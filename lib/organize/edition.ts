// Design Ref: §11 — 조간·석간 나누기 (임시 기준, 경계 시각은 평가관이 확정한다)
//
// 포털 기사에는 조간·석간 표시가 없으므로 발행 시각(한국 시간)으로 나눈다:
//   조간 = 전날 18시 ~ 당일 12시 에 발행된 기사 → 당일자 조간
//   석간 = 당일 12시 ~ 18시 에 발행된 기사     → 당일자 석간
// 경계를 바꾸려면 아래 두 숫자만 고치면 된다.
import type { Edition } from "../db/articles";

/** 이 시각(한국 시간) 이전에 발행된 기사는 당일 조간, 이 시각부터는 석간 */
export const MORNING_EDITION_END_HOUR = 12;
/** 이 시각(한국 시간) 이후에 발행된 기사는 다음 날짜 조간 */
export const EVENING_EDITION_END_HOUR = 18;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** 발행 시각으로 조간/석간과, 그 신문의 날짜("YYYY-MM-DD", 한국 날짜)를 정한다. */
export function editionOf(publishedAt: string): { edition: Edition; date: string } {
  const kstMs = new Date(publishedAt).getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const hour = kst.getUTCHours();
  if (hour >= EVENING_EDITION_END_HOUR) {
    return { edition: "조간", date: formatDate(kstMs + DAY_MS) }; // 저녁에 나온 기사는 다음 날 조간
  }
  if (hour >= MORNING_EDITION_END_HOUR) {
    return { edition: "석간", date: formatDate(kstMs) };
  }
  return { edition: "조간", date: formatDate(kstMs) };
}
