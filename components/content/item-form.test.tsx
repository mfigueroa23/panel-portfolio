import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
        expect(screen.getByLabelText(field.label)).toBeTruthy();
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
      position: 0,
      period: "2024 – now",
      role: "Engineer",
      company: "Acme",
      description: "Builds things.",
      technologies: ["TypeScript"],
      current: true,
    });
    expect((screen.getByLabelText("Position") as HTMLInputElement).value).toBe("0");
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
