// Design Ref: §7, §9 — 비밀번호 확인, 5회 연속 실패 시 10분 차단, 성공 시 session 쿠키 발급.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeEqual, signHex } from "@/lib/auth/crypto";
import { BLOCK_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/auth/lockout";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { hasEnv, requireEnv } from "@/lib/config";
import { beginLoginAttempt, resetLoginAttempts } from "@/lib/db/login-attempts";

export async function POST(request: Request) {
  // 설정이 빠져 있으면 누구도 들어올 수 없게 막는다.
  if (!hasEnv("ACCESS_PASSWORD") || !hasEnv("SESSION_SECRET")) {
    return NextResponse.json(
      { error: "not_configured", message: "서버 설정이 끝나지 않았습니다. 관리자에게 문의하세요." },
      { status: 500 },
    );
  }

  let password: unknown;
  try {
    password = ((await request.json()) as { password?: unknown }).password;
  } catch {
    password = undefined;
  }
  if (typeof password !== "string" || password === "" || password.length > 200) {
    return NextResponse.json(
      { error: "invalid", message: "비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const now = Date.now();

  // 비밀번호를 확인하기 전에 시도 1회를 먼저 센다. (동시에 여러 요청을 보내도 한 번의 차단 구간에 확인까지 가는 시도는 5번뿐)
  // 막혀 있는 동안에는 비밀번호가 맞아도 확인하지 않는다.
  let attempt;
  try {
    attempt = await beginLoginAttempt(MAX_FAILED_ATTEMPTS, BLOCK_MINUTES);
  } catch {
    return NextResponse.json({ error: "server", message: "서버에 문제가 있습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
  if (attempt.blocked) {
    return NextResponse.json({ error: "blocked", retryAfterSeconds: attempt.retryAfterSeconds }, { status: 429 });
  }

  // 길이나 시간으로 비밀번호를 추측하지 못하도록 서명한 값끼리 비교한다.
  const secret = requireEnv("SESSION_SECRET");
  const [given, expected] = await Promise.all([
    signHex(secret, `password:${password}`),
    signHex(secret, `password:${requireEnv("ACCESS_PASSWORD")}`),
  ]);

  if (!safeEqual(given, expected)) {
    // 이미 센 시도가 곧 실패 1회다. 5번째 실패면 함수가 이미 차단을 걸어 두었다.
    if (attempt.attemptNo >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json({ error: "blocked", retryAfterSeconds: BLOCK_MINUTES * 60 }, { status: 429 });
    }
    return NextResponse.json({ error: "wrong", remainingAttempts: MAX_FAILED_ATTEMPTS - attempt.attemptNo }, { status: 401 });
  }

  // 성공: 실패 횟수를 지우고 로그인 쿠키를 준다.
  await resetLoginAttempts();
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: await createSessionToken(secret, now),
    httpOnly: true, // 화면의 스크립트가 쿠키를 읽지 못하게 한다
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return NextResponse.json({ ok: true });
}
