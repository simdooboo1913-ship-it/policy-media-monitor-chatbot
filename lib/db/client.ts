// Design Ref: §4.3 — 데이터 보관함(Supabase)에 서버에서만 접속한다.
// 서비스 키는 모든 권한을 가지므로 브라우저로 내려보내지 않는다. (lib/config.ts 가 브라우저 사용을 막는다)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "../config";

let cached: SupabaseClient | null = null;

/** 보관함 연결을 돌려준다. 처음 한 번만 만들고 이후에는 재사용한다. */
export function getDb(): SupabaseClient {
  if (cached === null) {
    cached = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      // 서버에서 매번 새로 요청하므로 로그인 세션을 저장하지 않는다.
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}

/** 보관함 오류를 한국어 메시지로 바꿔 던진다. (오류 내용에 비밀 값은 들어 있지 않다) */
export function throwDbError(action: string, message: string): never {
  throw new Error(`보관함 ${action} 중 오류가 났습니다: ${message}`);
}
