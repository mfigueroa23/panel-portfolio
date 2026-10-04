import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredFile } from "@/lib/files";
import { DeleteFileDialog } from "./delete-file-dialog";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const FILE: StoredFile = {
  id: "8f2c",
  name: "upload-flow.png",
  mime: "image/png",
  size: 1000,
  createdAt: "2026-10-04T12:00:00.000Z",
  url: "https://api.test/files/8f2c",
};

const REFERENCES = [
  { collection: "posts", id: 3, title: "Serving uploads from Postgres", status: "draft" },
  { collection: "projects", id: 1, title: "Portfolio platform", status: "published" },
  { collection: "certifications", id: 2, title: "CKA" },
];

const onCancel = vi.fn();
const onDeleted = vi.fn();
const onUnauthorized = vi.fn();

async function renderDialog() {
  render(
    <DeleteFileDialog
      file={FILE}
      token="tok.en.value"
      onCancel={onCancel}
      onDeleted={onDeleted}
      onUnauthorized={onUnauthorized}
    />,
  );
  await act(async () => {});
  return screen.getByRole("dialog", { name: "Delete upload-flow.png?" });
}

describe("DeleteFileDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onCancel.mockReset();
    onDeleted.mockReset();
    onUnauthorized.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the references with the token before allowing the deletion", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(
      <DeleteFileDialog
        file={FILE}
        token="tok.en.value"
        onCancel={onCancel}
        onDeleted={onDeleted}
        onUnauthorized={onUnauthorized}
      />,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/files/8f2c/references");
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer tok.en.value");
    expect(screen.getByText("Checking where this file is used…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete file" }).hasAttribute("disabled")).toBe(true);
    await act(async () => resolve(jsonResponse(200, [])));
    expect(screen.getByRole("button", { name: "Delete file" }).hasAttribute("disabled")).toBe(false);
  });

  it("lists every reference with its status badge", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, REFERENCES));
    const dialog = await renderDialog();
    expect(within(dialog).getByText("This file is used in 3 items. Their links and images will break.")).toBeTruthy();
    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "DraftPost · Serving uploads from Postgres",
      "PublishedProject · Portfolio platform",
      "Certification · CKA",
    ]);
  });

  it("says when the file is not used anywhere", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    const dialog = await renderDialog();
    expect(within(dialog).getByText("No content uses this file.")).toBeTruthy();
    expect(within(dialog).queryByRole("list")).toBeNull();
  });

  it("Cancel deletes nothing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, REFERENCES));
    const dialog = await renderDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Delete file sends DELETE and reports the deletion after 204", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, REFERENCES))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const dialog = await renderDialog();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete file" })));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://api.test/files/8f2c");
    expect(init!.method).toBe("DELETE");
    expect(onDeleted).toHaveBeenCalledWith(FILE);
  });

  it("treats a 404 on delete as already deleted", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(404, { error: "Not found." }));
    const dialog = await renderDialog();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete file" })));
    expect(onDeleted).toHaveBeenCalledWith(FILE);
  });

  it("shows another error and keeps the dialog open", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(500, { error: "Internal server error." }));
    const dialog = await renderDialog();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete file" })));
    expect(within(dialog).getByRole("alert").textContent).toBe("Internal server error.");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("hands a 401 over to onUnauthorized", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
    await renderDialog();
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("keeps Delete file disabled when the references cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "Internal server error." }));
    const dialog = await renderDialog();
    expect(within(dialog).getByRole("alert").textContent).toBe("Internal server error.");
    expect(within(dialog).getByRole("button", { name: "Delete file" }).hasAttribute("disabled")).toBe(true);
  });
});
