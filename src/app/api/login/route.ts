/** POST /api/login — reviewer form: sets the session cookie or returns to /login?error=1. */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reviewerCredentials, safeNext, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/auth/session";

const FAILED_ATTEMPT_DELAY_MS = 600;

const digest = (value: string) => createHash("sha256").update(value).digest();
const sameSecret = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export async function POST(request: Request) {
  const credentials = reviewerCredentials();
  const form = await request.formData().catch(() => null);
  const next = safeNext(form?.get("next"));
  if (!credentials) return NextResponse.redirect(new URL(next, request.url), 303);

  const login = String(form?.get("login") ?? "").trim();
  const password = String(form?.get("password") ?? "");
  const ok = sameSecret(login, credentials.login) && sameSecret(password, credentials.password);
  if (!ok) {
    // Slow down guessing; the credentials are public for the jury anyway.
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS));
    const back = new URL("/login", request.url);
    back.searchParams.set("error", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, await sessionToken(credentials), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
