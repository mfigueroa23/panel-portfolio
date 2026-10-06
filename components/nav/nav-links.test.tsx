import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavLinks } from "./nav-links";

vi.mock("next/link", () => import("@/test/next-link-mock"));
vi.mock("next/navigation", () => ({ usePathname: () => "/testimonials" }));
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ signOut: vi.fn() }),
}));

let count = 0;
vi.mock("./pending-count-provider", () => ({
  usePendingCount: () => ({ count, refresh: vi.fn() }),
}));

describe("NavLinks pending badge", () => {
  beforeEach(() => {
    count = 0;
  });

  it("is hidden when nothing is pending", () => {
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Testimonials" })).toBeTruthy();
    expect(screen.queryByLabelText(/pending/)).toBeNull();
  });

  it("shows the number next to Testimonials with an accessible label", () => {
    count = 3;
    render(<NavLinks />);
    const badge = screen.getByLabelText("3 pending");
    expect(badge.textContent).toBe("3");
    const link = screen.getByRole("link", { name: "Testimonials 3 pending" });
    expect(link.contains(badge)).toBe(true);
    expect(link.getAttribute("href")).toBe("/testimonials");
  });

  it("shows 99 as is and 99+ above 99", () => {
    count = 99;
    const { unmount } = render(<NavLinks />);
    expect(screen.getByLabelText("99 pending").textContent).toBe("99");
    unmount();
    count = 120;
    render(<NavLinks />);
    expect(screen.getByLabelText("120 pending").textContent).toBe("99+");
  });

  it("shows no badge on the other links", () => {
    count = 5;
    render(<NavLinks />);
    expect(screen.getAllByLabelText(/pending/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Projects" }).textContent).toBe("Projects");
  });
});
