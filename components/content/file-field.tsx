"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { FilePickerDialog } from "@/components/files/file-picker-dialog";
import { ghostButton } from "@/components/files/file-library";
import { useSession } from "@/components/session/session-provider";
import { errorMessage } from "@/lib/api";
import type { FieldDef } from "@/lib/collections";
import { acceptAttribute, fileKind, validateFile, type StoredFile } from "@/lib/files";
import { uploadFile } from "@/lib/upload";

interface Props {
  id: string;
  field: FieldDef;
  value: string;
  onChange: (url: string) => void;
  /** An upload got 401: the form offers the sign-in again and keeps its values. */
  onUnauthorized?: () => void;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none aria-invalid:border-red-500";

// A single-file field (project image, post cover, certification file): the
// value is the file's URL, filled from the library, by uploading, or typed
// (existing external URLs keep working).
export function FileField({ id, field, value, onChange, onUnauthorized, inputProps }: Props) {
  const { token } = useSession();
  const accept = field.accept ?? ["image", "pdf"];
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The MIME of the last file chosen here; a typed URL has none.
  const [known, setKnown] = useState<{ url: string; name: string; mime: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = (file: StoredFile) => {
    setKnown({ url: file.url, name: file.name, mime: file.mime });
    setError(null);
    onChange(file.url);
  };

  async function upload(file: File) {
    const invalid = validateFile(file, accept);
    if (invalid) {
      setError(invalid.startsWith(file.name) ? invalid : `${file.name}: ${invalid}`);
      return;
    }
    setError(null);
    setProgress({ name: file.name, percent: 0 });
    const result = await uploadFile(file, token, (loaded, total) =>
      setProgress({ name: file.name, percent: total ? Math.round((loaded / total) * 100) : 0 }),
    );
    setProgress(null);
    if (result.ok) choose(result.data);
    else if (result.status === 401) {
      setError(`${file.name}: Your session expired. Upload the file again.`);
      onUnauthorized?.();
    } else setError(`${file.name}: ${errorMessage(result)}`);
  }

  const current = known?.url === value ? known : null;
  const isImage = current ? fileKind(current.mime) === "image" : !accept.includes("pdf");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-2">
        <div className="flex h-14 w-22 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-xs text-muted-foreground">
          {!value ? (
            "No file"
          ) : isImage ? (
            // Files live on the API's origin; next/image would need it as a remote pattern.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={`${field.label} preview`} className="size-full object-cover" />
          ) : (
            <a href={value} target="_blank" rel="noopener noreferrer" className="px-1 text-center text-primary underline-offset-2 hover:underline">
              {current?.name ?? "Open file"}
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} className={ghostButton}>
            Choose from library
          </button>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={progress !== null}
            className={ghostButton}
          >
            Upload
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className={ghostButton}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          aria-label={`Upload ${field.label}`}
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
      <input
        {...inputProps}
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://… or choose a file"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {progress && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`Uploading ${progress.name}`}
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{progress.percent} %</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {picking && (
        <FilePickerDialog
          accept={accept}
          onPick={(file) => {
            setPicking(false);
            choose(file);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
