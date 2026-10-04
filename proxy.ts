import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { isLive } from "@/lib/token";

// A UX redirect only: the token's signature is not checked here, because the
// API rejects any forged or expired token with 401.
export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isLive(token)) {
    const response = NextResponse.redirect(new URL("/login?expired=1", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Everything except /login, Next's own assets and files with an extension.
  matcher: ["/((?!login(?:/|$)|_next/|.*\\.[^/]+$).*)"],
};
