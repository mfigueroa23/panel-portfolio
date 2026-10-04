"use client";

import { useId } from "react";

interface Props {
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDialog({ title, pending, onCancel, onConfirm }: Props) {
  const headingId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 id={headingId} className="text-xl font-semibold text-foreground">
          Delete this item?
        </h2>
        <p className="mt-3 break-words text-sm text-muted-foreground">{title}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
