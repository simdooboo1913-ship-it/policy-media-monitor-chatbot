// Design Ref: §4.3 — 국정과제 표. PDF에서 뽑은 번호·과제명·쪽 번호·내용을 둔다.
import { getDb, throwDbError } from "./client";

export type Policy = {
  number: string;
  name: string;
  page: number | null;
  content: string;
  sourceFile: string;
};

type PolicyRow = {
  number: string;
  name: string;
  page: number | null;
  content: string;
  source_file: string;
};

/**
 * 한 PDF 파일에서 뽑은 국정과제를 통째로 바꿔 넣는다. (다시 읽었을 때 중복이 쌓이지 않게 한다)
 * 먼저 덮어써 저장하고 나서 이번에 없는 번호만 지우므로, 저장에 실패해도 기존 내용이 사라지지 않는다.
 */
export async function replacePolicies(sourceFile: string, policies: Policy[]): Promise<void> {
  const db = getDb();
  if (policies.length === 0) return;

  const rows: PolicyRow[] = policies.map((p) => ({
    number: p.number,
    name: p.name,
    page: p.page,
    content: p.content,
    source_file: sourceFile,
  }));
  const { error } = await db.from("policies").upsert(rows, { onConflict: "source_file,number" });
  if (error) throwDbError("국정과제 저장", error.message);

  const keep = `(${policies.map((p) => p.number).join(",")})`;
  const { error: pruneError } = await db
    .from("policies")
    .delete()
    .eq("source_file", sourceFile)
    .not("number", "in", keep);
  if (pruneError) throwDbError("이전 국정과제 정리", pruneError.message);
}

/** 보관된 국정과제를 모두 가져온다. */
export async function listPolicies(): Promise<Policy[]> {
  const { data, error } = await getDb().from("policies").select("*");
  if (error) throwDbError("국정과제 조회", error.message);
  return ((data ?? []) as PolicyRow[]).map((row) => ({
    number: row.number,
    name: row.name,
    page: row.page,
    content: row.content,
    sourceFile: row.source_file,
  }));
}
