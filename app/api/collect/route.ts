// 대시보드의 "기사 수집" 버튼: 지금 바로 기사를 모아 보관하고 정리한 뒤 목록을 돌려준다. (로그인한 사용자만, GET 은 수집 없이 목록만)
import { NextResponse } from "next/server";
import { collectArticles } from "@/lib/collect/collect";
import { startOfYesterdayKst } from "@/lib/collect/window";
import { deleteExpiredArticles, insertNewArticles, listAllArticles, updateArticles } from "@/lib/db/articles";
import { recordFailure } from "@/lib/db/failures";
import { listDashboardArticles } from "@/lib/export/list";
import { hasChanged, organizeArticles } from "@/lib/organize/organize";

export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json({ articles: await listDashboardArticles(new Date()) });
  } catch {
    return NextResponse.json({ error: "기사를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const now = new Date();
    const collected = await collectArticles({ since: startOfYesterdayKst(now), until: now });
    for (const f of collected.failures) {
      try {
        await recordFailure(f.target, f.reason);
      } catch {
        /* 기록 실패가 수집을 막지 않게 한다 */
      }
    }
    // 전부 실패하면 새 기사가 없는 것이므로 오류로 알린다. (보관함에 있던 기사는 GET 으로 볼 수 있다)
    if (collected.perFeed.length > 0 && collected.failures.length === collected.perFeed.length) {
      return NextResponse.json({ error: "기사를 가져오지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 502 });
    }
    const inserted = await insertNewArticles(collected.articles);
    await deleteExpiredArticles();
    const before = await listAllArticles();
    const after = organizeArticles(before);
    await updateArticles(after.filter((a, i) => hasChanged(before[i], a)));
    return NextResponse.json({
      articles: await listDashboardArticles(now),
      inserted,
      failedFeeds: collected.failures.length,
    });
  } catch {
    return NextResponse.json({ error: "기사를 수집하지 못했습니다." }, { status: 500 });
  }
}
