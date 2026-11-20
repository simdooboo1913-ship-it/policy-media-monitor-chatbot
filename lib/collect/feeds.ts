// 수집할 RSS 피드 목록. 언론사 3곳(연합뉴스, 전자신문, 매일경제)의 공개 RSS와 Google 뉴스 검색 RSS를 쓴다.
//
// 언론사 RSS는 부처 이름으로 검색되는 것이 아니라 분야별 최신 기사 목록이라서, 가져온 뒤 부처 이름이 들어 있는 기사만 남긴다.
//   피드마다 담고 있는 기간이 다르다. (2026-11 확인: 연합뉴스 정치·경제는 약 1~2일, 사회·산업은 수 시간)
//   → 하루에 한 번만 가져오면 전날 0시까지 닿지 않을 수 있어, 더 자주 가져와 보관함에 쌓는 것이 좋다.
//
// Google 뉴스 검색 RSS는 부처 이름으로 이미 검색된 결과라서 부처가 정해져 있다. 단, 기사 요약문이 없고
// 링크가 언론사 원문이 아니라 Google 연결 주소다. (원래 언론사는 <source> 태그로 알려준다)
import { MINISTRIES, type Ministry } from "../ministries";
import { MINISTRY_QUERIES } from "./queries";

export type FeedSource = {
  site: string; // 언론사 이름 (화면 표시용)
  name: string; // 피드 이름 (오류 안내용)
  url: string;
  /** 부처 이름으로 검색한 피드면 그 부처. 이 피드의 기사는 글자에 부처 이름이 없어도 그 부처에 걸린 것으로 본다. */
  ministry?: Ministry;
  /** true 면 피드의 설명 글이 기사 요약이 아니므로 요약문을 비워 둔다. */
  noSummary?: boolean;
};

/** 부처의 이름과 줄임말로 검색하는 Google 뉴스 RSS 주소 (최근 2일) */
function googleNewsUrl(ministry: Ministry): string {
  const terms = MINISTRY_QUERIES[ministry].map((alias) => `"${alias}"`).join(" OR ");
  const query = encodeURIComponent(`${terms} when:2d`);
  return `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;
}

export const FEEDS: FeedSource[] = [
  // 연합뉴스: 통신사로 정부 부처 소식이 가장 폭넓게 나온다
  { site: "연합뉴스", name: "정치", url: "https://www.yna.co.kr/rss/politics.xml" },
  { site: "연합뉴스", name: "경제", url: "https://www.yna.co.kr/rss/economy.xml" },
  { site: "연합뉴스", name: "사회", url: "https://www.yna.co.kr/rss/society.xml" },
  { site: "연합뉴스", name: "산업", url: "https://www.yna.co.kr/rss/industry.xml" },
  // 전자신문: IT·과학·우주 분야 (과학기술정보통신부, 우주항공청)
  { site: "전자신문", name: "오늘의 뉴스", url: "https://rss.etnews.com/Section901.xml" },
  { site: "전자신문", name: "섹션 3", url: "https://rss.etnews.com/Section903.xml" },
  // 매일경제: 경제·부동산 분야 (국토교통부, 조달청)
  { site: "매일경제", name: "경제", url: "https://www.mk.co.kr/rss/30100041/" },
  { site: "매일경제", name: "부동산", url: "https://www.mk.co.kr/rss/50300009/" },
  { site: "매일경제", name: "전체", url: "https://www.mk.co.kr/rss/40300001/" },
  // Google 뉴스: 부처별 검색 결과 (여러 언론사 기사)
  ...MINISTRIES.map((ministry) => ({
    site: "Google 뉴스",
    name: ministry,
    url: googleNewsUrl(ministry),
    ministry,
    noSummary: true,
  })),
];
