// "엑셀로 보내기": 체크한 기사를 엑셀 양식의 열에 맞게 분류해 돌려준다. (로그인한 사용자만)
import { NextResponse } from "next/server";
import { callOpenAi } from "@/lib/answer/llm";
import { listArticlesByIds } from "@/lib/db/articles";
import { listPolicies } from "@/lib/db/policies";
import { classifyArticles } from "@/lib/export/classify";
import { MAX_EXPORT_ROWS } from "@/lib/export/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === "string" && x.length <= 64))] : [];
  if (ids.length === 0) return NextResponse.json({ error: "기사를 먼저 체크해 주세요." }, { status: 400 });
  if (ids.length > MAX_EXPORT_ROWS) return NextResponse.json({ error: `한 번에 ${MAX_EXPORT_ROWS}건까지 보낼 수 있습니다.` }, { status: 400 });

  try {
    const found = await listArticlesByIds(ids);
    // 체크한 순서(화면 순서)를 지킨다.
    const order = new Map(ids.map((id, i) => [id, i]));
    found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const rows = await classifyArticles({ articles: found, policies: await listPolicies(), llm: callOpenAi });
    if (rows.length === 0) return NextResponse.json({ error: "부처가 정해진 기사가 없어 분류하지 못했습니다." }, { status: 422 });
    return NextResponse.json({ rows });
  } catch (error) {
    // 서버 기록에는 오류 종류만 남긴다. (기사 내용·키는 싣지 않는다)
    console.error("[export/classify] 실패:", error instanceof Error ? error.message.slice(0, 200) : "알 수 없는 오류");
    return NextResponse.json({ error: "분류하지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
