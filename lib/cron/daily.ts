// Design Ref: §4.2 — 매일 아침 자동 실행: 수집 → 보관 → 정리 → 요약 → 메일 발송.
// 하나라도 막히면 거기서 멈추지 않고 가능한 만큼 진행한다. 수집이 전부 실패하면 "수집 실패" 안내 메일을 바로 보낸다.
// 보관함·메일·AI는 deps 로 받아 시험에서 가짜로 바꿔 끼운다.
import type { LlmFn } from "../answer/llm";
import { collectArticles, type CollectFailure, type CollectResult } from "../collect/collect";
import { startOfYesterdayKst } from "../collect/window";
import type { Article, NewArticle } from "../db/articles";
import type { CollectionFailure } from "../db/failures";
import type { Policy } from "../db/policies";
import { buildDigest, type Digest } from "../digest/build";
import { renderHtml, renderText } from "../digest/render";
import type { SendResult, MailMessage } from "../mail/send";
import { hasChanged, organizeArticles } from "../organize/organize";

export type DailyDeps = {
  collect: (since: Date, until: Date) => Promise<CollectResult>;
  insertNewArticles: (articles: NewArticle[]) => Promise<number>;
  recordFailure: (target: string, reason: string) => Promise<void>;
  listAllArticles: () => Promise<Article[]>;
  updateArticles: (articles: Article[]) => Promise<void>;
  deleteExpiredArticles: () => Promise<number>;
  listPolicies: () => Promise<Policy[]>;
  listFailuresSince: (since: string) => Promise<CollectionFailure[]>;
  sendMail: (message: MailMessage) => Promise<SendResult>;
  reportEmail: () => string;
  llm: LlmFn;
};

export type DailyOutcome =
  | { status: "sent"; items: number; collectFailures: number; steps: string[] }
  | { status: "collect-failed"; notified: boolean; steps: string[] }
  | { status: "send-failed"; error: string; steps: string[] }
  | { status: "error"; notified: boolean; steps: string[] };

/** 실제 보관함·수집기를 쓰는 기본 연결 (시험에서는 쓰지 않는다) */
export function realCollect(): DailyDeps["collect"] {
  return (since, until) => collectArticles({ since, until });
}

/** "오늘은 수집 실패" 안내 메일 */
export function buildFailureMail(date: string, failures: CollectFailure[], to: string): MailMessage {
  const lines = failures.map((f) => `${f.target}: ${f.reason.replace(/\s+/g, " ").slice(0, 80)}`);
  const text = ["오늘은 수집 실패: 기사를 가져오지 못해 아침 요약을 만들지 못했습니다.", "", ...lines.map((l) => `- ${l}`), "", "서버 기록에 남겼습니다. 잠시 뒤 다시 확인해 주세요."].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<p>오늘은 수집 실패: 기사를 가져오지 못해 아침 요약을 만들지 못했습니다.</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p>서버 기록에 남겼습니다. 잠시 뒤 다시 확인해 주세요.</p>`;
  return { to, subject: `[정책·언론 브리핑] ${date} 오늘은 수집 실패`, html, text };
}

const kstDateOf = (now: Date) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/** 수집 이후 단계(보관·정리·요약·발송). 오류가 나면 던지고, 바깥(runDailyDigest)에서 안내 메일로 바꾼다. */
async function runAfterCollect(now: Date, deps: DailyDeps, collected: CollectResult, steps: string[]): Promise<DailyOutcome> {
  const since = startOfYesterdayKst(now);

  // 2) 보관 + 오래된 기사 정리
  const inserted = await deps.insertNewArticles(collected.articles);
  steps.push(`새로 저장 ${inserted}건`);
  const removed = await deps.deleteExpiredArticles();
  steps.push(`보관 기간 지난 기사 삭제 ${removed}건`);

  // 3) 기사 정리 (중복 묶기·부처·조간석간)
  const before = await deps.listAllArticles();
  const after = organizeArticles(before);
  const toSave = after.filter((a, i) => hasChanged(before[i], a));
  await deps.updateArticles(toSave);
  steps.push(`정리 반영 ${toSave.length}건`);

  // 4) 요약 만들기
  const [policies, failures] = await Promise.all([deps.listPolicies(), deps.listFailuresSince(since.toISOString())]);
  const digest: Digest = await buildDigest({ now, articles: after, policies, failures, llm: deps.llm });
  steps.push(`요약 ${digest.totalItems}항목`);

  // 5) 발송 (실패 시 mail 모듈이 한 번 다시 보낸다)
  const sent = await deps.sendMail({ to: deps.reportEmail(), subject: digest.subject, html: renderHtml(digest), text: renderText(digest) });
  if (!sent.ok) {
    steps.push("메일 발송 실패");
    return { status: "send-failed", error: sent.error, steps };
  }
  steps.push("메일 발송 완료");
  return { status: "sent", items: digest.totalItems, collectFailures: collected.failures.length, steps };
}

export async function runDailyDigest(now: Date, deps: DailyDeps): Promise<DailyOutcome> {
  const steps: string[] = [];
  const since = startOfYesterdayKst(now);

  // 1) 수집 — 한 피드가 실패해도 나머지는 계속 모은다.
  const collected = await deps.collect(since, now);
  steps.push(`수집 ${collected.articles.length}건, 실패 피드 ${collected.failures.length}개`);
  for (const f of collected.failures) {
    try {
      await deps.recordFailure(f.target, f.reason);
    } catch {
      /* 기록 실패가 전체를 막지 않게 한다 */
    }
  }

  // 전부 실패: 요약을 만들 수 없으니 실패 안내를 즉시 보낸다. (8시 30분 이전)
  const allFailed = collected.perFeed.length > 0 && collected.failures.length === collected.perFeed.length;
  if (allFailed) {
    const sent = await deps.sendMail(buildFailureMail(kstDateOf(now), collected.failures, deps.reportEmail()));
    steps.push(`전부 실패 → 안내 메일 ${sent.ok ? "발송" : "발송 실패"}`);
    return { status: "collect-failed", notified: sent.ok, steps };
  }

  // 수집 이후 단계에서 보관함·설정 오류가 나도 조용히 끝내지 않고, 안내 메일을 보낸다. (메일이 0통인 날을 없앤다)
  try {
    return await runAfterCollect(now, deps, collected, steps);
  } catch (error) {
    steps.push(`오류: ${error instanceof Error ? error.message.slice(0, 80) : "알 수 없는 오류"}`);
    let notified = false;
    try {
      const sent = await deps.sendMail(
        buildFailureMail(kstDateOf(now), [{ target: "아침 요약 준비", reason: "보관함·설정 오류로 요약을 만들지 못했습니다" }], deps.reportEmail()),
      );
      notified = sent.ok;
    } catch {
      /* 받는 주소가 비어 있는 등 안내 메일도 못 보내는 경우: 서버 기록(steps)에만 남긴다 */
    }
    steps.push(`안내 메일 ${notified ? "발송" : "발송 실패"}`);
    return { status: "error", notified, steps };
  }
}
