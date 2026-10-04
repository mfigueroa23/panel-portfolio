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

function menuButton() {
  return screen.getByRole("button", { name: "Open menu" });
}

function openDrawer() {
  fireEvent.click(menuButton());
  return screen.getByRole("dialog", { name: "Navigation" });
}

function overlay() {
  return document.querySelector<HTMLElement>("[data-testid='drawer-overlay']")!;
}

describe("MobileNav", () => {
  beforeEach(() => {
    pathname = "/experience";
    signOut.mockClear();
    document.body.style.overflow = "";
  });

  it("is a sticky top bar hidden from lg up, with a 44 px menu button", () => {
    render(<MobileNav />);
    const bar = screen.getByRole("banner");
    for (const cls of ["lg:hidden", "sticky", "top-0"]) {
      expect(bar.classList.contains(cls)).toBe(true);
    }
    expect(menuButton().classList.contains("size-11")).toBe(true);
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the drawer outside the header, directly in document.body", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    // Inside the header, its backdrop-blur would clip the fixed drawer to the bar's height.
    expect(drawer.closest("header")).toBeNull();
    expect(screen.getByRole("banner").contains(drawer)).toBe(false);
    expect(overlay().parentElement!.parentElement).toBe(document.body);
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("takes the full viewport height with an overlay over the rest", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    for (const cls of ["fixed", "inset-y-0", "left-0", "h-dvh", "flex", "flex-col"]) {
      expect(drawer.classList.contains(cls)).toBe(true);
    }
    for (const cls of ["fixed", "inset-0"]) {
      expect(overlay().classList.contains(cls)).toBe(true);
    }
  });

  it("groups the links, scrolls them inside the drawer and keeps Log out in a fixed footer", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    const nav = within(drawer).getByRole("navigation", { name: "Collections" });
    expect(nav.classList.contains("overflow-y-auto")).toBe(true);
    expect(nav.classList.contains("min-h-0")).toBe(true);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/social-links",
      "/technologies",
      "/highlights",
      "/testimonials",
      "/contact-info",
      "/projects",
      "/experience",
      "/certifications",
      "/posts",
      "/files",
    ]);
    for (const label of ["Home sections", "Pages", "Media"]) {
      expect(within(nav).getByRole("group", { name: label })).toBeTruthy();
    }
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.classList.contains("min-h-11")).toBe(true);
    }
    const logOut = within(drawer).getByRole("button", { name: "Log out" });
    expect(nav.contains(logOut)).toBe(false);
    fireEvent.click(logOut);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("locks the page scroll while open and restores it on close", () => {
    document.body.style.overflow = "auto";
    render(<MobileNav />);
    const drawer = openDrawer();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(within(drawer).getByRole("button", { name: "Close menu" }));
    expect(document.body.style.overflow).toBe("auto");
  });

  it("moves focus into the drawer on open and back to the menu button on close", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    const close = within(drawer).getByRole("button", { name: "Close menu" });
    expect(document.activeElement).toBe(close);
    expect(close.classList.contains("size-11")).toBe(true);
    fireEvent.click(close);
    expect(document.activeElement).toBe(menuButton());
  });

  it("closes with the close button", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the overlay is tapped", () => {
    render(<MobileNav />);
    openDrawer();
    fireEvent.click(overlay());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it("closes on Escape", () => {
    render(<MobileNav />);
    openDrawer();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it("closes when a link is followed", () => {
    render(<MobileNav />);
    const drawer = openDrawer();
    fireEvent.click(within(drawer).getByRole("link", { name: "Projects" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the route changes and unlocks the scroll", () => {
    const { rerender } = render(<MobileNav />);
    openDrawer();
    pathname = "/technologies";
    act(() => rerender(<MobileNav />));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when the viewport grows to the sidebar breakpoint", () => {
    let onChange: ((event: { matches: boolean }) => void) | null = null;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: (_: string, listener: typeof onChange) => (onChange = listener),
        removeEventListener: () => (onChange = null),
      })),
    );
    render(<MobileNav />);
    openDrawer();
    act(() => onChange!({ matches: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    vi.unstubAllGlobals();
  });
});
