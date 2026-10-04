import { apiFetch, type ApiResult } from "./api";

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
  readingMinutes: number;
}

// The API is the only Markdown renderer, so the preview matches the site.
export function renderMarkdown(
  markdown: string,
  token: string,
): Promise<ApiResult<RenderedMarkdown>> {
  return apiFetch<RenderedMarkdown>("/markdown/render", {
    method: "POST",
    body: { markdown },
    token,
  });
}
