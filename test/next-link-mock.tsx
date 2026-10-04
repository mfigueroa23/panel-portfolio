import type { AnchorHTMLAttributes } from "react";

// next/link needs the App Router context; in unit tests a plain anchor that
// keeps href, className, aria-* and onClick is enough.
export default function Link({
  href,
  prefetch: _prefetch,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) {
  void _prefetch;
  return <a href={href} {...props} />;
}
