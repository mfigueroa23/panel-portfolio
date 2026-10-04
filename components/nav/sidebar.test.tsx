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

const EXPECTED_LINKS = [
  ["Social links", "/social-links"],
  ["Technologies", "/technologies"],
  ["Highlights", "/highlights"],
  ["Testimonials", "/testimonials"],
  ["Contact info", "/contact-info"],
  ["Projects", "/projects"],
  ["Experience", "/experience"],
  ["Certifications", "/certifications"],
  ["Posts", "/posts"],
];

describe("Sidebar", () => {
  beforeEach(() => {
    pathname = "/experience";
    signOut.mockClear();
  });

  it("links to the 9 collections", () => {
    render(<Sidebar />);
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      EXPECTED_LINKS,
    );
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
