import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/components/session/session-provider";
import { CONNECTION_ERROR } from "@/lib/api";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "@/lib/collections";
import { ItemForm } from "./item-form";

vi.mock("@/lib/config", () => ({ API_URL: "http://api.test", GOOGLE_CLIENT_ID: "" }));

const push = vi.fn();
const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace }) }));
vi.mock("next/link", () => import("@/test/next-link-mock"));

vi.mock("@/app/actions/session", () => ({
  deleteSession: vi.fn(async () => {}),
  createSession: vi.fn(async () => {}),
}));

const notify = vi.fn();
vi.mock("./notice-provider", () => ({ useNotice: () => ({ notify }) }));

const refreshCount = vi.fn(async () => {});
vi.mock("@/components/nav/pending-count-provider", () => ({
  usePendingCount: () => ({ count: 0, refresh: refreshCount }),
}));

const uploadFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/upload", () => ({ uploadFile }));

// Google's button, replaced by one that signs in with a fresh token.
vi.mock("@/components/auth/google-sign-in-button", () => ({
  GoogleSignInButton: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button onClick={() => onSuccess("fresh.token.value")}>mock Google sign-in</button>
  ),
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderForm(collection: CollectionKey, item?: ContentItem) {
  return render(
    <SessionProvider initialToken="old.token.value">
      <ItemForm collection={collection} item={item} />
    </SessionProvider>,
  );
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
}

function fillTechnology(position = "3", name = "Rust") {
  type("Position", position);
  type("Name", name);
}

const TECHNOLOGY: ContentItem = { id: 7, position: 2, name: "Go" };

describe("ItemForm fields", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(Object.keys(COLLECTIONS) as CollectionKey[])(
    "renders a labelled input for every %s field",
    (key) => {
      renderForm(key);
      for (const field of COLLECTIONS[key].fields) {
        // Fields hidden on create (testimonial position) must be absent.
        if (field.createHidden) expect(screen.queryByLabelText(field.label)).toBeNull();
        else expect(screen.getByLabelText(field.label)).toBeTruthy();
      }
    },
  );

  it("renders position as a number input with min 0", () => {
    renderForm("technologies");
    const position = screen.getByLabelText("Position") as HTMLInputElement;
    expect(position.type).toBe("number");
    expect(position.min).toBe("0");
  });

  it("renders a boolean as a checkbox", () => {
    renderForm("experience");
    const current = screen.getByLabelText("Current position") as HTMLInputElement;
    expect(current.type).toBe("checkbox");
    expect(current.checked).toBe(false);
  });

  it("renders text and textarea counters", () => {
    renderForm("highlights");
    type("Title", "Clean");
    expect(screen.getByText("5 / 200")).toBeTruthy();
    expect(screen.getByLabelText("Description").tagName).toBe("TEXTAREA");
    expect(screen.getByText("0 / 5000")).toBeTruthy();
  });

  it("renders a list as a chip input with an n / max counter", () => {
    renderForm("projects");
    expect(screen.getByText("0 / 50")).toBeTruthy();
    type("Tags", "Angular");
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    type("Tags", "NestJS");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Angular")).toBeTruthy();
    expect(screen.getByText("NestJS")).toBeTruthy();
    expect(screen.getByText("2 / 50")).toBeTruthy();
    expect((screen.getByLabelText("Tags") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Remove Angular" }));
    expect(screen.queryByText("Angular")).toBeNull();
    expect(screen.getByText("1 / 50")).toBeTruthy();
  });

  it("fills the inputs with the initial values when editing", () => {
    renderForm("experience", {
      id: 1,
      period: "2024 – now",
      role: "Engineer",
      company: "Acme",
      description: "Builds things.",
      technologies: ["TypeScript"],
      current: true,
    });
    expect((screen.getByLabelText("Role") as HTMLInputElement).value).toBe("Engineer");
    expect((screen.getByLabelText("Current position") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("TypeScript")).toBeTruthy();
  });
});

describe("ItemForm submit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    notify.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a client-side error is shown next to the field and sends nothing", async () => {
    renderForm("technologies");
    type("Position", "-1");
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Position must be at least 0.")).toBeTruthy();
    expect(screen.getByText("Name is required.")).toBeTruthy();
    const name = screen.getByLabelText("Name");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Name is required.",
    );
  });

  it("disables submit while the request is pending", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderForm("technologies");
    fillTechnology();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => resolve(jsonResponse(201, { id: 9, position: 3, name: "Rust" })));
  });

  it("creates the item, notifies and goes back to the refreshed list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 9, position: 3, name: "Rust" }));
    renderForm("technologies");
    fillTechnology("3", "Rust");
    await submit();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/content/technologies");
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe(JSON.stringify({ position: 3, name: "Rust" }));
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer old.token.value");
    expect(notify).toHaveBeenCalledWith("Item created.");
    expect(push).toHaveBeenCalledWith("/technologies");
    expect(refresh).toHaveBeenCalled();
  });

  it("replaces the item when editing", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...TECHNOLOGY, name: "Golang" }));
    renderForm("technologies", TECHNOLOGY);
    type("Name", "Golang");
    await submit();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/content/technologies/7");
    expect(init!.method).toBe("PUT");
    expect(init!.body).toBe(JSON.stringify({ position: 2, name: "Golang" }));
    expect(notify).toHaveBeenCalledWith("Item updated.");
    expect(push).toHaveBeenCalledWith("/technologies");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("ItemForm API errors", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    notify.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function expectValuesKept(position = "3", name = "Rust") {
    expect((screen.getByLabelText("Position") as HTMLInputElement).value).toBe(position);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(name);
  }

  it("400 shows the API's field errors next to the inputs", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: "Validation failed.",
        fields: { name: ["name must be shorter than or equal to 100 characters"] },
      }),
    );
    renderForm("technologies");
    fillTechnology();
    await submit();
    const name = screen.getByLabelText("Name");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)!.textContent).toBe(
      "name must be shorter than or equal to 100 characters",
    );
    expectValuesKept();
    expect(push).not.toHaveBeenCalled();
  });

  it("404 notifies that the item no longer exists and goes back to the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
    renderForm("technologies", TECHNOLOGY);
    await submit();
    expect(notify).toHaveBeenCalledWith("This item no longer exists.");
    expect(push).toHaveBeenCalledWith("/technologies");
  });

  it("another error shows the API text in a banner and keeps the values", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "Internal server error." }));
    renderForm("technologies");
    fillTechnology();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Internal server error.");
    expectValuesKept();
    expect(push).not.toHaveBeenCalled();
  });

  it("no connection shows the connection error and keeps the values", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm("technologies");
    fillTechnology();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(CONNECTION_ERROR);
    expectValuesKept();
  });
});

describe("ItemForm expired session", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    notify.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("401 offers sign-in over the form, keeps the values and resends them with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 9, position: 3, name: "Rust" }));
    renderForm("technologies");
    fillTechnology("3", "Rust");
    await submit();

    const dialog = screen.getByRole("dialog", { name: "Session expired" });
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByText("mock Google sign-in"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Position") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Rust");

    await submit();
    const [, init] = fetchMock.mock.calls[1];
    expect(init!.body).toBe(JSON.stringify({ position: 3, name: "Rust" }));
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer fresh.token.value");
    expect(push).toHaveBeenCalledWith("/technologies");
  });

  it("'Not now' closes the dialog and keeps editing", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    renderForm("technologies");
    fillTechnology();
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Not now — keep editing" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Rust");
  });
});

describe("ItemForm content-pages fields", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the slug with the public path prefix", () => {
    renderForm("posts");
    const slug = screen.getByLabelText("Slug") as HTMLInputElement;
    expect(slug.type).toBe("text");
    expect(slug.parentElement!.textContent).toContain("/blog/");
    cleanupAndRender("projects");
    expect(screen.getByLabelText("Slug").parentElement!.textContent).toContain("/projects/");
  });

  it("renders date, month and url inputs", () => {
    renderForm("certifications");
    expect((screen.getByLabelText("Issue date") as HTMLInputElement).type).toBe("date");
    expect((screen.getByLabelText("Expiry date") as HTMLInputElement).type).toBe("date");
    expect((screen.getByLabelText("Verification URL") as HTMLInputElement).type).toBe("url");
    cleanupAndRender("experience");
    expect((screen.getByLabelText("Start month") as HTMLInputElement).type).toBe("month");
  });

  it("renders a file field with the library and upload buttons", () => {
    renderForm("certifications");
    expect((screen.getByLabelText("Certificate file") as HTMLInputElement).type).toBe("url");
    expect(screen.getByRole("button", { name: "Choose from library" })).toBeTruthy();
    expect(screen.getByLabelText("Upload Certificate file")).toBeTruthy();
  });

  it("renders a Markdown body with the editor", () => {
    renderForm("posts");
    expect(screen.getByLabelText("Body").tagName).toBe("TEXTAREA");
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
  });

  it("renders tags as chips with an n / 10 counter", () => {
    renderForm("posts");
    expect(screen.getByText("0 / 10")).toBeTruthy();
    type("Tags", "NestJS");
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    expect(screen.getByText("NestJS")).toBeTruthy();
    expect(screen.getByText("1 / 10")).toBeTruthy();
  });

  it("renders references as title and URL rows", () => {
    renderForm("posts");
    expect(screen.getByText("0 / 30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add reference" }));
    fireEvent.click(screen.getByRole("button", { name: "Add reference" }));
    type("Reference 1 title", "OWASP");
    type("Reference 1 URL", "https://owasp.org");
    expect(screen.getByText("2 / 30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove reference 2" }));
    expect(screen.queryByLabelText("Reference 2 title")).toBeNull();
    expect((screen.getByLabelText("Reference 1 URL") as HTMLInputElement).value).toBe(
      "https://owasp.org",
    );
  });

  it("does not render position for projects and experience", () => {
    renderForm("projects");
    expect(screen.queryByLabelText("Position")).toBeNull();
    cleanupAndRender("experience");
    expect(screen.queryByLabelText("Position")).toBeNull();
  });
});

function cleanupAndRender(collection: CollectionKey, item?: ContentItem) {
  cleanup();
  return renderForm(collection, item);
}

const DRAFT_POST: ContentItem = {
  id: 9,
  title: "Hello",
  slug: "hello",
  summary: null,
  coverUrl: null,
  tags: [],
  body: null,
  references: [],
  status: "draft",
  publishedAt: null,
};

const PUBLISHED_POST: ContentItem = {
  ...DRAFT_POST,
  summary: "Short.",
  body: "## Body",
  status: "published",
  publishedAt: "2026-10-01T10:00:00.000Z",
};

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function sent(index: number) {
  const [url, init] = fetchMock.mock.calls[index];
  return { url, method: init!.method, body: init!.body ? JSON.parse(String(init!.body)) : undefined };
}

function fieldError(label: string) {
  const input = screen.getByLabelText(label);
  const id = input.getAttribute("aria-describedby");
  return id ? document.getElementById(id)!.textContent : null;
}

describe("ItemForm publish flow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    notify.mockReset();
    uploadFile.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers Save draft and Publish with a Draft badge for a new post", () => {
    renderForm("posts");
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
  });

  it("keeps the single Save for collections without drafts", () => {
    renderForm("certifications");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByText("Draft")).toBeNull();
  });

  it("saves a draft with only title and slug, sending empty optional fields as null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, DRAFT_POST));
    renderForm("posts");
    type("Title", "Hello");
    await click("Save draft");
    expect(sent(0)).toEqual({
      url: "http://api.test/content/posts",
      method: "POST",
      body: {
        title: "Hello",
        slug: "hello",
        slugEs: null,
        summary: null,
        coverUrl: null,
        tags: [],
        body: null,
        references: [],
        titleEs: null,
        summaryEs: null,
        bodyEs: null,
      },
    });
    expect(notify).toHaveBeenCalledWith("Draft saved.");
    expect(push).toHaveBeenCalledWith("/posts");
  });

  it("refuses to publish with required fields empty and sends nothing", async () => {
    renderForm("posts");
    type("Title", "Hello");
    await click("Publish");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Summary")).toBe("Summary is required to publish.");
    expect(fieldError("Body")).toBe("Body is required to publish.");
  });

  it("refuses an invalid slug without sending", async () => {
    renderForm("posts");
    type("Title", "Hello");
    type("Slug", "Bad Slug");
    await click("Save draft");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Slug")).toBe(
      "Use lowercase letters, digits and single hyphens, not at the start or end.",
    );
  });

  it("publishes a new post: creates it, then publishes it", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { ...DRAFT_POST, summary: "S", body: "B" }))
      .mockResolvedValueOnce(jsonResponse(200, PUBLISHED_POST));
    renderForm("posts");
    type("Title", "Hello");
    type("Summary", "S");
    type("Body", "B");
    await click("Publish");
    expect(sent(0).url).toBe("http://api.test/content/posts");
    expect(sent(0).method).toBe("POST");
    expect(sent(1)).toEqual({
      url: "http://api.test/content/posts/9/publish",
      method: "POST",
      body: undefined,
    });
    expect(notify).toHaveBeenCalledWith("Published.");
    expect(push).toHaveBeenCalledWith("/posts");
  });

  it("shows the fields of a refused publish and updates the created item next time", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { ...DRAFT_POST, summary: "S", body: "B" }))
      .mockResolvedValueOnce(
        jsonResponse(400, { error: "Validation failed.", fields: { summary: ["Summary is required."] } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, DRAFT_POST))
      .mockResolvedValueOnce(jsonResponse(200, PUBLISHED_POST));
    renderForm("posts");
    type("Title", "Hello");
    type("Summary", "S");
    type("Body", "B");
    await click("Publish");
    expect(fieldError("Summary")).toBe("Summary is required.");
    expect(push).not.toHaveBeenCalled();
    await click("Publish");
    expect(sent(2).url).toBe("http://api.test/content/posts/9");
    expect(sent(2).method).toBe("PUT");
    expect(sent(3).url).toBe("http://api.test/content/posts/9/publish");
  });

  it("offers Save and Unpublish for a published post", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, PUBLISHED_POST))
      .mockResolvedValueOnce(jsonResponse(200, { ...PUBLISHED_POST, status: "draft" }));
    renderForm("posts", PUBLISHED_POST);
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    await click("Unpublish");
    expect(sent(0)).toMatchObject({ url: "http://api.test/content/posts/9", method: "PUT" });
    expect(sent(1)).toMatchObject({ url: "http://api.test/content/posts/9/unpublish", method: "POST" });
    expect(notify).toHaveBeenCalledWith("Moved back to drafts.");
  });

  it("saving a published post checks the publish rules", async () => {
    renderForm("posts", PUBLISHED_POST);
    type("Summary", "");
    await click("Save");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Summary")).toBe("Summary is required to publish.");
  });

  it("proposes the slug from the title until the slug is edited", () => {
    renderForm("posts");
    type("Title", "Diseño del Año!");
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("diseno-del-ano");
    expect(screen.getByText("Follows the title until you edit it.")).toBeTruthy();
    type("Slug", "my-slug");
    type("Title", "Another title");
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("my-slug");
    expect(screen.queryByText("Follows the title until you edit it.")).toBeNull();
  });

  it("does not change the slug of an item that was published once", () => {
    renderForm("posts", { ...DRAFT_POST, publishedAt: "2026-09-01T10:00:00.000Z" });
    type("Title", "Brand new title");
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("hello");
  });

  it("shows a 409 as the slug's field error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: "This slug is already in use.",
        fields: { slug: ["This slug is already in use."] },
      }),
    );
    renderForm("posts");
    type("Title", "Hello");
    await click("Save draft");
    expect(fieldError("Slug")).toBe("This slug is already in use.");
    expect(push).not.toHaveBeenCalled();
  });

  it("401 while saving a draft offers the sign-in and keeps the values", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    renderForm("posts");
    type("Title", "Hello");
    await click("Save draft");
    expect(screen.getByRole("dialog", { name: "Session expired" })).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Hello");
  });

  it("401 during an upload offers the sign-in and keeps the values", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    renderForm("posts");
    type("Title", "Hello");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload Cover image"), {
        target: { files: [new File(["png"], "cover.png", { type: "image/png" })] },
      });
    });
    const dialog = screen.getByRole("dialog", { name: "Session expired" });
    await act(async () => {
      fireEvent.click(within(dialog).getByText("mock Google sign-in"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Hello");
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("hello");
  });

  it("a failed upload keeps the form values", async () => {
    uploadFile.mockResolvedValue({ ok: false, status: 400, error: "File too large." });
    renderForm("posts");
    type("Title", "Hello");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload Cover image"), {
        target: { files: [new File(["png"], "cover.png", { type: "image/png" })] },
      });
    });
    expect(screen.getByText("cover.png: File too large.")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Hello");
  });
});

const PENDING: ContentItem = {
  id: 5,
  status: "pending",
  position: null,
  quote: "Great work.",
  author: "Grace",
  role: "CTO",
  avatar: null,
  email: "grace@example.com",
  language: "en",
  notified: true,
  submittedAt: "2026-10-05T12:00:00.000Z",
};

const APPROVED: ContentItem = {
  id: 1,
  status: "approved",
  position: 2,
  quote: "Fine.",
  author: "Ada",
  role: "Lead",
  avatar: "https://api.test/files/3",
  email: null,
  language: null,
  notified: true,
  submittedAt: null,
};

const PENDING_VALUES = {
  quote: "Great work.",
  author: "Grace",
  role: "CTO",
  avatar: null,
  quoteEs: null,
  roleEs: null,
};

describe("ItemForm testimonial position", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    notify.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for no position or email when creating and sends none", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { ...APPROVED, id: 9, position: 0 }));
    renderForm("testimonials");
    expect(screen.queryByLabelText("Position")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    type("Quote", "Great.");
    type("Author", "Ada");
    type("Role", "CTO");
    await submit();
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials",
      method: "POST",
      body: { quote: "Great.", author: "Ada", role: "CTO", avatar: null, quoteEs: null, roleEs: null },
    });
    expect(notify).toHaveBeenCalledWith("Item created.");
  });

  it("offers the position of an approved testimonial, as today", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, APPROVED));
    renderForm("testimonials", APPROVED);
    expect((screen.getByLabelText("Position") as HTMLInputElement).value).toBe("2");
    type("Position", "0");
    await submit();
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/1",
      method: "PUT",
      body: {
        position: 0,
        quote: "Fine.",
        author: "Ada",
        role: "Lead",
        avatar: "https://api.test/files/3",
        quoteEs: null,
        roleEs: null,
      },
    });
  });

  it("hides the position of a pending testimonial", () => {
    renderForm("testimonials", PENDING);
    expect(screen.queryByLabelText("Position")).toBeNull();
  });
});

describe("ItemForm pending details", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the email, language and submission date as read-only", () => {
    renderForm("testimonials", PENDING);
    const details = screen.getByRole("region", { name: "Submission" });
    expect(within(details).getByText("grace@example.com")).toBeTruthy();
    expect(within(details).getByText("English")).toBeTruthy();
    expect(within(details).getByText("Oct 5, 2026")).toBeTruthy();
    expect(within(details).queryByText("Notification not sent")).toBeNull();
    expect(within(details).queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("shows Spanish submissions and a failed notification", () => {
    renderForm("testimonials", { ...PENDING, language: "es", notified: false });
    const details = screen.getByRole("region", { name: "Submission" });
    expect(within(details).getByText("Spanish")).toBeTruthy();
    expect(within(details).getByText("Notification not sent")).toBeTruthy();
  });

  it("keeps the name, role, quote and photo editable", () => {
    renderForm("testimonials", PENDING);
    for (const label of ["Quote", "Author", "Role", "Photo"]) {
      expect(screen.getByLabelText(label).hasAttribute("readonly")).toBe(false);
    }
  });

  it("shows no submission block for approved testimonials", () => {
    renderForm("testimonials", APPROVED);
    expect(screen.queryByRole("region", { name: "Submission" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });
});

describe("ItemForm approve", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    notify.mockReset();
    refreshCount.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers Save, Approve and Reject for a pending testimonial", () => {
    renderForm("testimonials", PENDING);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("Save stores the changes and keeps the testimonial pending", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...PENDING, role: "CEO" }));
    renderForm("testimonials", PENDING);
    type("Role", "CEO");
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/5",
      method: "PUT",
      body: { ...PENDING_VALUES, role: "CEO" },
    });
    expect(notify).toHaveBeenCalledWith("Item updated.");
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it("Approve validates first: field errors and no request", async () => {
    renderForm("testimonials", PENDING);
    type("Quote", "x".repeat(501));
    type("Author", "");
    await click("Approve");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Quote")).toBe("Quote must be at most 500 characters.");
    expect(fieldError("Author")).toBe("Author is required.");
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it("Approve sends the form's values, updates the pending count and goes back to the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...PENDING, status: "approved", position: 0 }));
    renderForm("testimonials", PENDING);
    type("Quote", "Great work, really.");
    await click("Approve");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/5/approve",
      method: "POST",
      body: { ...PENDING_VALUES, quote: "Great work, really." },
    });
    expect(new Headers(fetchMock.mock.calls[0][1]!.headers).get("Authorization")).toBe(
      "Bearer old.token.value",
    );
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("Testimonial approved.");
    expect(push).toHaveBeenCalledWith("/testimonials");
    expect(refresh).toHaveBeenCalled();
  });

  it("Approve shows the API's field errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: "Validation failed.", fields: { role: ["Role is too long."] } }),
    );
    renderForm("testimonials", PENDING);
    await click("Approve");
    expect(fieldError("Role")).toBe("Role is too long.");
    expect(push).not.toHaveBeenCalled();
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it("401 on Approve offers sign-in, keeps the values and approves with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { ...PENDING, status: "approved", position: 0 }));
    renderForm("testimonials", PENDING);
    type("Role", "CEO");
    await click("Approve");
    const dialog = screen.getByRole("dialog", { name: "Session expired" });
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByText("mock Google sign-in"));
    });
    expect((screen.getByLabelText("Role") as HTMLInputElement).value).toBe("CEO");
    await click("Approve");
    expect(sent(1)).toEqual({
      url: "http://api.test/content/testimonials/5/approve",
      method: "POST",
      body: { ...PENDING_VALUES, role: "CEO" },
    });
    expect(new Headers(fetchMock.mock.calls[1][1]!.headers).get("Authorization")).toBe(
      "Bearer fresh.token.value",
    );
    expect(push).toHaveBeenCalledWith("/testimonials");
  });

  it("404 on Approve says the item no longer exists and reloads the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
    renderForm("testimonials", PENDING);
    await click("Approve");
    expect(notify).toHaveBeenCalledWith("This item no longer exists.");
    expect(push).toHaveBeenCalledWith("/testimonials");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("ItemForm reject", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    notify.mockReset();
    refreshCount.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function confirmReject() {
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject testimonial?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    });
  }

  it("asks for confirmation, and Cancel changes nothing", () => {
    renderForm("testimonials", PENDING);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject testimonial?" });
    expect(dialog.textContent).toContain("Grace");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the testimonial, updates the pending count and goes back to the list", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderForm("testimonials", PENDING);
    await confirmReject();
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/5",
      method: "DELETE",
      body: undefined,
    });
    expect(new Headers(fetchMock.mock.calls[0][1]!.headers).get("Authorization")).toBe(
      "Bearer old.token.value",
    );
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("Testimonial rejected.");
    expect(push).toHaveBeenCalledWith("/testimonials");
    expect(refresh).toHaveBeenCalled();
  });

  it("404 says the item no longer exists and reloads the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found." }));
    renderForm("testimonials", PENDING);
    await confirmReject();
    expect(screen.queryByRole("dialog", { name: "Reject testimonial?" })).toBeNull();
    expect(notify).toHaveBeenCalledWith("This item no longer exists.");
    expect(push).toHaveBeenCalledWith("/testimonials");
    expect(refresh).toHaveBeenCalled();
  });

  it("401 offers sign-in and keeps the form", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    renderForm("testimonials", PENDING);
    type("Role", "CEO");
    await confirmReject();
    expect(screen.getByRole("dialog", { name: "Session expired" })).toBeTruthy();
    expect((screen.getByLabelText("Role") as HTMLInputElement).value).toBe("CEO");
    expect(refreshCount).not.toHaveBeenCalled();
  });
});

function tab(name: "English" | "Spanish") {
  fireEvent.click(screen.getByRole("tab", { name }));
}

function value(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

describe("ItemForm language tabs", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    notify.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers English and Spanish tabs, English first, only where fields are bilingual", () => {
    renderForm("posts");
    const tabs = within(screen.getByRole("tablist", { name: "Language" })).getAllByRole("tab");
    expect(tabs.map((t) => [t.textContent, t.getAttribute("aria-selected")])).toEqual([
      ["English", "true"],
      ["Spanish", "false"],
    ]);
    cleanupAndRender("technologies");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("keeps the input of both languages when switching tabs", () => {
    renderForm("highlights");
    type("Title", "Clean code");
    tab("Spanish");
    expect(screen.getByRole("tab", { name: "Spanish" }).getAttribute("aria-selected")).toBe("true");
    expect(value("Title")).toBe("");
    type("Title", "Código limpio");
    tab("English");
    expect(value("Title")).toBe("Clean code");
    tab("Spanish");
    expect(value("Title")).toBe("Código limpio");
  });

  it("sends both languages, an empty Spanish value as null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 3 }));
    renderForm("highlights");
    type("Position", "1");
    type("Icon", "code");
    type("Title", "Clean code");
    type("Description", "Readable.");
    tab("Spanish");
    type("Title", "Código limpio");
    await submit();
    expect(sent(0).body).toEqual({
      position: 1,
      icon: "code",
      title: "Clean code",
      description: "Readable.",
      titleEs: "Código limpio",
      descriptionEs: null,
    });
  });

  it("fills the Spanish values of an item being edited", () => {
    renderForm("highlights", {
      id: 3,
      position: 0,
      icon: "code",
      title: "Clean code",
      description: "Readable.",
      titleEs: "Código limpio",
      descriptionEs: null,
    });
    tab("Spanish");
    expect(value("Title")).toBe("Código limpio");
    expect(value("Description")).toBe("");
  });

  it("shows in Spanish only the bilingual fields, each with its English value as hint", () => {
    renderForm("posts");
    type("Title", "Hello");
    type("Summary", "Short.");
    tab("Spanish");
    for (const label of ["Title", "Slug", "Summary", "Body"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "References" })).toBeTruthy();
    for (const label of ["Cover image", "Tags"]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.getByText("English: Hello")).toBeTruthy();
    expect(screen.getByText("English: Short.")).toBeTruthy();
    expect(screen.queryByText("English: ")).toBeNull();
  });

  it("previews the Markdown body of the active tab", () => {
    renderForm("posts");
    type("Body", "English body");
    tab("Spanish");
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("");
    type("Body", "Cuerpo");
    expect(screen.getByRole("region", { name: "Body preview" })).toBeTruthy();
    tab("English");
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("English body");
  });

  it("edits the Spanish title of each reference and sends it with the shared URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, DRAFT_POST));
    renderForm("posts");
    type("Title", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Add reference" }));
    fireEvent.click(screen.getByRole("button", { name: "Add reference" }));
    type("Reference 1 title", "OWASP");
    type("Reference 1 URL", "https://owasp.org");
    type("Reference 2 title", "MDN");
    type("Reference 2 URL", "https://developer.mozilla.org");
    tab("Spanish");
    type("Reference 1 title", "OWASP en español");
    await click("Save draft");
    expect(sent(0).body.references).toEqual([
      { title: "OWASP", url: "https://owasp.org", titleEs: "OWASP en español" },
      { title: "MDN", url: "https://developer.mozilla.org", titleEs: null },
    ]);
  });

  it("shows a Spanish field error and switches to its tab", async () => {
    renderForm("posts");
    type("Title", "Hello");
    tab("Spanish");
    type("Title", "x".repeat(201));
    tab("English");
    await click("Save draft");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Spanish" }).getAttribute("aria-selected")).toBe("true");
    expect(fieldError("Title")).toBe("Title must be at most 200 characters.");
  });
});

describe("ItemForm Spanish slug", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the Spanish title until the Spanish slug is edited", () => {
    renderForm("posts");
    type("Title", "Hello");
    tab("Spanish");
    type("Title", "Diseño del Año");
    expect(value("Slug")).toBe("diseno-del-ano");
    expect(screen.getByText("Follows the title until you edit it.")).toBeTruthy();
    type("Slug", "mi-slug");
    type("Title", "Otro título");
    expect(value("Slug")).toBe("mi-slug");
    tab("English");
    expect(value("Slug")).toBe("hello");
  });

  it("does not change the Spanish slug of an item published with one", () => {
    renderForm("posts", { ...PUBLISHED_POST, titleEs: "Hola", slugEs: "hola" });
    tab("Spanish");
    type("Title", "Nuevo título");
    expect(value("Slug")).toBe("hola");
  });

  it("proposes a Spanish slug for an item published without one", () => {
    renderForm("posts", { ...PUBLISHED_POST, titleEs: null, slugEs: null });
    tab("Spanish");
    type("Title", "Hola mundo");
    expect(value("Slug")).toBe("hola-mundo");
  });

  it("sends the Spanish slug", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, DRAFT_POST));
    renderForm("posts");
    type("Title", "Hello");
    tab("Spanish");
    type("Title", "Hola");
    await click("Save draft");
    expect(sent(0).body).toMatchObject({ slug: "hello", titleEs: "Hola", slugEs: "hola" });
  });

  it("shows a 409 on the Spanish slug in the Spanish tab", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: "This slug is already in use.",
        fields: { slugEs: ["This slug is already in use."] },
      }),
    );
    renderForm("posts");
    type("Title", "Hello");
    await click("Save draft");
    expect(screen.getByRole("tab", { name: "Spanish" }).getAttribute("aria-selected")).toBe("true");
    expect(fieldError("Slug")).toBe("This slug is already in use.");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ItemForm Spanish testimonial submission", () => {
  const SPANISH: ContentItem = {
    ...PENDING,
    quote: null,
    role: null,
    quoteEs: "Gran trabajo.",
    roleEs: "Directora",
    language: "es",
  };

  beforeEach(() => {
    fetchMock.mockReset();
    notify.mockReset();
    refreshCount.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Spanish text and the submission language", () => {
    renderForm("testimonials", SPANISH);
    expect(within(screen.getByRole("region", { name: "Submission" })).getByText("Spanish")).toBeTruthy();
    expect(value("Quote")).toBe("");
    tab("Spanish");
    expect(value("Quote")).toBe("Gran trabajo.");
    expect(value("Role")).toBe("Directora");
  });

  it("requires the English role and quote to approve, and sends nothing", async () => {
    renderForm("testimonials", SPANISH);
    tab("Spanish");
    await click("Approve");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "English" }).getAttribute("aria-selected")).toBe("true");
    expect(fieldError("Quote")).toBe("Quote is required.");
    expect(fieldError("Role")).toBe("Role is required.");
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it("saves a pending submission with only Spanish text, English empty as null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, SPANISH));
    renderForm("testimonials", SPANISH);
    tab("Spanish");
    type("Role", "Directora general");
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/5",
      method: "PUT",
      body: {
        quote: null,
        author: "Grace",
        role: null,
        avatar: null,
        quoteEs: "Gran trabajo.",
        roleEs: "Directora general",
      },
    });
    expect(notify).toHaveBeenCalledWith("Item updated.");
  });

  it("still checks the other rules when saving a pending submission", async () => {
    renderForm("testimonials", SPANISH);
    type("Author", "");
    type("Quote", "x".repeat(501));
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Author")).toBe("Author is required.");
    expect(fieldError("Quote")).toBe("Quote must be at most 500 characters.");
  });

  it("requires the English quote and role to save an approved testimonial", async () => {
    renderForm("testimonials", { ...APPROVED, quoteEs: "Bien.", roleEs: "Líder" });
    type("Quote", "");
    type("Role", "");
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fieldError("Quote")).toBe("Quote is required.");
    expect(fieldError("Role")).toBe("Role is required.");
  });

  it("approves once the English text is filled, with both languages", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...SPANISH, status: "approved" }));
    renderForm("testimonials", SPANISH);
    type("Quote", "Great work.");
    type("Role", "Director");
    await click("Approve");
    expect(sent(0)).toEqual({
      url: "http://api.test/content/testimonials/5/approve",
      method: "POST",
      body: {
        quote: "Great work.",
        author: "Grace",
        role: "Director",
        avatar: null,
        quoteEs: "Gran trabajo.",
        roleEs: "Directora",
      },
    });
  });
});
