import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_ERROR } from "@/lib/api";
import type { StoredFile } from "@/lib/files";
import type { ResumeAssignment, ResumeAssignments } from "@/lib/resume";
import { ResumeManager } from "./resume-manager";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const session = vi.hoisted(() => ({
  token: "tok.en.value",
  setToken: vi.fn(),
  onUnauthorized: vi.fn(async () => {}),
}));
vi.mock("@/components/session/session-provider", () => ({ useSession: () => session }));

const notify = vi.fn();
vi.mock("@/components/content/notice-provider", () => ({ useNotice: () => ({ notify }) }));

vi.mock("@/components/auth/google-sign-in-button", () => ({
  GoogleSignInButton: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button onClick={() => onSuccess("fresh.token.value")}>mock Google sign-in</button>
  ),
}));

// The real picker lists and uploads through the file library, which has its
// own tests; this stub hands back a library file or a freshly uploaded one.
const picker = vi.hoisted(() => ({
  accept: undefined as string[] | undefined,
  picked: {
    id: "9a3e",
    name: "Resume-2026.pdf",
    mime: "application/pdf",
    size: 200 * 1024,
    createdAt: "2026-10-18T12:00:00.000Z",
    url: "http://api.test/files/9a3e",
  },
  uploaded: {
    id: "4d2b",
    name: "Resume-uploaded.pdf",
    mime: "application/pdf",
    size: 210 * 1024,
    createdAt: "2026-10-18T12:00:00.000Z",
    url: "http://api.test/files/4d2b",
  },
}));
vi.mock("@/components/files/file-picker-dialog", () => ({
  FilePickerDialog: (props: {
    accept?: string[];
    onPick: (file: StoredFile) => void;
    onClose: () => void;
  }) => {
    picker.accept = props.accept;
    return (
      <div role="dialog" aria-label="Choose a file">
        <button onClick={() => props.onPick(picker.picked)}>mock pick</button>
        <button onClick={() => props.onPick(picker.uploaded)}>mock upload</button>
        <button onClick={props.onClose}>mock close</button>
      </div>
    );
  },
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function assignment(file: Partial<StoredFile>): ResumeAssignment {
  return {
    file: {
      id: "0b6f",
      name: "Marco-Figueroa-Resume.pdf",
      mime: "application/pdf",
      size: 182 * 1024,
      createdAt: "2026-10-18T12:00:00.000Z",
      url: "http://api.test/files/0b6f",
      ...file,
    },
    assignedAt: "2026-10-18T12:00:00.000Z",
  };
}

const EN = assignment({});
const ES = assignment({ id: "7c1d", name: "Marco-Figueroa-CV.pdf", url: "http://api.test/files/7c1d" });

async function renderManager(initial: ResumeAssignments | Response) {
  fetchMock.mockResolvedValueOnce(
    initial instanceof Response ? initial : jsonResponse(200, initial),
  );
  render(<ResumeManager />);
  await act(async () => {});
}

function section(name: "English" | "Spanish") {
  return screen.getByRole("region", { name });
}

function calls() {
  return fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`);
}

async function click(element: HTMLElement) {
  await act(async () => fireEvent.click(element));
}

describe("ResumeManager", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    notify.mockReset();
    session.setToken.mockReset();
    session.token = "tok.en.value";
    picker.accept = undefined;
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("loading", () => {
    it("loads the assignment with the token and shows English before Spanish", async () => {
      await renderManager({ en: EN, es: null });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://api.test/resume/assignments");
      expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer tok.en.value");
      const regions = screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"));
      expect(regions).toHaveLength(2);
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "English",
        "Spanish",
      ]);
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
    });

    it.each([
      ["the api's error", jsonResponse(500, { error: "Internal server error." }), "Internal server error."],
      ["the connection error", Response.error(), CONNECTION_ERROR],
    ])("shows %s and no actions when the load fails, then tries again", async (_case, response, text) => {
      if (response.type === "error") fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      else fetchMock.mockResolvedValueOnce(response);
      render(<ResumeManager />);
      await act(async () => {});
      expect(screen.getByRole("alert").textContent).toBe(text);
      expect(screen.queryByRole("region")).toBeNull();
      expect(screen.queryByRole("button", { name: "Choose PDF" })).toBeNull();

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { en: EN, es: null }));
      await click(screen.getByRole("button", { name: "Try again" }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(section("English")).toBeTruthy();
    });

    it("asks to sign in again on 401 and loads with the new token", async () => {
      await renderManager(jsonResponse(401, { error: "Unauthorized" }));
      expect(screen.getByRole("dialog", { name: "Session expired" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      await click(screen.getByRole("button", { name: "mock Google sign-in" }));
      expect(session.setToken).toHaveBeenCalledWith("fresh.token.value");
    });
  });

  describe("assigning", () => {
    it("opens the picker limited to PDFs from Choose PDF", async () => {
      await renderManager({ en: null, es: null });
      await click(within(section("English")).getByRole("button", { name: "Choose PDF" }));
      expect(screen.getByRole("dialog", { name: "Choose a file" })).toBeTruthy();
      expect(picker.accept).toEqual(["pdf"]);
    });

    it.each([
      ["picked from the library", "mock pick", "9a3e", "Resume-2026.pdf"],
      ["uploaded through the picker", "mock upload", "4d2b", "Resume-uploaded.pdf"],
    ])("assigns a PDF %s and shows the api's answer", async (_case, action, fileId, name) => {
      await renderManager({ en: null, es: null });
      await click(within(section("English")).getByRole("button", { name: "Choose PDF" }));
      const answer = { en: assignment({ id: fileId, name }), es: null };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, answer));
      await click(screen.getByRole("button", { name: action }));

      expect(screen.queryByRole("dialog", { name: "Choose a file" })).toBeNull();
      const [url, init] = fetchMock.mock.calls[1];
      expect(`${init!.method} ${url}`).toBe("PUT http://api.test/resume/assignments/en");
      expect(JSON.parse(init!.body as string)).toEqual({ fileId });
      expect(within(section("English")).getByText(name)).toBeTruthy();
      expect(notify).toHaveBeenCalledWith("Resume updated.");
    });

    it("replaces with a single PUT and never touches the previous file", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Replace" }));
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { en: assignment({ id: "9a3e", name: "Resume-2026.pdf" }), es: null }),
      );
      await click(screen.getByRole("button", { name: "mock pick" }));
      expect(calls()).toEqual([
        "GET http://api.test/resume/assignments",
        "PUT http://api.test/resume/assignments/en",
      ]);
      expect(within(section("English")).queryByText("Marco-Figueroa-Resume.pdf")).toBeNull();
    });

    it("sends nothing when the picker is closed", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Replace" }));
      await click(screen.getByRole("button", { name: "mock close" }));
      expect(screen.queryByRole("dialog", { name: "Choose a file" })).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
    });
  });

  describe("clearing", () => {
    it("confirms with the effect on the public link, then clears", async () => {
      await renderManager({ en: EN, es: ES });
      await click(within(section("Spanish")).getByRole("button", { name: "Clear" }));
      const dialog = screen.getByRole("dialog", { name: "Clear the Spanish resume?" });
      expect(dialog.textContent).toContain("Visitors of the Spanish site will get the English resume.");
      expect(dialog.textContent).toContain("The PDF stays in Files.");

      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await click(within(dialog).getByRole("button", { name: "Clear" }));
      expect(calls()[1]).toBe("DELETE http://api.test/resume/assignments/es");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        within(section("Spanish")).getByText(
          "No Spanish resume. Visitors of the Spanish site get the English resume.",
        ),
      ).toBeTruthy();
      expect(notify).toHaveBeenCalledWith("Resume cleared.");
    });

    it("warns that clearing English stops the public download", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Clear" }));
      const dialog = screen.getByRole("dialog", { name: "Clear the English resume?" });
      expect(dialog.textContent).toContain(
        "The public download will stop working until another English PDF is assigned.",
      );
    });

    it("sends nothing when the confirmation is cancelled", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Clear" }));
      await click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
    });
  });

  describe("pending and errors", () => {
    it("disables only the busy section while its request is pending", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Replace" }));
      let resolve!: (response: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      await click(screen.getByRole("button", { name: "mock pick" }));

      expect(within(section("English")).getByRole("button", { name: "Replace" }).hasAttribute("disabled")).toBe(true);
      expect(within(section("Spanish")).getByRole("button", { name: "Choose PDF" }).hasAttribute("disabled")).toBe(false);
      await act(async () => resolve(jsonResponse(200, { en: EN, es: null })));
      expect(within(section("English")).getByRole("button", { name: "Replace" }).hasAttribute("disabled")).toBe(false);
    });

    it.each([
      [400, "File is not a PDF."],
      [404, "File not found."],
    ])("shows a %i on assign in the section and keeps the previous file", async (status, error) => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Replace" }));
      fetchMock.mockResolvedValueOnce(jsonResponse(status, { error }));
      await click(screen.getByRole("button", { name: "mock pick" }));
      expect(within(section("English")).getByRole("alert").textContent).toBe(error);
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
      expect(within(section("Spanish")).queryByRole("alert")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("shows a failed clear in the section, and the connection error when unreachable", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Clear" }));
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "Internal server error." }));
      await click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
      expect(within(section("English")).getByRole("alert").textContent).toBe("Internal server error.");
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();

      await click(within(section("English")).getByRole("button", { name: "Clear" }));
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
      expect(within(section("English")).getByRole("alert").textContent).toBe(CONNECTION_ERROR);
    });

    it("reloads the assignment after a 409, keeping the message", async () => {
      // Another tab assigned Spanish meanwhile: clearing English is refused.
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Clear" }));
      fetchMock
        .mockResolvedValueOnce(jsonResponse(409, { error: "Clear the Spanish resume first." }))
        .mockResolvedValueOnce(jsonResponse(200, { en: EN, es: ES }));
      await click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
      expect(calls()).toEqual([
        "GET http://api.test/resume/assignments",
        "DELETE http://api.test/resume/assignments/en",
        "GET http://api.test/resume/assignments",
      ]);
      expect(within(section("English")).getByRole("alert").textContent).toBe(
        "Clear the Spanish resume first.",
      );
      expect(within(section("Spanish")).getByText("Marco-Figueroa-CV.pdf")).toBeTruthy();
    });

    it("asks to sign in again on a 401 change and keeps what it shows", async () => {
      await renderManager({ en: EN, es: null });
      await click(within(section("English")).getByRole("button", { name: "Replace" }));
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
      await click(screen.getByRole("button", { name: "mock pick" }));
      expect(screen.getByRole("dialog", { name: "Session expired" })).toBeTruthy();
      expect(within(section("English")).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
      expect(within(section("English")).queryByRole("alert")).toBeNull();
    });
  });
});
