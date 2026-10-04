import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FormPage } from "@/components/content/form-page";
import { errorMessage } from "@/lib/api";
import { isCollectionKey } from "@/lib/collections";
import { listItems } from "@/lib/content";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export default async function EditItemPage({ params }: PageProps<"/[collection]/[id]/edit">) {
  const { collection, id } = await params;
  if (!isCollectionKey(collection) || !/^\d+$/.test(id)) notFound();

  // The API has no GET /:id, so the item is picked from the list.
  // Publishable collections list drafts only for the signed-in owner.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const result = await listItems(collection, token);
  if (!result.ok) throw new Error(errorMessage(result));
  const item = result.data.find((candidate) => candidate.id === Number(id));
  if (!item) notFound();

  return <FormPage collection={collection} item={item} />;
}
