import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReauthDialog } from "./reauth-dialog";

vi.mock("./google-sign-in-button", () => ({
  GoogleSignInButton: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (token: string) => void;
    onError: (message: string) => void;
  }) => (
    <>
      <button onClick={() => onSuccess("fresh.token.value")}>fake success</button>
      <button onClick={() => onError("Too many attempts. Please try again later.")}>
        fake error
      </button>
    </>
  ),
}));

function setup() {
  const onSuccess = vi.fn();
  const onDismiss = vi.fn();
  render(<ReauthDialog onSuccess={onSuccess} onDismiss={onDismiss} />);
  return { onSuccess, onDismiss };
}

describe("ReauthDialog", () => {
  it("is a modal titled 'Session expired' that reassures the values stay", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Session expired" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain(
      "Sign in again to save. Everything you typed stays in this form.",
    );
  });

  it("passes the new token on success", () => {
    const { onSuccess } = setup();
    fireEvent.click(screen.getByText("fake success"));
    expect(onSuccess).toHaveBeenCalledWith("fresh.token.value");
  });

  it("shows a sign-in error inside the dialog", () => {
    const { onSuccess } = setup();
    fireEvent.click(screen.getByText("fake error"));
    expect(screen.getByRole("alert").textContent).toBe(
      "Too many attempts. Please try again later.",
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("'Not now — keep editing' dismisses it", () => {
    const { onDismiss } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Not now — keep editing" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
