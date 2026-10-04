import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeProvider, useNotice } from "./notice-provider";

function Trigger({ text }: { text: string }) {
  const { notify } = useNotice();
  return <button onClick={() => notify(text)}>notify {text}</button>;
}

describe("NoticeProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows nothing until notified", () => {
    render(
      <NoticeProvider>
        <Trigger text="Item saved." />
      </NoticeProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the text in a role=status toast and hides it after 3 s", () => {
    render(
      <NoticeProvider>
        <Trigger text="Item saved." />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText("notify Item saved."));
    expect(screen.getByRole("status").textContent).toBe("Item saved.");
    act(() => vi.advanceTimersByTime(2_999));
    expect(screen.getByRole("status").textContent).toBe("Item saved.");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a new notice replaces the current one and restarts the timer", () => {
    render(
      <NoticeProvider>
        <Trigger text="First." />
        <Trigger text="Second." />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText("notify First."));
    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.click(screen.getByText("notify Second."));
    expect(screen.getByRole("status").textContent).toBe("Second.");
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("status").textContent).toBe("Second.");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
