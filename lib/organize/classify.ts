// Design Ref: §4.4 — "가장 주요하게 언급된 부처" 판정.
// 제목과 요약문에서 부처 이름(줄임말 포함)이 나온 횟수를 센다. 제목을 먼저 보고, 제목에 없을 때만 요약문을 본다.
// 둘 다 없으면 검색에 걸린 부처가 하나뿐일 때만 그 부처로 정한다.
import { MINISTRY_QUERIES } from "../collect/queries";
import { MINISTRIES, type Ministry } from "../ministries";

type Mention = { count: number; firstIndex: number };

/** 글자 안에서 부처별로 몇 번, 어디서 처음 나왔는지 센다. */
function countMentions(text: string): Map<Ministry, Mention> {
  const result = new Map<Ministry, Mention>();
  for (const ministry of MINISTRIES) {
    let count = 0;
    let firstIndex = Number.POSITIVE_INFINITY;
    for (const alias of MINISTRY_QUERIES[ministry]) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(alias, from);
        if (at < 0) break;
        count++;
        firstIndex = Math.min(firstIndex, at);
        from = at + alias.length;
      }
    }
    if (count > 0) result.set(ministry, { count, firstIndex });
  }
  return result;
}

/** 많이 나온 부처, 같으면 먼저 나온 부처를 고른다. */
function strongest(mentions: Map<Ministry, Mention>): Ministry | null {
  let best: Ministry | null = null;
  for (const [ministry, mention] of mentions) {
    const current = best === null ? null : mentions.get(best)!;
    if (
      current === null ||
      mention.count > current.count ||
      (mention.count === current.count && mention.firstIndex < current.firstIndex)
    ) {
      best = ministry;
    }
  }
  return best;
}

export function classifyMinistry(
  title: string,
  summary: string,
  searchHits: Ministry[],
): { primary: Ministry | null; mentioned: Ministry[] } {
  const inTitle = countMentions(title);
  const inSummary = countMentions(summary);

  let primary: Ministry | null = strongest(inTitle) ?? strongest(inSummary);
  if (primary === null && new Set(searchHits).size === 1) primary = searchHits[0];

  // 주요 부처 외에 언급되거나 검색에 걸린 부처는 "함께 언급된 부처"로 적는다.
  const mentioned = MINISTRIES.filter(
    (m) => m !== primary && (inTitle.has(m) || inSummary.has(m) || searchHits.includes(m)),
  );
  return { primary, mentioned };
}
