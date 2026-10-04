"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const NOTICE_MS = 3_000;

interface NoticeContextValue {
  notify: (text: string) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

// Lives in the admin layout, so a notice survives the navigation that follows
// a save or a delete.
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  // The id restarts the timer when the same text is notified twice.
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const notify = useCallback((text: string) => {
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, text }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {notice && (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-50 rounded-xl border border-primary/40 bg-surface px-4 py-3 text-sm text-foreground shadow-xl sm:left-auto sm:max-w-sm"
        >
          {notice.text}
        </div>
      )}
    </NoticeContext.Provider>
  );
}

export function useNotice(): NoticeContextValue {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("useNotice must be used inside NoticeProvider.");
  return value;
}
