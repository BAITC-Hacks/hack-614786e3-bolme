import { NextResponse, type NextRequest } from "next/server";
import { reviewerCredentials, SESSION_COOKIE, sessionToken } from "@/auth/session";

/** Everything except the login page (and its backdrop) needs a reviewer session. */
export async function proxy(request: NextRequest) {
  const credentials = reviewerCredentials();
  if (!credentials) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname === "/api/login") return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(credentials))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
