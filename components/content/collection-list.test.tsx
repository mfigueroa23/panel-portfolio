import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_ERROR } from "@/lib/api";
import type { ContentItem } from "@/lib/collections";
import { CollectionList } from "./collection-list";

vi.mock("next/link", () => import("@/test/next-link-mock"));
vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const onUnauthorized = vi.fn(async () => {});
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({ token: "tok.en.value", onUnauthorized }),
}));

const notify = vi.fn();
vi.mock("./notice-provider", () => ({ useNotice: () => ({ notify }) }));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ITEMS: ContentItem[] = [
  { id: 2, startDate: "2024-03", period: "2024 – now", role: "Engineer", company: "Acme" },
  { id: 1, startDate: null, period: "2020 – 2024", role: "Developer", company: "Globex" },
];

function rows() {
  return screen.getAllByRole("listitem");
}

async function confirmDeleteOf(title: string) {
  const row = rows().find((r) => r.textContent?.includes(title))!;
  fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }),
    );
  });
}

describe("CollectionList", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    refresh.mockReset();
    notify.mockReset();
    onUnauthorized.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows experience rows in the given order with start month, title and secondary text", () => {
    render(<CollectionList collection="experience" items={ITEMS} />);
    const [first, second] = rows();
    expect(first.textContent).toContain("Mar 2024");
    expect(first.textContent).toContain("Engineer · Acme");
    expect(first.textContent).toContain("2024 – now");
    expect(first.textContent).not.toContain("#");
    expect(second.textContent).toContain("No start month");
    expect(second.textContent).toContain("Developer · Globex");
  });

  it("keeps #position for collections that still have it", () => {
    render(
      <CollectionList
        collection="certifications"
        items={[{ id: 1, position: 3, name: "CKA", issuer: "CNCF" }]}
      />,
    );
    expect(rows()[0].textContent).toContain("#3");
    expect(rows()[0].textContent).toContain("CNCF");
  });

  it("shows the status badge and public path of posts", () => {
    render(
      <CollectionList
        collection="posts"
        items={[
          { id: 3, title: "Uploads", slug: "uploads", status: "draft", publishedAt: null },
          {
            id: 1,
            title: "Moving to an API",
            slug: "moving-to-an-api",
            status: "published",
            publishedAt: "2026-10-04T12:00:00.000Z",
          },
        ]}
      />,
    );
    const [draft, published] = rows();
    expect(within(draft).getByText("Draft")).toBeTruthy();
    expect(draft.textContent).toContain("/blog/uploads");
    expect(within(published).getByText("Published")).toBeTruthy();
    expect(published.textContent).toContain("/blog/moving-to-an-api · Oct 4, 2026");
    expect(draft.textContent).not.toContain("#");
  });

  it("shows the status badge and public path of projects", () => {
    render(
      <CollectionList
        collection="projects"
        items={[{ id: 1, title: "Portfolio", slug: "portfolio", status: "draft", publishedAt: null }]}
      />,
    );
    expect(within(rows()[0]).getByText("Draft")).toBeTruthy();
    expect(rows()[0].textContent).toContain("/projects/portfolio");
  });

  it("links each row's Edit to /<key>/<id>/edit", () => {
    render(<CollectionList collection="experience" items={ITEMS} />);
    const edit = within(rows()[0]).getByRole("link", { name: "Edit" });
    expect(edit.getAttribute("href")).toBe("/experience/2/edit");
  });

  it("shows an empty state with a link to create the first item", () => {
    render(<CollectionList collection="technologies" items={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("No items yet.")).toBeTruthy();
    const create = screen.getByRole("link", { name: "Create the first item" });
    expect(create.getAttribute("href")).toBe("/technologies/new");
  });

  it("Delete opens the confirmation and Cancel changes nothing", () => {
    render(<CollectionList collection="experience" items={ITEMS} />);
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog").textContent).toContain("Engineer · Acme");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(rows()).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Confirm deletes through the API with the token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/content/experiences/2");
    expect(init!.method).toBe("DELETE");
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer tok.en.value");
  });

  it("204 removes the row, notifies and refreshes", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Developer · Globex");
    expect(notify).toHaveBeenCalledWith("Item deleted.");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables the dialog's Delete while the request is pending", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<CollectionList collection="experience" items={ITEMS} />);
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(
      within(screen.getByRole("dialog"))
        .getByRole("button", { name: "Deleting…" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await act(async () => resolve(new Response(null, { status: 204 })));
  });

  it("404 says the item no longer exists and refreshes", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(notify).toHaveBeenCalledWith("This item no longer exists.");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("401 hands over to onUnauthorized", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(2);
  });

  it("another error shows the API text and keeps the row", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "Internal server error." }));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    expect(screen.getByRole("alert").textContent).toBe("Internal server error.");
    expect(rows()).toHaveLength(2);
    expect(notify).not.toHaveBeenCalled();
  });

  it("no connection shows the connection error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<CollectionList collection="experience" items={ITEMS} />);
    await confirmDeleteOf("Engineer · Acme");
    expect(screen.getByRole("alert").textContent).toBe(CONNECTION_ERROR);
    expect(rows()).toHaveLength(2);
  });
});
