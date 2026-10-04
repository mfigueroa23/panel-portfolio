"use client";

import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh w-66 shrink-0 flex-col gap-8 border-r border-border bg-card p-6">
      <p className="font-display text-xl font-semibold text-foreground">Portfolio Panel</p>
      <NavLinks />
    </aside>
  );
}
