import { toError, type ApiResult } from "./api";
import { API_URL } from "./config";
import type { StoredFile } from "./files";

export type UploadProgress = (loaded: number, total: number) => void;

// XMLHttpRequest instead of fetch: only XHR reports upload progress. The body
// is the raw file and the name travels in the query (plan D2). Like apiFetch,
// nothing is logged and every outcome is returned as data.
export function uploadFile(
  file: File,
  token: string,
  onProgress?: UploadProgress,
): Promise<ApiResult<StoredFile>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/files?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      const payload = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, data: payload as StoredFile });
      } else {
        resolve({ ok: false, status: xhr.status, ...toError(payload, xhr.status) });
      }
    };
    const unreachable = () => resolve({ ok: false, status: 0 });
    xhr.onerror = unreachable;
    xhr.onabort = unreachable;
    xhr.ontimeout = unreachable;
    xhr.send(file);
  });
}

function parse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}
