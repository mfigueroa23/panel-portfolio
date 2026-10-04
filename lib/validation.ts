import type { FieldDef } from "./collections";

// Mirrors the API's class-validator rules so invalid input never reaches it.
// Values are not trimmed, because the API does not trim them either.
export function validateItem(
  fields: FieldDef[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateField(field, values[field.name]);
    if (error) errors[field.name] = error;
  }
  return errors;
}

function validateField(field: FieldDef, value: unknown): string | null {
  const { label } = field;
  switch (field.kind) {
    case "text":
    case "textarea":
      if (typeof value !== "string" || value === "") return `${label} is required.`;
      if (field.maxLength !== undefined && textLength(value) > field.maxLength) {
        return `${label} must be at most ${field.maxLength} characters.`;
      }
      return null;
    case "int":
      if (value === undefined || value === null || value === "") {
        return `${label} is required.`;
      }
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `${label} must be a whole number.`;
      }
      if (field.min !== undefined && value < field.min) {
        return `${label} must be at least ${field.min}.`;
      }
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : `${label} must be true or false.`;
    case "list":
      if (!Array.isArray(value)) return `${label} must be a list.`;
      if (value.some((item) => typeof item !== "string")) {
        return `${label} must contain only text.`;
      }
      if (field.maxItems !== undefined && value.length > field.maxItems) {
        return `${label} must have at most ${field.maxItems} items.`;
      }
      return null;
  }
}

// Same counting as class-validator's MaxLength (validator.js isLength):
// surrogate pairs and variation selectors do not add to the length.
function textLength(value: string): number {
  const surrogatePairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) ?? [];
  const presentationSequences = value.match(/(️|︎)/g) ?? [];
  return value.length - surrogatePairs.length - presentationSequences.length;
}
