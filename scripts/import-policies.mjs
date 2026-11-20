// 국정과제 PDF를 읽어 보관함(policies 표)에 넣는 실행용 스크립트.
//
// 사용법 (my-app 폴더에서):
//   node scripts/import-policies.mjs --dry-run   ← 보관함에 쓰지 않고 결과만 확인
//   node scripts/import-policies.mjs             ← 보관함에 저장
//
// 비밀 값은 .env 에서 읽으며 화면에 출력하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { parseAgenda } from "../lib/policy/parse-agenda.ts";

const PDF_PATH = path.join("data", "national-agenda-123.pdf");
const dryRun = process.argv.includes("--dry-run");

// 1) PDF에서 쪽별 글자 뽑기
const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
const { pages } = await parser.getText();
await parser.destroy?.();
console.log(`PDF를 읽었습니다: ${pages.length}쪽`);

// 2) 과제별로 나누기
const { policies, problems } = parseAgenda(pages, path.basename(PDF_PATH));
console.log(`찾은 국정과제: ${policies.length}개`);
if (problems.length > 0) {
  console.error("\n문제가 있어 저장하지 않습니다:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

const lengths = policies.map((p) => p.content.length);
console.log(`내용 글자 수: 최소 ${Math.min(...lengths)} / 최대 ${Math.max(...lengths)}`);

if (dryRun) {
  console.log("\n--dry-run 이므로 보관함에는 저장하지 않았습니다.");
  process.exit(0);
}

// 3) 보관함에 저장 (같은 파일·번호는 덮어쓰고, 이번에 없는 번호는 지운다)
process.loadEnvFile(".env");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(".env 에 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 값이 없습니다.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const sourceFile = path.basename(PDF_PATH);

const rows = policies.map((p) => ({
  number: p.number,
  name: p.name,
  page: p.page,
  content: p.content,
  source_file: sourceFile,
}));

const upsert = await db.from("policies").upsert(rows, { onConflict: "source_file,number" });
if (upsert.error) {
  console.error("저장 중 오류:", upsert.error.message);
  process.exit(1);
}
const prune = await db
  .from("policies")
  .delete()
  .eq("source_file", sourceFile)
  .not("number", "in", `(${policies.map((p) => p.number).join(",")})`);
if (prune.error) {
  console.error("이전 기록 정리 중 오류:", prune.error.message);
  process.exit(1);
}

const count = await db
  .from("policies")
  .select("*", { count: "exact", head: true })
  .eq("source_file", sourceFile);
console.log(`보관함에 저장했습니다. 현재 ${count.count}개`);
