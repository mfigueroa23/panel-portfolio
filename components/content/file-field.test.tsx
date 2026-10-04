import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldDef } from "@/lib/collections";
import type { StoredFile } from "@/lib/files";
import { FileField } from "./file-field";

vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ token: "tok.en.value" }),
}));

const uploadFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/upload", () => ({ uploadFile }));

const PICKED: StoredFile = {
  id: "c3",
  name: "certificate.pdf",
  mime: "application/pdf",
  size: 1000,
  createdAt: "2026-09-28T12:00:00.000Z",
  url: "https://api.test/files/c3",
};

// The real picker is tested on its own; here it only needs to hand back a file.
const pickerProps = vi.hoisted(() => ({ accept: undefined as unknown }));
vi.mock("@/components/files/file-picker-dialog", () => ({
  FilePickerDialog: ({
    accept,
    onPick,
    onClose,
  }: {
    accept?: unknown;
    onPick: (file: StoredFile) => void;
    onClose: () => void;
  }) => {
    pickerProps.accept = accept;
    return (
      <div role="dialog" aria-label="Choose a file">
        <button onClick={() => onPick(PICKED)}>mock pick</button>
        <button onClick={onClose}>mock close</button>
      </div>
    );
  },
}));

const COVER: FieldDef = {
  name: "coverUrl",
  label: "Cover image",
  kind: "file",
  required: false,
  maxLength: 500,
  accept: ["image"],
};
const CERTIFICATE: FieldDef = { ...COVER, name: "fileUrl", label: "Certificate file", accept: ["image", "pdf"] };

const onChange = vi.fn();
const onUnauthorized = vi.fn();

function Harness({ field, initial = "" }: { field: FieldDef; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="f">{field.label}</label>
      <FileField
        id="f"
        field={field}
        value={value}
        onChange={(url) => {
          onChange(url);
          setValue(url);
        }}
        onUnauthorized={onUnauthorized}
      />
    </>
  );
}

function choose(file: File) {
  return act(async () => {
    fireEvent.change(screen.getByLabelText(/^Upload/), { target: { files: [file] } });
  });
}

describe("FileField", () => {
  beforeEach(() => {
    onChange.mockReset();
    onUnauthorized.mockReset();
    uploadFile.mockReset();
    pickerProps.accept = undefined;
  });

  it("keeps the URL in a labelled input that can also be typed", () => {
    render(<Harness field={COVER} />);
    const input = screen.getByLabelText("Cover image") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://cdn.test/a.png" } });
    expect(onChange).toHaveBeenLastCalledWith("https://cdn.test/a.png");
  });

  it("previews an image value and can remove it", () => {
    render(<Harness field={COVER} initial="https://api.test/files/a1" />);
    expect(screen.getByRole("img", { name: "Cover image preview" }).getAttribute("src")).toBe(
      "https://api.test/files/a1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows an empty state without a value", () => {
    render(<Harness field={COVER} />);
    expect(screen.getByText("No file")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("chooses from the library with the field's accepted kinds", () => {
    render(<Harness field={CERTIFICATE} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose from library" }));
    expect(pickerProps.accept).toEqual(["image", "pdf"]);
    fireEvent.click(screen.getByText("mock pick"));
    expect(onChange).toHaveBeenLastCalledWith("https://api.test/files/c3");
    expect(screen.queryByRole("dialog")).toBeNull();
    // A PDF previews as a link, not an image.
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("link", { name: "certificate.pdf" }).getAttribute("href")).toBe(
      "https://api.test/files/c3",
    );
  });

  it("limits the file chooser to the field's kinds", () => {
    render(<Harness field={COVER} />);
    const input = screen.getByLabelText("Upload Cover image") as HTMLInputElement;
    expect(input.accept).toContain("image/png");
    expect(input.accept).not.toContain("application/pdf");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(click).toHaveBeenCalled();
  });

  it("refuses a PDF in an image-only field before uploading", async () => {
    render(<Harness field={COVER} />);
    await choose(new File(["pdf"], "cv.pdf", { type: "application/pdf" }));
    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("cv.pdf: Unsupported file type.");
  });

  it("uploads, shows progress and fills the URL", async () => {
    let finish!: (value: unknown) => void;
    let report!: (loaded: number, total: number) => void;
    uploadFile.mockImplementation((_file, _token, progress) => {
      report = progress;
      return new Promise((resolve) => (finish = resolve));
    });
    render(<Harness field={COVER} />);
    await choose(new File(["png"], "cover.png", { type: "image/png" }));
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), "tok.en.value", expect.any(Function));
    act(() => report(1, 4));
    expect(
      screen.getByRole("progressbar", { name: "Uploading cover.png" }).getAttribute("aria-valuenow"),
    ).toBe("25");
    await act(async () =>
      finish({ ok: true, data: { ...PICKED, name: "cover.png", mime: "image/png" } }),
    );
    expect(onChange).toHaveBeenLastCalledWith("https://api.test/files/c3");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows a failed upload's error and keeps the value", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 400, error: "File too large." });
    render(<Harness field={COVER} initial="https://api.test/files/a1" />);
    await choose(new File(["png"], "cover.png", { type: "image/png" }));
    expect(screen.getByRole("alert").textContent).toBe("cover.png: File too large.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands a 401 to onUnauthorized so the form can offer the sign-in", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    render(<Harness field={COVER} />);
    await choose(new File(["png"], "cover.png", { type: "image/png" }));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toBe(
      "cover.png: Your session expired. Upload the file again.",
    );
  });
});
