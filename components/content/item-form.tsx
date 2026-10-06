"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ReauthDialog } from "@/components/auth/reauth-dialog";
import { usePendingCount } from "@/components/nav/pending-count-provider";
import { useSession } from "@/components/session/session-provider";
import { errorMessage, type ApiResult } from "@/lib/api";
import {
  COLLECTIONS,
  type CollectionKey,
  type ContentItem,
  type FieldDef,
} from "@/lib/collections";
import {
  approveItem,
  createItem,
  deleteItem,
  publishItem,
  unpublishItem,
  updateItem,
  type ItemValues,
} from "@/lib/content";
import { slugify } from "@/lib/slug";
import { validateItem, type ValidationMode } from "@/lib/validation";
import { DeleteDialog } from "./delete-dialog";
import { FileField } from "./file-field";
import { MarkdownEditor } from "./markdown-editor";
import { useNotice } from "./notice-provider";
import { StatusBadge } from "./status-badge";

interface Props {
  collection: CollectionKey;
  /** The item being edited; omitted when creating. */
  item?: ContentItem;
}

type Intent = "save" | "draft" | "publish" | "unpublish" | "approve" | "reject";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none aria-invalid:border-red-500";

const ghostClass =
  "min-h-11 rounded-lg border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-60";
const primaryClass =
  "min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60";

const dangerClass =
  "min-h-11 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60";

const ARRAY_KINDS = new Set(["list", "tags", "references"]);
// Kinds that take the whole row of the two-column layout.
const WIDE_KINDS = new Set(["markdown", "references"]);

// The fields this form shows and sends: testimonials take no position on
// create (the API puts them first) nor while pending review.
function formFields(fields: FieldDef[], item?: ContentItem): FieldDef[] {
  return fields.filter(
    (field) =>
      !(field.createHidden && !item) && !(field.approvedOnly && item?.status !== "approved"),
  );
}

function initialValues(fields: FieldDef[], item?: ContentItem): ItemValues {
  const values: ItemValues = {};
  for (const field of fields) {
    const value = item?.[field.name];
    if (value !== undefined && value !== null) values[field.name] = value;
    else if (field.kind === "boolean") values[field.name] = false;
    else if (ARRAY_KINDS.has(field.kind)) values[field.name] = [];
    else values[field.name] = "";
  }
  return values;
}

// Empty optional fields go as null: the API skips them (and clears them on a
// PUT) instead of rejecting "" as an invalid URL or date.
function toPayload(fields: FieldDef[], values: ItemValues): ItemValues {
  const payload: ItemValues = {};
  for (const field of fields) {
    const value = values[field.name];
    payload[field.name] = !field.required && value === "" ? null : value;
  }
  return payload;
}

function toFieldErrors(fields: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, messages]) => [name, messages.join(" ")]),
  );
}

export function ItemForm({ collection, item }: Props) {
  const def = COLLECTIONS[collection];
  const fields = formFields(def.fields, item);
  const router = useRouter();
  const { token, setToken } = useSession();
  const { notify } = useNotice();
  const { refresh: refreshPendingCount } = usePendingCount();
  const formId = useId();
  // Values are only ever replaced by the owner's typing, never on failure.
  const [values, setValues] = useState(() => initialValues(fields, item));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const [reauth, setReauth] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  // Set once a new item is created, so a refused publish retries as an update.
  const [savedId, setSavedId] = useState(item?.id);
  const hasSlug = def.fields.some((field) => field.kind === "slug");
  // The slug follows the title until the owner edits it, and never once the
  // item has been published (its URL may already be shared).
  const [slugFollows, setSlugFollows] = useState(hasSlug && !item?.publishedAt);
  const published = item?.status === "published";
  // A visitor submission waiting for review: Save / Approve / Reject.
  const reviewing = def.reviewable === true && item?.status === "pending";

  const setValue = (name: string, value: unknown) =>
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "title" && slugFollows && typeof value === "string") {
        next.slug = slugify(value);
      }
      return next;
    });

  function failed(result: Extract<ApiResult<unknown>, { ok: false }>) {
    if (result.status === 401) {
      setReauth(true);
    } else if (result.status === 404) {
      notify("This item no longer exists.");
      router.push(`/${collection}`);
      router.refresh();
    } else if ((result.status === 400 || result.status === 409) && "fields" in result && result.fields) {
      setFieldErrors(toFieldErrors(result.fields));
    } else if (result.status === 409 && hasSlug) {
      setFieldErrors({ slug: errorMessage(result) });
    } else {
      setBanner(errorMessage(result));
    }
  }

  function done(message: string) {
    notify(message);
    router.push(`/${collection}`);
    router.refresh();
  }

  async function run(intent: Intent) {
    setBanner(null);
    const mode: ValidationMode = intent === "draft" || intent === "unpublish" ? "draft" : "publish";
    const errors = validateItem(fields, values, mode);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(intent);
    try {
      const payload = toPayload(fields, values);
      if (intent === "approve" && item) {
        // The API stores these values before making the item public.
        const result = await approveItem(collection, item.id, payload, token);
        if (!result.ok) return failed(result);
        void refreshPendingCount();
        return done("Testimonial approved.");
      }
      const saved =
        savedId !== undefined
          ? await updateItem(collection, savedId, payload, token)
          : await createItem(collection, payload, token);
      if (!saved.ok) return failed(saved);
      setSavedId(saved.data.id);

      if (intent === "publish" && !published) {
        const result = await publishItem(collection, saved.data.id, token);
        if (!result.ok) return failed(result);
        return done("Published.");
      }
      if (intent === "unpublish") {
        const result = await unpublishItem(collection, saved.data.id, token);
        if (!result.ok) return failed(result);
        return done("Moved back to drafts.");
      }
      if (intent === "draft") return done("Draft saved.");
      done(item ? "Item updated." : "Item created.");
    } finally {
      setPending(null);
    }
  }

  async function reject() {
    if (!item) return;
    setBanner(null);
    setPending("reject");
    try {
      const result = await deleteItem(collection, item.id, token);
      setConfirmReject(false);
      if (!result.ok) return failed(result);
      void refreshPendingCount();
      done("Testimonial rejected.");
    } finally {
      setPending(null);
    }
  }

  const wide = def.fields.some((field) => field.kind === "markdown");
  const busy = pending !== null;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(def.publishable && !published ? "draft" : "save");
        }}
        noValidate
        className="flex min-w-0 flex-col gap-5"
      >
        {banner && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {banner}
          </p>
        )}
        {reviewing && item && <SubmissionDetails item={item} />}
        <div className={`grid min-w-0 grid-cols-1 gap-5 ${wide ? "lg:grid-cols-2" : ""}`}>
          {fields.map((field) => (
            <div key={field.name} className={`min-w-0 ${WIDE_KINDS.has(field.kind) ? "lg:col-span-2" : ""}`}>
              <Field
                id={`${formId}-${field.name}`}
                field={field}
                value={values[field.name]}
                error={fieldErrors[field.name]}
                onChange={(value) => {
                  if (field.kind === "slug") setSlugFollows(false);
                  setValue(field.name, value);
                }}
                slugPrefix={def.publicBase ? `${def.publicBase}/` : undefined}
                slugFollows={slugFollows}
                onUnauthorized={() => setReauth(true)}
              />
            </div>
          ))}
        </div>
        {def.publishable ? (
          // A sticky bar on phones (mobile editor mockup); a plain row from lg up.
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
            <StatusBadge status={published ? "published" : "draft"} />
            <div className="ml-auto flex flex-1 justify-end gap-3 sm:flex-none">
              {published ? (
                <>
                  <button type="button" disabled={busy} onClick={() => void run("unpublish")} className={`${ghostClass} flex-1 sm:flex-none`}>
                    {pending === "unpublish" ? "Unpublishing…" : "Unpublish"}
                  </button>
                  <button type="submit" disabled={busy} className={`${primaryClass} flex-1 sm:flex-none`}>
                    {pending === "save" ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button type="submit" disabled={busy} className={`${ghostClass} flex-1 sm:flex-none`}>
                    {pending === "draft" ? "Saving…" : "Save draft"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void run("publish")} className={`${primaryClass} flex-1 sm:flex-none`}>
                    {pending === "publish" ? "Publishing…" : "Publish"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : reviewing ? (
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={busy} onClick={() => setConfirmReject(true)} className={dangerClass}>
              Reject
            </button>
            <button type="submit" disabled={busy} className={ghostClass}>
              {pending === "save" ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={busy} onClick={() => void run("approve")} className={primaryClass}>
              {pending === "approve" ? "Approving…" : "Approve"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </form>
      {confirmReject && item && (
        <DeleteDialog
          heading="Reject testimonial?"
          title={def.itemTitle(item)}
          pending={pending === "reject"}
          onCancel={() => setConfirmReject(false)}
          onConfirm={() => void reject()}
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
    </>
  );
}

const submittedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish" };

// Read-only facts of a visitor submission; the email is deleted on approval.
function SubmissionDetails({ item }: { item: ContentItem }) {
  const headingId = useId();
  const language = typeof item.language === "string" ? LANGUAGES[item.language] : undefined;
  const rows: [string, string][] = [
    ["Email", typeof item.email === "string" ? item.email : "—"],
    ["Language", language ?? "—"],
    [
      "Submitted",
      typeof item.submittedAt === "string"
        ? submittedFormat.format(new Date(item.submittedAt))
        : "—",
    ],
  ];
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          Submission
        </h2>
        <span className="rounded-full bg-highlight/15 px-2.5 py-0.5 text-xs font-semibold text-highlight">
          Pending
        </span>
        {item.notified === false && (
          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
            Notification not sent
          </span>
        )}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface FieldProps {
  id: string;
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  slugPrefix?: string;
  slugFollows: boolean;
  onUnauthorized: () => void;
}

function Field({ id, field, value, error, onChange, slugPrefix, slugFollows, onUnauthorized }: FieldProps) {
  const errorId = `${id}-error`;
  const labelId = `${id}-label`;
  const a11y = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };
  const errorText = error && (
    <p id={errorId} className="text-sm text-red-300">
      {error}
    </p>
  );
  const text = typeof value === "string" ? value : "";
  const items = Array.isArray(value) ? value : [];

  if (field.kind === "boolean") {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="flex items-center gap-3 text-sm text-foreground">
          <input
            {...a11y}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="size-4 accent-primary"
          />
          {field.label}
        </label>
        {errorText}
      </div>
    );
  }

  const counter =
    field.kind === "text" || field.kind === "textarea" || field.kind === "markdown"
      ? field.maxLength && `${text.length} / ${field.maxLength}`
      : ARRAY_KINDS.has(field.kind)
        ? field.maxItems && `${items.length} / ${field.maxItems}`
        : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {field.kind === "references" ? (
          <span id={labelId} className="text-sm font-medium text-foreground">
            {field.label}
          </span>
        ) : (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {field.label}
          </label>
        )}
        {counter && <span className="text-xs text-muted-foreground">{counter}</span>}
      </div>
      {field.kind === "int" && (
        <input
          {...a11y}
          type="number"
          min={field.min}
          step={1}
          inputMode="numeric"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          className={inputClass}
        />
      )}
      {(field.kind === "text" || field.kind === "url" || field.kind === "date" || field.kind === "month") && (
        <input
          {...a11y}
          type={field.kind === "text" ? "text" : field.kind}
          inputMode={field.kind === "url" ? "url" : undefined}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {field.kind === "slug" && (
        <>
          <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
            {slugPrefix && (
              <span className="shrink-0 pl-3 text-sm whitespace-nowrap text-muted-foreground">
                {slugPrefix}
              </span>
            )}
            <input
              {...a11y}
              type="text"
              autoCapitalize="none"
              spellCheck={false}
              value={text}
              onChange={(event) => onChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 pl-1 text-sm text-foreground focus:outline-none"
            />
          </div>
          {slugFollows && (
            <span className="text-xs text-muted-foreground">Follows the title until you edit it.</span>
          )}
        </>
      )}
      {field.kind === "textarea" && (
        <textarea
          {...a11y}
          rows={5}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {field.kind === "markdown" && (
        <MarkdownEditor
          id={id}
          label={field.label}
          value={text}
          onChange={onChange}
          onUnauthorized={onUnauthorized}
          textareaProps={{
            "aria-invalid": a11y["aria-invalid"],
            "aria-describedby": a11y["aria-describedby"],
          }}
        />
      )}
      {field.kind === "file" && (
        <FileField
          id={id}
          field={field}
          value={text}
          onChange={onChange}
          onUnauthorized={onUnauthorized}
          inputProps={{
            "aria-invalid": a11y["aria-invalid"],
            "aria-describedby": a11y["aria-describedby"],
          }}
        />
      )}
      {(field.kind === "list" || field.kind === "tags") && (
        <ChipInput
          a11y={a11y}
          items={items.map(String)}
          maxItems={field.maxItems}
          maxLength={field.kind === "tags" ? field.maxLength : undefined}
          onChange={onChange}
        />
      )}
      {field.kind === "references" && (
        <ReferencesInput
          labelId={labelId}
          a11y={a11y}
          items={items as Reference[]}
          maxItems={field.maxItems}
          onChange={onChange}
        />
      )}
      {errorText}
    </div>
  );
}

interface ChipInputProps {
  a11y: React.InputHTMLAttributes<HTMLInputElement>;
  items: string[];
  maxItems?: number;
  maxLength?: number;
  onChange: (items: string[]) => void;
}

function ChipInput({ a11y, items, maxItems, maxLength, onChange }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const full = maxItems !== undefined && items.length >= maxItems;

  const add = () => {
    if (draft === "" || full) return;
    onChange([...items, draft]);
    setDraft("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((chip, index) => (
            <li
              key={`${chip}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm text-secondary-foreground"
            >
              <span className="truncate">{chip}</span>
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded-full px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          {...a11y}
          type="text"
          value={draft}
          disabled={full}
          maxLength={maxLength}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={full}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </div>
  );
}

interface Reference {
  title: string;
  url: string;
}

interface ReferencesInputProps {
  labelId: string;
  a11y: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };
  items: Reference[];
  maxItems?: number;
  onChange: (items: Reference[]) => void;
}

function ReferencesInput({ labelId, a11y, items, maxItems, onChange }: ReferencesInputProps) {
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
      {items.map((reference, index) => {
        const n = index + 1;
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
              className={`${inputClass} col-start-1`}
            />
            <input
              aria-label={`Reference ${n} URL`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={reference.url ?? ""}
              onChange={(event) => update(index, { url: event.target.value })}
              className={`${inputClass} col-start-1 sm:col-start-2 sm:row-start-1`}
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
      <button
        type="button"
        aria-label="Add reference"
        disabled={full}
        onClick={() => onChange([...items, { title: "", url: "" }])}
        className="self-start rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-60"
      >
        + Add reference
      </button>
    </div>
  );
}
