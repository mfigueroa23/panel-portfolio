"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginCard({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const message = error ?? (expired ? "Session expired." : null);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
      <h1 className="text-3xl font-semibold text-foreground">Portfolio Panel</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to manage the site content.
      </p>
      {message && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-highlight"
        >
          {message}
        </p>
      )}
      <div className="mt-6">
        <GoogleSignInButton
          onSuccess={() => router.replace("/experience")}
          onError={setError}
        />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Only the site owner&apos;s Google account can sign in.
      </p>
    </div>
  );
}
