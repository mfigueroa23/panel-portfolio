import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("transliterates accents and ñ", () => {
    expect(slugify("Diseño y Migración")).toBe("diseno-y-migracion");
    expect(slugify("Ünïcödé Àçcéñts")).toBe("unicode-accents");
  });

  it("replaces runs of other characters with one hyphen and trims them", () => {
    expect(slugify("  --Next.js 16 & React 19!!  ")).toBe("next-js-16-react-19");
    expect(slugify("a / b // c")).toBe("a-b-c");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(slugify("")).toBe("");
    expect(slugify("¿¡!?")).toBe("");
  });

  it("cuts at 100 characters without a trailing hyphen", () => {
    expect(slugify("a".repeat(150))).toBe("a".repeat(100));
    // Character 100 would be the hyphen between the two words.
    const slug = slugify(`${"a".repeat(99)} bcd`);
    expect(slug).toBe("a".repeat(99));
    expect(slug.length).toBeLessThanOrEqual(100);
  });

  it("produces only lowercase letters, digits and single inner hyphens", () => {
    const slug = slugify("Serving uploads from Postgres — without leaking scripts (part 2)");
    expect(slug).toBe("serving-uploads-from-postgres-without-leaking-scripts-part-2");
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
