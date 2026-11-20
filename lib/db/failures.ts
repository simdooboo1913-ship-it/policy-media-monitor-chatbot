// Design Ref: §4.3 — 수집 실패 기록. 답변과 요약에 "수집되지 않은 부분"을 알리기 위해 쓴다.
import { getDb, throwDbError } from "./client";

export type CollectionFailure = {
  occurredAt: string; // ISO 시각 문자열
  target: string;
  reason: string;
};

type FailureRow = {
  occurred_at: string;
  target: string;
  reason: string;
};

/** 수집 실패를 기록한다. 사유에는 키·비밀번호 같은 비밀 값을 넣지 않는다. */
export async function recordFailure(target: string, reason: string): Promise<void> {
  const { error } = await getDb().from("collection_failures").insert({ target, reason });
  if (error) throwDbError("수집 실패 기록", error.message);
}

/** 지정한 시각 이후의 수집 실패를 최신순으로 가져온다. */
export async function listFailuresSince(since: string): Promise<CollectionFailure[]> {
  const { data, error } = await getDb()
    .from("collection_failures")
    .select("*")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });
  if (error) throwDbError("수집 실패 조회", error.message);
  return ((data ?? []) as FailureRow[]).map((row) => ({
    occurredAt: row.occurred_at,
    target: row.target,
    reason: row.reason,
  }));
}
