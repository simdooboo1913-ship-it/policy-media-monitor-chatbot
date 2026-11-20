"use client";

// Design Ref: §3.1 — 비밀번호 입력칸, 들어가기 버튼, 실패·차단 안내.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Notice = { kind: "error"; text: string } | null;

/** 남은 초를 "N분 M초" 모양으로 바꾼다. */
function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}분 ${rest}초` : `${rest}초`;
}

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === "" || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        remainingAttempts?: number;
        retryAfterSeconds?: number;
      };
      if (body.error === "blocked") {
        setNotice({
          kind: "error",
          text: `비밀번호를 5회 틀려 접속이 막혔습니다. ${formatWait(body.retryAfterSeconds ?? 600)} 뒤에 다시 시도해 주세요.`,
        });
      } else if (body.error === "wrong") {
        setNotice({
          kind: "error",
          text: `비밀번호가 맞지 않습니다. (남은 시도 ${body.remainingAttempts ?? 0}회)`,
        });
      } else {
        setNotice({ kind: "error", text: body.message ?? "접속하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." });
      }
    } catch {
      setNotice({ kind: "error", text: "서버에 연결하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." });
    } finally {
      setPending(false);
      setPassword("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="password">
        비밀번호
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        maxLength={200}
        className="field w-full px-4 py-2.5 text-sm"
      />
      <button
        type="submit"
        disabled={password === "" || pending}
        className="btn-pop w-full px-4 py-2.5 text-sm"
      >
        {pending ? "확인 중..." : "들어가기 🚪"}
      </button>
      {notice && (
        <p role="alert" className="rounded-xl bg-rose-500/20 p-3 text-sm text-rose-100">
          {notice.text}
        </p>
      )}
    </form>
  );
}
