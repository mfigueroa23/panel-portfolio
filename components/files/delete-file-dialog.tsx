"use client";

import { useEffect, useId, useRef, useState } from "react";
import { StatusBadge } from "@/components/content/status-badge";
import { errorMessage } from "@/lib/api";
import { deleteFile, fileReferences, type FileReference, type StoredFile } from "@/lib/files";

interface Props {
  file: StoredFile;
  token: string;
  onCancel: () => void;
  /** The file is gone (deleted now or already missing). */
  onDeleted: (file: StoredFile) => void;
  onUnauthorized: () => void;
}

// The API names collections in the plural or singular; both read as one word.
const COLLECTION_NAMES: Record<string, string> = {
  project: "Project",
  projects: "Project",
  post: "Post",
  posts: "Post",
  experience: "Experience",
  experiences: "Experience",
  certification: "Certification",
  certifications: "Certification",
  testimonial: "Testimonial",
  testimonials: "Testimonial",
};

function collectionName(collection: string): string {
  return COLLECTION_NAMES[collection] ?? collection;
}

// The references are shown before the owner can confirm, so a file still in
// use is never deleted blindly.
export function DeleteFileDialog({ file, token, onCancel, onDeleted, onUnauthorized }: Props) {
  const headingId = useId();
  const [references, setReferences] = useState<FileReference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Kept in a ref so an inline callback from the parent does not reload the
  // references on every render.
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    void fileReferences(file.id, token).then((result) => {
      if (cancelled) return;
      if (result.ok) setReferences(result.data);
      else if (result.status === 401) unauthorized.current();
      else setError(errorMessage(result));
    });
    return () => {
      cancelled = true;
    };
  }, [file.id, token]);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await deleteFile(file.id, token);
    setPending(false);
    if (result.ok || result.status === 404) onDeleted(file);
    else if (result.status === 401) onUnauthorized();
    else setError(errorMessage(result));
  }

  const count = references?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 id={headingId} className="break-words text-xl font-semibold text-foreground">
          Delete {file.name}?
        </h2>
        {references === null && !error && (
          <p className="text-sm text-muted-foreground">Checking where this file is used…</p>
        )}
        {references !== null && count === 0 && (
          <p className="text-sm text-foreground">No content uses this file.</p>
        )}
        {count > 0 && (
          <>
            <p className="text-sm text-foreground">
              This file is used in {count} {count === 1 ? "item" : "items"}. Their links and images
              will break.
            </p>
            <ul className="flex flex-col gap-2">
              {references!.map((reference) => (
                <li
                  key={`${reference.collection}-${reference.id}`}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 text-sm text-foreground"
                >
                  {reference.status && <StatusBadge status={reference.status} />}
                  <span className="min-w-0 truncate">
                    {collectionName(reference.collection)} · {reference.title}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-border px-4 text-sm text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={references === null || pending}
            className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete file"}
          </button>
        </div>
      </div>
    </div>
  );
}
