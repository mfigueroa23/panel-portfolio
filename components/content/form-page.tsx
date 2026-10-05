import Link from "next/link";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "@/lib/collections";
import { ItemForm } from "./item-form";

// Shared frame of the new and edit pages.
export function FormPage({ collection, item }: { collection: CollectionKey; item?: ContentItem }) {
  const def = COLLECTIONS[collection];
  // The Markdown editor's split view needs the room of the posts editor mockup.
  const wide = def.fields.some((field) => field.kind === "markdown");
  return (
    <section className={`mx-auto w-full px-4 py-8 sm:px-6 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
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
