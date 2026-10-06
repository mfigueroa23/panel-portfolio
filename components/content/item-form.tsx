"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ReauthDialog } from "@/components/auth/reauth-dialog";
import { usePendingCount } from "@/components/nav/pending-count-provider";
import { useSession } from "@/components/session/session-provider";
import { errorMessage, type ApiResult } from "@/lib/api";
import {
  COLLECTIONS,
  spanishTwin,
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
import { ReferencesField, type Reference } from "./references-field";
import { StatusBadge } from "./status-badge";

interface Props {
  collection: CollectionKey;
  /** The item being edited; omitted when creating. */
  item?: ContentItem;
}

type Intent = "save" | "draft" | "publish" | "unpublish" | "approve" | "reject";
type Lang = "en" | "es";

const TABS: [Lang, string][] = [
  ["en", "English"],
  ["es", "Spanish"],
];

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

// What the Spanish tab shows: the Spanish slug and the Spanish version of each
// bilingual field (references edit their rows' `titleEs`).
function spanishFields(fields: FieldDef[]): FieldDef[] {
  return fields.flatMap((field) => {
    if (field.spanishOnly) return [field];
    if (!field.bilingual) return [];
    return [field.kind === "references" ? field : spanishTwin(field)];
  });
}

// Every value the form keeps and sends: the fields plus their Spanish twins.
function valueFields(fields: FieldDef[]): FieldDef[] {
  return fields.flatMap((field) =>
    field.bilingual && field.kind !== "references" ? [field, spanishTwin(field)] : [field],
  );
}

// The English field whose value the Spanish tab shows as a hint.
function englishName(field: FieldDef): string | undefined {
  if (field.kind === "references") return undefined;
  return field.name.endsWith("Es") ? field.name.slice(0, -2) : undefined;
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
    if (field.kind === "references" && field.bilingual && Array.isArray(value)) {
      payload[field.name] = (value as Reference[]).map((row) => ({
        ...row,
        titleEs: row.titleEs ? row.titleEs : null,
      }));
    }
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
  const englishTab = fields.filter((field) => !field.spanishOnly);
  const spanishTab = spanishFields(fields);
  const bilingual = spanishTab.length > 0;
  const spanishNames = new Set(
    spanishTab.filter((field) => field.kind !== "references").map((field) => field.name),
  );
  const router = useRouter();
  const { token, setToken } = useSession();
  const { notify } = useNotice();
  const { refresh: refreshPendingCount } = usePendingCount();
  const formId = useId();
  // Values are only ever replaced by the owner's typing, never on failure.
  const [values, setValues] = useState(() => initialValues(valueFields(fields), item));
  // Both tabs edit the one `values` state, so switching never loses input.
  const [tab, setTab] = useState<Lang>("en");
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
  // The Spanish slug follows the Spanish title the same way, unless the item
  // was published with one.
  const hasSlugEs = def.fields.some((field) => field.name === "slugEs");
  const [slugEsFollows, setSlugEsFollows] = useState(
    hasSlugEs && !(item?.publishedAt && item?.slugEs),
  );
  const published = item?.status === "published";
  // A visitor submission waiting for review: Save / Approve / Reject.
  const reviewing = def.reviewable === true && item?.status === "pending";

  const setValue = (name: string, value: unknown) =>
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "title" && slugFollows && typeof value === "string") {
        next.slug = slugify(value);
      }
      if (name === "titleEs" && slugEsFollows && typeof value === "string") {
        next.slugEs = slugify(value);
      }
      return next;
    });

  // Shows field errors; when none of them is in the open tab, opens the other.
  function showErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const names = Object.keys(errors);
    if (!bilingual || names.length === 0) return;
    const visible = (name: string) =>
      name === "references" || spanishNames.has(name) === (tab === "es");
    if (!names.some(visible)) setTab(tab === "es" ? "en" : "es");
  }

  function failed(result: Extract<ApiResult<unknown>, { ok: false }>) {
    if (result.status === 401) {
      setReauth(true);
    } else if (result.status === 404) {
      notify("This item no longer exists.");
      router.push(`/${collection}`);
      router.refresh();
    } else if ((result.status === 400 || result.status === 409) && "fields" in result && result.fields) {
      showErrors(toFieldErrors(result.fields));
    } else if (result.status === 409 && hasSlug) {
      showErrors({ slug: errorMessage(result) });
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
    showErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(intent);
    try {
      const payload = toPayload(valueFields(fields), values);
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
        {bilingual && (
          <div role="tablist" aria-label="Language" className="flex gap-1 border-b border-border">
            {TABS.map(([lang, name]) => (
              <button
                key={lang}
                id={`${formId}-tab-${lang}`}
                type="button"
                role="tab"
                aria-selected={tab === lang}
                aria-controls={`${formId}-panel`}
                onClick={() => setTab(lang)}
                className={`-mb-px min-h-11 border-b-2 px-4 text-sm ${
                  tab === lang
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <div
          id={`${formId}-panel`}
          role={bilingual ? "tabpanel" : undefined}
          aria-labelledby={bilingual ? `${formId}-tab-${tab}` : undefined}
          className={`grid min-w-0 grid-cols-1 gap-5 ${wide ? "lg:grid-cols-2" : ""}`}
        >
          {(tab === "es" ? spanishTab : englishTab).map((field) => {
            const english = englishName(field);
            const hint = tab === "es" && english ? values[english] : undefined;
            return (
              <div key={field.name} className={`min-w-0 ${WIDE_KINDS.has(field.kind) ? "lg:col-span-2" : ""}`}>
                <Field
                  id={`${formId}-${field.name}`}
                  field={field}
                  value={values[field.name]}
                  error={fieldErrors[field.name]}
                  hint={typeof hint === "string" && hint !== "" ? hint : undefined}
                  lang={tab}
                  onChange={(value) => {
                    if (field.name === "slugEs") setSlugEsFollows(false);
                    else if (field.kind === "slug") setSlugFollows(false);
                    setValue(field.name, value);
                  }}
                  slugPrefix={def.publicBase ? `${def.publicBase}/` : undefined}
                  slugFollows={field.name === "slugEs" ? slugEsFollows : slugFollows}
                  onUnauthorized={() => setReauth(true)}
                />
              </div>
            );
          })}
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
  /** Spanish tab: the English value, shown under the input. */
  hint?: string;
  lang: Lang;
  onChange: (value: unknown) => void;
  slugPrefix?: string;
  slugFollows: boolean;
  onUnauthorized: () => void;
}

function Field({
  id,
  field,
  value,
  error,
  hint,
  lang,
  onChange,
  slugPrefix,
  slugFollows,
  onUnauthorized,
}: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const labelId = `${id}-label`;
  const a11y = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : hint ? hintId : undefined,
  };
  const hintText = hint && (
    <p id={hintId} className="line-clamp-2 text-xs break-words text-muted-foreground">
      English: {hint}
    </p>
  );
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
        <ReferencesField
          labelId={labelId}
          a11y={a11y}
          items={items as Reference[]}
          maxItems={field.maxItems}
          lang={lang}
          onChange={onChange}
        />
      )}
      {hintText}
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
