import { notFound } from "next/navigation";
import { FormPage } from "@/components/content/form-page";
import { isCollectionKey } from "@/lib/collections";

export default async function NewItemPage({ params }: PageProps<"/[collection]/new">) {
  const { collection } = await params;
  if (!isCollectionKey(collection)) notFound();
  return <FormPage collection={collection} />;
}
