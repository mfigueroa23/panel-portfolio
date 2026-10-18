import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeAssignment, ResumeAssignments, ResumeLang } from "@/lib/resume";
import { ResumeSection } from "./resume-section";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const notify = vi.fn();
vi.mock("@/components/content/notice-provider", () => ({ useNotice: () => ({ notify }) }));

const EN: ResumeAssignment = {
  file: {
    id: "0b6f",
    name: "Marco-Figueroa-Resume.pdf",
    mime: "application/pdf",
    size: 182 * 1024,
    createdAt: "2026-10-18T12:00:00.000Z",
    url: "http://api.test/files/0b6f",
  },
  assignedAt: "2026-10-18T12:00:00.000Z",
};

const ES: ResumeAssignment = {
  file: { ...EN.file, id: "7c1d", name: "Marco-Figueroa-CV.pdf", url: "http://api.test/files/7c1d" },
  assignedAt: "2026-10-18T12:30:00.000Z",
};

const onChoose = vi.fn();
const onClear = vi.fn();

function renderSection(
  lang: ResumeLang,
  assignments: ResumeAssignments,
  extra: { pending?: boolean; error?: string | null } = {},
) {
  render(
    <ResumeSection
      lang={lang}
      assignments={assignments}
      pending={extra.pending ?? false}
      error={extra.error ?? null}
      onChoose={onChoose}
      onClear={onClear}
    />,
  );
  return screen.getByRole("region", { name: lang === "en" ? "English" : "Spanish" });
}

function button(section: HTMLElement, name: string) {
  return within(section).getByRole("button", { name });
}

describe("ResumeSection", () => {
  beforeEach(() => {
    notify.mockReset();
    onChoose.mockReset();
    onClear.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the assigned file with its size, date and a link to the PDF", () => {
    const section = renderSection("en", { en: EN, es: null });
    expect(within(section).getByText("Marco-Figueroa-Resume.pdf")).toBeTruthy();
    expect(within(section).getByText("182 KiB · Assigned Oct 18, 2026")).toBeTruthy();
    const open = within(section).getByRole("link", { name: "Open PDF" });
    expect(open.getAttribute("href")).toBe("http://api.test/files/0b6f");
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("says the public download is unavailable without an English resume", () => {
    const section = renderSection("en", { en: null, es: null });
    expect(
      within(section).getByText(
        "No English resume. The public download is unavailable until one is assigned.",
      ),
    ).toBeTruthy();
    expect(within(section).queryByRole("link", { name: "Open PDF" })).toBeNull();
  });

  it("says Spanish visitors get the English resume without a Spanish one", () => {
    const section = renderSection("es", { en: EN, es: null });
    expect(
      within(section).getByText(
        "No Spanish resume. Visitors of the Spanish site get the English resume.",
      ),
    ).toBeTruthy();
  });

  it("shows the stable public link, copies it and opens it in a new tab", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const section = renderSection("es", { en: EN, es: ES });
    expect(within(section).getByText("http://api.test/resume?lang=es")).toBeTruthy();
    const open = within(section).getByRole("link", { name: "Open link" });
    expect(open.getAttribute("href")).toBe("http://api.test/resume?lang=es");
    expect(open.getAttribute("target")).toBe("_blank");
    await act(async () => fireEvent.click(button(section, "Copy link")));
    expect(writeText).toHaveBeenCalledWith("http://api.test/resume?lang=es");
    expect(notify).toHaveBeenCalledWith("Link copied.");
  });

  it("tells when the link cannot be copied", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
    const section = renderSection("en", { en: EN, es: null });
    await act(async () => fireEvent.click(button(section, "Copy link")));
    expect(notify).toHaveBeenCalledWith("Could not copy the link.");
  });

  it("offers Choose PDF without a file and Replace with one", () => {
    let section = renderSection("en", { en: null, es: null });
    fireEvent.click(button(section, "Choose PDF"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    cleanup();
    section = renderSection("en", { en: EN, es: null });
    expect(button(section, "Replace")).toBeTruthy();
  });

  describe("ordering rules", () => {
    it("disables choosing a Spanish PDF until English is assigned", () => {
      const section = renderSection("es", { en: null, es: null });
      expect(button(section, "Choose PDF").hasAttribute("disabled")).toBe(true);
      expect(within(section).getByText("Assign an English resume first.")).toBeTruthy();
    });

    it("lets Spanish be chosen once English is assigned", () => {
      const section = renderSection("es", { en: EN, es: null });
      expect(button(section, "Choose PDF").hasAttribute("disabled")).toBe(false);
      expect(within(section).queryByText("Assign an English resume first.")).toBeNull();
    });

    it("disables clearing English while a Spanish resume is assigned", () => {
      const section = renderSection("en", { en: EN, es: ES });
      expect(button(section, "Clear").hasAttribute("disabled")).toBe(true);
      expect(within(section).getByText("Clear the Spanish resume first.")).toBeTruthy();
    });

    it("lets English be cleared when Spanish is empty", () => {
      const section = renderSection("en", { en: EN, es: null });
      fireEvent.click(button(section, "Clear"));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("offers no Clear without an assigned file", () => {
      const section = renderSection("en", { en: null, es: null });
      expect(within(section).queryByRole("button", { name: "Clear" })).toBeNull();
    });
  });

  it("disables its actions while a request is pending", () => {
    const section = renderSection("en", { en: EN, es: null }, { pending: true });
    expect(button(section, "Replace").hasAttribute("disabled")).toBe(true);
    expect(button(section, "Clear").hasAttribute("disabled")).toBe(true);
  });

  it("shows its error as an alert", () => {
    const section = renderSection("en", { en: EN, es: null }, { error: "File not found." });
    expect(within(section).getByRole("alert").textContent).toBe("File not found.");
  });
});
