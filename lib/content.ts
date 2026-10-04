import { apiFetch, type ApiResult } from "./api";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "./collections";

export type ItemValues = Record<string, unknown>;

/** Reads a collection from its public endpoint, always fresh. */
export async function listItems(key: CollectionKey): Promise<ApiResult<ContentItem[]>> {
  const result = await apiFetch<ContentItem[]>(COLLECTIONS[key].apiPath, {
    method: "GET",
    cache: "no-store",
  });
  if (!result.ok) return result;
  // The API already orders by position then id; sorting again is a safeguard.
  const data = [...result.data].sort((a, b) => a.position - b.position || a.id - b.id);
  return { ok: true, data };
}

export function createItem(
  key: CollectionKey,
  values: ItemValues,
  token: string,
): Promise<ApiResult<ContentItem>> {
  return apiFetch<ContentItem>(COLLECTIONS[key].apiPath, {
    method: "POST",
    body: values,
    token,
  });
}

export function updateItem(
  key: CollectionKey,
  id: number,
  values: ItemValues,
  token: string,
): Promise<ApiResult<ContentItem>> {
  return apiFetch<ContentItem>(`${COLLECTIONS[key].apiPath}/${id}`, {
    method: "PUT",
    body: values,
    token,
  });
}

export function deleteItem(
  key: CollectionKey,
  id: number,
  token: string,
): Promise<ApiResult<void>> {
  return apiFetch<void>(`${COLLECTIONS[key].apiPath}/${id}`, {
    method: "DELETE",
    token,
  });
}
