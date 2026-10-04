import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionList } from "@/components/content/collection-list";
import { errorMessage } from "@/lib/api";
import { COLLECTIONS, isCollectionKey } from "@/lib/collections";
import { listItems } from "@/lib/content";

export async function generateMetadata({
  params,
}: PageProps<"/[collection]">): Promise<Metadata> {
  const { collection } = await params;
  return isCollectionKey(collection)
    ? { title: `${COLLECTIONS[collection].label} · Portfolio Panel` }
    : {};
}

export default async function CollectionPage({ params }: PageProps<"/[collection]">) {
  const { collection } = await params;
  if (!isCollectionKey(collection)) notFound();

  const result = await listItems(collection);
  // Caught by app/(admin)/error.tsx, which shows the connection error.
  if (!result.ok) throw new Error(errorMessage(result));

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-foreground">
          {COLLECTIONS[collection].label}
        </h1>
        <Link
          href={`/${collection}/new`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New item
        </Link>
      </header>
      <CollectionList collection={collection} items={result.data} />
    </section>
  );
}
