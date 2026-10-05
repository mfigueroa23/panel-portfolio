import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "./markdown";

vi.mock("./config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const fetchMock = vi.fn<typeof fetch>();

describe("renderMarkdown", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the Markdown to /markdown/render with the token", async () => {
    const rendered = { html: "<h2 id=\"a\">A</h2>", toc: [], readingMinutes: 1 };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rendered), { status: 200 }));
    expect(await renderMarkdown("## A", "tok.en.value")).toEqual({ ok: true, data: rendered });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/markdown/render");
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe(JSON.stringify({ markdown: "## A" }));
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("returns API errors as data", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
    expect(await renderMarkdown("x", "t.o.k")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });
});
