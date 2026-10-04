const MAX_LENGTH = 100;

/**
 * Proposes a slug from a title: lowercased, accents and `ñ` transliterated,
 * any other run of characters turned into one hyphen, trimmed and cut at 100
 * characters without a trailing hyphen.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, "");
}
