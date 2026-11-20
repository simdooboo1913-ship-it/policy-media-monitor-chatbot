// 부처 버튼을 누르면 AI 없이 바로 보여주는 최신 기사 목록. (로그인한 사용자만)
import { NextResponse } from "next/server";
import { startOfYesterdayKst } from "@/lib/collect/window";
import { listArticles } from "@/lib/db/articles";
import { pickTop } from "@/lib/digest/build";
import { MINISTRIES, type Ministry } from "@/lib/ministries";
import { editionOf } from "@/lib/organize/edition";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("ministry");
  const ministry = MINISTRIES.find((m) => m === name) as Ministry | undefined;
  if (!ministry) return NextResponse.json({ error: "부처를 확인해 주세요." }, { status: 400 });
  try {
    const now = new Date();
    const since = startOfYesterdayKst(now);
    const articles = await listArticles({ ministry, since: since.toISOString(), limit: 300 });
    // 같은 내용을 보도한 기사가 많은 순(같으면 최신순) 상위 10건. 아침 요약과 같은 기준이다.
    const items = pickTop(articles, ministry, since, now).map((a) => {
      const ed = editionOf(a.publishedAt);
      return { title: a.title, url: a.url, publisher: a.publisher, publishedAt: a.publishedAt, edition: ed.edition, editionDate: ed.date, duplicateCount: a.duplicateCount };
    });
    return NextResponse.json({ ministry, items });
  } catch {
    return NextResponse.json({ error: "기사를 불러오지 못했습니다." }, { status: 500 });
  }
}
