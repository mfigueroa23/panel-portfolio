import { describe, expect, it } from "vitest";
import type { FieldDef } from "./collections";
import { validateItem } from "./validation";

const name: FieldDef = { name: "name", label: "Name", kind: "text", required: true, maxLength: 5 };
const description: FieldDef = {
  name: "description",
  label: "Description",
  kind: "textarea",
  required: true,
  maxLength: 10,
};
const position: FieldDef = { name: "position", label: "Position", kind: "int", required: true, min: 0 };
const current: FieldDef = { name: "current", label: "Current", kind: "boolean", required: true };
const tags: FieldDef = { name: "tags", label: "Tags", kind: "list", required: true, maxItems: 2 };

const FIELDS = [name, description, position, current, tags];
const VALID = {
  name: "Go",
  description: "Language",
  position: 0,
  current: false,
  tags: ["a", "b"],
};

function errorsFor(values: Record<string, unknown>) {
  return validateItem(FIELDS, { ...VALID, ...values });
}

describe("validateItem", () => {
  it("returns no errors for valid values", () => {
    expect(validateItem(FIELDS, VALID)).toEqual({});
  });

  describe("text and textarea", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["not a string", 42],
      ["null", null],
    ])("requires a non-empty string (%s)", (_case, value) => {
      expect(errorsFor({ name: value, description: value })).toEqual({
        name: "Name is required.",
        description: "Description is required.",
      });
    });

    it("counts a whitespace-only string as non-empty, like the API", () => {
      expect(errorsFor({ name: "   " })).toEqual({});
    });

    it("does not trim values before checking the length", () => {
      expect(errorsFor({ name: " abcd " })).toEqual({
        name: "Name must be at most 5 characters.",
      });
    });

    it("accepts max characters and rejects max + 1", () => {
      expect(errorsFor({ name: "abcde", description: "x".repeat(10) })).toEqual({});
      expect(errorsFor({ name: "abcdef", description: "x".repeat(11) })).toEqual({
        name: "Name must be at most 5 characters.",
        description: "Description must be at most 10 characters.",
      });
    });

    it("counts an emoji as one character, like the API", () => {
      expect(errorsFor({ name: "😀😀😀😀😀" })).toEqual({});
    });
  });

  describe("int", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["null", null],
    ])("is required (%s)", (_case, value) => {
      expect(errorsFor({ position: value })).toEqual({
        position: "Position is required.",
      });
    });

    it.each([
      ["a decimal", 1.5],
      ["a numeric string", "3"],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ])("must be a whole number (%s)", (_case, value) => {
      expect(errorsFor({ position: value })).toEqual({
        position: "Position must be a whole number.",
      });
    });

    it("accepts min 0 and rejects -1", () => {
      expect(errorsFor({ position: 0 })).toEqual({});
      expect(errorsFor({ position: -1 })).toEqual({
        position: "Position must be at least 0.",
      });
    });
  });

  describe("boolean", () => {
    it("accepts true and false", () => {
      expect(errorsFor({ current: true })).toEqual({});
      expect(errorsFor({ current: false })).toEqual({});
    });

    it.each([
      ["missing", undefined],
      ["a string", "true"],
      ["a number", 1],
    ])("rejects a non-boolean (%s)", (_case, value) => {
      expect(errorsFor({ current: value })).toEqual({
        current: "Current must be true or false.",
      });
    });
  });

  describe("list", () => {
    it("accepts an empty list", () => {
      expect(errorsFor({ tags: [] })).toEqual({});
    });

    it("accepts maxItems and rejects maxItems + 1", () => {
      expect(errorsFor({ tags: ["a", "b"] })).toEqual({});
      expect(errorsFor({ tags: ["a", "b", "c"] })).toEqual({
        tags: "Tags must have at most 2 items.",
      });
    });

    it.each([
      ["missing", undefined],
      ["a string", "a,b"],
    ])("must be a list (%s)", (_case, value) => {
      expect(errorsFor({ tags: value })).toEqual({ tags: "Tags must be a list." });
    });

    it("rejects a non-string item", () => {
      expect(errorsFor({ tags: ["a", 2] })).toEqual({
        tags: "Tags must contain only text.",
      });
    });
  });

  it("reports one error per field for several invalid fields", () => {
    expect(
      validateItem(FIELDS, { name: "", position: -2, current: "no", tags: "x" }),
    ).toEqual({
      name: "Name is required.",
      description: "Description is required.",
      position: "Position must be at least 0.",
      current: "Current must be true or false.",
      tags: "Tags must be a list.",
    });
  });
});

describe("validateItem — content pages kinds", () => {
  const title: FieldDef = { name: "title", label: "Title", kind: "text", required: true, maxLength: 200 };
  const slug: FieldDef = {
    name: "slug",
    label: "Slug",
    kind: "slug",
    required: true,
    maxLength: 100,
    reserved: ["tag", "page", "all", "feed"],
  };
  const summary: FieldDef = {
    name: "summary",
    label: "Summary",
    kind: "textarea",
    required: false,
    publishRequired: true,
    maxLength: 300,
  };
  const body: FieldDef = {
    name: "body",
    label: "Body",
    kind: "markdown",
    required: false,
    publishRequired: true,
    maxLength: 100_000,
  };
  const cover: FieldDef = {
    name: "coverUrl",
    label: "Cover image",
    kind: "file",
    required: false,
    maxLength: 500,
    accept: ["image"],
  };
  const link: FieldDef = { name: "link", label: "Link", kind: "url", required: false, maxLength: 500 };
  const credential: FieldDef = {
    name: "credentialId",
    label: "Credential ID",
    kind: "text",
    required: false,
    maxLength: 100,
  };
  const tagsField: FieldDef = {
    name: "tags",
    label: "Tags",
    kind: "tags",
    required: false,
    maxItems: 10,
    maxLength: 30,
  };
  const references: FieldDef = {
    name: "references",
    label: "References",
    kind: "references",
    required: false,
    maxItems: 30,
  };
  const startDate: FieldDef = { name: "startDate", label: "Start month", kind: "month", required: true };
  const issueDate: FieldDef = { name: "issueDate", label: "Issue date", kind: "date", required: true };
  const expiryDate: FieldDef = {
    name: "expiryDate",
    label: "Expiry date",
    kind: "date",
    required: false,
    notBefore: "issueDate",
  };

  const POST_FIELDS = [title, slug, summary, cover, tagsField, body, references];
  const DRAFT = { title: "Hello", slug: "hello", summary: "", coverUrl: "", tags: [], body: "", references: [] };

  describe("draft and publish modes", () => {
    it("saves a draft with only title and slug", () => {
      expect(validateItem(POST_FIELDS, DRAFT, "draft")).toEqual({});
    });

    it("still requires title and slug for a draft", () => {
      expect(validateItem(POST_FIELDS, { ...DRAFT, title: "", slug: "" }, "draft")).toEqual({
        title: "Title is required.",
        slug: "Slug is required.",
      });
    });

    it("requires the publish-required fields to publish", () => {
      expect(validateItem(POST_FIELDS, DRAFT, "publish")).toEqual({
        summary: "Summary is required to publish.",
        body: "Body is required to publish.",
      });
      expect(
        validateItem(POST_FIELDS, { ...DRAFT, summary: "S", body: "## B" }, "publish"),
      ).toEqual({});
    });

    it("defaults to publish mode", () => {
      expect(Object.keys(validateItem(POST_FIELDS, DRAFT))).toEqual(["summary", "body"]);
    });

    it("checks lengths of optional fields when they are filled", () => {
      expect(
        validateItem(POST_FIELDS, { ...DRAFT, summary: "x".repeat(301) }, "draft"),
      ).toEqual({ summary: "Summary must be at most 300 characters." });
      expect(validateItem([credential], { credentialId: "" })).toEqual({});
      expect(validateItem([credential], { credentialId: null })).toEqual({});
      expect(validateItem([credential], { credentialId: "x".repeat(101) })).toEqual({
        credentialId: "Credential ID must be at most 100 characters.",
      });
    });

    it("limits a Markdown body to 100,000 characters", () => {
      expect(validateItem([body], { body: "x".repeat(100_000) }, "draft")).toEqual({});
      expect(validateItem([body], { body: "x".repeat(100_001) }, "draft")).toEqual({
        body: "Body must be at most 100000 characters.",
      });
    });
  });

  describe("slug", () => {
    it.each(["a", "a-b", "post-2", "x".repeat(100)])("accepts %s", (value) => {
      expect(validateItem([slug], { slug: value })).toEqual({});
    });

    it.each(["-a", "a-", "a--b", "Hello", "a b", "ñu", "a_b"])("rejects %s", (value) => {
      expect(validateItem([slug], { slug: value })).toEqual({
        slug: "Use lowercase letters, digits and single hyphens, not at the start or end.",
      });
    });

    it("rejects more than 100 characters", () => {
      expect(validateItem([slug], { slug: "x".repeat(101) })).toEqual({
        slug: "Slug must be at most 100 characters.",
      });
    });

    it("rejects the reserved post slugs", () => {
      for (const value of ["tag", "page", "all", "feed"]) {
        expect(validateItem([slug], { slug: value })).toEqual({
          slug: `"${value}" is reserved. Choose another slug.`,
        });
      }
    });
  });

  describe("url and file", () => {
    it("accepts http(s) URLs and an empty optional value", () => {
      for (const value of ["https://x.test/a", "http://x.test", "", null, undefined]) {
        expect(validateItem([link, cover], { link: value, coverUrl: value })).toEqual({});
      }
    });

    it.each(["x.test", "ftp://x.test", "javascript:alert(1)", "https://"])(
      "rejects %s",
      (value) => {
        expect(validateItem([link, cover], { link: value, coverUrl: value })).toEqual({
          link: "Link must be an http or https URL.",
          coverUrl: "Cover image must be an http or https URL.",
        });
      },
    );

    it("limits URLs to 500 characters", () => {
      const long = `https://x.test/${"a".repeat(486)}`;
      expect(long.length).toBe(501);
      expect(validateItem([link], { link: long })).toEqual({
        link: "Link must be at most 500 characters.",
      });
    });

    it("requires a publish-required file to publish", () => {
      const image: FieldDef = { ...cover, name: "image", label: "Image", publishRequired: true };
      expect(validateItem([image], { image: "" }, "draft")).toEqual({});
      expect(validateItem([image], { image: "" }, "publish")).toEqual({
        image: "Image is required to publish.",
      });
    });
  });

  describe("date and month", () => {
    it("accepts a calendar date and rejects others", () => {
      expect(validateItem([issueDate], { issueDate: "2024-02-29" })).toEqual({});
      for (const value of ["2023-02-29", "2024-13-01", "2024-1-01", "01/02/2024"]) {
        expect(validateItem([issueDate], { issueDate: value })).toEqual({
          issueDate: "Issue date must be a valid date.",
        });
      }
      expect(validateItem([issueDate], { issueDate: "" })).toEqual({
        issueDate: "Issue date is required.",
      });
    });

    it("requires the start month as YYYY-MM", () => {
      expect(validateItem([startDate], { startDate: "2026-01" })).toEqual({});
      expect(validateItem([startDate], { startDate: "" })).toEqual({
        startDate: "Start month is required.",
      });
      for (const value of ["2026-13", "2026-1", "2026-01-01", "Jan 2026"]) {
        expect(validateItem([startDate], { startDate: value })).toEqual({
          startDate: "Start month must be a month (YYYY-MM).",
        });
      }
    });

    it("refuses an expiry date before the issue date", () => {
      const fields = [issueDate, expiryDate];
      expect(validateItem(fields, { issueDate: "2025-05-10", expiryDate: "" })).toEqual({});
      expect(
        validateItem(fields, { issueDate: "2025-05-10", expiryDate: "2025-05-10" }),
      ).toEqual({});
      expect(
        validateItem(fields, { issueDate: "2025-05-10", expiryDate: "2025-05-09" }),
      ).toEqual({ expiryDate: "Expiry date must be on or after the issue date." });
    });
  });

  describe("tags", () => {
    it("accepts up to 10 tags of 1 to 30 letters, digits, spaces or hyphens", () => {
      const ten = Array.from({ length: 10 }, (_, i) => `Tag ${i}`);
      expect(validateItem([tagsField], { tags: ten })).toEqual({});
      expect(validateItem([tagsField], { tags: ["Diseño", "next-js", "x".repeat(30)] })).toEqual({});
      expect(validateItem([tagsField], { tags: [...ten, "Eleven"] })).toEqual({
        tags: "Tags must have at most 10 items.",
      });
    });

    it.each([["x".repeat(31)], [""], ["Next.js"], ["C#"]])("rejects the tag %j", (tag) => {
      expect(validateItem([tagsField], { tags: [tag] })).toEqual({
        tags: "Each tag must be 1 to 30 letters, digits, spaces or hyphens.",
      });
    });

    it("rejects tags repeated ignoring case and outer spaces", () => {
      expect(validateItem([tagsField], { tags: ["Angular", "angular "] })).toEqual({
        tags: 'The tag "angular " is repeated.',
      });
    });
  });

  describe("references", () => {
    const ref = (title: string, url: string) => ({ title, url });

    it("accepts up to 30 references with a title and an http(s) URL", () => {
      const thirty = Array.from({ length: 30 }, (_, i) => ref(`Ref ${i}`, `https://x.test/${i}`));
      expect(validateItem([references], { references: [] })).toEqual({});
      expect(validateItem([references], { references: thirty })).toEqual({});
      expect(
        validateItem([references], { references: [...thirty, ref("31", "https://x.test")] }),
      ).toEqual({ references: "References must have at most 30 items." });
    });

    it("reports the first invalid reference by its number", () => {
      expect(
        validateItem([references], {
          references: [ref("Ok", "https://x.test"), ref("", "https://x.test")],
        }),
      ).toEqual({ references: "Reference 2: title is required." });
      expect(
        validateItem([references], { references: [ref("x".repeat(201), "https://x.test")] }),
      ).toEqual({ references: "Reference 1: title must be at most 200 characters." });
      expect(validateItem([references], { references: [ref("Ok", "x.test")] })).toEqual({
        references: "Reference 1: URL must be an http or https URL.",
      });
      expect(
        validateItem([references], {
          references: [ref("Ok", `https://x.test/${"a".repeat(486)}`)],
        }),
      ).toEqual({ references: "Reference 1: URL must be at most 500 characters." });
    });
  });
});
