import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveItem,
  createItem,
  deleteItem,
  listItems,
  pendingCount,
  publishItem,
  unpublishItem,
  updateItem,
} from "./content";

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

    it("reads the admin list with the token where the collection has one", async () => {
      fetchMock.mockImplementation(async () => jsonResponse(200, []));
      await listItems("posts", "tok.en.value");
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/posts/all");
      expect(init.cache).toBe("no-store");
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
      await listItems("projects", "tok.en.value");
      expect(lastCall().url).toBe("http://api.test/content/projects/all");
    });

    it("sorts projects with drafts first, then by publication date descending", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, [
          { id: 1, status: "published", publishedAt: "2026-09-01T00:00:00.000Z" },
          { id: 2, status: "published", publishedAt: "2026-10-01T00:00:00.000Z" },
          { id: 3, status: "draft", publishedAt: null },
        ]),
      );
      const result = await listItems("projects", "tok.en.value");
      expect(result.ok && result.data.map((item) => item.id)).toEqual([3, 2, 1]);
    });

    it("sorts experience by current, then start month descending", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, [
          { id: 1, current: false, startDate: "2020-01" },
          { id: 2, current: false, startDate: null },
          { id: 3, current: true, startDate: "2018-01" },
          { id: 4, current: false, startDate: "2023-06" },
        ]),
      );
      const result = await listItems("experience");
      expect(result.ok && result.data.map((item) => item.id)).toEqual([3, 4, 1, 2]);
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

  describe("publishItem and unpublishItem", () => {
    it("POSTs to /:id/publish with the token", async () => {
      const published = { id: 4, status: "published", publishedAt: "2026-10-04T00:00:00.000Z" };
      fetchMock.mockResolvedValue(jsonResponse(200, published));
      expect(await publishItem("posts", 4, "tok.en.value")).toEqual({ ok: true, data: published });
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/posts/4/publish");
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
    });

    it("POSTs to /:id/unpublish with the token", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 4, status: "draft" }));
      await unpublishItem("projects", 4, "tok.en.value");
      const { url, init } = lastCall();
      expect(url).toBe("http://api.test/content/projects/4/unpublish");
      expect(init.method).toBe("POST");
    });

    it("returns the missing fields of a refused publish", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, { error: "Validation failed.", fields: { summary: ["Required."] } }),
      );
      expect(await publishItem("posts", 4, "t.o.k")).toEqual({
        ok: false,
        status: 400,
        error: "Validation failed.",
        fields: { summary: ["Required."] },
      });
    });
  });

  describe("approveItem", () => {
    it("POSTs the form values to /:id/approve with the token", async () => {
      const approved = { id: 4, status: "approved", position: 0 };
      fetchMock.mockResolvedValue(jsonResponse(200, approved));
      const values = { quote: "Great.", author: "Ada", role: "CTO", avatar: null };
      expect(await approveItem("testimonials", 4, values, "tok.en.value")).toEqual({
        ok: true,
        data: approved,
      });
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/testimonials/4/approve");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify(values));
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
    });

    it("returns a 404 as an API error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
      expect(await approveItem("testimonials", 99, {}, "t.o.k")).toEqual({
        ok: false,
        status: 404,
        error: "Not found.",
      });
    });
  });

  describe("pendingCount", () => {
    it("GETs the pending count with the token, never cached", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { count: 3 }));
      expect(await pendingCount("tok.en.value")).toEqual({ ok: true, data: 3 });
      const { url, init, headers } = lastCall();
      expect(url).toBe("http://api.test/content/testimonials/pending-count");
      expect(init.method).toBe("GET");
      expect(init.cache).toBe("no-store");
      expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
    });

    it("returns the API error unchanged", async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
      expect(await pendingCount("t.o.k")).toEqual({
        ok: false,
        status: 401,
        error: "Unauthorized",
      });
    });
  });
});
