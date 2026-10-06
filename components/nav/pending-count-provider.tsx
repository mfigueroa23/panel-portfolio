"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { pendingCount } from "@/lib/content";

interface PendingCount {
  /** Testimonials waiting for review. */
  count: number;
  /** Reloads the count, e.g. after an approval or a rejection. */
  refresh: () => Promise<void>;
}

// Outside the admin layout (unit tests of single components) there is no
// count to show and nothing to refresh.
const PendingCountContext = createContext<PendingCount>({
  count: 0,
  refresh: async () => {},
});

// Lives in the admin layout, so the navigation badge and the item form share
// one count. A failed request keeps the last count: the badge is a hint, and
// the list page shows the API's errors itself.
export function PendingCountProvider({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await pendingCount(token);
    if (result.ok) setCount(result.data);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void pendingCount(token).then((result) => {
      if (!cancelled && result.ok) setCount(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return <PendingCountContext.Provider value={value}>{children}</PendingCountContext.Provider>;
}

export function usePendingCount(): PendingCount {
  return useContext(PendingCountContext);
}
