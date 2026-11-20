// 검토한 행을 엑셀 양식 파일(.xlsx)로 내려받는다. (로그인한 사용자만)
import { NextResponse } from "next/server";
import { buildWorkbook, validateRows } from "@/lib/export/xlsx";

export async function POST(request: Request) {
  let body: { rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const rows = validateRows(body.rows);
  if (!rows) return NextResponse.json({ error: "보낼 내용을 확인해 주세요." }, { status: 400 });
  try {
    const file = await buildWorkbook(rows);
    const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="media-policy-${kst}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
