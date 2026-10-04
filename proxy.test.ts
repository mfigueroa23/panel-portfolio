import { NextRequest } from "next/server";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { tokenExpiringIn } from "@/test/tokens";
import { config, proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  const req = new NextRequest(`https://panel.test${path}`);
  if (cookie) req.cookies.set("panel_session", cookie);
  return req;
}

describe("proxy", () => {
  it("redirects to /login without a session cookie", () => {
    const response = proxy(request("/experience"));
    expect(getRedirectUrl(response)).toBe("https://panel.test/login");
  });

  it("deletes an expired cookie and redirects to /login?expired=1", () => {
    const response = proxy(request("/experience", tokenExpiringIn(-10)));
    expect(getRedirectUrl(response)).toBe("https://panel.test/login?expired=1");
    const cleared = response.cookies.get("panel_session");
    expect(cleared?.value).toBe("");
    expect(response.headers.get("set-cookie")).toMatch(/panel_session=;/);
  });

  it("treats a malformed cookie as expired", () => {
    const response = proxy(request("/projects", "garbage"));
    expect(getRedirectUrl(response)).toBe("https://panel.test/login?expired=1");
  });

  it("lets a request with a live cookie through", () => {
    const response = proxy(request("/experience", tokenExpiringIn(3600)));
    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/", "/experience", "/projects/3/edit", "/technologies/new"])(
    "runs on %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/login",
    "/login?expired=1",
    "/_next/static/chunks/main.js",
    "/_next/image?url=x",
    "/favicon.ico",
    "/robots.txt",
  ])("does not run on %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
