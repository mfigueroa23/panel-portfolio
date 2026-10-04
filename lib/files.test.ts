import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCEPTED_TYPES,
  LIMITS,
  deleteFile,
  fileKind,
  fileReferences,
  formatSize,
  listFiles,
  markdownFor,
  validateFile,
  type StoredFile,
} from "./files";

vi.mock("./config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const MiB = 1024 * 1024;

// A File whose `size` is faked, so boundary tests need no real megabytes.
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function stored(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: "8f2c",
    name: "upload-flow.png",
    mime: "image/png",
    size: 1000,
    createdAt: "2026-10-04T10:00:00.000Z",
    url: "https://api.test/files/8f2c",
    ...overrides,
  };
}

describe("accepted types and limits", () => {
  it("accepts PNG, JPEG, WebP, GIF, SVG and PDF", () => {
    expect(ACCEPTED_TYPES.map((type) => type.mime)).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "application/pdf",
    ]);
  });

  it("limits images to 5 MiB and PDFs to 10 MiB", () => {
    expect(LIMITS).toEqual({ image: 5_242_880, pdf: 10_485_760 });
  });
});

describe("validateFile", () => {
  it("rejects another type with 'Unsupported file type.'", () => {
    expect(validateFile(fakeFile("notes.docx", "application/msword", 10))).toBe(
      "Unsupported file type.",
    );
    expect(validateFile(fakeFile("script.html", "text/html", 10))).toBe(
      "Unsupported file type.",
    );
  });

  it.each([
    ["photo.png", "image/png"],
    ["photo.JPG", "image/jpeg"],
    ["photo.jpeg", ""],
    ["photo.webp", "image/webp"],
    ["anim.gif", "image/gif"],
    ["diagram.svg", "image/svg+xml"],
    ["cert.pdf", "application/pdf"],
  ])("accepts %s (%s)", (name, type) => {
    expect(validateFile(fakeFile(name, type, 100))).toBeNull();
  });

  it("accepts an image of exactly 5 MiB and rejects one byte more", () => {
    expect(validateFile(fakeFile("big.png", "image/png", 5 * MiB))).toBeNull();
    expect(validateFile(fakeFile("big.png", "image/png", 5 * MiB + 1))).toBe(
      "big.png is larger than 5 MiB.",
    );
  });

  it("accepts a PDF of exactly 10 MiB and rejects one byte more", () => {
    expect(validateFile(fakeFile("cv.pdf", "application/pdf", 10 * MiB))).toBeNull();
    expect(validateFile(fakeFile("cv.pdf", "application/pdf", 10 * MiB + 1))).toBe(
      "cv.pdf is larger than 10 MiB.",
    );
  });

  it("only allows the kinds passed in `accept`", () => {
    expect(validateFile(fakeFile("cv.pdf", "application/pdf", 10), ["image"])).toBe(
      "Unsupported file type.",
    );
    expect(validateFile(fakeFile("a.png", "image/png", 10), ["image"])).toBeNull();
  });
});

describe("fileKind", () => {
  it("tells images from PDFs by MIME type", () => {
    expect(fileKind("image/svg+xml")).toBe("image");
    expect(fileKind("application/pdf")).toBe("pdf");
  });
});

describe("markdownFor", () => {
  it("inserts an image with the name without extension as alt text", () => {
    expect(markdownFor(stored())).toBe("![upload-flow](https://api.test/files/8f2c)");
    expect(markdownFor(stored({ name: "archive.v2.final.webp", mime: "image/webp" }))).toBe(
      "![archive.v2.final](https://api.test/files/8f2c)",
    );
  });

  it("inserts a PDF as a link with the full file name", () => {
    expect(markdownFor(stored({ name: "cv 2026.pdf", mime: "application/pdf" }))).toBe(
      "[cv 2026.pdf](https://api.test/files/8f2c)",
    );
  });

  it("escapes brackets so the name cannot break the Markdown", () => {
    expect(markdownFor(stored({ name: "[certificate].pdf", mime: "application/pdf" }))).toBe(
      "[\\[certificate\\].pdf](https://api.test/files/8f2c)",
    );
  });
});

describe("formatSize", () => {
  it("shows bytes, KiB and MiB", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(412 * 1024)).toBe("412 KiB");
    expect(formatSize(1.2 * MiB)).toBe("1.2 MiB");
  });
});

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init: init!, headers: new Headers(init!.headers) };
}

describe("files API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listFiles reads a page with the token, optionally filtered by type", async () => {
    const page = { items: [stored()], page: 2, totalPages: 3, total: 120 };
    fetchMock.mockResolvedValue(jsonResponse(200, page));
    expect(await listFiles(2, "pdf", "tok.en.value")).toEqual({ ok: true, data: page });
    const { url, init, headers } = lastCall();
    expect(url).toBe("http://api.test/files?page=2&type=pdf");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");

    await listFiles(1, undefined, "tok.en.value");
    expect(lastCall().url).toBe("http://api.test/files?page=1");
  });

  it("fileReferences reads the references of a file", async () => {
    const refs = [{ collection: "posts", id: 3, title: "Uploads", status: "draft" }];
    fetchMock.mockResolvedValue(jsonResponse(200, refs));
    expect(await fileReferences("8f2c", "tok.en.value")).toEqual({ ok: true, data: refs });
    const { url, headers } = lastCall();
    expect(url).toBe("http://api.test/files/8f2c/references");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("deleteFile sends DELETE with the token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await deleteFile("8f2c", "tok.en.value")).toEqual({ ok: true, data: undefined });
    const { url, init, headers } = lastCall();
    expect(url).toBe("http://api.test/files/8f2c");
    expect(init.method).toBe("DELETE");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
  });
});
