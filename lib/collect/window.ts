// 수집할 기간 계산. 한국 시간(KST, UTC+9)을 기준으로 한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금을 기준으로 "전날 0시(한국 시간)"의 시각을 돌려준다. (PRD: 전날 0시부터 수집) */
export function startOfYesterdayKst(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const midnightKstAsUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - 1);
  return new Date(midnightKstAsUtc - KST_OFFSET_MS);
}
