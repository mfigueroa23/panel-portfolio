"use client";

import { CONNECTION_ERROR } from "@/lib/api";

// A failed server-side list fetch lands here. The error itself is not shown
// or logged: the owner only needs to know the API could not be reached.
export default function AdminError({ retry }: { error: Error; retry: () => void }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <p
        role="alert"
        className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        {CONNECTION_ERROR}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
      >
        Try again
      </button>
    </section>
  );
}
