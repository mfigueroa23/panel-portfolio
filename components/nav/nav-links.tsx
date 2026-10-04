"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/session/session-provider";
import { COLLECTIONS } from "@/lib/collections";

// Shared by the desktop sidebar and the mobile drawer.
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useSession();

  return (
    <>
      <nav aria-label="Collections" className="flex flex-col gap-1">
        {Object.values(COLLECTIONS).map(({ key, label }) => {
          const href = `/${key}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Log out
      </button>
    </>
  );
}
