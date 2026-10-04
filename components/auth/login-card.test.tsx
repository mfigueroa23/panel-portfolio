import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginCard } from "./login-card";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

// Stands in for Google's button: lets the test trigger either outcome.
vi.mock("./google-sign-in-button", () => ({
  GoogleSignInButton: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (token: string) => void;
    onError: (message: string) => void;
  }) => (
    <>
      <button onClick={() => onSuccess("api.jwt.token")}>fake success</button>
      <button onClick={() => onError("This Google account is not authorized.")}>
        fake error
      </button>
    </>
  ),
}));

describe("LoginCard", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("shows the title and the owner-only note", () => {
    render(<LoginCard expired={false} />);
    expect(screen.getByRole("heading", { name: "Portfolio Panel" })).toBeTruthy();
    expect(
      screen.getByText("Only the site owner's Google account can sign in."),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows 'Session expired.' when the session expired", () => {
    render(<LoginCard expired />);
    expect(screen.getByRole("alert").textContent).toBe("Session expired.");
  });

  it("shows the error passed by the button", () => {
    render(<LoginCard expired />);
    fireEvent.click(screen.getByText("fake error"));
    expect(screen.getByRole("alert").textContent).toBe(
      "This Google account is not authorized.",
    );
  });

  it("navigates to /experience on success", () => {
    render(<LoginCard expired={false} />);
    fireEvent.click(screen.getByText("fake success"));
    expect(replace).toHaveBeenCalledWith("/experience");
  });
});
