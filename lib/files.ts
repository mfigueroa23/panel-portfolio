import { apiFetch, type ApiResult } from "./api";

export type FileKind = "image" | "pdf";

/** A file as the API returns it after an upload or in the library. */
export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
}

export interface FilePage {
  items: StoredFile[];
  page: number;
  totalPages: number;
  total: number;
}

/** A content item whose fields contain a file's URL. */
export interface FileReference {
  collection: string;
  id: number;
  title: string;
  status?: "draft" | "published";
}

// The API decides by the file's content; this list only lets the panel refuse
// obvious mistakes before sending megabytes.
export const ACCEPTED_TYPES: { mime: string; extensions: string[]; kind: FileKind }[] = [
  { mime: "image/png", extensions: ["png"], kind: "image" },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], kind: "image" },
  { mime: "image/webp", extensions: ["webp"], kind: "image" },
  { mime: "image/gif", extensions: ["gif"], kind: "image" },
  { mime: "image/svg+xml", extensions: ["svg"], kind: "image" },
  { mime: "application/pdf", extensions: ["pdf"], kind: "pdf" },
];

export const LIMITS: Record<FileKind, number> = {
  image: 5 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

const LIMIT_TEXT: Record<FileKind, string> = { image: "5 MiB", pdf: "10 MiB" };

export const UNSUPPORTED_TYPE = "Unsupported file type.";

/** The `accept` attribute for a file input limited to these kinds. */
export function acceptAttribute(kinds: FileKind[] = ["image", "pdf"]): string {
  return ACCEPTED_TYPES.filter((type) => kinds.includes(type.kind))
    .flatMap((type) => [type.mime, ...type.extensions.map((ext) => `.${ext}`)])
    .join(",");
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function typeOf(file: File) {
  // Browsers leave `type` empty for some files; the extension decides then.
  return file.type
    ? ACCEPTED_TYPES.find((type) => type.mime === file.type)
    : ACCEPTED_TYPES.find((type) => type.extensions.includes(extension(file.name)));
}

/** The error to show for a file the API would refuse, or null if it can be sent. */
export function validateFile(
  file: File,
  accept: FileKind[] = ["image", "pdf"],
): string | null {
  const type = typeOf(file);
  if (!type || !accept.includes(type.kind)) return UNSUPPORTED_TYPE;
  if (file.size > LIMITS[type.kind]) {
    return `${file.name} is larger than ${LIMIT_TEXT[type.kind]}.`;
  }
  return null;
}

export function fileKind(mime: string): FileKind {
  return mime === "application/pdf" ? "pdf" : "image";
}

// Brackets and backslashes in a name would end the link text early.
function escapeText(text: string): string {
  return text.replace(/[\\[\]]/g, (char) => `\\${char}`);
}

/** The Markdown that embeds an image or links a PDF. */
export function markdownFor(file: Pick<StoredFile, "name" | "mime" | "url">): string {
  if (fileKind(file.mime) === "pdf") return `[${escapeText(file.name)}](${file.url})`;
  const dot = file.name.lastIndexOf(".");
  const alt = dot > 0 ? file.name.slice(0, dot) : file.name;
  return `![${escapeText(alt)}](${file.url})`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function listFiles(
  page: number,
  type: FileKind | undefined,
  token: string,
): Promise<ApiResult<FilePage>> {
  const query = type ? `?page=${page}&type=${type}` : `?page=${page}`;
  return apiFetch<FilePage>(`/files${query}`, { method: "GET", token, cache: "no-store" });
}

export function fileReferences(
  id: string,
  token: string,
): Promise<ApiResult<FileReference[]>> {
  return apiFetch<FileReference[]>(`/files/${encodeURIComponent(id)}/references`, {
    method: "GET",
    token,
    cache: "no-store",
  });
}

export function deleteFile(id: string, token: string): Promise<ApiResult<void>> {
  return apiFetch<void>(`/files/${encodeURIComponent(id)}`, { method: "DELETE", token });
}
