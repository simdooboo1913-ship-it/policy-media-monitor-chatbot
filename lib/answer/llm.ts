// Design Ref: §6 — OpenAI 호출. 서버에서만 쓰며 키는 .env 에서 읽는다.
import { requireEnv } from "../config";

export type LlmPrompt = { system: string; user: string };
/** AI 호출 함수. 시험에서는 가짜 함수로 바꿔 끼운다. 글자(JSON)를 돌려준다. */
export type LlmFn = (prompt: LlmPrompt, signal: AbortSignal) => Promise<string>;

const DEFAULT_MODEL = "gpt-4o-mini";

export const callOpenAi: LlmFn = async (prompt, signal) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      temperature: 0,
      max_tokens: 500, // 답변이 길어져 느려지는 것을 막는다
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI 서비스 응답 오류 (HTTP ${res.status})`); // 응답 본문·키는 오류에 싣지 않는다
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "";
};
