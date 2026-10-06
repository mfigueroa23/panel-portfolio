import { apiFetch, type ApiResult } from "./api";
import { COLLECTIONS, type CollectionKey, type ContentItem } from "./collections";

export type ItemValues = Record<string, unknown>;

/**
 * Reads a collection, always fresh: the admin list (drafts included, with the
 * token) where the collection has one, the public list otherwise.
 */
export async function listItems(
  key: CollectionKey,
  token?: string,
): Promise<ApiResult<ContentItem[]>> {
  const def = COLLECTIONS[key];
  const result = await apiFetch<ContentItem[]>(def.apiAdminListPath ?? def.apiPath, {
    method: "GET",
    cache: "no-store",
    ...(def.apiAdminListPath && token ? { token } : {}),
  });
  if (!result.ok) return result;
  // The API already returns this order; sorting again is a safeguard.
  const data = [...result.data].sort(def.sort);
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

export function publishItem(
  key: CollectionKey,
  id: number,
  token: string,
): Promise<ApiResult<ContentItem>> {
  return apiFetch<ContentItem>(`${COLLECTIONS[key].apiPath}/${id}/publish`, {
    method: "POST",
    token,
  });
}

export function unpublishItem(
  key: CollectionKey,
  id: number,
  token: string,
): Promise<ApiResult<ContentItem>> {
  return apiFetch<ContentItem>(`${COLLECTIONS[key].apiPath}/${id}/unpublish`, {
    method: "POST",
    token,
  });
}

/** Reviewable collections: stores the form's values and makes the item public. */
export function approveItem(
  key: CollectionKey,
  id: number,
  values: ItemValues,
  token: string,
): Promise<ApiResult<ContentItem>> {
  return apiFetch<ContentItem>(`${COLLECTIONS[key].apiPath}/${id}/approve`, {
    method: "POST",
    body: values,
    token,
  });
}

/** Number of testimonials waiting for review. */
export async function pendingCount(token: string): Promise<ApiResult<number>> {
  const result = await apiFetch<{ count: number }>(
    `${COLLECTIONS.testimonials.apiPath}/pending-count`,
    { method: "GET", cache: "no-store", token },
  );
  return result.ok ? { ok: true, data: result.data.count } : result;
}
