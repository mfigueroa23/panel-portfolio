import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "@/test/tokens";
import { createSession, deleteSession } from "./session";

const cookieStore = { set: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const NOW = new Date("2026-10-04T12:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

describe("session actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("createSession stores the token in an httpOnly, Secure, SameSite=Strict cookie", async () => {
    const token = makeToken({ sub: "owner", exp: nowSeconds + 3600 });
    await createSession(token);
    expect(cookieStore.set).toHaveBeenCalledWith("panel_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    });
  });

  it("createSession sets Max-Age to the seconds left until exp", async () => {
    await createSession(makeToken({ exp: nowSeconds + 120 }));
    expect(cookieStore.set.mock.calls[0][2]).toMatchObject({ maxAge: 120 });
  });

  it.each([
    ["a malformed token", "not-a-token"],
    ["an expired token", makeToken({ exp: nowSeconds - 1 })],
    ["a token expiring now", makeToken({ exp: nowSeconds })],
  ])("createSession sets no cookie for %s", async (_case, token) => {
    await createSession(token);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("deleteSession deletes the cookie", async () => {
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith("panel_session");
  });

  it("never touches Web Storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await createSession(makeToken({ exp: nowSeconds + 3600 }));
    await deleteSession();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
