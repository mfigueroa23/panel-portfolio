import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle } from "./auth";

vi.mock("./config", () => ({
  API_URL: "http://api.test",
  GOOGLE_CLIENT_ID: "",
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("signInWithGoogle", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the Google credential to /auth/google without a Bearer token", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken: "api.jwt.token", expiresIn: 3600 }),
    );
    const result = await signInWithGoogle("google-id-token");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/auth/google");
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe(JSON.stringify({ credential: "google-id-token" }));
    expect(new Headers(init!.headers).has("Authorization")).toBe(false);
    expect(result).toEqual({
      ok: true,
      data: { accessToken: "api.jwt.token", expiresIn: 3600 },
    });
  });

  it("returns the API's error text", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: "This Google account is not authorized." }),
    );
    expect(await signInWithGoogle("other-account")).toEqual({
      ok: false,
      status: 403,
      error: "This Google account is not authorized.",
    });
  });

  it("returns status 0 when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await signInWithGoogle("google-id-token")).toEqual({
      ok: false,
      status: 0,
    });
  });
});
