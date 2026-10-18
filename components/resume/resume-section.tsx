"use client";

import { useId } from "react";
import { useNotice } from "@/components/content/notice-provider";
import { ghostButton } from "@/components/files/file-library";
import { formatSize } from "@/lib/files";
import {
  LANG_LABELS,
  publicResumeUrl,
  type ResumeAssignments,
  type ResumeLang,
} from "@/lib/resume";

interface Props {
  lang: ResumeLang;
  /** Both languages: the ordering rules depend on the other one. */
  assignments: ResumeAssignments;
  pending: boolean;
  error: string | null;
  onChoose: () => void;
  onClear: () => void;
}

const EMPTY_TEXT: Record<ResumeLang, string> = {
  en: "No English resume. The public download is unavailable until one is assigned.",
  es: "No Spanish resume. Visitors of the Spanish site get the English resume.",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// The api refuses Spanish without English and clearing English under Spanish
// (409); the panel disables both and says why (plan D6).
function blockers(lang: ResumeLang, assignments: ResumeAssignments) {
  return {
    choose: lang === "es" && !assignments.en ? "Assign an English resume first." : null,
    clear: lang === "en" && assignments.es ? "Clear the Spanish resume first." : null,
  };
}

export function ResumeSection({ lang, assignments, pending, error, onChoose, onClear }: Props) {
  const headingId = useId();
  const { notify } = useNotice();
  const current = assignments[lang];
  const blocked = blockers(lang, assignments);
  const hint = blocked.choose ?? (current ? blocked.clear : null);
  const publicUrl = publicResumeUrl(lang);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      notify("Link copied.");
    } catch {
      notify("Could not copy the link.");
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id={headingId} className="text-xl font-semibold text-foreground">
        {LANG_LABELS[lang]}
      </h2>

      {current ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{current.file.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatSize(current.file.size)} · Assigned{" "}
              {dateFormat.format(new Date(current.assignedAt))}
            </p>
          </div>
          <a
            href={current.file.url}
            target="_blank"
            rel="noopener noreferrer"
            className={ghostButton}
          >
            Open PDF
          </a>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {EMPTY_TEXT[lang]}
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Public link
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-sm text-foreground">
            {publicUrl}
          </code>
          <button type="button" onClick={() => void copy()} className={ghostButton}>
            Copy link
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={ghostButton}>
            Open link
          </a>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChoose}
            disabled={pending || blocked.choose !== null}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {current ? "Replace" : "Choose PDF"}
          </button>
          {current && (
            <button
              type="button"
              onClick={onClear}
              disabled={pending || blocked.clear !== null}
              className="inline-flex min-h-11 items-center rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              Clear
            </button>
          )}
        </div>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </section>
  );
}
