"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOutButton, NavLinks } from "./nav-links";

// The sidebar takes over from this width (Tailwind's lg).
const DESKTOP_QUERY = "(min-width: 1024px)";

export function MobileNav() {
  const pathname = usePathname();
  // The drawer is open only on the route where it was opened, so any
  // navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Focus goes into the drawer when it opens and back to the menu button
  // when it closes, however it was closed.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // The page behind must not scroll while the drawer covers it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    // Growing past the breakpoint shows the sidebar, so the drawer goes away.
    const desktop = typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY) : null;
    const onBreakpoint = (event: { matches: boolean }) => {
      if (event.matches) setOpenOn(null);
    };
    desktop?.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop?.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center gap-1 border-b border-border bg-background/90 px-2 py-2 backdrop-blur">
      <button
        ref={menuButton}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpenOn(pathname)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <p className="font-display text-lg font-semibold text-foreground">Portfolio Panel</p>
      {open &&
        // Portalled out of the header: its backdrop-blur makes it the containing
        // block of fixed children, which clipped the drawer to the bar's height.
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              data-testid="drawer-overlay"
              aria-hidden="true"
              onClick={close}
              className="fixed inset-0 bg-black/70"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 flex h-dvh w-76 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl"
            >
              <div className="flex h-15 flex-none items-center justify-between border-b border-border pr-2 pl-5">
                <p className="font-display text-lg font-semibold text-foreground">Portfolio Panel</p>
                <button
                  ref={closeButton}
                  type="button"
                  aria-label="Close menu"
                  onClick={close}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <NavLinks onNavigate={close} className="min-h-0 flex-1 overflow-y-auto px-3 py-4" />
              <div className="flex-none border-t border-border p-3">
                <LogOutButton />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
