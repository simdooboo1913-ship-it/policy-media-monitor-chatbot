// RSS 피드를 읽어 기사 목록으로 바꾼다. (보관함 접근 없음)
import { XMLParser } from "fast-xml-parser";
import { cleanHtml } from "./text";

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  /** 모아서 보여주는 피드(Google 뉴스)가 알려주는 원래 언론사. 없으면 빈 글자 */
  sourceName: string;
  sourceUrl: string;
};

export type FetchLike = typeof fetch;

// 글자가 숫자처럼 보여도 숫자로 바꾸지 않게 한다. (제목이 "2026"인 기사 등)
// 태그 속성은 <source url="..."> 의 주소를 읽기 위해 "@_" 를 붙여 함께 읽는다.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** 태그 안의 글자를 꺼낸다. 속성이 있는 태그는 { "#text": 글자, "@_속성": 값 } 모양이다. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const inner = (value as Record<string, unknown>)["#text"];
    if (typeof inner === "string") return inner;
  }
  return "";
}

function attribute(value: unknown, name: string): string {
  if (value && typeof value === "object") {
    const found = (value as Record<string, unknown>)[`@_${name}`];
    if (typeof found === "string") return found;
  }
  return "";
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
/** 피드 한 개 응답 크기 상한 (이보다 크면 버린다) */
const MAX_FEED_BYTES = 5 * 1024 * 1024;
/** 피드 한 개를 기다리는 시간. 피드를 동시에 받으므로 전체도 이 시간 안에 끝난다 (자동 실행 60초 제한 대비) */
const FEED_TIMEOUT_MS = 8000;

// 제어문자와 줄·문단 구분 문자 (유니코드 번호로 적어 둔다)
const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f\u2028\u2029]+", "g");

/** 줄바꿈·탭·제어문자를 공백 하나로 바꾸고 길이를 줄인다. */
export function oneLine(value: string, maxLength: number): string {
  const flat = value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  return flat.length > maxLength ? flat.slice(0, maxLength) : flat;
}

/** 기사 주소에서 추적용 값(utm_…)을 지운다. (같은 기사가 다른 주소로 보이는 것을 막기 위함) */
export function cleanLink(link: string): string {
  try {
    const url = new URL(link.trim());
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_")) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return link.trim();
  }
}

/** "+09:00" 처럼 쓴 시간대를 "+0900" 으로 맞춰 날짜로 읽을 수 있게 한다. */
export function normalizePubDate(pubDate: string): string {
  return pubDate.trim().replace(/([+-]\d{2}):(\d{2})$/, "$1$2");
}

/** RSS 글(XML)을 기사 목록으로 바꾼다. 형식이 예상과 다르면 오류를 던진다. */
export function parseRss(xml: string): RssItem[] {
  const channel = (parser.parse(xml) as { rss?: { channel?: { item?: unknown } } }).rss?.channel;
  if (!channel) throw new Error("RSS 형식이 아닙니다.");
  const raw = channel.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map((entry) => {
    const item = entry as Record<string, unknown>;
    const sourceName = text(item.source);
    let title = text(item.title);
    // Google 뉴스는 제목 끝에 " - 언론사"를 붙여 보낸다. 제목에서는 뗀다.
    if (sourceName && title.endsWith(` - ${sourceName}`)) {
      title = title.slice(0, -(` - ${sourceName}`).length);
    }
    return {
      // 제목·요약의 줄바꿈과 제어문자를 지우고 길이를 줄인다. (AI에게 넘기는 기사 목록에 가짜 기사 줄을 끼워 넣지 못하게 함)
      title: oneLine(title, MAX_TITLE_LENGTH),
      link: cleanLink(text(item.link)),
      description: oneLine(cleanHtml(text(item.description)), MAX_DESCRIPTION_LENGTH),
      pubDate: normalizePubDate(text(item.pubDate)),
      sourceName,
      sourceUrl: attribute(item.source, "url"),
    };
  });
}

/** 피드 주소에서 RSS를 받아 기사 목록으로 돌려준다. 오류 메시지에는 상태 번호만 넣는다. */
export async function fetchFeed(url: string, fetchImpl: FetchLike = fetch): Promise<RssItem[]> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; policy-monitor/1.0)" },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS), // 한 피드가 느려도 전체가 멈추지 않게 한다
  });
  if (!response.ok) throw new Error(`RSS 응답 오류 (HTTP ${response.status})`);
  const declared = Number(response.headers?.get?.("content-length") ?? 0);
  if (declared > MAX_FEED_BYTES) throw new Error("RSS 응답이 너무 큽니다.");
  const body = await response.text();
  if (body.length > MAX_FEED_BYTES) throw new Error("RSS 응답이 너무 큽니다.");
  return parseRss(body);
}
