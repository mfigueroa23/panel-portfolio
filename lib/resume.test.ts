import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LANG_LABELS,
  RESUME_LANGS,
  assignResume,
  clearResume,
  getAssignments,
  publicResumeUrl,
  type ResumeAssignments,
} from "./resume";

vi.mock("./config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init: init!, headers: new Headers(init!.headers) };
}

// The api's answer as documented in api Plan 005; pinned here (constitution §5).
const ASSIGNMENTS: ResumeAssignments = {
  en: {
    file: {
      id: "0b6f",
      name: "Marco-Figueroa-Resume.pdf",
      mime: "application/pdf",
      size: 182_000,
      createdAt: "2026-10-18T09:00:00.000Z",
      url: "http://api.test/files/0b6f",
    },
    assignedAt: "2026-10-18T09:05:00.000Z",
  },
  es: null,
};

describe("resume languages", () => {
  it("lists English first, then Spanish, with their labels", () => {
    expect(RESUME_LANGS).toEqual(["en", "es"]);
    expect(LANG_LABELS).toEqual({ en: "English", es: "Spanish" });
  });
});

describe("publicResumeUrl", () => {
  it("names the language explicitly for both resumes", () => {
    expect(publicResumeUrl("en")).toBe("http://api.test/resume?lang=en");
    expect(publicResumeUrl("es")).toBe("http://api.test/resume?lang=es");
  });
});

describe("resume API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getAssignments reads both languages with the token, uncached", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ASSIGNMENTS));
    expect(await getAssignments("tok.en.value")).toEqual({ ok: true, data: ASSIGNMENTS });
    const { url, init, headers } = lastCall();
    expect(url).toBe("http://api.test/resume/assignments");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("assignResume sends PUT with the file id for the language", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ASSIGNMENTS));
    expect(await assignResume("es", "0b6f", "tok.en.value")).toEqual({
      ok: true,
      data: ASSIGNMENTS,
    });
    const { url, init, headers } = lastCall();
    expect(url).toBe("http://api.test/resume/assignments/es");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ fileId: "0b6f" });
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("clearResume sends DELETE for the language", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await clearResume("en", "tok.en.value")).toEqual({ ok: true, data: undefined });
    const { url, init, headers } = lastCall();
    expect(url).toBe("http://api.test/resume/assignments/en");
    expect(init.method).toBe("DELETE");
    expect(headers.get("Authorization")).toBe("Bearer tok.en.value");
  });

  it.each([
    [400, "File is not a PDF."],
    [404, "File not found."],
    [409, "Assign an English resume first."],
  ])("returns the api's %i answer as an error", async (status, error) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error }));
    expect(await assignResume("es", "0b6f", "tok.en.value")).toEqual({
      ok: false,
      status,
      error,
    });
  });
});
