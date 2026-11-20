// Design Ref: §4.3·§9 — 비밀번호를 5회 연속 틀리면 10분간 접속을 막는다.
// 횟수 계산과 차단은 보관함 함수(lib/db/login-attempts.ts)가 한 번에 처리한다. 여기에는 기준 값만 둔다.

export const MAX_FAILED_ATTEMPTS = 5;
export const BLOCK_MINUTES = 10;
