// src/middleware.ts (또는 루트의 middleware.ts)
// 로그인이 필요한 모든 페이지를 일괄 보호
// NextAuth JWT 기반 — 별도 DB 조회 없이 엣지에서 처리

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// ── 보호가 필요한 경로 패턴 ──────────────────────────────
const PROTECTED_PATHS = [
  "/dashboard",
  "/chat",
  "/files",
  "/profile",
  "/settings",
  "/notifications",
  "/trash",
  "/search",
  "/posts",
  "/users",
  "/admin",
  "/shared",
];

// ── 관리자 전용 경로 ─────────────────────────────────────
const ADMIN_PATHS = ["/admin"];

// ── 공개 경로 (로그인 상태에서 접근 시 대시보드 리디렉션) ─
const PUBLIC_ONLY_PATHS = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, API 인증 엔드포인트는 스킵
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/share") ||   // 공개 파일 공유
    pathname.startsWith("/share") ||
    pathname.startsWith("/offline") ||
    pathname === "/" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isAdmin = token?.role === "ADMIN";

  // ── 로그인 상태에서 공개 전용 페이지 접근 → 대시보드로 ─
  if (isAuthenticated && PUBLIC_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── 보호된 페이지 접근 ────────────────────────────────
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 관리자 페이지 접근 ────────────────────────────────
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  // ── 정지된 사용자 차단 ────────────────────────────────
  // token에 isBanned 커스텀 클레임을 포함시켜야 함 (authOptions의 jwt callback에서 처리)
  if (token?.isBanned && isProtected) {
    const bannedUrl = new URL("/banned", request.url);
    return NextResponse.redirect(bannedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청에 적용:
     * - api/auth (NextAuth 자체 라우트)
     * - _next/static, _next/image (정적 파일)
     * - favicon.ico
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
