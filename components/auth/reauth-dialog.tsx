"use client";

import { useId, useState } from "react";
import { GoogleSignInButton } from "./google-sign-in-button";

interface Props {
  onSuccess: (token: string) => void;
  onDismiss: () => void;
}

// Opens over a form when a save gets 401. The form stays mounted underneath,
// so everything typed survives the new sign-in.
export function ReauthDialog({ onSuccess, onDismiss }: Props) {
  const headingId = useId();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl"
      >
        <h2 id={headingId} className="text-xl font-semibold text-foreground">
          Session expired
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in again to save. Everything you typed stays in this form.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-highlight"
          >
            {error}
          </p>
        )}
        <div className="mt-6">
          <GoogleSignInButton onSuccess={onSuccess} onError={setError} />
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Not now — keep editing
        </button>
      </div>
    </div>
  );
}
