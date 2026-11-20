// Design Ref: §4.3 — 로그인 시도 횟수. 5회 연속 실패하면 10분간 접속을 막는 데 쓴다.
// 읽고 → 비교하고 → 저장하면 동시 요청에 뚫리므로, 보관함 안의 함수(supabase/migrations/…atomic_login_attempts.sql)가
// 행을 잠그고 한 번에 처리한다. 이용자가 1명이므로 고정 키 하나만 사용한다.
import { getDb, throwDbError } from "./client";

export type LoginAttempt = {
  blocked: boolean;
  retryAfterSeconds: number; // 막혀 있을 때 남은 초
  attemptNo: number; // 이번이 이번 구간의 몇 번째 시도인지
};

type AttemptRow = { blocked: boolean; retry_after_seconds: number; attempt_no: number };

/** 비밀번호를 확인하기 전에 호출해 시도 1회를 센다. 이미 막혀 있으면 세지 않고 blocked 를 돌려준다. */
export async function beginLoginAttempt(maxFailed: number, blockMinutes: number): Promise<LoginAttempt> {
  const { data, error } = await getDb().rpc("begin_login_attempt", { max_failed: maxFailed, block_minutes: blockMinutes });
  if (error) throwDbError("로그인 시도 기록", error.message);
  const row = (Array.isArray(data) ? data[0] : data) as AttemptRow | undefined;
  if (!row) throwDbError("로그인 시도 기록", "응답이 비어 있습니다");
  return { blocked: row.blocked, retryAfterSeconds: row.retry_after_seconds, attemptNo: row.attempt_no };
}

/** 로그인에 성공하면 실패 횟수와 차단을 지운다. */
export async function resetLoginAttempts(): Promise<void> {
  const { error } = await getDb().rpc("login_succeeded");
  if (error) throwDbError("로그인 상태 초기화", error.message);
}
