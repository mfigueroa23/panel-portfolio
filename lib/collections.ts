// Field rules copied 1:1 from the API DTOs (api/src/app/content/*/dto). A DTO
// change in `api` must update this registry under the same spec.
import type { FileKind } from "./files";

export type FieldKind =
  | "text"
  | "textarea"
  | "int"
  | "boolean"
  | "list"
  | "markdown"
  | "slug"
  | "file"
  | "date"
  | "month"
  | "tags"
  | "references"
  | "url";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  /** Required for every save, drafts included. */
  required: boolean;
  /** Required only to publish (publishable collections). */
  publishRequired?: boolean;
  maxLength?: number;
  min?: number;
  maxItems?: number;
  /** `file` kind: which kinds of file the field takes. */
  accept?: FileKind[];
  /** `slug` kind: values the API refuses. */
  reserved?: string[];
  /** `date` kind: the date field this one may not be earlier than. */
  notBefore?: string;
  /** Not shown (nor sent) when creating an item. */
  createHidden?: boolean;
  /** Reviewable collections: shown (and sent) only for approved items. */
  approvedOnly?: boolean;
  /**
   * Has a Spanish version `<name>Es`, edited in the form's Spanish tab with the
   * English field's rules, never required. References: a `titleEs` per row.
   */
  bilingual?: boolean;
  /** Shown only in the Spanish tab (the Spanish slug `slugEs`). */
  spanishOnly?: boolean;
}

/** The Spanish version of a bilingual field: same rules, never required. */
export function spanishTwin(field: FieldDef): FieldDef {
  const twin: FieldDef = { ...field, name: `${field.name}Es`, required: false };
  delete twin.publishRequired;
  delete twin.bilingual;
  return twin;
}

export type CollectionKey =
  | "social-links"
  | "technologies"
  | "highlights"
  | "testimonials"
  | "contact-info"
  | "projects"
  | "experience"
  | "certifications"
  | "posts";

export type ContentStatus = "draft" | "published";
/** Reviewable collections: visitor submissions wait as pending until approved. */
export type ReviewStatus = "pending" | "approved";

export interface ContentItem {
  id: number;
  /** Only in the collections that keep a manual order; null while pending. */
  position?: number | null;
  status?: ContentStatus | ReviewStatus;
  publishedAt?: string | null;
  [field: string]: unknown;
}

export type SortFn = (a: ContentItem, b: ContentItem) => number;

export interface CollectionDef {
  key: CollectionKey;
  /** Public list and the base of the admin writes. */
  apiPath: string;
  /** Admin list with drafts, read with the token. */
  apiAdminListPath?: string;
  label: string;
  itemTitle: (item: ContentItem) => string;
  fields: FieldDef[];
  /** Has drafts: Save draft / Publish / Unpublish. */
  publishable: boolean;
  /** Has visitor submissions: pending items offer Save / Approve / Reject. */
  reviewable?: boolean;
  /** Path of the item pages on the public site (`/<base>/<slug>`). */
  publicBase?: string;
  sort: SortFn;
}

const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Manual order: position, then creation order. */
export const byPosition: SortFn = (a, b) => num(a.position) - num(b.position) || a.id - b.id;

/** Drafts first, then published items by publication date, newest first. */
export const byPublication: SortFn = (a, b) => {
  const aDraft = a.status !== "published";
  const bDraft = b.status !== "published";
  if (aDraft !== bDraft) return aDraft ? -1 : 1;
  if (!aDraft) {
    const byDate = str(b.publishedAt).localeCompare(str(a.publishedAt));
    if (byDate !== 0) return byDate;
  }
  return b.id - a.id;
};

/** Pending items first, newest submission first; then approved items by position. */
export const byReview: SortFn = (a, b) => {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending !== bPending) return aPending ? -1 : 1;
  if (aPending) return str(b.submittedAt).localeCompare(str(a.submittedAt)) || b.id - a.id;
  return byPosition(a, b);
};

/** Current entries first, then start month descending, undated last, then creation. */
export const byRecency: SortFn = (a, b) => {
  if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1;
  const aDate = str(a.startDate);
  const bDate = str(b.startDate);
  if (aDate !== bDate) {
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.localeCompare(aDate);
  }
  return a.id - b.id;
};

const position: FieldDef = {
  name: "position",
  label: "Position",
  kind: "int",
  required: true,
  min: 0,
};

const text = (name: string, label: string, maxLength: number, required = true): FieldDef => ({
  name,
  label,
  kind: "text",
  required,
  maxLength,
});

const textarea = (name: string, label: string, maxLength: number): FieldDef => ({
  name,
  label,
  kind: "textarea",
  required: true,
  maxLength,
});

const list = (name: string, label: string, maxItems: number): FieldDef => ({
  name,
  label,
  kind: "list",
  required: true,
  maxItems,
});

const boolean = (name: string, label: string): FieldDef => ({
  name,
  label,
  kind: "boolean",
  required: true,
});

const url = (name: string, label: string): FieldDef => ({
  name,
  label,
  kind: "url",
  required: false,
  maxLength: 500,
});

const markdown = (name: string, label: string, publishRequired = false): FieldDef => ({
  name,
  label,
  kind: "markdown",
  required: false,
  maxLength: 100_000,
  ...(publishRequired ? { publishRequired: true } : {}),
});

/** Plan §3: texts visitors read get a Spanish version; names, URLs and dates stay shared. */
const bi = (field: FieldDef): FieldDef => ({ ...field, bilingual: true });

/** Optional Spanish slug of projects and posts; empty means the English slug. */
const slugEs = (reserved: string[]): FieldDef => ({
  name: "slugEs",
  label: "Slug",
  kind: "slug",
  required: false,
  maxLength: 100,
  reserved,
  spanishOnly: true,
});

// Key order is the order inside the navigation groups.
export const COLLECTIONS: Record<CollectionKey, CollectionDef> = {
  "social-links": {
    key: "social-links",
    apiPath: "/content/social-links",
    label: "Social links",
    itemTitle: (item) => str(item.href),
    fields: [position, text("icon", "Icon", 100), text("href", "Link URL", 500)],
    publishable: false,
    sort: byPosition,
  },
  technologies: {
    key: "technologies",
    apiPath: "/content/technologies",
    label: "Technologies",
    itemTitle: (item) => str(item.name),
    fields: [position, text("name", "Name", 100)],
    publishable: false,
    sort: byPosition,
  },
  highlights: {
    key: "highlights",
    apiPath: "/content/highlights",
    apiAdminListPath: "/content/highlights/all",
    label: "Highlights",
    itemTitle: (item) => str(item.title),
    fields: [
      position,
      text("icon", "Icon", 100),
      bi(text("title", "Title", 200)),
      bi(textarea("description", "Description", 5000)),
    ],
    publishable: false,
    sort: byPosition,
  },
  testimonials: {
    key: "testimonials",
    apiPath: "/content/testimonials",
    apiAdminListPath: "/content/testimonials/all",
    label: "Testimonials",
    itemTitle: (item) => str(item.author),
    fields: [
      // New and approved items go first (API); the order is edited afterwards.
      { ...position, createHidden: true, approvedOnly: true },
      bi(textarea("quote", "Quote", 500)),
      text("author", "Author", 200),
      bi(text("role", "Role", 200)),
      {
        name: "avatar",
        label: "Photo",
        kind: "file",
        required: false,
        maxLength: 500,
        accept: ["image"],
      },
    ],
    publishable: false,
    reviewable: true,
    sort: byReview,
  },
  "contact-info": {
    key: "contact-info",
    apiPath: "/content/contact-info",
    apiAdminListPath: "/content/contact-info/all",
    label: "Contact info",
    itemTitle: (item) => str(item.label),
    fields: [
      position,
      text("icon", "Icon", 100),
      bi(text("label", "Label", 100)),
      text("value", "Value", 200),
      text("href", "Link URL", 500),
    ],
    publishable: false,
    sort: byPosition,
  },
  projects: {
    key: "projects",
    apiPath: "/content/projects",
    apiAdminListPath: "/content/projects/all",
    label: "Projects",
    itemTitle: (item) => str(item.title),
    fields: [
      bi(text("title", "Title", 200)),
      {
        name: "slug",
        label: "Slug",
        kind: "slug",
        required: true,
        maxLength: 100,
        reserved: ["all"],
      },
      slugEs(["all"]),
      bi({
        name: "description",
        label: "Description",
        kind: "textarea",
        required: false,
        publishRequired: true,
        maxLength: 5000,
      }),
      {
        name: "image",
        label: "Image",
        kind: "file",
        required: false,
        publishRequired: true,
        maxLength: 500,
        accept: ["image"],
      },
      list("tags", "Tags", 50),
      url("link", "Live link"),
      url("github", "Source link"),
      bi(markdown("body", "Body")),
    ],
    publishable: true,
    publicBase: "/projects",
    sort: byPublication,
  },
  experience: {
    key: "experience",
    apiPath: "/content/experiences",
    apiAdminListPath: "/content/experiences/all",
    label: "Experience",
    itemTitle: (item) => `${str(item.role)} · ${str(item.company)}`,
    fields: [
      bi(text("period", "Period", 100)),
      { name: "startDate", label: "Start month", kind: "month", required: true },
      bi(text("role", "Role", 200)),
      text("company", "Company", 200),
      bi(textarea("description", "Description", 5000)),
      list("technologies", "Technologies", 50),
      boolean("current", "Current position"),
      bi(markdown("body", "Body")),
    ],
    publishable: false,
    sort: byRecency,
  },
  certifications: {
    key: "certifications",
    apiPath: "/content/certifications",
    apiAdminListPath: "/content/certifications/all",
    label: "Certifications",
    itemTitle: (item) => str(item.name),
    fields: [
      position,
      bi(text("name", "Name", 200)),
      text("issuer", "Issuer", 200),
      { name: "issueDate", label: "Issue date", kind: "date", required: true },
      {
        name: "expiryDate",
        label: "Expiry date",
        kind: "date",
        required: false,
        notBefore: "issueDate",
      },
      text("credentialId", "Credential ID", 100, false),
      url("verificationUrl", "Verification URL"),
      {
        name: "fileUrl",
        label: "Certificate file",
        kind: "file",
        required: false,
        maxLength: 500,
        accept: ["image", "pdf"],
      },
    ],
    publishable: false,
    sort: byPosition,
  },
  posts: {
    key: "posts",
    apiPath: "/content/posts",
    apiAdminListPath: "/content/posts/all",
    label: "Posts",
    itemTitle: (item) => str(item.title),
    fields: [
      bi(text("title", "Title", 200)),
      {
        name: "slug",
        label: "Slug",
        kind: "slug",
        required: true,
        maxLength: 100,
        reserved: ["tag", "page", "all", "feed"],
      },
      slugEs(["tag", "page", "all", "feed"]),
      bi({
        name: "summary",
        label: "Summary",
        kind: "textarea",
        required: false,
        publishRequired: true,
        maxLength: 300,
      }),
      {
        name: "coverUrl",
        label: "Cover image",
        kind: "file",
        required: false,
        maxLength: 500,
        accept: ["image"],
      },
      { name: "tags", label: "Tags", kind: "tags", required: false, maxItems: 10, maxLength: 30 },
      bi(markdown("body", "Body", true)),
      bi({ name: "references", label: "References", kind: "references", required: false, maxItems: 30 }),
    ],
    publishable: true,
    publicBase: "/blog",
    sort: byPublication,
  },
};

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

const collectionLinks = (keys: CollectionKey[]): NavLink[] =>
  keys.map((key) => ({ href: `/${key}`, label: COLLECTIONS[key].label }));

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home sections",
    links: collectionLinks([
      "social-links",
      "technologies",
      "highlights",
      "testimonials",
      "contact-info",
    ]),
  },
  {
    label: "Pages",
    links: collectionLinks(["projects", "experience", "certifications", "posts"]),
  },
  { label: "Media", links: [{ href: "/files", label: "Files" }] },
];

export function isCollectionKey(value: string): value is CollectionKey {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, value);
}
