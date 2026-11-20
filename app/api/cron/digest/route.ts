// 매일 아침 자동 실행 주소. Vercel Cron 이 호출하며, 쿠키 대신 CRON_SECRET 으로 확인한다. (proxy.ts 는 /api/cron/* 을 통과시킨다)
import { NextResponse } from "next/server";
import { callOpenAi } from "@/lib/answer/llm";
import { safeEqual } from "@/lib/auth/crypto";
import { realCollect, runDailyDigest } from "@/lib/cron/daily";
import { deleteExpiredArticles, insertNewArticles, listAllArticles, updateArticles } from "@/lib/db/articles";
import { listFailuresSince, recordFailure } from "@/lib/db/failures";
import { listPolicies } from "@/lib/db/policies";
import { requireEnv } from "@/lib/config";
import { sendMail } from "@/lib/mail/send";

// 수집·요약·발송을 한 번에 하므로 넉넉히 잡는다. (요금제 상한은 배포 때 확인)
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  // 비밀 값이 비어 있으면 누구도 통과시키지 않는다.
  if (!secret || !safeEqual(given, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const outcome = await runDailyDigest(new Date(), {
      collect: realCollect(),
      insertNewArticles,
      recordFailure,
      listAllArticles: () => listAllArticles(),
      updateArticles: (articles) => updateArticles(articles),
      deleteExpiredArticles: () => deleteExpiredArticles(),
      listPolicies,
      listFailuresSince,
      sendMail,
      reportEmail: () => requireEnv("REPORT_EMAIL"),
      llm: callOpenAi,
    });
    // 서버 기록(Vercel 로그)에는 단계 요약만 남긴다. 주소·키는 싣지 않는다.
    console.log("[cron/digest]", outcome.status, outcome.steps.join(" | "));
    return NextResponse.json(outcome, { status: outcome.status === "sent" ? 200 : 500 });
  } catch (error) {
    console.error("[cron/digest] 실패:", error instanceof Error ? error.message : "알 수 없는 오류");
    return NextResponse.json({ error: "실행 중 오류가 발생했습니다." }, { status: 500 });
  }
}
