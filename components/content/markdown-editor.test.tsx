import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredFile } from "@/lib/files";
import { MarkdownEditor } from "./markdown-editor";

vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ token: "tok.en.value" }),
}));

const renderMarkdown = vi.hoisted(() => vi.fn());
vi.mock("@/lib/markdown", () => ({ renderMarkdown }));

const useMermaid = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mermaid", () => ({ useMermaid }));

const IMAGE: StoredFile = {
  id: "a1",
  name: "upload-flow.png",
  mime: "image/png",
  size: 1000,
  createdAt: "2026-10-04T12:00:00.000Z",
  url: "https://api.test/files/a1",
};
const PDF: StoredFile = { ...IMAGE, id: "p1", name: "cv.pdf", mime: "application/pdf", url: "https://api.test/files/p1" };

// The real picker (library + upload) has its own test; this one hands back
// either an existing file or a freshly uploaded one, as the picker does.
vi.mock("@/components/files/file-picker-dialog", () => ({
  FilePickerDialog: ({ onPick, onClose }: { onPick: (file: StoredFile) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Choose a file">
      <button onClick={() => onPick(IMAGE)}>mock pick image</button>
      <button onClick={() => onPick(PDF)}>mock upload pdf</button>
      <button onClick={onClose}>mock close</button>
    </div>
  ),
}));

const onUnauthorized = vi.fn();

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="body">Body</label>
      <MarkdownEditor id="body" label="Body" value={value} onChange={setValue} onUnauthorized={onUnauthorized} />
    </>
  );
}

function textarea() {
  return screen.getByLabelText("Body") as HTMLTextAreaElement;
}

function select(start: number, end = start) {
  textarea().setSelectionRange(start, end);
}

function tool(name: string) {
  fireEvent.click(within(screen.getByRole("toolbar", { name: "Formatting" })).getByRole("button", { name }));
}

function view(name: string) {
  return within(screen.getByRole("group", { name: "Editor view" })).getByRole("button", { name });
}

describe("MarkdownEditor writing area", () => {
  beforeEach(() => {
    renderMarkdown.mockReset();
    renderMarkdown.mockResolvedValue({ ok: true, data: { html: "", toc: [], readingMinutes: 1 } });
    useMermaid.mockReset();
    onUnauthorized.mockReset();
  });

  it("is a labelled textarea", () => {
    render(<Harness initial="Hello" />);
    expect(textarea().tagName).toBe("TEXTAREA");
    fireEvent.change(textarea(), { target: { value: "Hello world" } });
    expect(textarea().value).toBe("Hello world");
  });

  it("has the formatting toolbar", () => {
    render(<Harness />);
    const names = within(screen.getByRole("toolbar", { name: "Formatting" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(["Heading", "Bold", "Link", "Code block", "Mermaid", "Insert file"]);
  });

  it("Bold wraps the selection", () => {
    render(<Harness initial="make this strong" />);
    select(5, 9);
    tool("Bold");
    expect(textarea().value).toBe("make **this** strong");
  });

  it("Link turns the selection into a link", () => {
    render(<Harness initial="see docs" />);
    select(4, 8);
    tool("Link");
    expect(textarea().value).toBe("see [docs](https://)");
  });

  it("Heading turns the current line into a level 2 heading", () => {
    render(<Harness initial={"intro\nTitle here\nmore"} />);
    select(9);
    tool("Heading");
    expect(textarea().value).toBe("intro\n## Title here\nmore");
  });

  it("Code block and Mermaid insert fences at the cursor", () => {
    render(<Harness initial="ab" />);
    select(1);
    tool("Code block");
    expect(textarea().value).toBe("a\n```\ncode\n```\nb");
    select(textarea().value.length);
    tool("Mermaid");
    expect(textarea().value).toBe("a\n```\ncode\n```\nb\n```mermaid\nflowchart LR\n  A --> B\n```\n");
  });

  it("Insert file inserts an image picked from the library at the cursor", () => {
    render(<Harness initial="before after" />);
    select(7);
    tool("Insert file");
    fireEvent.click(screen.getByText("mock pick image"));
    expect(textarea().value).toBe("before ![upload-flow](https://api.test/files/a1)after");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Insert file inserts a PDF as a link", () => {
    render(<Harness initial="" />);
    tool("Insert file");
    fireEvent.click(screen.getByText("mock upload pdf"));
    expect(textarea().value).toBe("[cv.pdf](https://api.test/files/p1)");
  });

  it("switches between Split, Write and Preview", () => {
    render(<Harness initial="x" />);
    expect(view("Split").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("markdown-preview")).toBeTruthy();

    fireEvent.click(view("Write"));
    expect(view("Write").getAttribute("aria-pressed")).toBe("true");
    expect(view("Split").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("markdown-preview")).toBeNull();
    expect(textarea()).toBeTruthy();

    fireEvent.click(view("Preview"));
    expect(view("Preview").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("Body")).toBeNull();
    expect(screen.getByTestId("markdown-preview")).toBeTruthy();
  });
});

describe("MarkdownEditor live preview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderMarkdown.mockReset();
    useMermaid.mockReset();
    onUnauthorized.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders through the API 400 ms after the last change", async () => {
    renderMarkdown.mockResolvedValue({
      ok: true,
      data: { html: '<h2 id="hi">Hi</h2><figure class="md-mermaid"></figure>', toc: [], readingMinutes: 1 },
    });
    render(<Harness initial="" />);
    fireEvent.change(textarea(), { target: { value: "## H" } });
    await act(async () => vi.advanceTimersByTime(200));
    fireEvent.change(textarea(), { target: { value: "## Hi" } });
    await act(async () => vi.advanceTimersByTime(399));
    expect(renderMarkdown).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(renderMarkdown).toHaveBeenCalledTimes(1);
    expect(renderMarkdown).toHaveBeenCalledWith("## Hi", "tok.en.value");

    const preview = screen.getByTestId("markdown-preview");
    expect(preview.querySelector("h2#hi")!.textContent).toBe("Hi");
    // Diagrams in the preview are drawn by useMermaid with the rendered HTML.
    const [ref, html] = useMermaid.mock.calls.at(-1)!;
    expect(ref.current).toBe(preview);
    expect(html).toContain("md-mermaid");
  });

  it("does not call the API while only Write is shown", async () => {
    render(<Harness initial="text" />);
    fireEvent.click(view("Write"));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(renderMarkdown).not.toHaveBeenCalled();
  });

  it("shows an empty preview for an empty body without calling the API", async () => {
    render(<Harness initial="" />);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(renderMarkdown).not.toHaveBeenCalled();
    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();
  });

  it("shows the API error in the preview", async () => {
    renderMarkdown.mockResolvedValue({ ok: false, status: 500, error: "Internal server error." });
    render(<Harness initial="x" />);
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByRole("alert").textContent).toBe("Preview unavailable: Internal server error.");
  });

  it("hands a 401 to onUnauthorized", async () => {
    renderMarkdown.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    render(<Harness initial="x" />);
    await act(async () => vi.advanceTimersByTime(400));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
