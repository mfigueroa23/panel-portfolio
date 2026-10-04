"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const pathname = usePathname();
  // The drawer is open only on the route where it was opened, so any
  // navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
      <p className="font-display text-lg font-semibold text-foreground">Portfolio Panel</p>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpenOn(pathname)}
        className="rounded-lg p-2 text-foreground hover:bg-muted"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-foreground">Portfolio Panel</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="rounded-lg p-2 text-foreground hover:bg-muted"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <NavLinks onNavigate={close} />
          </div>
        </div>
      )}
    </header>
  );
}
