// Design Ref: §8 — 비밀 값은 서버 쪽 코드에서만 읽는다. (NEXT_PUBLIC_ 접두사는 쓰지 않는다)
// 이 파일은 브라우저 쪽 코드에서 가져오면 안 된다.

if (typeof window !== "undefined") {
  throw new Error("lib/config.ts 는 서버 쪽 코드에서만 사용할 수 있습니다.");
}

/** 사용할 수 있는 비밀 값 이름 목록 (.env.example 과 같게 유지한다) */
export type EnvName =
  | "OPENAI_API_KEY"
  | "SUPABASE_ACCESS_TOKEN"
  | "VERCEL_TOKEN"
  | "GITHUB_TOKEN"
  | "ACCESS_PASSWORD"
  | "SESSION_SECRET"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_PROJECT_REF"
  | "SUPABASE_DB_PASSWORD"
  | "RESEND_API_KEY"
  | "REPORT_EMAIL"
  | "MAIL_FROM"
  | "OPENAI_MODEL"
  | "CRON_SECRET";

/**
 * 비밀 값을 읽는다. 값이 없으면 어떤 이름이 비었는지만 알려주고 멈춘다.
 * (값 자체는 오류 메시지·로그에 절대 넣지 않는다)
 */
export function requireEnv(name: EnvName): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`.env 에 ${name} 값이 없습니다. .env 파일에 직접 채워 주세요.`);
  }
  return value;
}

/** 값이 채워져 있는지만 확인한다. (값은 돌려주지 않는다) */
export function hasEnv(name: EnvName): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim() !== "");
}

// 부처 목록은 화면에서도 쓰므로 lib/ministries.ts 로 옮기고, 기존 import 가 깨지지 않게 다시 내보낸다.
export { MINISTRIES } from "./ministries";
export type { Ministry } from "./ministries";
