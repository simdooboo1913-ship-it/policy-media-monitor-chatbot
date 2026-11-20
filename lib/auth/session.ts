// Design Ref: §7 — 서명된 쿠키 `session`. 유효기간은 7일, 서명에는 SESSION_SECRET 을 쓴다.
// 쿠키 값은 "만료시각.서명" 모양이며, 서명이 맞고 만료 전이어야 로그인된 것으로 본다.
import { safeEqual, signHex } from "./crypto";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** 새 로그인 쿠키 값을 만든다. */
export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const signature = await signHex(secret, `session:${expiresAt}`);
  return `${expiresAt}.${signature}`;
}

/** 쿠키 값이 올바르고 만료 전인지 확인한다. 비밀 값이 없거나 형식이 틀리면 항상 거짓이다. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const [expiresText, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !expiresText || !signature) return false;
  if (!/^\d+$/.test(expiresText)) return false;
  if (Number(expiresText) <= now) return false;
  const expected = await signHex(secret, `session:${expiresText}`);
  return safeEqual(signature, expected);
}
