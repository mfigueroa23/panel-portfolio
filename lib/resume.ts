import { apiFetch, type ApiResult } from "./api";
import { API_URL } from "./config";
import type { StoredFile } from "./files";

// Mirror of the api's resume assignment (api Spec 005). A DTO change in `api`
// must update these types under the same spec.
export type ResumeLang = "en" | "es";

/** English is the base; Spanish falls back to it on the site. */
export const RESUME_LANGS: readonly ResumeLang[] = ["en", "es"];

export const LANG_LABELS: Record<ResumeLang, string> = { en: "English", es: "Spanish" };

export interface ResumeAssignment {
  file: StoredFile;
  assignedAt: string;
}

/** Always both languages; null means no resume in that language. */
export type ResumeAssignments = Record<ResumeLang, ResumeAssignment | null>;

/** The stable public link; `lang` is explicit for English too (plan D12). */
export function publicResumeUrl(lang: ResumeLang): string {
  return `${API_URL}/resume?lang=${lang}`;
}

export function getAssignments(token: string): Promise<ApiResult<ResumeAssignments>> {
  return apiFetch<ResumeAssignments>("/resume/assignments", {
    method: "GET",
    token,
    cache: "no-store",
  });
}

export function assignResume(
  lang: ResumeLang,
  fileId: string,
  token: string,
): Promise<ApiResult<ResumeAssignments>> {
  return apiFetch<ResumeAssignments>(`/resume/assignments/${encodeURIComponent(lang)}`, {
    method: "PUT",
    body: { fileId },
    token,
  });
}

export function clearResume(lang: ResumeLang, token: string): Promise<ApiResult<void>> {
  return apiFetch<void>(`/resume/assignments/${encodeURIComponent(lang)}`, {
    method: "DELETE",
    token,
  });
}
