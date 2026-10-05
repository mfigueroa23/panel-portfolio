import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredFile } from "@/lib/files";
import { FilePickerDialog } from "./file-picker-dialog";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const session = vi.hoisted(() => ({
  token: "tok.en.value",
  setToken: vi.fn(),
  onUnauthorized: vi.fn(async () => {}),
}));
vi.mock("@/components/session/session-provider", () => ({ useSession: () => session }));
vi.mock("@/components/content/notice-provider", () => ({ useNotice: () => ({ notify: vi.fn() }) }));

const uploadFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/upload", () => ({ uploadFile }));

const fetchMock = vi.fn<typeof fetch>();

const IMAGE: StoredFile = {
  id: "a1",
  name: "cover.webp",
  mime: "image/webp",
  size: 188 * 1024,
  createdAt: "2026-10-03T12:00:00.000Z",
  url: "https://api.test/files/a1",
};

const onPick = vi.fn();
const onClose = vi.fn();

async function renderPicker(accept?: ("image" | "pdf")[]) {
  render(<FilePickerDialog accept={accept} onPick={onPick} onClose={onClose} />);
  await act(async () => {});
  return screen.getByRole("dialog", { name: "Choose a file" });
}

describe("FilePickerDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ items: [IMAGE], page: 1, totalPages: 1, total: 1 }), {
          status: 200,
        }),
    );
    uploadFile.mockReset();
    onPick.mockReset();
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the library in pick mode inside a modal dialog", async () => {
    const dialog = await renderPicker();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("group", { name: "Filter by type" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("resolves the chosen file", async () => {
    const dialog = await renderPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Choose cover.webp" }));
    expect(onPick).toHaveBeenCalledWith(IMAGE);
  });

  it("resolves a file uploaded from inside the dialog", async () => {
    const uploaded = { ...IMAGE, id: "b2", name: "new.png", mime: "image/png" };
    uploadFile.mockResolvedValue({ ok: true, data: uploaded });
    const dialog = await renderPicker();
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText("Upload a file"), {
        target: { files: [new File(["png"], "new.png", { type: "image/png" })] },
      });
    });
    expect(onPick).toHaveBeenCalledWith(uploaded);
  });

  it("lists only the accepted kind", async () => {
    await renderPicker(["image"]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/files?page=1&type=image");
  });

  it("closes with Cancel and with Escape", async () => {
    const dialog = await renderPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
