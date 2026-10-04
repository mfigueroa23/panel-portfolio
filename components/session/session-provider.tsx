"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { deleteSession } from "@/app/actions/session";

export interface Session {
  token: string;
  setToken: (token: string) => void;
  signOut: () => Promise<void>;
  /** For an expired session found outside a form: back to the login screen. */
  onUnauthorized: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

// The token lives only in React state here and in the httpOnly cookie; never
// in Web Storage.
export function SessionProvider({
  initialToken,
  children,
}: {
  initialToken: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);

  const signOut = useCallback(async () => {
    await deleteSession();
    router.replace("/login");
  }, [router]);

  const onUnauthorized = useCallback(async () => {
    await deleteSession();
    router.replace("/login?expired=1");
  }, [router]);

  const value = useMemo(
    () => ({ token, setToken, signOut, onUnauthorized }),
    [token, signOut, onUnauthorized],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider.");
  return session;
}
