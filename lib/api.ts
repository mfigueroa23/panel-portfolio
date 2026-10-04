import { API_URL } from "./config";

export const CONNECTION_ERROR =
  "Could not reach the server. Check your connection and try again.";

/** Field errors as the API returns them: `{ field: [messages] }`. */
export type ApiFieldErrors = Record<string, string[]>;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; fields?: ApiFieldErrors }
  /** Network or CORS failure: the API was never reached. */
  | { ok: false; status: 0 };

export type ApiFailure = Extract<ApiResult<never>, { ok: false }>;

/** The text to show for a failed request: the API's own, or the connection error. */
export function errorMessage(result: ApiFailure): string {
  return "error" in result ? result.error : CONNECTION_ERROR;
}

export interface ApiRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  cache?: RequestCache;
}

// Never logs requests, tokens or bodies: every outcome is returned as data.
export async function apiFetch<T>(
  path: string,
  { method, body, token, cache }: ApiRequest,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(cache ? { cache } : {}),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  const payload = await readJson(response);
  if (response.ok) {
    return { ok: true, data: payload as T };
  }
  return { ok: false, status: response.status, ...toError(payload, response.status) };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

function toError(
  payload: unknown,
  status: number,
): { error: string; fields?: ApiFieldErrors } {
  if (payload && typeof payload === "object") {
    const { error, fields } = payload as { error?: unknown; fields?: unknown };
    if (typeof error === "string") {
      return fields && typeof fields === "object"
        ? { error, fields: fields as ApiFieldErrors }
        : { error };
    }
  }
  // A proxy or gateway answered instead of the API (e.g. an HTML 502 page).
  return { error: `Request failed (${status}).` };
}
