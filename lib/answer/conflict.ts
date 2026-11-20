// 서로 다른 출처의 내용이 상충할 때 하나로 합치지 않고 알리기 위한 서버 검사. (PRD 5번 질의응답 규칙)
// 뜻을 읽어 비교하지는 못하므로, 같은 주제로 보이는 기사 쌍에서 "서로 다른 큰 숫자"가 나오는 경우를 찾아 알려 준다.
import type { Article } from "../db/articles";
import { bigrams, titleSimilarity } from "../organize/organize";
import { numbersIn } from "./verify";

/** 제목이 이 정도 이상 비슷하면 같은 주제로 본다 (중복 묶기 기준 0.8보다 낮게 잡는다) */
const SAME_TOPIC_SIMILARITY = 0.3;
const MAX_CONFLICT_NOTICES = 2;

/** 날짜·시각 같은 작은 숫자는 빼고, 세 자리 이상이거나 소수점이 있는 숫자만 비교한다. */
export function bigNumbers(text: string): Set<string> {
  return new Set(numbersIn(text).filter((n) => n.length >= 3 || n.includes(".")));
}

/**
 * 답변에 쓰인 기사들 중 같은 주제인데 수치가 서로 다른 쌍을 찾아 안내 문구로 돌려준다.
 * used: [기사 번호, 기사] 목록 (번호는 화면의 출처 번호)
 */
export function findConflictNotices(used: { n: number; article: Pick<Article, "title" | "summary"> }[]): string[] {
  const notices: string[] = [];
  for (let i = 0; i < used.length && notices.length < MAX_CONFLICT_NOTICES; i++) {
    for (let j = i + 1; j < used.length && notices.length < MAX_CONFLICT_NOTICES; j++) {
      const a = used[i];
      const b = used[j];
      if (titleSimilarity(bigrams(a.article.title), bigrams(b.article.title)) < SAME_TOPIC_SIMILARITY) continue;
      const numsA = bigNumbers(`${a.article.title} ${a.article.summary}`);
      const numsB = bigNumbers(`${b.article.title} ${b.article.summary}`);
      const onlyA = [...numsA].filter((x) => !numsB.has(x));
      const onlyB = [...numsB].filter((x) => !numsA.has(x));
      if (onlyA.length > 0 && onlyB.length > 0) {
        notices.push(
          `출처 [${a.n}]과 [${b.n}]은 같은 주제인데 수치가 다릅니다 ([${a.n}] ${onlyA.slice(0, 2).join(", ")} / [${b.n}] ${onlyB.slice(0, 2).join(", ")}). 하나로 합치지 않고 각각의 출처와 함께 보여 드리니 원문을 확인해 주세요.`,
        );
      }
    }
  }
  return notices;
}
