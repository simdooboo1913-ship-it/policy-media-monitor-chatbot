// 보관함의 기사를 정리하는 실행용 스크립트. (중복 묶기, 주요 부처 분류, 조간·석간 나누기)
//
// 사용법 (my-app 폴더에서):
//   npm run articles:organize -- --dry-run     ← 보관함에 쓰지 않고 결과만 확인
//   npm run articles:organize                  ← 정리하고 보관함에 반영
//
// 여러 번 실행해도 결과는 같다. 비밀 값은 .env 에서 읽으며 화면에 출력하지 않는다.
import { listAllArticles, updateArticles } from "../lib/db/articles";
import { MINISTRIES } from "../lib/ministries";
import { hasChanged, organizeArticles } from "../lib/organize/organize";

async function main(): Promise<number> {
  const dryRun = process.argv.includes("--dry-run");

  const before = await listAllArticles();
  console.log(`보관함의 기사: ${before.length}건`);
  if (before.length === 0) return 0;

  const after = organizeArticles(before);
  const representatives = after.filter((a) => a.duplicateOf === null);
  console.log(`\n중복을 묶은 뒤 기사: ${representatives.length}건 (중복으로 묶인 기사 ${after.length - representatives.length}건)`);

  console.log("\n부처별 대표 기사 수:");
  for (const ministry of MINISTRIES) {
    const list = representatives.filter((a) => a.ministry === ministry);
    const cho = list.filter((a) => a.edition === "조간").length;
    console.log(` - ${ministry}: ${list.length}건 (조간 ${cho} / 석간 ${list.length - cho})`);
  }
  const unclassified = representatives.filter((a) => a.ministry === null).length;
  console.log(` - 부처를 정하지 못한 기사: ${unclassified}건`);

  const toSave = after.filter((a, i) => hasChanged(before[i], a));
  console.log(`\n바뀐 기사: ${toSave.length}건`);
  if (dryRun) {
    console.log("--dry-run 이므로 보관함에는 저장하지 않았습니다.");
    return 0;
  }
  await updateArticles(toSave);
  console.log("보관함에 반영했습니다.");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
