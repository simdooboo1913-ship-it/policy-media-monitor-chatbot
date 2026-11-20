// 수집 실패 안내를 돌려주는 API. (로그인한 사용자만: proxy.ts가 /api/* 를 막는다)
import { NextResponse } from "next/server";
import { buildCollectionNotice } from "@/lib/collect/notice";
import { startOfYesterdayKst } from "@/lib/collect/window";
import { listFailuresSince } from "@/lib/db/failures";

export async function GET() {
  try {
    const since = startOfYesterdayKst(new Date()).toISOString();
    const notice = buildCollectionNotice(await listFailuresSince(since));
    return NextResponse.json({ notice });
  } catch {
    // 실패 기록을 읽지 못해도 화면은 계속 쓸 수 있게 한다. 사유 문구에는 내부 오류를 싣지 않는다.
    return NextResponse.json({ notice: null, error: "수집 안내를 불러오지 못했습니다." }, { status: 500 });
  }
}
