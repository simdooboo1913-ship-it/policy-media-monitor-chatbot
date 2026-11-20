// 서비스가 다루는 부처 4곳 (PRD 4번).
// 비밀 값을 읽는 lib/config.ts 와 분리해 둔 이유: config.ts 는 서버 전용이라
// 브라우저에서 실행되는 화면 코드가 가져오면 오류가 나기 때문이다.

export const MINISTRIES = [
  "과학기술정보통신부",
  "국토교통부",
  "조달청",
  "우주항공청",
] as const;

export type Ministry = (typeof MINISTRIES)[number];

/** 화면·엑셀·PDF에 보여주는 짧은 이름. (내부 처리와 검증에는 위의 정식 이름을 그대로 쓴다) */
export const MINISTRY_SHORT: Record<Ministry, string> = {
  과학기술정보통신부: "과기정통부",
  국토교통부: "국토부",
  조달청: "조달청",
  우주항공청: "우주청",
};
