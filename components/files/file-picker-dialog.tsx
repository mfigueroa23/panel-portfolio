"use client";

import { useEffect, useId, useRef } from "react";
import type { FileKind, StoredFile } from "@/lib/files";
import { FileLibrary, ghostButton } from "./file-library";

interface Props {
  accept?: FileKind[];
  /** The file chosen from the library, or the one just uploaded. */
  onPick: (file: StoredFile) => void;
  onClose: () => void;
}

// Used by the Markdown editor and by single-file fields: the library in pick
// mode, with its Upload button, over the form (which stays mounted).
export function FilePickerDialog({ accept, onPick, onClose }: Props) {
  const headingId = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"
      >
        <FileLibrary
          accept={accept}
          onPick={onPick}
          onUploaded={onPick}
          heading={
            <h2 id={headingId} className="text-xl font-semibold text-foreground">
              Choose a file
            </h2>
          }
        />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={`${ghostButton} min-h-11 px-4`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
