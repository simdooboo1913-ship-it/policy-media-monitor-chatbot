// Design Ref: §4.4 — 질문에서 키워드를 뽑고, 보관함 기사 중 근거 후보를 찾는다. (보관함 접근 없음, AI 호출 없음)
import type { Article } from "../db/articles";

/** 후보로 쓰는 기사 수 상한 (DESIGN 4.4는 20건이지만, 응답 속도를 위해 12건으로 줄였다) */
export const MAX_CANDIDATES = 12;

/** 수집 대상이 아닌 채널을 가리키는 단어 (DESIGN 4.4, 개발하면서 보완) */
const UNSUPPORTED_CHANNEL_WORDS = [
  "유튜브", "영상", "SNS", "트위터", "페이스북", "인스타", "국무회의 중계", "누리집", "홈페이지", "블로그", "카카오톡",
];

/** 질문이 수집 대상이 아닌 채널을 묻고 있는지 */
export function mentionsUnsupportedChannel(question: string): boolean {
  const q = question.toLowerCase();
  if (/(^|[^a-z])x(에|의|계정|게시|[^a-z]|$)/i.test(question) && /계정|게시|트윗|포스트/.test(question)) return true;
  return UNSUPPORTED_CHANNEL_WORDS.some((w) => q.includes(w.toLowerCase()));
}

// 질문에서 뜻이 없는 말(조사·요청 표현)을 걷어낸다.
const STOPWORDS = new Set([
  "소식", "평가", "정책", "계획", "사실", "성공적", "발견", "일정", "알려줘", "알려주세요", "알려", "관련", "대해", "대한", "최근", "뉴스", "기사", "어떤", "어때", "있어", "있나요", "무엇",
  "현황", "동향", "내용", "정리", "요약", "보여줘", "해줘", "해주세요", "오늘", "어제", "무슨", "얼마나", "어떻게",
]);
const MINISTRY_ALIASES = ["과기정통부", "과기부", "국토부", "우주청"];
const PARTICLES = ["인가요", "있나요", "해줘", "이야", "나요", "에서는", "에서", "으로", "에게", "까지", "부터", "에는", "이다", "인가", "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과", "도", "만"];

/** 질문에서 검색 키워드(최대 5개)를 뽑는다. 부처 이름은 이미 부처를 골랐으므로 뺀다. */
export function extractKeywords(question: string, ministryNames: readonly string[] = [], limit = 5): string[] {
  const tokens = question
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let token of tokens) {
    for (const p of PARTICLES) {
      if (token.length > p.length + 1 && token.endsWith(p)) {
        token = token.slice(0, -p.length);
        break;
      }
    }
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    // 부처 이름·줄임말 자체만 뺀다. ("조달" 같은 일반 단어는 부처 이름의 일부여도 키워드로 쓴다)
    if ([...ministryNames, ...MINISTRY_ALIASES].some((m) => token === m)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, limit);
}

/** 기사 제목·요약문에 들어 있는 키워드 수 */
export function matchCount(article: Pick<Article, "title" | "summary">, keywords: string[]): number {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return keywords.filter((k) => text.includes(k.toLowerCase())).length;
}

/**
 * 근거 후보 찾기: 겹치는 키워드가 많은 순(같으면 최신순)으로 상위 20건.
 * 키워드가 하나도 안 뽑힌 질문("최근 동향")은 최신 기사 순으로 쓴다.
 * 키워드가 있는데 하나도 겹치지 않으면 빈 목록(= 근거 없음).
 */
export function findCandidates(articles: Article[], keywords: string[]): Article[] {
  const byNewest = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (keywords.length === 0) return byNewest.slice(0, MAX_CANDIDATES);
  return byNewest
    .map((article) => ({ article, score: matchCount(article, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score) // 정렬은 안정적이라 같은 점수는 최신순이 유지된다
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.article);
}
