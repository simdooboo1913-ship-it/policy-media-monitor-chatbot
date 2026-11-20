// Design Ref: §7 — 모든 요청 앞에서 로그인 쿠키를 확인한다. (이 Next.js 버전의 이름은 proxy, 예전 middleware)
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// 로그인 확인 없이 열어 두는 기능 주소 (접속 화면 /login 은 아래에서 따로 처리한다)
const LOGIN_API_PATH = "/api/login";
// 자동 실행 주소는 쿠키 대신 CRON_SECRET 으로 따로 확인한다. (개발 순서 14번에서 만든다)
const CRON_PREFIX = "/api/cron/";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === LOGIN_API_PATH) return NextResponse.next();
  if (pathname.startsWith(CRON_PREFIX)) return NextResponse.next();

  const loggedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET, // 비밀 값이 없으면 항상 로그인 안 된 것으로 본다
  );

  if (pathname === "/login") {
    // 이미 로그인했다면 접속 화면 대신 메인 화면으로 보낸다.
    return loggedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (loggedIn) return NextResponse.next();

  // 로그인이 안 된 요청: 기능 주소는 401, 화면은 접속 화면으로 보낸다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // 정적 파일(_next/static, _next/image, 아이콘)은 확인하지 않는다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
