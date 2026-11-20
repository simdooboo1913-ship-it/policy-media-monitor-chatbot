// 서명·비교에 쓰는 도구. 브라우저·서버 어디서나 있는 Web Crypto 만 사용한다.
// (proxy.ts 가 실행되는 환경에서도 동작하게 하기 위함)

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** 비밀 값(secret)으로 메시지에 서명하고 16진수 문자열로 돌려준다. (HMAC-SHA256) */
export async function signHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** 두 문자열이 같은지 비교한다. 걸리는 시간으로 내용을 추측하지 못하도록 끝까지 비교한다. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
