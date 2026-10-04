import Link from "next/link";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "@/lib/collections";
import { ItemForm } from "./item-form";

// Shared frame of the new and edit pages.
export function FormPage({ collection, item }: { collection: CollectionKey; item?: ContentItem }) {
  const def = COLLECTIONS[collection];
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href={`/${collection}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to {def.label.toLowerCase()}
      </Link>
      <h1 className="mt-3 mb-6 text-3xl font-semibold text-foreground">
        {item ? `Edit ${def.itemTitle(item) || "item"}` : `New ${def.label.toLowerCase()} item`}
      </h1>
      <ItemForm collection={collection} item={item} />
    </section>
  );
}
