// Field rules copied 1:1 from the API DTOs (api/src/app/content/*/dto). A DTO
// change in `api` must update this registry under the same spec.
export type FieldKind = "text" | "textarea" | "int" | "boolean" | "list";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  maxLength?: number;
  min?: number;
  maxItems?: number;
}

export type CollectionKey =
  | "experience"
  | "projects"
  | "testimonials"
  | "highlights"
  | "social-links"
  | "technologies"
  | "contact-info";

export interface ContentItem {
  id: number;
  position: number;
  [field: string]: unknown;
}

export interface CollectionDef {
  key: CollectionKey;
  apiPath: string;
  label: string;
  itemTitle: (item: ContentItem) => string;
  fields: FieldDef[];
}

const position: FieldDef = {
  name: "position",
  label: "Position",
  kind: "int",
  required: true,
  min: 0,
};

const text = (name: string, label: string, maxLength: number): FieldDef => ({
  name,
  label,
  kind: "text",
  required: true,
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

const str = (value: unknown): string => (typeof value === "string" ? value : "");

export const COLLECTIONS: Record<CollectionKey, CollectionDef> = {
  experience: {
    key: "experience",
    apiPath: "/content/experiences",
    label: "Experience",
    itemTitle: (item) => `${str(item.role)} · ${str(item.company)}`,
    fields: [
      position,
      text("period", "Period", 100),
      text("role", "Role", 200),
      text("company", "Company", 200),
      textarea("description", "Description", 5000),
      list("technologies", "Technologies", 50),
      boolean("current", "Current position"),
    ],
  },
  projects: {
    key: "projects",
    apiPath: "/content/projects",
    label: "Projects",
    itemTitle: (item) => str(item.title),
    fields: [
      position,
      text("title", "Title", 200),
      textarea("description", "Description", 5000),
      text("image", "Image URL", 500),
      list("tags", "Tags", 50),
      text("link", "Link", 500),
      text("github", "GitHub URL", 500),
    ],
  },
  testimonials: {
    key: "testimonials",
    apiPath: "/content/testimonials",
    label: "Testimonials",
    itemTitle: (item) => str(item.author),
    fields: [
      position,
      textarea("quote", "Quote", 5000),
      text("author", "Author", 200),
      text("role", "Role", 200),
      text("avatar", "Avatar URL", 500),
    ],
  },
  highlights: {
    key: "highlights",
    apiPath: "/content/highlights",
    label: "Highlights",
    itemTitle: (item) => str(item.title),
    fields: [
      position,
      text("icon", "Icon", 100),
      text("title", "Title", 200),
      textarea("description", "Description", 5000),
    ],
  },
  "social-links": {
    key: "social-links",
    apiPath: "/content/social-links",
    label: "Social links",
    itemTitle: (item) => str(item.href),
    fields: [position, text("icon", "Icon", 100), text("href", "Link URL", 500)],
  },
  technologies: {
    key: "technologies",
    apiPath: "/content/technologies",
    label: "Technologies",
    itemTitle: (item) => str(item.name),
    fields: [position, text("name", "Name", 100)],
  },
  "contact-info": {
    key: "contact-info",
    apiPath: "/content/contact-info",
    label: "Contact info",
    itemTitle: (item) => str(item.label),
    fields: [
      position,
      text("icon", "Icon", 100),
      text("label", "Label", 100),
      text("value", "Value", 200),
      text("href", "Link URL", 500),
    ],
  },
};
