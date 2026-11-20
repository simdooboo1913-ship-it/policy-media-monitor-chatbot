// Design Ref: §5 — AI 답변을 서버가 검사한다. 통과하지 못한 답변은 사용하지 않는다.
// AI는 "문장 + 기사 번호 목록"만 낸다. 링크는 서버가 번호로 붙인다.
import type { Article } from "../db/articles";

export type AnswerSentence = { text: string; sources: number[] };
/** AI가 "관련 기사가 없다"며 문장을 하나도 내지 않은 경우의 사유. 오류가 아니므로 다시 호출하지 않는다. */
export const NO_SENTENCES_REASON = "문장이 없음";

export type VerifyResult = { ok: true; sentences: AnswerSentence[] } | { ok: false; reason: string };

const MAX_SENTENCES = 8;
const MAX_SENTENCE_LENGTH = 200;
const MAX_SOURCES_PER_SENTENCE = 5;
/** 기사 제목·요약문에서 이 글자 수 이상 그대로 옮기면 "전문 옮기기"로 보고 버린다 */
const MAX_VERBATIM_RUN = 40;

/** 평가·전망·진위 판정 표현 (DESIGN 5장, 개발하면서 보완) */
export const FORBIDDEN_EXPRESSIONS = [
  "성공적", "우려된다", "우려가", "바람직", "미흡", "훌륭", "전망된다", "전망이다", "기대된다", "예상된다",
  "것으로 보인다", "거짓", "허위", "사실이 아니", "사실로 확인", "잘못된",
];

export function numbersIn(text: string): string[] {
  return (text.replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []);
}

function hasLongVerbatimRun(text: string, source: string): boolean {
  const compact = (s: string) => s.replace(/\s+/g, "");
  const t = compact(text);
  const s = compact(source);
  if (t.length < MAX_VERBATIM_RUN) return false;
  for (let i = 0; i + MAX_VERBATIM_RUN <= t.length; i++) {
    if (s.includes(t.slice(i, i + MAX_VERBATIM_RUN))) return true;
  }
  return false;
}

/**
 * AI가 낸 글자(JSON)를 검사한다.
 * candidates: AI에게 번호를 붙여 보여 준 기사들 (번호 n = candidates[n-1])
 */
export function verifyAnswer(raw: string, candidates: Pick<Article, "title" | "summary">[]): VerifyResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "JSON 형식이 아님" };
  }
  const list = (data as { sentences?: unknown })?.sentences;
  if (!Array.isArray(list)) return { ok: false, reason: "형식이 다름" };
  if (list.length === 0) return { ok: false, reason: NO_SENTENCES_REASON };
  // 문장이 너무 많으면 앞의 문장만 쓴다. (AI가 길게 쓴다고 답변 전체를 버려 다시 호출하면 느려진다)

  // 문장마다 검사한다. 걸린 문장은 버리고 통과한 문장만 쓴다. (하나도 남지 않으면 답변 전체를 거부)
  const sentences: AnswerSentence[] = [];
  const seen = new Set<string>();
  let lastReason = "문장이 없음";
  for (const item of list.slice(0, MAX_SENTENCES)) {
    const reason = checkSentence(item, candidates);
    if (typeof reason === "string") {
      lastReason = reason;
      continue;
    }
    if (seen.has(reason.text)) continue;
    seen.add(reason.text);
    sentences.push(reason);
  }
  return sentences.length > 0 ? { ok: true, sentences } : { ok: false, reason: lastReason };
}

/** 문장 하나를 검사한다. 통과하면 문장을, 아니면 거부 사유(글자)를 돌려준다. */
function checkSentence(item: unknown, candidates: Pick<Article, "title" | "summary">[]): AnswerSentence | string {
  const text = typeof (item as { text?: unknown })?.text === "string" ? (item as { text: string }).text.trim() : "";
  const sources = (item as { sources?: unknown })?.sources;
  if (text === "") return "빈 문장";
  if (text.length > MAX_SENTENCE_LENGTH) return "문장이 너무 김";
  if (!Array.isArray(sources) || sources.length === 0) return "출처 번호 없음";
  if (sources.length > MAX_SOURCES_PER_SENTENCE) return "출처 번호가 너무 많음";
  const nums: number[] = [];
  for (const n of sources) {
    if (!Number.isInteger(n) || n < 1 || n > candidates.length) return "없는 기사 번호";
    if (!nums.includes(n as number)) nums.push(n as number);
  }
  if (/https?:\/\/|www\./i.test(text)) return "문장 안에 링크";
  if (FORBIDDEN_EXPRESSIONS.some((w) => text.includes(w))) return "평가·전망·진위 표현";

  const sourceText = nums.map((n) => `${candidates[n - 1].title} ${candidates[n - 1].summary}`).join(" ");
  const sourceNumbers = new Set(numbersIn(sourceText));
  if (numbersIn(text).some((x) => !sourceNumbers.has(x))) return "기사에 없는 숫자";
  if (hasLongVerbatimRun(text, sourceText)) return "기사 문장을 길게 그대로 옮김";
  // 출처가 둘 이상인데 어떤 출처에는 문장의 숫자가 없고 그 출처가 다른 숫자를 말하고 있으면, 상충하는 내용을 한 문장으로 합친 것이다. (PRD: 합치지 않는다)
  if (nums.length > 1) {
    const sentenceNumbers = new Set(numbersIn(text));
    for (const n of nums) {
      const own = new Set(numbersIn(`${candidates[n - 1].title} ${candidates[n - 1].summary}`));
      const missing = [...sentenceNumbers].some((x) => !own.has(x));
      const different = [...own].some((x) => !sentenceNumbers.has(x));
      if (missing && different) return "출처마다 수치가 달라 한 문장으로 합침";
    }
  }
  return { text, sources: nums };
}
