import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_ERROR } from "./api";
import { uploadFile } from "./upload";

vi.mock("./config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

// Minimal XMLHttpRequest stand-in: records the request and lets each test
// drive progress and the outcome by hand.
class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.onload?.();
  }
}

const STORED = {
  id: "8f2c",
  name: "Diseño final.png",
  mime: "image/png",
  size: 3,
  createdAt: "2026-10-04T10:00:00.000Z",
  url: "https://api.test/files/8f2c",
};

function png(): File {
  return new File(["png"], "Diseño final.png", { type: "image/png" });
}

describe("uploadFile", () => {
  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the raw bytes to /files?name= with the Bearer token", async () => {
    const file = png();
    const pending = uploadFile(file, "tok.en.value");
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("http://api.test/files?name=Dise%C3%B1o%20final.png");
    expect(xhr.headers).toEqual({
      "Content-Type": "application/octet-stream",
      Authorization: "Bearer tok.en.value",
    });
    expect(xhr.body).toBe(file);
    xhr.respond(201, STORED);
    expect(await pending).toEqual({ ok: true, data: STORED });
  });

  it("reports progress as loaded and total bytes", async () => {
    const onProgress = vi.fn();
    const pending = uploadFile(png(), "t.o.k", onProgress);
    FakeXhr.last.progress(1, 3);
    FakeXhr.last.progress(3, 3);
    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [3, 3],
    ]);
    FakeXhr.last.respond(201, STORED);
    await pending;
  });

  it("maps a 400 to the API's error text", async () => {
    const pending = uploadFile(png(), "t.o.k");
    FakeXhr.last.respond(400, { error: "Unsupported file type." });
    expect(await pending).toEqual({ ok: false, status: 400, error: "Unsupported file type." });
  });

  it("maps a 401 so the caller can offer the sign-in again", async () => {
    const pending = uploadFile(png(), "t.o.k");
    FakeXhr.last.respond(401, { error: "Unauthorized" });
    expect(await pending).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("maps a non-JSON answer to a generic error with the status", async () => {
    const pending = uploadFile(png(), "t.o.k");
    FakeXhr.last.respond(413, "<html>Too large</html>");
    expect(await pending).toEqual({ ok: false, status: 413, error: "Request failed (413)." });
  });

  it.each(["onerror", "onabort", "ontimeout"] as const)(
    "maps %s to status 0 (connection error)",
    async (handler) => {
      const pending = uploadFile(png(), "t.o.k");
      FakeXhr.last[handler]?.();
      const result = await pending;
      expect(result).toEqual({ ok: false, status: 0 });
      expect(CONNECTION_ERROR).toBeTruthy();
    },
  );
});
