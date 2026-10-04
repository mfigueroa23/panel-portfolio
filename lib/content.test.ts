import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createItem, deleteItem, listItems, updateItem } from "./content";

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

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init: init!, headers: new Headers(init!.headers) };
}

describe("content", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listItems", () => {
    it("reads the public endpoint with no-store and no token", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, []));
      await listItems("experience");
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/experiences");
      expect(init.method).toBe("GET");
      expect(init.cache).toBe("no-store");
      expect(headers.has("Authorization")).toBe(false);
    });

    it("sorts by position, then id", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, [
          { id: 3, position: 1, name: "c" },
          { id: 2, position: 0, name: "b" },
          { id: 5, position: 1, name: "e" },
          { id: 1, position: 0, name: "a" },
        ]),
      );
      const result = await listItems("technologies");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.map((item) => item.id)).toEqual([1, 2, 3, 5]);
    });

    it("returns the API error unchanged", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { error: "Internal server error." }));
      expect(await listItems("projects")).toEqual({
        ok: false,
        status: 500,
        error: "Internal server error.",
      });
    });

    it("returns status 0 when the API cannot be reached", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      expect(await listItems("projects")).toEqual({ ok: false, status: 0 });
    });
  });

  describe("createItem", () => {
    it("POSTs the values to the collection with the Bearer token", async () => {
      const created = { id: 9, position: 2, name: "Rust" };
      fetchMock.mockResolvedValue(jsonResponse(201, created));
      const result = await createItem(
        "technologies",
        { position: 2, name: "Rust" },
        "tok.en.value",
      );
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/technologies");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ position: 2, name: "Rust" }));
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
      expect(result).toEqual({ ok: true, data: created });
    });
  });

  describe("updateItem", () => {
    it("PUTs the values to the item with the Bearer token", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 4, position: 0, icon: "x" }));
      await updateItem(
        "social-links",
        4,
        { position: 0, icon: "x", href: "https://x.test" },
        "tok.en.value",
      );
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/social-links/4");
      expect(init.method).toBe("PUT");
      expect(init.body).toBe(
        JSON.stringify({ position: 0, icon: "x", href: "https://x.test" }),
      );
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
    });

    it("returns a 404 as an API error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
      expect(await updateItem("highlights", 99, {}, "t.o.k")).toEqual({
        ok: false,
        status: 404,
        error: "Not found.",
      });
    });
  });

  describe("deleteItem", () => {
    it("DELETEs the item with the Bearer token and no body", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      const result = await deleteItem("contact-info", 3, "tok.en.value");
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/contact-info/3");
      expect(init.method).toBe("DELETE");
      expect(init.body).toBeUndefined();
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
      expect(result).toEqual({ ok: true, data: undefined });
    });
  });
});
