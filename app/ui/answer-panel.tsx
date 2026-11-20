// Design Ref: §3.2 — 답변이 나오는 칸. 조간/석간 구분, 문장마다 출처 번호, 출처 목록(링크), 국정과제 연관성.
// 부처 버튼을 누르면 질문 전에 그 부처의 최신 기사 목록을 먼저 보여준다. (AI 없이 보관함만 읽어 빠르다)
import type { AskResult } from "@/lib/answer/ask";
import type { PolicyLink } from "@/lib/answer/policy";
import { publisherName } from "@/lib/export/publisher";
import { MINISTRY_SHORT, type Ministry } from "@/lib/ministries";

export type NewsItem = {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  edition: "조간" | "석간";
  editionDate: string;
  duplicateCount: number;
};

export type AnswerState =
  | { kind: "idle" }
  | { kind: "news-loading"; ministry: string }
  | { kind: "news"; ministry: string; items: NewsItem[] }
  | { kind: "news-error"; ministry: string; message: string }
  | { kind: "loading"; ministry: string; question: string }
  | { kind: "error"; ministry: string; question: string; message: string }
  | { kind: "done"; ministry: string; question: string; result: AskResult; policy: PolicyLink | "loading" | null };

function formatDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

const muted = "text-violet-200/70";
const errorBox = "rounded-xl bg-rose-500/20 p-3 text-rose-100";

function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return <p className="rounded-xl bg-white/10 p-3">신규 동향 없음</p>;
  // 조간/석간(날짜 포함)별로 묶는다. 최신 신문이 위.
  const groups = new Map<string, { label: string; items: NewsItem[] }>();
  for (const item of [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const key = `${item.editionDate}-${item.edition === "조간" ? 0 : 1}`;
    const g = groups.get(key) ?? { label: `${formatDate(item.editionDate)} ${item.edition}`, items: [] };
    g.items.push(item);
    groups.set(key, g);
  }
  return (
    <div className="space-y-3">
      {[...groups.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, g]) => (
          <div key={key} className="rounded-xl border border-white/15 bg-white/5 p-3">
            <h3 className={`mb-2 text-xs font-semibold ${muted}`}>{g.label}</h3>
            <ul className="space-y-2">
              {g.items.map((item) => (
                <li key={item.url}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline decoration-cyan-300/50 hover:text-cyan-200">
                    {item.title}
                  </a>
                  <span className={`ml-1 text-xs ${muted}`}>
                    · {publisherName(item.publisher)} · {formatTime(item.publishedAt)}
                    {item.duplicateCount > 1 ? ` · 같은 내용 ${item.duplicateCount}건` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

function Answer({ result }: { result: AskResult }) {
  const byNumber = new Map(result.sources.map((s) => [s.n, s]));
  const groups = new Map<string, { label: string; key: string; sentences: typeof result.sentences }>();
  for (const sentence of result.sentences) {
    const src = byNumber.get(sentence.sources[0]);
    if (!src) continue;
    const key = `${src.editionDate}-${src.edition === "조간" ? 0 : 1}`;
    const group = groups.get(key) ?? { key, label: `${formatDate(src.editionDate)} ${src.edition}`, sentences: [] };
    group.sentences.push(sentence);
    groups.set(key, group);
  }
  const ordered = [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));

  return (
    <div className="space-y-4">
      {ordered.map((group) => (
        <div key={group.key} className="rounded-xl border border-white/15 bg-white/5 p-3">
          <h3 className={`mb-2 text-xs font-semibold ${muted}`}>{group.label}</h3>
          <ul className="space-y-2">
            {group.sentences.map((s, i) => (
              <li key={i}>
                {s.text}{" "}
                <span className="text-xs font-bold text-pink-300">{s.sources.map((n) => `[${n}]`).join("")}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className={`mb-1 text-xs font-semibold ${muted}`}>출처</h3>
        <ol className="space-y-1 text-xs">
          {result.sources.map((s) => (
            <li key={s.n}>
              [{s.n}]{" "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline decoration-cyan-300/50 hover:text-cyan-200">
                {s.title}
              </a>{" "}
              · {publisherName(s.publisher)} · {formatTime(s.publishedAt)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function PolicyBox({ policy }: { policy: PolicyLink | "loading" }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs">
      <h3 className={`mb-1 font-semibold ${muted}`}>국정과제 연관성</h3>
      {policy === "loading" ? (
        <p className={muted}>찾는 중입니다…</p>
      ) : policy.status === "found" ? (
        <>
          <p className="text-sm font-medium">
            {policy.number}번 · {policy.name}
          </p>
          <p className="mt-1">&ldquo;{policy.quote}&rdquo;</p>
          <p className={`mt-1 ${muted}`}>
            출처: {policy.sourceFile}
            {policy.page ? ` ${policy.page}쪽` : ""}
          </p>
        </>
      ) : (
        <p>{policy.message}</p>
      )}
    </div>
  );
}

export default function AnswerPanel({ state }: { state: AnswerState }) {
  return (
    <section
      aria-label="답변"
      aria-live="polite"
      className="glass min-h-64 p-5"
    >
      {state.kind === "idle" ? (
        <p className={`text-sm ${muted}`}>
          👆 위에서 부처를 고르면 최신 기사가 바로 나와요! 질문을 입력하면 수집된 기사만 근거로 답하고,
          근거가 없으면 &quot;확인된 자료가 없습니다&quot;라고 답해요.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className={muted}>
            선택한 부처: <span className="font-bold text-fuchsia-300">{MINISTRY_SHORT[state.ministry as Ministry] ?? state.ministry}</span>
          </p>
          {state.kind === "news-loading" && <p className={muted}>최신 기사를 불러오는 중입니다…</p>}
          {state.kind === "news-error" && <p className={errorBox}>{state.message}</p>}
          {state.kind === "news" && (
            <>
              <p className="text-xs font-semibold">최신 기사 (전날 0시부터, 같은 내용을 많이 보도한 순)</p>
              <NewsList items={state.items} />
            </>
          )}
          {(state.kind === "loading" || state.kind === "error" || state.kind === "done") && (
            <p className="font-medium">질문: {state.question}</p>
          )}
          {state.kind === "loading" && <p className={muted}>답변을 만드는 중입니다…</p>}
          {state.kind === "error" && <p className={errorBox}>{state.message}</p>}
          {state.kind === "done" && (
            <>
              {state.result.notices.map((n) => (
                <p key={n} className="rounded-xl bg-amber-400/20 p-3 text-amber-100">
                  {n}
                </p>
              ))}
              {state.result.status === "ok" ? (
                <Answer result={state.result} />
              ) : (
                <p className="rounded-xl bg-white/10 p-3">{state.result.message}</p>
              )}
              {state.policy && <PolicyBox policy={state.policy} />}
              {state.result.otherMinistries.length > 0 && (
                <p className={`text-xs ${muted}`}>
                  관련 기사 있음: {state.result.otherMinistries.map((o) => `${MINISTRY_SHORT[o.ministry as Ministry] ?? o.ministry} ${o.count}건`).join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
