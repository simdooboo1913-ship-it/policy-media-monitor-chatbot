// 부처별 검색어. 기사에서 부처를 부르는 이름(정식 이름과 줄임말)을 함께 쓴다.
import type { Ministry } from "../ministries";

export const MINISTRY_QUERIES: Record<Ministry, string[]> = {
  과학기술정보통신부: ["과학기술정보통신부", "과기정통부"],
  국토교통부: ["국토교통부", "국토부"],
  조달청: ["조달청"],
  우주항공청: ["우주항공청", "우주청"],
};
