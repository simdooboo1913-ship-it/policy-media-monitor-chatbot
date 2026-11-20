// 수집한 기사 글자를 다듬는 작은 도구들. (네트워크·보관함 접근 없음)

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  nbsp: " ",
};

/** 검색 결과의 <b> 같은 태그를 지우고 &quot; 같은 표기를 원래 글자로 되돌린다. */
export function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** 기사 주소에서 발행처로 쓸 도메인을 뽑는다. (예: https://www.chosun.com/a → chosun.com) 주소가 이상하면 null */
export function publisherOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Google 뉴스가 보내는 "연결 주소"(원문 주소가 아님)인지 확인한다. */
export function isGoogleNewsLink(url: string): boolean {
  return publisherOf(url) === "news.google.com";
}

/** 글자 중 한글의 비율(0~1). 글자가 하나도 없으면 0. */
export function hangulRatio(text: string): number {
  const letters = text.match(/[A-Za-zㄱ-ㆎ가-힣À-ɏЀ-ӿ぀-ヿ一-鿿]/g);
  if (!letters || letters.length === 0) return 0;
  const hangul = letters.filter((ch) => /[ㄱ-ㆎ가-힣]/.test(ch)).length;
  return hangul / letters.length;
}
