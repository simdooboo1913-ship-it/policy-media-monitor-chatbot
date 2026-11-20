// Design Ref: §4.2 — RSS 피드에서 기사를 모아, 부처 이름이 나오는 기사 중 정해진 기간(since~until)의 기사만 돌려준다.
// 이 파일은 기사를 "모으기"만 한다. 부처 분류·조간석간 나누기·중복 묶기는 개발 순서 7번(lib/organize), 보관함 저장은 호출하는 쪽에서 한다.
import type { NewArticle } from "../db/articles";
import { MINISTRIES, type Ministry } from "../ministries";
import { FEEDS, type FeedSource } from "./feeds";
import { MINISTRY_QUERIES } from "./queries";
import { fetchFeed, type FetchLike } from "./rss";
import { hangulRatio, publisherOf } from "./text";

// 제목에 한글이 이 비율보다 적으면 외국어 기사로 보고 제외한다. (PRD 비범위: 외국어 자료, DESIGN 5장)
const MIN_HANGUL_RATIO = 0.3;

export type CollectFailure = { target: string; reason: string };

export type CollectStats = {
  fetched: number; // 피드에서 받은 기사 수
  kept: number; // 최종으로 남은 기사 수
  irrelevant: number; // 대상 부처 이름이 없어 제외한 수
  outOfWindow: number; // 정해진 기간 밖이라 제외한 수
  foreign: number; // 외국어라 제외한 수
  invalid: number; // 주소·날짜가 이상해 제외한 수
  duplicated: number; // 같은 주소라 합친 수
};

export type CollectResult = {
  articles: NewArticle[];
  failures: CollectFailure[]; // 수집에 실패한 부분 (답변·요약에 알리기 위해 기록한다)
  stats: CollectStats;
  perFeed: { feed: string; fetched: number; kept: number }[]; // 피드별 결과 (점검용)
};

export type CollectOptions = {
  since: Date; // 이 시각 이후에 발행된 기사만
  until: Date; // 이 시각 이전에 발행된 기사만
  feeds?: FeedSource[]; // 시험할 때 다른 피드를 쓰기 위한 자리 (기본: lib/collect/feeds.ts)
  fetchImpl?: FetchLike; // 시험할 때 가짜 응답을 넣기 위한 자리
};

/** 글자에 이름(줄임말 포함)이 나오는 부처들을 정해진 순서로 돌려준다. */
function ministriesIn(text: string): Ministry[] {
  return MINISTRIES.filter((m) => MINISTRY_QUERIES[m].some((alias) => text.includes(alias)));
}

export async function collectArticles(options: CollectOptions): Promise<CollectResult> {
  const feeds = options.feeds ?? FEEDS;
  const byUrl = new Map<string, NewArticle>();
  const failures: CollectFailure[] = [];
  const perFeed: CollectResult["perFeed"] = [];
  const stats: CollectStats = {
    fetched: 0,
    kept: 0,
    irrelevant: 0,
    outOfWindow: 0,
    foreign: 0,
    invalid: 0,
    duplicated: 0,
  };

  // 피드는 동시에 받는다. (차례로 받으면 느린 피드가 겹쳐 자동 실행 제한 시간을 넘길 수 있다)
  // 결과는 피드 순서대로 처리해, 같은 기사가 여러 피드에 있을 때 앞선 피드가 우선하는 규칙을 유지한다.
  const responses = await Promise.all(
    feeds.map(async (feed) => {
      try {
        return { feed, items: await fetchFeed(feed.url, options.fetchImpl), error: null as unknown };
      } catch (error) {
        return { feed, items: null, error };
      }
    }),
  );

  for (const { feed, items, error } of responses) {
    const label = `${feed.site} ${feed.name}`;
    if (items === null) {
      // 한 피드가 실패해도 나머지는 계속 모은다. 실패는 기록해 두었다가 알린다.
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      failures.push({ target: `RSS ${label}`, reason });
      perFeed.push({ feed: label, fetched: 0, kept: 0 });
      continue;
    }

    let kept = 0;
    for (const item of items) {
      stats.fetched++;
      // 발행처: Google 뉴스처럼 모아 보여주는 피드는 원래 언론사 주소(sourceUrl)를, 그 밖에는 기사 주소를 쓴다.
      const publisher = publisherOf(item.sourceUrl || item.link);
      const published = new Date(item.pubDate);
      // 링크는 http/https 만 받는다. (화면·메일 링크에 이상한 형식이 들어가지 않게 함)
      if (!/^https?:\/\//i.test(item.link) || !publisher || item.title === "" || Number.isNaN(published.getTime())) {
        stats.invalid++;
        continue;
      }
      if (published < options.since || published > options.until) {
        stats.outOfWindow++;
        continue;
      }
      if (hangulRatio(item.title) < MIN_HANGUL_RATIO) {
        stats.foreign++;
        continue;
      }
      // 제목이나 요약에 대상 부처 이름이 있는 기사만 남긴다. 부처 이름으로 검색한 피드는 그 부처에 걸린 기사로 본다.
      const mentioned = MINISTRIES.filter(
        (m) => m === feed.ministry || ministriesIn(`${item.title}\n${item.description}`).includes(m),
      );
      if (mentioned.length === 0) {
        stats.irrelevant++;
        continue;
      }
      const existing = byUrl.get(item.link);
      if (existing) {
        stats.duplicated++;
        continue;
      }
      byUrl.set(item.link, {
        title: item.title,
        url: item.link,
        publisher,
        publishedAt: published.toISOString(),
        summary: feed.noSummary ? "" : item.description,
        // 최종 부처 분류와 조간·석간 구분, 중복 묶기는 개발 순서 7번(lib/organize)에서 한다.
        ministry: null,
        mentionedMinistries: mentioned,
        edition: null,
        duplicateCount: 1,
        duplicateOf: null,
      });
      kept++;
    }
    perFeed.push({ feed: label, fetched: items.length, kept });
  }

  const articles = [...byUrl.values()];
  stats.kept = articles.length;
  return { articles, failures, stats, perFeed };
}
