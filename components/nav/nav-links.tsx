"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { useSession } from "@/components/session/session-provider";
import { NAV_GROUPS } from "@/lib/collections";

// Shared by the desktop sidebar and the mobile drawer. Items are at least
// 44 px tall, the touch target size on phones.
export function NavLinks({
  onNavigate,
  className = "",
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const baseId = useId();

  return (
    <nav aria-label="Collections" className={`flex flex-col gap-4.5 ${className}`}>
      {NAV_GROUPS.map((group, index) => {
        const labelId = `${baseId}-group-${index}`;
        return (
          <div key={group.label} role="group" aria-labelledby={labelId} className="flex flex-col gap-0.5">
            <p
              id={labelId}
              className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              {group.label}
            </p>
            {group.links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${
                    active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function LogOutButton({ className = "" }: { className?: string }) {
  const { signOut } = useSession();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      Log out
    </button>
  );
}
