// Reads the JWT's `exp` only to decide redirects and cookie lifetime. The
// signature is not checked here: the API rejects forged or expired tokens.
const LIVE_MARGIN_MS = 5_000;

/** The token's `exp` in seconds since the epoch, or null if unreadable. */
export function tokenExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object") return null;
    const { exp } = payload as { exp?: unknown };
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** True while `exp` is more than 5 s ahead of `now` (milliseconds). */
export function isLive(token: string, now: number = Date.now()): boolean {
  const exp = tokenExpiry(token);
  return exp !== null && exp * 1000 - now > LIVE_MARGIN_MS;
}
