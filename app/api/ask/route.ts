// 질문 → 답변 API. 로그인한 사용자만 쓸 수 있다(proxy.ts). 질문·답변은 저장하지 않는다.
import { NextResponse } from "next/server";
import { askQuestion } from "@/lib/answer/ask";
import { callOpenAi } from "@/lib/answer/llm";
import { listArticles } from "@/lib/db/articles";
import { MINISTRIES, type Ministry } from "@/lib/ministries";

const MAX_QUESTION_LENGTH = 500;
const SEARCH_DAYS = 7; // 기사 보관 기간과 같다

export async function POST(request: Request) {
  let body: { ministry?: unknown; question?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const ministry = MINISTRIES.find((m) => m === body.ministry) as Ministry | undefined;
  if (!ministry || question === "" || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "부처와 질문(500자 이내)을 확인해 주세요." }, { status: 400 });
  }

  try {
    const since = new Date(Date.now() - SEARCH_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // 국정과제 연관성은 답변을 먼저 보여준 뒤 /api/ask/policy 에서 따로 찾는다. (응답 속도)
    const articles = await listArticles({ since, limit: 1000 });
    const result = await askQuestion({ ministry, question, articles, llm: callOpenAi });
    return NextResponse.json(result);
  } catch {
    // 내부 오류 내용(키·주소 등)은 화면에 내보내지 않는다.
    return NextResponse.json({ error: "답변을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
}
