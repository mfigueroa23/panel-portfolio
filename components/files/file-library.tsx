"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ReauthDialog } from "@/components/auth/reauth-dialog";
import { useNotice } from "@/components/content/notice-provider";
import { useSession } from "@/components/session/session-provider";
import { errorMessage, type ApiFailure } from "@/lib/api";
import {
  acceptAttribute,
  fileKind,
  formatSize,
  listFiles,
  validateFile,
  type FileKind,
  type FilePage,
  type StoredFile,
} from "@/lib/files";
import { uploadFile } from "@/lib/upload";
import { DeleteFileDialog } from "./delete-file-dialog";

const PAGE_SIZE = 50;
const MiB = 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "application/pdf": "PDF",
};

const FILTERS: { label: string; kind?: FileKind }[] = [
  { label: "All" },
  { label: "Images", kind: "image" },
  { label: "PDF", kind: "pdf" },
];

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const ghostButton =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-border px-3 text-sm text-foreground hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";

interface Props {
  /** Shown left of the Upload button (the page title, or the dialog's). */
  heading?: ReactNode;
  /** Kinds of file listed and uploaded; both by default. */
  accept?: FileKind[];
  /** Pick mode: each file gets "Choose" instead of Copy URL and Delete. */
  onPick?: (file: StoredFile) => void;
  onUploaded?: (file: StoredFile) => void;
}

interface Query {
  kind?: FileKind;
  page: number;
  /** Bumped by "Try again" to reload the same page. */
  attempt: number;
}

interface Progress {
  name: string;
  loaded: number;
  total: number;
}

export function FileLibrary({
  heading,
  accept = ["image", "pdf"],
  onPick,
  onUploaded,
}: Props) {
  const { token, setToken } = useSession();
  const { notify } = useNotice();
  const onlyKind = accept.length === 1 ? accept[0] : undefined;
  const [query, setQuery] = useState<Query>({ kind: onlyKind, page: 1, attempt: 0 });
  // The answer is stored with the request it belongs to, so a stale page is
  // never shown as the current one.
  const requestKey = `${query.kind ?? "all"}|${query.page}|${query.attempt}|${token}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data?: FilePage;
    error?: ApiFailure;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [target, setTarget] = useState<StoredFile | null>(null);
  const [reauth, setReauth] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void listFiles(query.page, query.kind, token).then((result) => {
      if (cancelled) return;
      if (result.ok) setLoaded({ key: requestKey, data: result.data });
      else {
        setLoaded({ key: requestKey, error: result });
        if (result.status === 401) setReauth(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, token, requestKey]);

  const current = loaded?.key === requestKey ? loaded : null;
  const items = current?.data?.items ?? [];

  const updateItems = (change: (page: FilePage) => FilePage) =>
    setLoaded((state) => (state?.data ? { ...state, data: change(state.data) } : state));

  async function upload(file: File) {
    const invalid = validateFile(file, accept);
    if (invalid) {
      setBanner(invalid.startsWith(file.name) ? invalid : `${file.name}: ${invalid}`);
      return;
    }
    setBanner(null);
    setProgress({ name: file.name, loaded: 0, total: file.size });
    const result = await uploadFile(file, token, (done, total) =>
      setProgress({ name: file.name, loaded: done, total }),
    );
    setProgress(null);
    if (result.ok) {
      const stored = result.data;
      if (query.page === 1 && (!query.kind || query.kind === fileKind(stored.mime))) {
        updateItems((page) => ({ ...page, items: [stored, ...page.items], total: page.total + 1 }));
      }
      notify("File uploaded.");
      onUploaded?.(stored);
    } else if (result.status === 401) {
      setBanner(`${file.name}: Your session expired. Upload the file again.`);
      setReauth(true);
    } else {
      setBanner(`${file.name}: ${errorMessage(result)}`);
    }
  }

  async function copy(file: StoredFile) {
    try {
      await navigator.clipboard.writeText(file.url);
      notify("URL copied.");
    } catch {
      notify("Could not copy the URL.");
    }
  }

  function removed(file: StoredFile) {
    setTarget(null);
    updateItems((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== file.id),
      total: Math.max(0, page.total - 1),
    }));
    notify("File deleted.");
  }

  const total = current?.data?.total ?? 0;
  const totalPages = current?.data?.totalPages ?? 1;
  const first = (query.page - 1) * PAGE_SIZE + 1;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">{heading}</div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
          </svg>
          Upload
        </button>
        <input
          ref={input}
          type="file"
          aria-label="Upload a file"
          tabIndex={-1}
          accept={acceptAttribute(accept)}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>

      {progress && <ProgressRow progress={progress} />}
      {banner && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {banner}
        </p>
      )}

      {!onlyKind && (
        <div
          role="group"
          aria-label="Filter by type"
          className="inline-flex self-start rounded-lg border border-border bg-card p-0.5"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={query.kind === filter.kind}
              onClick={() => setQuery({ kind: filter.kind, page: 1, attempt: 0 })}
              className="min-h-9 rounded-md px-3.5 text-sm text-muted-foreground aria-pressed:bg-secondary aria-pressed:font-semibold aria-pressed:text-secondary-foreground"
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {current?.error && current.error.status !== 401 && (
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage(current.error)}
          </p>
          <button
            type="button"
            onClick={() => setQuery((q) => ({ ...q, attempt: q.attempt + 1 }))}
            className={ghostButton}
          >
            Try again
          </button>
        </div>
      )}

      {!current && <p className="text-sm text-muted-foreground">Loading files…</p>}

      {current?.data && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No files yet.</p>
        </div>
      )}

      {items.length > 0 && (
        <ul
          aria-label="Files"
          className={`grid grid-cols-2 gap-4 ${onPick ? "sm:grid-cols-3" : "lg:grid-cols-4"}`}
        >
          {items.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onPick={onPick}
              onCopy={() => void copy(file)}
              onDelete={() => setTarget(file)}
            />
          ))}
        </ul>
      )}

      {current?.data && total > 0 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {first}–{first + items.length - 1} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={query.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: q.page - 1, attempt: 0 }))}
              className={ghostButton}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={query.page >= totalPages}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1, attempt: 0 }))}
              className={ghostButton}
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {target && (
        <DeleteFileDialog
          file={target}
          token={token}
          onCancel={() => setTarget(null)}
          onDeleted={removed}
          onUnauthorized={() => {
            setTarget(null);
            setReauth(true);
          }}
        />
      )}
      {reauth && (
        <ReauthDialog
          onSuccess={(fresh) => {
            setToken(fresh);
            setReauth(false);
          }}
          onDismiss={() => setReauth(false)}
        />
      )}
    </div>
  );
}

function ProgressRow({ progress }: { progress: Progress }) {
  const percent = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5">
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{progress.name}</span>
      <div
        role="progressbar"
        aria-label={`Uploading ${progress.name}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm text-muted-foreground">
        {percent} % · {(progress.loaded / MiB).toFixed(1)} of {(progress.total / MiB).toFixed(1)} MiB
      </span>
    </div>
  );
}

interface CardProps {
  file: StoredFile;
  onPick?: (file: StoredFile) => void;
  onCopy: () => void;
  onDelete: () => void;
}

function FileCard({ file, onPick, onCopy, onDelete }: CardProps) {
  const isPdf = fileKind(file.mime) === "pdf";
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex aspect-4/3 items-center justify-center bg-surface">
        {isPdf ? (
          <svg
            data-testid="pdf-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-9 text-highlight"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M14 3H6v18h12V7z" />
            <path d="M14 3v4h4" />
          </svg>
        ) : (
          // Files live on the API's origin; next/image would need it as a remote pattern.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2 p-3">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {TYPE_LABELS[file.mime] ?? file.mime} · {formatSize(file.size)} ·{" "}
          {dateFormat.format(new Date(file.createdAt))}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {onPick ? (
            <button
              type="button"
              aria-label={`Choose ${file.name}`}
              onClick={() => onPick(file)}
              className={ghostButton}
            >
              Choose
            </button>
          ) : (
            <>
              <button type="button" onClick={onCopy} className={ghostButton}>
                Copy URL
              </button>
              <button
                type="button"
                onClick={onDelete}
                className={`${ghostButton} text-red-300 hover:border-red-400 hover:text-red-300`}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
