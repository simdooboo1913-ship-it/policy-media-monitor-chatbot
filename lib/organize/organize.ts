// Design Ref: §4.4 — 기사 정리: 중복 묶기 → 주요 부처 분류 → 조간·석간 나누기.
// 보관함의 기사들을 받아 정리한 결과를 돌려준다. (보관함 접근 없음, 여러 번 해도 같은 결과가 나온다)
import { isGoogleNewsLink } from "../collect/text";
import type { Article } from "../db/articles";
import type { Ministry } from "../ministries";
import { classifyMinistry } from "./classify";
import { editionOf } from "./edition";

/** 제목의 글자(bigram) 겹침이 이 값 이상이면 같은 기사로 본다 (DESIGN 4.4: 80%) */
export const SIMILARITY_THRESHOLD = 0.8;
/** 대표 기사와 발행 시각 차이가 이 시간 이내여야 묶는다 (DESIGN 4.4: 24시간) */
export const DUPLICATE_WINDOW_HOURS = 24;

const WINDOW_MS = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;

/** 제목에서 한글·영문·숫자만 남기고 두 글자씩 끊어 센다. */
function bigrams(title: string): Map<string, number> {
  const letters = title.toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
  const counts = new Map<string, number>();
  if (letters.length === 0) return counts;
  if (letters.length === 1) return counts.set(letters, 1);
  for (let i = 0; i < letters.length - 1; i++) {
    const gram = letters.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** 두 제목이 얼마나 겹치는지 (0~1, Dice 계수) */
export function titleSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let totalA = 0;
  let totalB = 0;
  let shared = 0;
  for (const count of a.values()) totalA += count;
  for (const count of b.values()) totalB += count;
  if (totalA === 0 || totalB === 0) return 0;
  for (const [gram, count] of a) shared += Math.min(count, b.get(gram) ?? 0);
  return (2 * shared) / (totalA + totalB);
}

type Group = { rep: Article; repGrams: Map<string, number>; members: Article[] };

export function organizeArticles(articles: Article[]): Article[] {
  // 발행이 이른 순으로 보며 같은 기사끼리 묶는다. (묶은 뒤 대표 기사는 아래에서 고른다)
  const sorted = [...articles].sort(
    (a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id),
  );

  // 1) 중복 묶기 — 대표 기사 발행 후 24시간 이내의 기사만 비교한다.
  const groups: Group[] = [];
  let firstActive = 0; // 이 위치 앞의 묶음은 24시간이 지나 더 이상 비교하지 않는다
  for (const article of sorted) {
    const time = new Date(article.publishedAt).getTime();
    while (
      firstActive < groups.length &&
      time - new Date(groups[firstActive].rep.publishedAt).getTime() > WINDOW_MS
    ) {
      firstActive++;
    }
    const grams = bigrams(article.title);
    let best: Group | null = null;
    let bestScore = SIMILARITY_THRESHOLD;
    for (let i = firstActive; i < groups.length; i++) {
      const score = titleSimilarity(grams, groups[i].repGrams);
      if (score >= bestScore) {
        best = groups[i];
        bestScore = score;
      }
    }
    if (best) best.members.push(article);
    else groups.push({ rep: article, repGrams: grams, members: [] });
  }

  // 2~3) 묶음마다 주요 부처를 정하고, 조간·석간을 나눈다.
  const result = new Map<string, Article>();
  for (const group of groups) {
    const all = [group.rep, ...group.members];
    // 대표 기사: 언론사 원문 주소가 있는 기사를 먼저, 그다음 가장 먼저 발행된 기사.
    // (Google 뉴스는 요약문이 없고 링크가 연결 주소라서, 같은 기사가 언론사 RSS에도 있으면 그쪽을 대표로 한다)
    const rep = [...all].sort(
      (a, b) =>
        Number(isGoogleNewsLink(a.url)) - Number(isGoogleNewsLink(b.url)) ||
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.id.localeCompare(b.id),
    )[0];
    const members = all.filter((a) => a.id !== rep.id);
    // 검색에 걸린 부처 정보: 이전 정리 결과(주요·함께 언급된 부처)도 같은 정보로 이어받아, 다시 정리해도 결과가 같게 한다.
    const hits = new Set<Ministry>();
    for (const a of all) {
      for (const m of a.mentionedMinistries) hits.add(m);
      if (a.ministry) hits.add(a.ministry);
    }
    const { primary, mentioned } = classifyMinistry(rep.title, rep.summary, [...hits]);

    result.set(rep.id, {
      ...rep,
      ministry: primary,
      mentionedMinistries: mentioned,
      edition: editionOf(rep.publishedAt).edition,
      duplicateCount: all.length,
      duplicateOf: null,
    });
    for (const member of members) {
      result.set(member.id, {
        ...member,
        ministry: primary,
        mentionedMinistries: mentioned,
        edition: editionOf(member.publishedAt).edition, // 대표 기사가 지워져도 자기 값을 갖도록 따로 계산해 둔다
        duplicateCount: 1,
        duplicateOf: rep.id,
      });
    }
  }

  return articles.map((a) => result.get(a.id) ?? a);
}

/** 정리 결과가 정리 전과 달라졌는지 (달라진 기사만 보관함에 다시 저장하기 위해 쓴다) */
export function hasChanged(before: Article, after: Article): boolean {
  return (
    before.ministry !== after.ministry ||
    before.edition !== after.edition ||
    before.duplicateCount !== after.duplicateCount ||
    before.duplicateOf !== after.duplicateOf ||
    before.mentionedMinistries.join(",") !== after.mentionedMinistries.join(",")
  );
}
