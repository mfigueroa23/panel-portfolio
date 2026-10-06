import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReferencesField, type Reference } from "./references-field";

const ROWS: Reference[] = [
  { title: "OWASP", url: "https://owasp.org" },
  { title: "MDN", url: "https://developer.mozilla.org", titleEs: "MDN en español" },
];

function Harness({ lang, initial = ROWS, onItems }: { lang: "en" | "es"; initial?: Reference[]; onItems?: (items: Reference[]) => void }) {
  const [items, setItems] = useState(initial);
  return (
    <>
      <span id="refs-label">References</span>
      <ReferencesField
        labelId="refs-label"
        a11y={{ id: "refs" }}
        items={items}
        maxItems={3}
        lang={lang}
        onChange={(next) => {
          setItems(next);
          onItems?.(next);
        }}
      />
    </>
  );
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("ReferencesField", () => {
  it("is a group labelled by the field's label", () => {
    render(<Harness lang="en" />);
    expect(screen.getByRole("group", { name: "References" })).toBeTruthy();
  });

  it("edits English titles and URLs, adds and removes rows in English", () => {
    const onItems = vi.fn();
    render(<Harness lang="en" onItems={onItems} />);
    expect(input("Reference 1 title").value).toBe("OWASP");
    fireEvent.change(input("Reference 1 URL"), { target: { value: "https://owasp.org/top10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add reference" }));
    expect(input("Reference 3 title").value).toBe("");
    expect(screen.getByRole("button", { name: "Add reference" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove reference 1" }));
    expect(input("Reference 1 title").value).toBe("MDN");
    expect(onItems).toHaveBeenLastCalledWith([
      ROWS[1],
      { title: "", url: "" },
    ]);
  });

  it("in Spanish edits titleEs per row with the English title as hint and the URL shared", () => {
    const onItems = vi.fn();
    render(<Harness lang="es" onItems={onItems} />);
    expect(input("Reference 1 title").value).toBe("");
    expect(input("Reference 2 title").value).toBe("MDN en español");
    expect(screen.getByText("English: OWASP")).toBeTruthy();
    expect(screen.getByText("https://owasp.org")).toBeTruthy();
    expect(screen.queryByLabelText("Reference 1 URL")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove reference 1" })).toBeNull();
    fireEvent.change(input("Reference 1 title"), { target: { value: "OWASP (es)" } });
    expect(onItems).toHaveBeenLastCalledWith([
      { title: "OWASP", url: "https://owasp.org", titleEs: "OWASP (es)" },
      ROWS[1],
    ]);
  });

  it("in Spanish says there is nothing to translate without rows", () => {
    render(<Harness lang="es" initial={[]} />);
    expect(screen.getByText("Add references in the English tab.")).toBeTruthy();
  });
});
