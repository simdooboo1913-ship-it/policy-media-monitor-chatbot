// 아침 요약 메일을 지금 만들어 평가관 이메일로 보낸다.
//
// 사용법 (my-app 폴더에서):
//   npm run digest:send -- --test     ← 짧은 시험 메일 1통 (요약을 만들지 않음, 메일 연결만 확인)
//   npm run digest:send               ← 지금 보관함 기준으로 아침 요약을 만들어 발송
//
// 키·받는 주소는 .env 의 RESEND_API_KEY, REPORT_EMAIL 에서 읽고 화면에 출력하지 않는다.
import { callOpenAi } from "../lib/answer/llm";
import { startOfYesterdayKst } from "../lib/collect/window";
import { hasEnv } from "../lib/config";
import { listArticles } from "../lib/db/articles";
import { listFailuresSince } from "../lib/db/failures";
import { listPolicies } from "../lib/db/policies";
import { buildDigest } from "../lib/digest/build";
import { sendDigest, sendMail } from "../lib/mail/send";

async function main(): Promise<number> {
  const missing = (["RESEND_API_KEY", "REPORT_EMAIL"] as const).filter((n) => !hasEnv(n));
  if (missing.length > 0) {
    console.error(`.env 에 ${missing.join(", ")} 값이 없습니다. 직접 채운 뒤 다시 실행해 주세요.`);
    return 1;
  }

  let result;
  if (process.argv.includes("--test")) {
    result = await sendMail({
      to: process.env.REPORT_EMAIL as string,
      subject: "[정책·언론 브리핑] 메일 연결 시험",
      html: "<p>메일 연결 시험입니다. 이 메일이 보이면 발송 설정이 정상입니다.</p>",
      text: "메일 연결 시험입니다. 이 메일이 보이면 발송 설정이 정상입니다.",
    });
  } else {
    const now = new Date();
    const since = startOfYesterdayKst(now).toISOString();
    const [articles, policies, failures] = await Promise.all([listArticles({ since, limit: 1000 }), listPolicies(), listFailuresSince(since)]);
    const digest = await buildDigest({ now, articles, policies, failures, llm: callOpenAi });
    console.log(`요약 ${digest.totalItems}항목을 만들었습니다. 제목: ${digest.subject}`);
    result = await sendDigest(digest);
  }

  if (result.ok) {
    console.log(`발송 성공 (시도 ${result.attempts}회)${result.id ? `, 메일 번호 ${result.id}` : ""}`);
    return 0;
  }
  console.error(`발송 실패 (시도 ${result.attempts}회): ${result.error}`);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
