import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "./mobile-nav";

vi.mock("next/link", () => import("@/test/next-link-mock"));

let pathname = "/experience";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const signOut = vi.fn(async () => {});
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ signOut }),
}));

function openDrawer() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("dialog", { name: "Navigation" });
}

describe("MobileNav", () => {
  beforeEach(() => {
    pathname = "/experience";
    signOut.mockClear();
  });

  it("is a sticky top bar hidden from lg up", () => {
    render(<MobileNav />);
    const bar = screen.getByRole("banner");
    for (const cls of ["lg:hidden", "sticky", "top-0"]) {
      expect(bar.classList.contains(cls)).toBe(true);
    }
  });

  it("opens a drawer with the 9 collection links and Log out", () => {
    render(<MobileNav />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const drawer = openDrawer();
    const links = within(drawer).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/social-links",
      "/technologies",
      "/highlights",
      "/testimonials",
      "/contact-info",
      "/projects",
      "/experience",
      "/certifications",
      "/posts",
    ]);
    fireEvent.click(within(drawer).getByRole("button", { name: "Log out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes with the close button", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<MobileNav />);
    openDrawer();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when a link is followed", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    fireEvent.click(within(drawer).getByRole("link", { name: "Projects" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the route changes", () => {
    const { rerender } = render(<MobileNav />);
    openDrawer();
    pathname = "/technologies";
    act(() => rerender(<MobileNav />));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
