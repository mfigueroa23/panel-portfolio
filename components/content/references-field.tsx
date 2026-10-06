"use client";

export interface Reference {
  title: string;
  url: string;
  /** Spanish title (Spec 004); the URL is shared by both languages. */
  titleEs?: string | null;
}

const referenceInputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none aria-invalid:border-red-500";

interface Props {
  labelId: string;
  a11y: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };
  items: Reference[];
  maxItems?: number;
  /** English edits titles, URLs and rows; Spanish only each row's `titleEs`. */
  lang: "en" | "es";
  onChange: (items: Reference[]) => void;
}

export function ReferencesField({ labelId, a11y, items, maxItems, lang, onChange }: Props) {
  const full = maxItems !== undefined && items.length >= maxItems;
  const update = (index: number, change: Partial<Reference>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...change } : item)));

  return (
    <div
      id={a11y.id}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={a11y["aria-describedby"]}
      className="flex min-w-0 flex-col gap-2"
    >
      {lang === "es" && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Add references in the English tab.</p>
      )}
      {items.map((reference, index) => {
        const n = index + 1;
        if (lang === "es") {
          return (
            <div key={index} className="flex min-w-0 flex-col gap-1">
              <input
                aria-label={`Reference ${n} title`}
                type="text"
                placeholder="Title"
                value={reference.titleEs ?? ""}
                onChange={(event) => update(index, { titleEs: event.target.value })}
                className={referenceInputClass}
              />
              <p className="truncate text-xs text-muted-foreground">
                {reference.title && <span>English: {reference.title}</span>}
                {reference.title && reference.url && " · "}
                {reference.url && <span>{reference.url}</span>}
              </p>
            </div>
          );
        }
        return (
          <div
            key={index}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
          >
            <input
              aria-label={`Reference ${n} title`}
              type="text"
              placeholder="Title"
              value={reference.title ?? ""}
              onChange={(event) => update(index, { title: event.target.value })}
              className={`${referenceInputClass} col-start-1`}
            />
            <input
              aria-label={`Reference ${n} URL`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={reference.url ?? ""}
              onChange={(event) => update(index, { url: event.target.value })}
              className={`${referenceInputClass} col-start-1 sm:col-start-2 sm:row-start-1`}
            />
            <button
              type="button"
              aria-label={`Remove reference ${n}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="col-start-2 row-span-2 row-start-1 min-h-11 min-w-11 rounded-lg border border-border text-foreground hover:bg-muted sm:col-start-3 sm:row-span-1"
            >
              ×
            </button>
          </div>
        );
      })}
      {lang === "en" && (
        <button
          type="button"
          aria-label="Add reference"
          disabled={full}
          onClick={() => onChange([...items, { title: "", url: "" }])}
          className="self-start rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-60"
        >
          + Add reference
        </button>
      )}
    </div>
  );
}
