"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { tokenExpiry } from "@/lib/token";

// The cookie lives exactly as long as the token. It is httpOnly, so page
// scripts never read it; the token reaches the client only through the
// admin layout, into memory. Safari drops Secure cookies on http://localhost,
// so only the dev server leaves it out; any other build keeps it (plan D9).
export async function createSession(accessToken: string): Promise<void> {
  const exp = tokenExpiry(accessToken);
  if (exp === null) return;
  const maxAge = exp - Math.floor(Date.now() / 1000);
  if (maxAge <= 0) return;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
