"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { errorMessage } from "@/lib/api";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "@/lib/collections";
import { deleteItem } from "@/lib/content";
import { DeleteDialog } from "./delete-dialog";
import { useNotice } from "./notice-provider";
import { StatusBadge } from "./status-badge";

interface Props {
  collection: CollectionKey;
  items: ContentItem[];
}

export function CollectionList({ collection, items }: Props) {
  const def = COLLECTIONS[collection];
  const router = useRouter();
  const { token, onUnauthorized } = useSession();
  const { notify } = useNotice();
  // Deleted rows disappear at once, before router.refresh() brings new items.
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = items.filter((item) => !removed.has(item.id));

  async function confirmDelete() {
    if (!target) return;
    setPending(true);
    setError(null);
    const result = await deleteItem(collection, target.id, token);
    setPending(false);
    setTarget(null);
    if (result.ok) {
      setRemoved((current) => new Set(current).add(target.id));
      notify("Item deleted.");
      router.refresh();
    } else if (result.status === 404) {
      notify("This item no longer exists.");
      router.refresh();
    } else if (result.status === 401) {
      await onUnauthorized();
    } else {
      setError(errorMessage(result));
    }
  }

  return (
    <div className="min-w-0">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No items yet.</p>
          <Link
            href={`/${collection}/new`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create the first item
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              {def.publishable ? (
                <StatusBadge status={item.status === "published" ? "published" : "draft"} />
              ) : isPending(collection, item) ? (
                <PendingBadges item={item} />
              ) : (
                <OrderLabel collection={collection} item={item} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{def.itemTitle(item)}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {secondaryText(collection, item)}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/${collection}/${item.id}/edit`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setTarget(item)}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {target && (
        <DeleteDialog
          title={def.itemTitle(target)}
          pending={pending}
          onCancel={() => setTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const isPending = (collection: CollectionKey, item: ContentItem) =>
  COLLECTIONS[collection].reviewable === true && item.status === "pending";

// A visitor submission waiting for review, and whether the owner was emailed.
function PendingBadges({ item }: { item: ContentItem }) {
  return (
    <span className="flex flex-wrap gap-2">
      <span className="inline-flex shrink-0 items-center rounded-full bg-highlight/15 px-2.5 py-0.5 text-xs font-semibold text-highlight">
        Pending
      </span>
      {item.notified === false && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
          Notification not sent
        </span>
      )}
    </span>
  );
}

// What orders the list: #position where it is manual, the start month for
// experience (projects and posts show their status instead).
function OrderLabel({ collection, item }: { collection: CollectionKey; item: ContentItem }) {
  const def = COLLECTIONS[collection];
  if (def.fields.some((field) => field.name === "position")) {
    return <span className="font-mono text-sm text-primary">#{item.position}</span>;
  }
  if (def.fields.some((field) => field.kind === "month")) {
    const month = typeof item.startDate === "string" ? item.startDate : "";
    const [year, monthNumber] = month.split("-").map(Number);
    return (
      <span className="text-sm text-primary">
        {year && monthNumber
          ? monthFormat.format(new Date(Date.UTC(year, monthNumber - 1, 1)))
          : "No start month"}
      </span>
    );
  }
  return null;
}

// Publishable items show their public path (and publication date); pending
// submissions their submission date; others the first text value that the
// title does not already show.
function secondaryText(collection: CollectionKey, item: ContentItem): string {
  const def = COLLECTIONS[collection];
  if (isPending(collection, item)) {
    return typeof item.submittedAt === "string"
      ? `Submitted ${dateFormat.format(new Date(item.submittedAt))}`
      : "";
  }
  if (def.publicBase) {
    const path = `${def.publicBase}/${typeof item.slug === "string" ? item.slug : ""}`;
    return item.status === "published" && item.publishedAt
      ? `${path} · ${dateFormat.format(new Date(item.publishedAt))}`
      : path;
  }
  const title = def.itemTitle(item);
  for (const field of def.fields) {
    const value = item[field.name];
    if ((field.kind === "text" || field.kind === "textarea") && typeof value === "string") {
      if (value && !title.includes(value)) return value;
    }
  }
  return "";
}
