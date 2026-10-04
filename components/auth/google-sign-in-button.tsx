"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { createSession } from "@/app/actions/session";
import { CONNECTION_ERROR, errorMessage } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth";
import { GOOGLE_CLIENT_ID } from "@/lib/config";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void | Promise<void>;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

interface Props {
  onSuccess: (token: string) => void;
  onError: (message: string) => void;
}

// If the owner cancels or closes Google's prompt, Google never fires the
// callback, so nothing happens and no error is shown.
export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSuccess, onError });

  useEffect(() => {
    handlers.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    const id = window.google?.accounts.id;
    if (!ready || !id || !container.current) return;

    const handleCredential = async ({ credential }: GoogleCredentialResponse) => {
      const result = await signInWithGoogle(credential);
      if (!result.ok) {
        handlers.current.onError(errorMessage(result));
        return;
      }
      try {
        await createSession(result.data.accessToken);
      } catch {
        handlers.current.onError(CONNECTION_ERROR);
        return;
      }
      handlers.current.onSuccess(result.data.accessToken);
    };

    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
    });
    id.renderButton(container.current, {
      theme: "filled_black",
      shape: "pill",
      size: "large",
      text: "signin_with",
    });
  }, [ready]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" onReady={() => setReady(true)} />
      <div ref={container} className="flex min-h-11 justify-center" />
    </>
  );
}
