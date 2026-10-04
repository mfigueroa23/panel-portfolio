import { describe, expect, it } from "vitest";
import { COLLECTIONS, isCollectionKey, type CollectionKey, type FieldDef } from "./collections";

// Mirrors the API DTOs (plan §4). A DTO change in `api` must update this table
// and lib/collections.ts under the same spec.
type Rule = Omit<FieldDef, "label">;

const position: Rule = { name: "position", kind: "int", required: true, min: 0 };
const text = (name: string, maxLength: number): Rule => ({
  name,
  kind: "text",
  required: true,
  maxLength,
});
const textarea = (name: string, maxLength: number): Rule => ({
  name,
  kind: "textarea",
  required: true,
  maxLength,
});
const list = (name: string, maxItems: number): Rule => ({
  name,
  kind: "list",
  required: true,
  maxItems,
});
const boolean = (name: string): Rule => ({ name, kind: "boolean", required: true });

const EXPECTED: Record<CollectionKey, { apiPath: string; rules: Rule[] }> = {
  experience: {
    apiPath: "/content/experiences",
    rules: [
      position,
      text("period", 100),
      text("role", 200),
      text("company", 200),
      textarea("description", 5000),
      list("technologies", 50),
      boolean("current"),
    ],
  },
  projects: {
    apiPath: "/content/projects",
    rules: [
      position,
      text("title", 200),
      textarea("description", 5000),
      text("image", 500),
      list("tags", 50),
      text("link", 500),
      text("github", 500),
    ],
  },
  testimonials: {
    apiPath: "/content/testimonials",
    rules: [
      position,
      textarea("quote", 5000),
      text("author", 200),
      text("role", 200),
      text("avatar", 500),
    ],
  },
  highlights: {
    apiPath: "/content/highlights",
    rules: [
      position,
      text("icon", 100),
      text("title", 200),
      textarea("description", 5000),
    ],
  },
  "social-links": {
    apiPath: "/content/social-links",
    rules: [position, text("icon", 100), text("href", 500)],
  },
  technologies: {
    apiPath: "/content/technologies",
    rules: [position, text("name", 100)],
  },
  "contact-info": {
    apiPath: "/content/contact-info",
    rules: [
      position,
      text("icon", 100),
      text("label", 100),
      text("value", 200),
      text("href", 500),
    ],
  },
};

describe("COLLECTIONS", () => {
  it("has exactly the 7 collections, in navigation order", () => {
    expect(Object.keys(COLLECTIONS)).toEqual([
      "experience",
      "projects",
      "testimonials",
      "highlights",
      "social-links",
      "technologies",
      "contact-info",
    ]);
  });

  it.each(Object.entries(EXPECTED))(
    "%s mirrors the API path and DTO rules",
    (key, expected) => {
      const def = COLLECTIONS[key as CollectionKey];
      expect(def.key).toBe(key);
      expect(def.apiPath).toBe(expected.apiPath);
      const rules = def.fields.map((field) => {
        const rule: Partial<FieldDef> = { ...field };
        delete rule.label;
        return rule;
      });
      expect(rules).toEqual(expected.rules);
    },
  );

  it("gives every collection and field a non-empty English label", () => {
    expect(Object.values(COLLECTIONS).map((c) => c.label)).toEqual([
      "Experience",
      "Projects",
      "Testimonials",
      "Highlights",
      "Social links",
      "Technologies",
      "Contact info",
    ]);
    for (const def of Object.values(COLLECTIONS)) {
      for (const field of def.fields) {
        expect(field.label.trim()).not.toBe("");
      }
      expect(def.fields[0].label).toBe("Position");
    }
  });

  it("derives each item's identifying text", () => {
    const base = { id: 1, position: 0 };
    expect(
      COLLECTIONS.experience.itemTitle({ ...base, role: "Engineer", company: "Acme" }),
    ).toBe("Engineer · Acme");
    expect(COLLECTIONS.projects.itemTitle({ ...base, title: "Portfolio" })).toBe(
      "Portfolio",
    );
    expect(COLLECTIONS.testimonials.itemTitle({ ...base, author: "Ada" })).toBe("Ada");
    expect(COLLECTIONS.highlights.itemTitle({ ...base, title: "Clean code" })).toBe(
      "Clean code",
    );
    expect(
      COLLECTIONS["social-links"].itemTitle({ ...base, href: "https://github.com/x" }),
    ).toBe("https://github.com/x");
    expect(COLLECTIONS.technologies.itemTitle({ ...base, name: "TypeScript" })).toBe(
      "TypeScript",
    );
    expect(COLLECTIONS["contact-info"].itemTitle({ ...base, label: "Email" })).toBe(
      "Email",
    );
  });
});

describe("isCollectionKey", () => {
  it("accepts the 7 keys and rejects anything else", () => {
    for (const key of Object.keys(COLLECTIONS)) expect(isCollectionKey(key)).toBe(true);
    for (const key of ["unknown", "experiences", "", "toString", "__proto__"]) {
      expect(isCollectionKey(key)).toBe(false);
    }
  });
});
