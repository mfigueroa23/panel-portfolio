import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingCountProvider, usePendingCount } from "./pending-count-provider";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ token: "tok.en.value" }),
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Probe() {
  const { count, refresh } = usePendingCount();
  return (
    <>
      <output>{count}</output>
      <button onClick={() => void refresh()}>refresh</button>
    </>
  );
}

async function renderProvider() {
  await act(async () => {
    render(
      <PendingCountProvider>
        <Probe />
      </PendingCountProvider>,
    );
  });
}

describe("PendingCountProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the pending count with the token on mount", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { count: 4 }));
    await renderProvider();
    expect(screen.getByRole("status").textContent).toBe("4");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/content/testimonials/pending-count");
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("refresh() reloads the count without a page reload", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { count: 2 }))
      .mockResolvedValueOnce(jsonResponse(200, { count: 1 }));
    await renderProvider();
    expect(screen.getByRole("status").textContent).toBe("2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe("1");
  });

  it("keeps the last count when the request fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { count: 2 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderProvider();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    });
    expect(screen.getByRole("status").textContent).toBe("2");
  });

  it("outside the provider the count is 0 and refresh does nothing", async () => {
    await act(async () => {
      render(<Probe />);
    });
    expect(screen.getByRole("status").textContent).toBe("0");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
