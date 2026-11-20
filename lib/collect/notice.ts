// Design Ref: §3.2, §4.3 — 수집 실패 기록을 답변·요약에 붙일 "수집 안내" 문구로 바꾼다.
// 보관함 접근 없음(순수 함수). 같은 대상이 여러 번 실패했으면 가장 최근 1건만 보여준다.
import type { CollectionFailure } from "../db/failures";

/** 출처 검사에서 링크 없이 허용하는 고정 문구의 머리말 (DESIGN 5장) */
export const COLLECTION_NOTICE_HEADING = "수집 안내: 일부 자료를 수집하지 못했습니다.";

export type CollectionNotice = {
  heading: string;
  /** 수집하지 못한 대상(피드 이름)과 사유, 최신순 */
  items: { target: string; reason: string; occurredAt: string }[];
};

/** 사유는 한 줄로 줄이고 너무 길면 자른다. (화면·메일에 긴 오류 문구가 그대로 나가지 않게) */
const MAX_REASON_LENGTH = 80;

function shorten(reason: string): string {
  const oneLine = reason.replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_REASON_LENGTH ? `${oneLine.slice(0, MAX_REASON_LENGTH)}…` : oneLine;
}

/** 실패 기록이 없으면 null(안내를 보여주지 않음). */
export function buildCollectionNotice(failures: CollectionFailure[]): CollectionNotice | null {
  const latest = new Map<string, CollectionFailure>();
  for (const f of failures) {
    const prev = latest.get(f.target);
    if (!prev || f.occurredAt > prev.occurredAt) latest.set(f.target, f);
  }
  if (latest.size === 0) return null;
  const items = [...latest.values()]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.target.localeCompare(b.target))
    .map((f) => ({ target: f.target, reason: shorten(f.reason), occurredAt: f.occurredAt }));
  return { heading: COLLECTION_NOTICE_HEADING, items };
}

/** 메일·글자 전용 화면에서 쓰는 한 덩어리 문구 */
export function noticeToText(notice: CollectionNotice): string {
  return [notice.heading, ...notice.items.map((i) => `- ${i.target}: ${i.reason}`)].join("\n");
}
