import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  NAV_GROUPS,
  byPosition,
  byPublication,
  byRecency,
  isCollectionKey,
  type CollectionKey,
  type ContentItem,
  type FieldDef,
} from "./collections";

// Mirrors the API DTOs (plan §4). A DTO change in `api` must update this table
// and lib/collections.ts under the same spec.
type Rule = Omit<FieldDef, "label">;

const position: Rule = { name: "position", kind: "int", required: true, min: 0 };
const text = (name: string, maxLength: number, required = true): Rule => ({
  name,
  kind: "text",
  required,
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
const url = (name: string): Rule => ({ name, kind: "url", required: false, maxLength: 500 });
const markdown = (name: string, publishRequired = false): Rule => ({
  name,
  kind: "markdown",
  required: false,
  maxLength: 100_000,
  ...(publishRequired ? { publishRequired: true } : {}),
});

const EXPECTED: Record<
  CollectionKey,
  { apiPath: string; apiAdminListPath?: string; publishable: boolean; rules: Rule[] }
> = {
  "social-links": {
    apiPath: "/content/social-links",
    publishable: false,
    rules: [position, text("icon", 100), text("href", 500)],
  },
  technologies: {
    apiPath: "/content/technologies",
    publishable: false,
    rules: [position, text("name", 100)],
  },
  highlights: {
    apiPath: "/content/highlights",
    publishable: false,
    rules: [position, text("icon", 100), text("title", 200), textarea("description", 5000)],
  },
  testimonials: {
    apiPath: "/content/testimonials",
    publishable: false,
    rules: [
      position,
      textarea("quote", 5000),
      text("author", 200),
      text("role", 200),
      text("avatar", 500),
    ],
  },
  "contact-info": {
    apiPath: "/content/contact-info",
    publishable: false,
    rules: [
      position,
      text("icon", 100),
      text("label", 100),
      text("value", 200),
      text("href", 500),
    ],
  },
  projects: {
    apiPath: "/content/projects",
    apiAdminListPath: "/content/projects/all",
    publishable: true,
    rules: [
      text("title", 200),
      { name: "slug", kind: "slug", required: true, maxLength: 100, reserved: ["all"] },
      {
        name: "description",
        kind: "textarea",
        required: false,
        publishRequired: true,
        maxLength: 5000,
      },
      {
        name: "image",
        kind: "file",
        required: false,
        publishRequired: true,
        maxLength: 500,
        accept: ["image"],
      },
      list("tags", 50),
      url("link"),
      url("github"),
      markdown("body"),
    ],
  },
  experience: {
    apiPath: "/content/experiences",
    publishable: false,
    rules: [
      text("period", 100),
      { name: "startDate", kind: "month", required: true },
      text("role", 200),
      text("company", 200),
      textarea("description", 5000),
      list("technologies", 50),
      boolean("current"),
      markdown("body"),
    ],
  },
  certifications: {
    apiPath: "/content/certifications",
    publishable: false,
    rules: [
      position,
      text("name", 200),
      text("issuer", 200),
      { name: "issueDate", kind: "date", required: true },
      { name: "expiryDate", kind: "date", required: false, notBefore: "issueDate" },
      text("credentialId", 100, false),
      url("verificationUrl"),
      { name: "fileUrl", kind: "file", required: false, maxLength: 500, accept: ["image", "pdf"] },
    ],
  },
  posts: {
    apiPath: "/content/posts",
    apiAdminListPath: "/content/posts/all",
    publishable: true,
    rules: [
      text("title", 200),
      { name: "slug", kind: "slug", required: true, maxLength: 100, reserved: ["tag", "page", "all", "feed"] },
      {
        name: "summary",
        kind: "textarea",
        required: false,
        publishRequired: true,
        maxLength: 300,
      },
      { name: "coverUrl", kind: "file", required: false, maxLength: 500, accept: ["image"] },
      { name: "tags", kind: "tags", required: false, maxItems: 10, maxLength: 30 },
      markdown("body", true),
      { name: "references", kind: "references", required: false, maxItems: 30 },
    ],
  },
};

const ALL_KEYS = [
  "social-links",
  "technologies",
  "highlights",
  "testimonials",
  "contact-info",
  "projects",
  "experience",
  "certifications",
  "posts",
];

describe("COLLECTIONS", () => {
  it("has exactly the 9 collections, in navigation order", () => {
    expect(Object.keys(COLLECTIONS)).toEqual(ALL_KEYS);
  });

  it.each(Object.entries(EXPECTED))(
    "%s mirrors the API paths and DTO rules",
    (key, expected) => {
      const def = COLLECTIONS[key as CollectionKey];
      expect(def.key).toBe(key);
      expect(def.apiPath).toBe(expected.apiPath);
      expect(def.apiAdminListPath).toBe(expected.apiAdminListPath);
      expect(def.publishable).toBe(expected.publishable);
      const rules = def.fields.map((field) => {
        const rule: Partial<FieldDef> = { ...field };
        delete rule.label;
        return rule;
      });
      expect(rules).toEqual(expected.rules);
    },
  );

  it("drops position from projects and experience only", () => {
    const withPosition = Object.values(COLLECTIONS)
      .filter((def) => def.fields.some((field) => field.name === "position"))
      .map((def) => def.key);
    expect(withPosition).toEqual([
      "social-links",
      "technologies",
      "highlights",
      "testimonials",
      "contact-info",
      "certifications",
    ]);
  });

  it("gives the public base path of publishable collections", () => {
    expect(COLLECTIONS.projects.publicBase).toBe("/projects");
    expect(COLLECTIONS.posts.publicBase).toBe("/blog");
    expect(COLLECTIONS.experience.publicBase).toBeUndefined();
  });

  it("gives every collection and field a non-empty English label", () => {
    expect(Object.values(COLLECTIONS).map((c) => c.label)).toEqual([
      "Social links",
      "Technologies",
      "Highlights",
      "Testimonials",
      "Contact info",
      "Projects",
      "Experience",
      "Certifications",
      "Posts",
    ]);
    for (const def of Object.values(COLLECTIONS)) {
      for (const field of def.fields) {
        expect(field.label.trim()).not.toBe("");
      }
    }
    expect(COLLECTIONS.experience.fields.find((f) => f.name === "startDate")!.label).toBe(
      "Start month",
    );
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
    expect(COLLECTIONS.certifications.itemTitle({ ...base, name: "CKA" })).toBe("CKA");
    expect(COLLECTIONS.posts.itemTitle({ id: 1, title: "Hello" })).toBe("Hello");
  });

  it("sorts each collection with its own order", () => {
    expect(COLLECTIONS.projects.sort).toBe(byPublication);
    expect(COLLECTIONS.posts.sort).toBe(byPublication);
    expect(COLLECTIONS.experience.sort).toBe(byRecency);
    for (const key of ALL_KEYS.filter((k) => !["projects", "posts", "experience"].includes(k))) {
      expect(COLLECTIONS[key as CollectionKey].sort).toBe(byPosition);
    }
  });
});

const ids = (items: ContentItem[]) => items.map((item) => item.id);

describe("sort functions", () => {
  it("byPosition orders by position, then id", () => {
    const items: ContentItem[] = [
      { id: 3, position: 1 },
      { id: 2, position: 0 },
      { id: 5, position: 1 },
      { id: 1, position: 0 },
    ];
    expect(ids([...items].sort(byPosition))).toEqual([1, 2, 3, 5]);
  });

  it("byPublication puts drafts first, then published by date descending", () => {
    const items: ContentItem[] = [
      { id: 1, status: "published", publishedAt: "2026-09-01T10:00:00.000Z" },
      { id: 2, status: "draft", publishedAt: null },
      { id: 3, status: "published", publishedAt: "2026-10-01T10:00:00.000Z" },
      // Unpublished: back to draft, first publication date kept.
      { id: 4, status: "draft", publishedAt: "2026-08-01T10:00:00.000Z" },
      { id: 5, status: "published", publishedAt: "2026-09-01T10:00:00.000Z" },
    ];
    expect(ids([...items].sort(byPublication))).toEqual([4, 2, 3, 5, 1]);
  });

  it("byRecency puts current entries first, then start month descending, undated last", () => {
    const items: ContentItem[] = [
      { id: 1, current: false, startDate: "2020-01" },
      { id: 2, current: false, startDate: null },
      { id: 3, current: true, startDate: "2019-05" },
      { id: 4, current: false, startDate: "2024-03" },
      { id: 5, current: false, startDate: "2024-03" },
      { id: 6, current: false, startDate: null },
    ];
    expect(ids([...items].sort(byRecency))).toEqual([3, 4, 5, 1, 2, 6]);
  });
});

describe("NAV_GROUPS", () => {
  it("groups the navigation into Home sections, Pages and Media", () => {
    expect(NAV_GROUPS).toEqual([
      {
        label: "Home sections",
        links: [
          { href: "/social-links", label: "Social links" },
          { href: "/technologies", label: "Technologies" },
          { href: "/highlights", label: "Highlights" },
          { href: "/testimonials", label: "Testimonials" },
          { href: "/contact-info", label: "Contact info" },
        ],
      },
      {
        label: "Pages",
        links: [
          { href: "/projects", label: "Projects" },
          { href: "/experience", label: "Experience" },
          { href: "/certifications", label: "Certifications" },
          { href: "/posts", label: "Posts" },
        ],
      },
      { label: "Media", links: [{ href: "/files", label: "Files" }] },
    ]);
  });
});

describe("isCollectionKey", () => {
  it("accepts the 9 keys and rejects anything else", () => {
    for (const key of Object.keys(COLLECTIONS)) expect(isCollectionKey(key)).toBe(true);
    for (const key of ["unknown", "experiences", "files", "", "toString", "__proto__"]) {
      expect(isCollectionKey(key)).toBe(false);
    }
  });
});
