import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_ERROR } from "@/lib/api";
import { GoogleSignInButton } from "./google-sign-in-button";

vi.mock("@/lib/config", () => ({
  API_URL: "http://api.test",
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
}));

// next/script never loads anything in jsdom: report the script as ready.
vi.mock("next/script", () => ({
  default: function Script({ onReady }: { onReady?: () => void }) {
    useEffect(() => onReady?.(), [onReady]);
    return null;
  },
}));

const createSession = vi.fn<(token: string) => Promise<void>>(async () => {});
vi.mock("@/app/actions/session", () => ({
  createSession: (token: string) => createSession(token),
}));

const fetchMock = vi.fn<typeof fetch>();
const initialize = vi.fn();
const renderButton = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup() {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
  const { callback } = initialize.mock.calls.at(-1)![0] as {
    callback: (response: { credential: string }) => Promise<void> | void;
  };
  const signIn = (credential = "google-id-token") =>
    act(async () => {
      await callback({ credential });
    });
  return { onSuccess, onError, signIn };
}

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    createSession.mockClear();
    initialize.mockReset();
    renderButton.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("google", { accounts: { id: { initialize, renderButton } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes Google Identity Services and renders the button", () => {
    setup();
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-id.apps.googleusercontent.com" }),
    );
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ theme: "filled_black", shape: "pill" }),
    );
  });

  it("posts the credential, creates the session and calls onSuccess", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken: "api.jwt.token", expiresIn: 3600 }),
    );
    const { onSuccess, onError, signIn } = setup();
    await signIn("google-id-token");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/auth/google");
    expect(init!.body).toBe(JSON.stringify({ credential: "google-id-token" }));
    expect(createSession).toHaveBeenCalledWith("api.jwt.token");
    expect(onSuccess).toHaveBeenCalledWith("api.jwt.token");
    expect(onError).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Invalid Google sign-in."],
    [403, "This Google account is not authorized."],
    [429, "Too many attempts. Please try again later."],
    [500, "Sign-in is not available."],
  ])("shows the API text for a %i", async (status, error) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error }));
    const { onSuccess, onError, signIn } = setup();
    await signIn();
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("shows the connection error when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { onSuccess, onError, signIn } = setup();
    await signIn();
    expect(onError).toHaveBeenCalledWith(CONNECTION_ERROR);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the connection error when the session cannot be stored", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken: "api.jwt.token", expiresIn: 3600 }),
    );
    createSession.mockRejectedValueOnce(new Error("offline"));
    const { onSuccess, onError, signIn } = setup();
    await signIn();
    expect(onError).toHaveBeenCalledWith(CONNECTION_ERROR);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does nothing when the owner cancels (Google never fires the callback)", () => {
    const { onSuccess, onError } = setup();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
