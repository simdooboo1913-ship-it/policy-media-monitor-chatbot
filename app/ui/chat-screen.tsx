"use client";

// Design Ref: §3.2 — 메인 화면: 부처 선택 → 답변 칸 → 안내 문구 → 질문 입력.
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { AskResult } from "@/lib/answer/ask";
import { NO_POLICY_TEXT, type PolicyLink } from "@/lib/answer/policy";
import type { Ministry } from "@/lib/ministries";
import AnswerPanel, { type AnswerState } from "./answer-panel";
import CollectionNoticeBanner from "./collection-notice";
import MinistrySelector from "./ministry-selector";

// 질문 글자 수 상한 (너무 긴 입력을 막기 위한 임시 값)
const MAX_QUESTION_LENGTH = 500;

/** 로그인이 만료되면(401) 로그인 화면으로 보낸다. */
function redirectIfUnauthorized(res: Response, goLogin: () => void): boolean {
  if (res.status !== 401) return false;
  goLogin();
  return true;
}

/** 국정과제 연관성 요청. 실패해도 답변은 그대로 두고 고정 문구를 보여준다. */
async function fetchPolicy(ministry: Ministry, question: string, result: AskResult, goLogin: () => void): Promise<PolicyLink> {
  try {
    const res = await fetch("/api/ask/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ministry,
        question,
        titles: result.sources.map((s) => s.title),
        sentences: result.sentences.map((s) => s.text),
      }),
    });
    if (redirectIfUnauthorized(res, goLogin)) return { status: "none", message: NO_POLICY_TEXT };
    if (res.ok) return (await res.json()).policy as PolicyLink;
  } catch {
    /* 아래 고정 문구로 */
  }
  return { status: "none", message: NO_POLICY_TEXT };
}

export default function ChatScreen() {
  const [ministry, setMinistry] = useState<Ministry | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerState>({ kind: "idle" });

  // 부처를 고르고 질문을 적어야만 보낼 수 있다.
  const canSend = ministry !== null && question.trim() !== "";

  // 가장 최근에 보낸 요청의 번호. 늦게 도착한 이전 응답이 화면을 덮어쓰지 않게 한다.
  const requestId = useRef(0);
  const router = useRouter();
  const goLogin = () => router.push("/login");

  // 부처 버튼을 누르면 AI 없이 그 부처의 최신 기사부터 바로 보여준다.
  async function handleSelect(next: Ministry) {
    setMinistry(next);
    const id = ++requestId.current;
    setAnswer({ kind: "news-loading", ministry: next });
    try {
      const res = await fetch(`/api/ministry-news?ministry=${encodeURIComponent(next)}`);
      if (redirectIfUnauthorized(res, goLogin)) return;
      const body = await res.json();
      if (id !== requestId.current) return;
      setAnswer(
        res.ok
          ? { kind: "news", ministry: next, items: body.items }
          : { kind: "news-error", ministry: next, message: body.error ?? "기사를 불러오지 못했습니다." },
      );
    } catch {
      if (id === requestId.current) setAnswer({ kind: "news-error", ministry: next, message: "서버에 연결하지 못했습니다. 다시 시도해 주세요." });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = question.trim();
    if (ministry === null || asked === "" || answer.kind === "loading") return;
    const id = ++requestId.current;
    setAnswer({ kind: "loading", ministry, question: asked });
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ministry, question: asked }),
      });
      if (redirectIfUnauthorized(res, goLogin)) return;
      const body = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) {
        setAnswer({ kind: "error", ministry, question: asked, message: body.error ?? "답변을 만들지 못했습니다." });
        return;
      }
      const result: AskResult = body;
      // 답변을 먼저 보여주고, 국정과제 연관성은 뒤에서 따로 찾아 붙인다. (응답 속도)
      const wantsPolicy = result.status === "ok";
      setAnswer({ kind: "done", ministry, question: asked, result, policy: wantsPolicy ? "loading" : null });
      if (!wantsPolicy) return;
      const policy = await fetchPolicy(ministry, asked, result, goLogin);
      if (id !== requestId.current) return;
      setAnswer({ kind: "done", ministry, question: asked, result, policy });
    } catch {
      if (id === requestId.current) setAnswer({ kind: "error", ministry, question: asked, message: "서버에 연결하지 못했습니다. 다시 시도해 주세요." });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-bold">정책·언론 모니터링 &amp; 이슈 브리핑 챗봇</h1>
      </header>

      <MinistrySelector selected={ministry} onSelect={handleSelect} />

      <CollectionNoticeBanner />

      <div className="flex-1">
        <AnswerPanel state={answer} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          개인정보나 비공개 내용은 입력하지 마세요.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder={
              ministry === null ? "먼저 부처를 선택하세요" : "질문을 입력하세요"
            }
            aria-label="질문 입력"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            보내기
          </button>
        </div>
      </form>
    </div>
  );
}
