/**
 * Reviewer gate for the deployed demo. Enabled only when REVIEWER_LOGIN and
 * REVIEWER_PASSWORD are set (Vercel); locally the app opens without a login.
 * The session cookie holds a SHA-256 of the credentials, so changing the
 * password on the server signs everybody out.
 */
export const SESSION_COOKIE = "akim_review";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type ReviewerCredentials = { login: string; password: string };

export function reviewerCredentials(): ReviewerCredentials | null {
  const login = process.env.REVIEWER_LOGIN?.trim();
  const password = process.env.REVIEWER_PASSWORD;
  return login && password ? { login, password } : null;
}

export async function sessionToken({ login, password }: ReviewerCredentials): Promise<string> {
  const bytes = new TextEncoder().encode(`akim-review:${login}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same-origin path to return to after login; anything else falls back to "/". */
export function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/";
}
