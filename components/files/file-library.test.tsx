import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_ERROR } from "@/lib/api";
import type { StoredFile } from "@/lib/files";
import { FileLibrary } from "./file-library";

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

const uploadFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/upload", () => ({ uploadFile }));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function file(id: number, overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: `id-${id}`,
    name: `image-${id}.png`,
    mime: "image/png",
    size: 412 * 1024,
    createdAt: "2026-10-04T12:00:00.000Z",
    url: `https://api.test/files/id-${id}`,
    ...overrides,
  };
}

const PDF = file(2, { name: "certificate.pdf", mime: "application/pdf", size: 1.2 * 1024 * 1024 });

function page(items: StoredFile[], pageNumber = 1, totalPages = 1, total = items.length) {
  return { items, page: pageNumber, totalPages, total };
}

function respondWith(...bodies: unknown[]) {
  for (const body of bodies) {
    fetchMock.mockImplementationOnce(async () => jsonResponse(200, body));
  }
}

async function renderLibrary(props: Partial<Parameters<typeof FileLibrary>[0]> = {}) {
  const view = render(<FileLibrary {...props} />);
  await act(async () => {});
  return view;
}

function cards() {
  return within(screen.getByRole("list", { name: "Files" })).getAllByRole("listitem");
}

function requestedUrls() {
  return fetchMock.mock.calls.map(([url]) => url);
}

describe("FileLibrary", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    uploadFile.mockReset();
    notify.mockReset();
    session.setToken.mockReset();
    session.token = "tok.en.value";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the first page with the token and shows each file", async () => {
    respondWith(page([file(1), PDF]));
    await renderLibrary();
    expect(requestedUrls()).toEqual(["http://api.test/files?page=1"]);
    expect(new Headers(fetchMock.mock.calls[0][1]!.headers).get("Authorization")).toBe(
      "Bearer tok.en.value",
    );
    const [image, pdf] = cards();
    expect(within(image).getByText("image-1.png")).toBeTruthy();
    expect(within(image).getByText("PNG · 412 KiB · Oct 4, 2026")).toBeTruthy();
    expect(image.querySelector("img")!.getAttribute("src")).toBe("https://api.test/files/id-1");
    expect(within(pdf).getByText("certificate.pdf")).toBeTruthy();
    expect(within(pdf).getByText("PDF · 1.2 MiB · Oct 4, 2026")).toBeTruthy();
    expect(pdf.querySelector("img")).toBeNull();
    expect(within(pdf).getByTestId("pdf-icon")).toBeTruthy();
  });

  it("shows an empty state", async () => {
    respondWith(page([]));
    await renderLibrary();
    expect(screen.getByText("No files yet.")).toBeTruthy();
  });

  it("filters by type and starts again at page 1", async () => {
    respondWith(page([file(1)], 1, 2, 60), page([file(51)], 2, 2, 60), page([PDF]), page([file(1)]));
    await renderLibrary();
    const filter = screen.getByRole("group", { name: "Filter by type" });
    expect(within(filter).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next" })));
    await act(async () => fireEvent.click(within(filter).getByRole("button", { name: "PDF" })));
    expect(within(filter).getByRole("button", { name: "PDF" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await act(async () => fireEvent.click(within(filter).getByRole("button", { name: "Images" })));
    expect(requestedUrls()).toEqual([
      "http://api.test/files?page=1",
      "http://api.test/files?page=2",
      "http://api.test/files?page=1&type=pdf",
      "http://api.test/files?page=1&type=image",
    ]);
  });

  it("pages through 50 files at a time with Previous and Next", async () => {
    const first = Array.from({ length: 50 }, (_, i) => file(i + 1));
    respondWith(page(first, 1, 2, 63), page([file(51)], 2, 2, 63), page(first, 1, 2, 63));
    await renderLibrary();
    expect(cards()).toHaveLength(50);
    const pagination = () => screen.getByRole("navigation", { name: "Pagination" });
    expect(within(pagination()).getByText("1–50 of 63")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next" })));
    expect(within(pagination()).getByText("51–51 of 63")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Previous" })));
    expect(requestedUrls().at(-1)).toBe("http://api.test/files?page=1");
  });

  it("Copy URL copies the file's URL", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    respondWith(page([file(1)]));
    await renderLibrary();
    await act(async () => fireEvent.click(within(cards()[0]).getByRole("button", { name: "Copy URL" })));
    expect(writeText).toHaveBeenCalledWith("https://api.test/files/id-1");
    expect(notify).toHaveBeenCalledWith("URL copied.");
  });

  it("shows a list error with a retry", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });
    respondWith(page([file(1)]));
    await renderLibrary();
    expect(screen.getByRole("alert").textContent).toBe(CONNECTION_ERROR);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(cards()).toHaveLength(1);
  });

  it("removes a deleted file from the grid", async () => {
    respondWith(page([file(1), PDF]), []);
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }));
    await renderLibrary();
    await act(async () => fireEvent.click(within(cards()[0]).getByRole("button", { name: "Delete" })));
    const dialog = screen.getByRole("dialog", { name: "Delete image-1.png?" });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete file" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]).getByText("certificate.pdf")).toBeTruthy();
    expect(notify).toHaveBeenCalledWith("File deleted.");
  });

  describe("pick mode", () => {
    it("offers Choose instead of Copy URL and Delete, and returns the file", async () => {
      const onPick = vi.fn();
      respondWith(page([file(1)]));
      await renderLibrary({ onPick });
      const card = cards()[0];
      expect(within(card).queryByRole("button", { name: "Delete" })).toBeNull();
      fireEvent.click(within(card).getByRole("button", { name: "Choose image-1.png" }));
      expect(onPick).toHaveBeenCalledWith(file(1));
    });

    it("lists only images and hides the filter when only images are accepted", async () => {
      respondWith(page([file(1)]));
      await renderLibrary({ onPick: vi.fn(), accept: ["image"] });
      expect(requestedUrls()).toEqual(["http://api.test/files?page=1&type=image"]);
      expect(screen.queryByRole("group", { name: "Filter by type" })).toBeNull();
    });
  });
});

describe("FileLibrary uploads", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    uploadFile.mockReset();
    notify.mockReset();
    session.setToken.mockReset();
    session.token = "tok.en.value";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function choose(selected: File) {
    const input = screen.getByLabelText("Upload a file") as HTMLInputElement;
    return act(async () => {
      fireEvent.change(input, { target: { files: [selected] } });
    });
  }

  function png(name = "architecture-v2.png", size = 3) {
    const selected = new File(["png"], name, { type: "image/png" });
    Object.defineProperty(selected, "size", { value: size });
    return selected;
  }

  it("the Upload button opens the file chooser limited to accepted types", async () => {
    respondWith(page([]));
    await renderLibrary();
    const input = screen.getByLabelText("Upload a file") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(click).toHaveBeenCalled();
    expect(input.accept).toContain("image/png");
    expect(input.accept).toContain("application/pdf");
  });

  it("refuses an unsupported file before uploading", async () => {
    respondWith(page([]));
    await renderLibrary();
    await choose(new File(["doc"], "notes.docx", { type: "application/msword" }));
    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("notes.docx: Unsupported file type.");
  });

  it("refuses a file over its limit before uploading", async () => {
    respondWith(page([]));
    await renderLibrary();
    await choose(png("big.png", 5 * 1024 * 1024 + 1));
    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("big.png is larger than 5 MiB.");
  });

  it("shows the progress, then puts the new file at the top", async () => {
    let finish!: (value: unknown) => void;
    let report!: (loaded: number, total: number) => void;
    uploadFile.mockImplementation((_file, _token, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => (finish = resolve));
    });
    respondWith(page([file(1)]));
    await renderLibrary();
    const selected = png();
    await choose(selected);
    expect(uploadFile).toHaveBeenCalledWith(selected, "tok.en.value", expect.any(Function));

    act(() => report(2.1 * 1024 * 1024, 3.3 * 1024 * 1024));
    const bar = screen.getByRole("progressbar", { name: "Uploading architecture-v2.png" });
    expect(bar.getAttribute("aria-valuenow")).toBe("64");
    expect(screen.getByText("64 % · 2.1 of 3.3 MiB")).toBeTruthy();

    const uploaded = file(9, { name: "architecture-v2.png" });
    await act(async () => finish({ ok: true, data: uploaded }));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(within(cards()[0]).getByText("architecture-v2.png")).toBeTruthy();
    expect(cards()).toHaveLength(2);
  });

  it("calls onUploaded with the stored file", async () => {
    const onUploaded = vi.fn();
    uploadFile.mockResolvedValue({ ok: true, data: file(9) });
    respondWith(page([]));
    await renderLibrary({ onUploaded });
    await choose(png());
    expect(onUploaded).toHaveBeenCalledWith(file(9));
  });

  it("shows the API error of a failed upload", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 400, error: "Unsupported file type." });
    respondWith(page([file(1)]));
    await renderLibrary();
    await choose(png("renamed.png"));
    expect(screen.getByRole("alert").textContent).toBe("renamed.png: Unsupported file type.");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(cards()).toHaveLength(1);
  });

  it("shows the connection error when the API cannot be reached", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 0 });
    respondWith(page([]));
    await renderLibrary();
    await choose(png("a.png"));
    expect(screen.getByRole("alert").textContent).toBe(`a.png: ${CONNECTION_ERROR}`);
  });

  it("offers the sign-in again on 401 and keeps the page", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    respondWith(page([file(1)]));
    await renderLibrary();
    await choose(png("a.png"));
    const dialog = screen.getByRole("dialog", { name: "Session expired" });
    await act(async () => fireEvent.click(within(dialog).getByText("mock Google sign-in")));
    expect(session.setToken).toHaveBeenCalledWith("fresh.token.value");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "a.png: Your session expired. Upload the file again.",
    );
    expect(cards()).toHaveLength(1);
  });
});
