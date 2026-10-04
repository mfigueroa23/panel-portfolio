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
