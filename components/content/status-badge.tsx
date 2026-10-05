import type { ContentStatus } from "@/lib/collections";

// Draft in the highlight (amber) colour, Published in the primary (teal) one.
export function StatusBadge({ status }: { status: ContentStatus }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        published ? "bg-primary/15 text-primary" : "bg-highlight/15 text-highlight"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
