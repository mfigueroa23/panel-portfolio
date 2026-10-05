"use client";

import { LogOutButton, NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh w-66 shrink-0 flex-col gap-6 border-r border-border bg-card px-3.5 py-6">
      <p className="px-3 font-display text-xl font-semibold text-foreground">Portfolio Panel</p>
      <NavLinks className="min-h-0 flex-1 overflow-y-auto" />
      <LogOutButton />
    </aside>
  );
}
