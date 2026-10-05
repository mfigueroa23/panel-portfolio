import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/link", () => import("@/test/next-link-mock"));

let pathname = "/experience";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const signOut = vi.fn(async () => {});
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ signOut }),
}));

const EXPECTED_GROUPS = [
  [
    "Home sections",
    [
      ["Social links", "/social-links"],
      ["Technologies", "/technologies"],
      ["Highlights", "/highlights"],
      ["Testimonials", "/testimonials"],
      ["Contact info", "/contact-info"],
    ],
  ],
  [
    "Pages",
    [
      ["Projects", "/projects"],
      ["Experience", "/experience"],
      ["Certifications", "/certifications"],
      ["Posts", "/posts"],
    ],
  ],
  ["Media", [["Files", "/files"]]],
] as const;

describe("Sidebar", () => {
  beforeEach(() => {
    pathname = "/experience";
    signOut.mockClear();
  });

  it("groups the links into Home sections, Pages and Media", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Collections" });
    const groups = within(nav).getAllByRole("group");
    expect(
      groups.map((group) => [
        group.getAttribute("aria-labelledby") &&
          document.getElementById(group.getAttribute("aria-labelledby")!)!.textContent,
        within(group)
          .getAllByRole("link")
          .map((link) => [link.textContent, link.getAttribute("href")]),
      ]),
    ).toEqual(EXPECTED_GROUPS);
  });

  it("gives every link a target of at least 44 px", () => {
    render(<Sidebar />);
    for (const link of within(screen.getByRole("navigation")).getAllByRole("link")) {
      expect(link.classList.contains("min-h-11")).toBe(true);
    }
  });

  it("marks the current collection as active, also on its sub-pages", () => {
    pathname = "/projects/4/edit";
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Experience" }).hasAttribute("aria-current")).toBe(
      false,
    );
  });

  it("marks Files as active on the library", () => {
    pathname = "/files";
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Files" }).getAttribute("aria-current")).toBe("page");
  });

  it("logs out through the session", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("is hidden below lg and sticks to the viewport from lg up", () => {
    render(<Sidebar />);
    const aside = screen.getByRole("complementary");
    for (const cls of ["hidden", "lg:flex", "lg:sticky", "lg:top-0", "lg:h-dvh"]) {
      expect(aside.classList.contains(cls)).toBe(true);
    }
  });
});
