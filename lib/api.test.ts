import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, CONNECTION_ERROR } from "./api";

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

const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;

describe("apiFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    for (const method of consoleMethods) vi.spyOn(console, method);
  });

  afterEach(() => {
    // No request, token or body may ever be logged.
    for (const method of consoleMethods) {
      expect(console[method]).not.toHaveBeenCalled();
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("prefixes the path with the API base URL from lib/config", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiFetch("/content/technologies", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/content/technologies",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("maps a 2xx JSON response to { ok: true, data }", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 7, name: "Go" }));
    const result = await apiFetch<{ id: number; name: string }>(
      "/content/technologies",
      { method: "POST", body: { name: "Go" } },
    );
    expect(result).toEqual({ ok: true, data: { id: 7, name: "Go" } });
  });

  it("maps a 204 response to { ok: true } without data", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await apiFetch("/content/technologies/7", {
      method: "DELETE",
    });
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("sends the body as JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    await apiFetch("/content/technologies", {
      method: "POST",
      body: { name: "Go", position: 1 },
    });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.body).toBe(JSON.stringify({ name: "Go", position: 1 }));
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("sends the token as a Bearer Authorization header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await apiFetch("/content/technologies/1", {
      method: "PUT",
      body: {},
      token: "abc.def.ghi",
    });
    const init = fetchMock.mock.calls[0][1]!;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer abc.def.ghi",
    );
  });

  it("sends no Authorization header without a token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiFetch("/content/technologies", { method: "GET" });
    const init = fetchMock.mock.calls[0][1]!;
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("passes the cache mode through", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiFetch("/content/technologies", {
      method: "GET",
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("maps an API error with field errors to { ok: false, status, error, fields }", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: "Validation failed.",
        fields: { name: ["name should not be empty"] },
      }),
    );
    const result = await apiFetch("/content/technologies", {
      method: "POST",
      body: { name: "" },
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Validation failed.",
      fields: { name: ["name should not be empty"] },
    });
  });

  it("maps an API error without fields to { ok: false, status, error }", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
    const result = await apiFetch("/content/technologies/99", {
      method: "DELETE",
    });
    expect(result).toEqual({ ok: false, status: 404, error: "Not found." });
  });

  it("gives a generic error text when the error body is not the API's JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad gateway</html>", { status: 502 }),
    );
    const result = await apiFetch("/content/technologies", { method: "GET" });
    expect(result).toEqual({
      ok: false,
      status: 502,
      error: "Request failed (502).",
    });
  });

  it("maps a network failure to { ok: false, status: 0 }", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await apiFetch("/content/technologies", {
      method: "POST",
      body: { name: "Go" },
      token: "secret.token.value",
    });
    expect(result).toEqual({ ok: false, status: 0 });
  });

  it("exposes the generic connection error text", () => {
    expect(CONNECTION_ERROR).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
  });
});
