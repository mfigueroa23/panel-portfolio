import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./session-provider";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const deleteSession = vi.fn(async () => {});
vi.mock("@/app/actions/session", () => ({
  deleteSession: () => deleteSession(),
}));

function Probe() {
  const session = useSession();
  return (
    <>
      <p>token:{session.token}</p>
      <button onClick={() => session.setToken("fresh.token.value")}>set token</button>
      <button onClick={() => void session.signOut()}>sign out</button>
      <button onClick={() => void session.onUnauthorized()}>unauthorized</button>
    </>
  );
}

// Clicks a probe button and lets the async session call settle.
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

function renderProvider(token = "initial.token.value") {
  return render(
    <SessionProvider initialToken={token}>
      <Probe />
    </SessionProvider>,
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    replace.mockReset();
    deleteSession.mockClear();
  });

  it("exposes the token seeded from the cookie", () => {
    renderProvider();
    expect(screen.getByText("token:initial.token.value")).toBeTruthy();
  });

  it("setToken replaces the token in memory", async () => {
    renderProvider();
    await click("set token");
    expect(screen.getByText("token:fresh.token.value")).toBeTruthy();
  });

  it("signOut deletes the session and then goes to /login", async () => {
    const order: string[] = [];
    deleteSession.mockImplementationOnce(async () => {
      order.push("deleteSession");
    });
    replace.mockImplementationOnce(() => order.push("replace"));
    renderProvider();
    await click("sign out");
    expect(order).toEqual(["deleteSession", "replace"]);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("onUnauthorized deletes the session and goes to /login?expired=1", async () => {
    renderProvider();
    await click("unauthorized");
    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?expired=1");
  });

  it("never touches localStorage or sessionStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    renderProvider();
    await click("set token");
    await click("sign out");
    await click("unauthorized");
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    setItem.mockRestore();
    getItem.mockRestore();
  });

  it("useSession throws outside the provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
    error.mockRestore();
  });
});
