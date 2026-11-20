// Design Ref: §6, §9 — 메일 발송(Resend). 실패하면 한 번 다시 보내고, 그래도 실패하면 결과로 알린다.
// 키·받는 주소는 .env 에서만 읽고, 오류 문구·기록에는 싣지 않는다.
import { requireEnv } from "../config";
import type { Digest } from "../digest/build";
import { renderHtml, renderText } from "../digest/render";

const RESEND_URL = "https://api.resend.com/emails";
/** Resend 시험용 보낸 사람 주소. (자기 도메인을 인증하기 전에는 Resend 계정 소유자 주소로만 보낼 수 있다) */
const DEFAULT_FROM = "정책·언론 브리핑 <onboarding@resend.dev>";
const MAX_ATTEMPTS = 2; // 처음 1회 + 다시 1회
const REQUEST_TIMEOUT_MS = 15_000;

export type MailMessage = { to: string; subject: string; html: string; text: string };
export type SendResult = { ok: true; id: string | null; attempts: number } | { ok: false; error: string; attempts: number };

function senderAddress(): string {
  const from = process.env.MAIL_FROM?.trim();
  return from ? from : DEFAULT_FROM;
}

/** 메일 한 통을 보낸다. 실패 사유에는 HTTP 상태만 적고, 받는 주소·키는 적지 않는다. */
export async function sendMail(message: MailMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const apiKey = requireEnv("RESEND_API_KEY");
  let lastError = "알 수 없는 오류";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(RESEND_URL, {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: senderAddress(), to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: body.id ?? null, attempts: attempt };
      }
      lastError = `메일 서비스 응답 오류 (HTTP ${res.status})`;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break; // 요청 자체가 잘못된 경우는 다시 보내도 같다
    } catch {
      lastError = "메일 서비스에 연결하지 못했습니다";
    }
  }
  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS };
}

/** 아침 요약을 평가관 이메일(.env 의 REPORT_EMAIL)로 보낸다. */
export async function sendDigest(digest: Digest, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  return sendMail(
    { to: requireEnv("REPORT_EMAIL"), subject: digest.subject, html: renderHtml(digest), text: renderText(digest) },
    fetchImpl,
  );
}
