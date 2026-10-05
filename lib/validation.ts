import type { FieldDef } from "./collections";

/** Drafts need only the always-required fields; publishing needs the rest too. */
export type ValidationMode = "draft" | "publish";

// Mirrors the API's class-validator rules so invalid input never reaches it.
// Values are not trimmed, because the API does not trim them either.
export function validateItem(
  fields: FieldDef[],
  values: Record<string, unknown>,
  mode: ValidationMode = "publish",
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateField(field, values[field.name], mode) ?? crossCheck(field, values);
    if (error) errors[field.name] = error;
  }
  return errors;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TAG_PATTERN = /^[\p{L}\p{N} -]{1,30}$/u;
const MAX_REFERENCE_TITLE = 200;
const MAX_REFERENCE_URL = 500;

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";

function validateField(field: FieldDef, value: unknown, mode: ValidationMode): string | null {
  const { label } = field;
  switch (field.kind) {
    case "text":
    case "textarea":
    case "markdown":
    case "slug":
    case "url":
    case "file":
    case "date":
    case "month": {
      if (isEmpty(value)) return missing(field, mode);
      if (typeof value !== "string") {
        return field.required ? `${label} is required.` : `${label} must be text.`;
      }
      if (field.maxLength !== undefined && textLength(value) > field.maxLength) {
        return `${label} must be at most ${field.maxLength} characters.`;
      }
      return formatError(field, value);
    }
    case "int":
      if (isEmpty(value)) return `${label} is required.`;
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
      return tooMany(field, value);
    case "tags":
      if (isEmpty(value)) return missing(field, mode);
      if (!Array.isArray(value)) return `${label} must be a list.`;
      return tooMany(field, value) ?? tagsError(value);
    case "references":
      if (isEmpty(value)) return missing(field, mode);
      if (!Array.isArray(value)) return `${label} must be a list.`;
      return tooMany(field, value) ?? referencesError(value);
  }
}

function missing(field: FieldDef, mode: ValidationMode): string | null {
  if (field.required) return `${field.label} is required.`;
  if (field.publishRequired && mode === "publish") return `${field.label} is required to publish.`;
  return null;
}

function tooMany(field: FieldDef, value: unknown[]): string | null {
  return field.maxItems !== undefined && value.length > field.maxItems
    ? `${field.label} must have at most ${field.maxItems} items.`
    : null;
}

function formatError(field: FieldDef, value: string): string | null {
  const { label } = field;
  switch (field.kind) {
    case "slug":
      if (!SLUG_PATTERN.test(value)) {
        return "Use lowercase letters, digits and single hyphens, not at the start or end.";
      }
      if (field.reserved?.includes(value)) return `"${value}" is reserved. Choose another slug.`;
      return null;
    case "url":
    case "file":
      return isHttpUrl(value) ? null : `${label} must be an http or https URL.`;
    case "date":
      return isCalendarDate(value) ? null : `${label} must be a valid date.`;
    case "month":
      return MONTH_PATTERN.test(value) ? null : `${label} must be a month (YYYY-MM).`;
    default:
      return null;
  }
}

function crossCheck(field: FieldDef, values: Record<string, unknown>): string | null {
  if (!field.notBefore) return null;
  const value = values[field.name];
  const other = values[field.notBefore];
  // Both are valid YYYY-MM-DD here, so string order is date order.
  if (typeof value === "string" && typeof other === "string" && value && other && value < other) {
    return "Expiry date must be on or after the issue date.";
  }
  return null;
}

export function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Tags compare ignoring case and outer spaces, as the API does. */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

function tagsError(tags: unknown[]): string | null {
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string" || !TAG_PATTERN.test(tag)) {
      return "Each tag must be 1 to 30 letters, digits, spaces or hyphens.";
    }
    const key = tagKey(tag);
    if (seen.has(key)) return `The tag "${tag}" is repeated.`;
    seen.add(key);
  }
  return null;
}

function referencesError(references: unknown[]): string | null {
  for (const [index, reference] of references.entries()) {
    const { title, url } = (reference ?? {}) as { title?: unknown; url?: unknown };
    const prefix = `Reference ${index + 1}:`;
    if (typeof title !== "string" || title === "") return `${prefix} title is required.`;
    if (textLength(title) > MAX_REFERENCE_TITLE) {
      return `${prefix} title must be at most ${MAX_REFERENCE_TITLE} characters.`;
    }
    if (typeof url !== "string" || url === "") return `${prefix} URL is required.`;
    if (url.length > MAX_REFERENCE_URL) {
      return `${prefix} URL must be at most ${MAX_REFERENCE_URL} characters.`;
    }
    if (!isHttpUrl(url)) return `${prefix} URL must be an http or https URL.`;
  }
  return null;
}

// Same counting as class-validator's MaxLength (validator.js isLength):
// surrogate pairs and variation selectors do not add to the length.
function textLength(value: string): number {
  const surrogatePairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) ?? [];
  const presentationSequences = value.match(/(️|︎)/g) ?? [];
  return value.length - surrogatePairs.length - presentationSequences.length;
}
