// 답변에 연관된 국정과제를 따로 찾는 API. 답변을 먼저 보여주고 이 결과는 뒤에 붙인다. (로그인한 사용자만)
import { NextResponse } from "next/server";
import { callOpenAi } from "@/lib/answer/llm";
import { relatePolicy } from "@/lib/answer/policy";
import { listPolicies } from "@/lib/db/policies";
import { MINISTRIES, type Ministry } from "@/lib/ministries";

const POLICY_TIMEOUT_MS = 10_000;
const asStrings = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, 300)) : [];

export async function POST(request: Request) {
  let body: { ministry?: unknown; question?: unknown; titles?: unknown; sentences?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const ministry = MINISTRIES.find((m) => m === body.ministry) as Ministry | undefined;
  const question = typeof body.question === "string" ? body.question.slice(0, 500) : "";
  if (!ministry) return NextResponse.json({ error: "부처를 확인해 주세요." }, { status: 400 });
  // 근거 문구가 국정과제 PDF에 실제 있는지는 서버(relatePolicy)가 직접 확인하므로, 여기서 받는 글은 후보를 찾는 데만 쓴다.
  const relatedText = [question, ...asStrings(body.titles, 12), ...asStrings(body.sentences, 8)].join("\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POLICY_TIMEOUT_MS);
    try {
      const policy = await relatePolicy({ ministry, relatedText, policies: await listPolicies(), llm: callOpenAi, signal: controller.signal });
      return NextResponse.json({ policy });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ error: "국정과제를 찾지 못했습니다." }, { status: 500 });
  }
}
