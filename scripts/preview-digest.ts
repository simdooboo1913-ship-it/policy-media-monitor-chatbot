// 아침 요약을 지금 보관함 기준으로 만들어 보고, 미리보기 파일(digest-preview.html)로 저장한다. (메일은 보내지 않음)
//
// 사용법 (my-app 폴더에서):
//   npm run digest:preview
// 만들어진 digest-preview.html 을 브라우저로 열어 확인한다. 비밀 값은 .env 에서 읽고 출력하지 않는다.
import { writeFileSync } from "node:fs";
import { callOpenAi } from "../lib/answer/llm";
import { startOfYesterdayKst } from "../lib/collect/window";
import { listArticles } from "../lib/db/articles";
import { listFailuresSince } from "../lib/db/failures";
import { listPolicies } from "../lib/db/policies";
import { buildDigest } from "../lib/digest/build";
import { renderHtml, renderText } from "../lib/digest/render";

async function main(): Promise<number> {
  const now = new Date();
  const since = startOfYesterdayKst(now).toISOString();
  const [articles, policies, failures] = await Promise.all([
    listArticles({ since, limit: 1000 }),
    listPolicies(),
    listFailuresSince(since),
  ]);
  const started = Date.now();
  const digest = await buildDigest({ now, articles, policies, failures, llm: callOpenAi });
  console.log(`요약 생성 ${((Date.now() - started) / 1000).toFixed(1)}초, 총 ${digest.totalItems}항목\n`);
  console.log(renderText(digest));
  writeFileSync("digest-preview.html", renderHtml(digest), "utf8");
  console.log("\n미리보기 파일: digest-preview.html");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
