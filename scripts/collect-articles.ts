// 포털 기사를 모아 보관함에 넣는 실행용 스크립트.
//
// 사용법 (my-app 폴더에서):
//   npm run articles:collect -- --dry-run      ← 보관함에 쓰지 않고 결과만 확인
//   npm run articles:collect                   ← 전날 0시(한국 시간)부터 지금까지 모아 저장
//   npm run articles:collect -- --hours 6      ← 최근 6시간만 모으기 (시험용)
//
// 비밀 값은 .env 에서 읽으며 화면에 출력하지 않는다.
import { collectArticles } from "../lib/collect/collect";
import { startOfYesterdayKst } from "../lib/collect/window";
import { insertNewArticles } from "../lib/db/articles";
import { recordFailure } from "../lib/db/failures";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const hoursIndex = args.indexOf("--hours");
  const hours = hoursIndex >= 0 ? Number(args[hoursIndex + 1]) : null;
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0)) {
    console.error("--hours 다음에는 0보다 큰 숫자를 적어 주세요. 예: --hours 6");
    return 1;
  }

  const now = new Date();
  const since = hours !== null ? new Date(now.getTime() - hours * 60 * 60 * 1000) : startOfYesterdayKst(now);
  console.log(`수집 기간: ${since.toISOString()} ~ ${now.toISOString()} (UTC 기준)`);

  const { articles, failures, stats, perFeed } = await collectArticles({ since, until: now });
  console.log("\n피드별 결과 (받은 기사 → 남긴 기사):");
  for (const f of perFeed) console.log(` - ${f.feed}: ${f.fetched} → ${f.kept}`);
  console.log("\n수집 결과:", stats);
  console.log("\n최신 기사 5건 (제목 · 발행처 · 발행 시각):");
  for (const a of articles.slice(0, 5)) console.log(` - ${a.title} · ${a.publisher} · ${a.publishedAt}`);

  if (failures.length > 0) {
    console.error("\n수집에 실패한 부분:");
    for (const f of failures) console.error(` - ${f.target}: ${f.reason}`);
  }

  if (dryRun) {
    console.log("\n--dry-run 이므로 보관함에는 저장하지 않았습니다.");
    return failures.length > 0 ? 1 : 0;
  }

  const inserted = await insertNewArticles(articles);
  console.log(`\n보관함에 새로 저장한 기사: ${inserted}건 (이미 있던 기사 ${articles.length - inserted}건은 그대로 둠)`);
  for (const f of failures) await recordFailure(f.target, f.reason);
  if (failures.length > 0) console.log(`수집 실패 ${failures.length}건을 보관함에 기록했습니다.`);
  return failures.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
