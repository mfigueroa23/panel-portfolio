import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteDialog } from "./delete-dialog";

function setup(pending = false) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DeleteDialog
      title="Engineer · Acme"
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  return { onCancel, onConfirm };
}

describe("DeleteDialog", () => {
  it("is a modal dialog asking to confirm with the item's title", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Delete this item?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Engineer · Acme");
  });

  it("Cancel calls onCancel only", () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Delete calls onConfirm", () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Delete while the request is pending", () => {
    const { onConfirm } = setup(true);
    const button = screen.getByRole("button", { name: "Deleting…" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
