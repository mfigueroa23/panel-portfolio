import { notFound } from "next/navigation";
import { FormPage } from "@/components/content/form-page";
import { errorMessage } from "@/lib/api";
import { isCollectionKey } from "@/lib/collections";
import { listItems } from "@/lib/content";

export default async function EditItemPage({ params }: PageProps<"/[collection]/[id]/edit">) {
  const { collection, id } = await params;
  if (!isCollectionKey(collection) || !/^\d+$/.test(id)) notFound();

  // The API has no GET /:id, so the item is picked from the list.
  const result = await listItems(collection);
  if (!result.ok) throw new Error(errorMessage(result));
  const item = result.data.find((candidate) => candidate.id === Number(id));
  if (!item) notFound();

  return <FormPage collection={collection} item={item} />;
}
