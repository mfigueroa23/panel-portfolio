"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ReauthDialog } from "@/components/auth/reauth-dialog";
import { useSession } from "@/components/session/session-provider";
import { errorMessage } from "@/lib/api";
import {
  COLLECTIONS,
  type CollectionKey,
  type ContentItem,
  type FieldDef,
} from "@/lib/collections";
import { createItem, updateItem, type ItemValues } from "@/lib/content";
import { validateItem } from "@/lib/validation";
import { useNotice } from "./notice-provider";

interface Props {
  collection: CollectionKey;
  /** The item being edited; omitted when creating. */
  item?: ContentItem;
}

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none aria-invalid:border-red-500";

function initialValues(fields: FieldDef[], item?: ContentItem): ItemValues {
  const values: ItemValues = {};
  for (const field of fields) {
    const value = item?.[field.name];
    if (value !== undefined) values[field.name] = value;
    else if (field.kind === "boolean") values[field.name] = false;
    else if (field.kind === "list") values[field.name] = [];
    else values[field.name] = "";
  }
  return values;
}

export function ItemForm({ collection, item }: Props) {
  const def = COLLECTIONS[collection];
  const router = useRouter();
  const { token, setToken } = useSession();
  const { notify } = useNotice();
  const formId = useId();
  // Values are only ever replaced by the owner's typing, never on failure.
  const [values, setValues] = useState(() => initialValues(def.fields, item));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reauth, setReauth] = useState(false);

  const setValue = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    const errors = validateItem(def.fields, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = item
      ? await updateItem(collection, item.id, values, token)
      : await createItem(collection, values, token);
    setPending(false);

    if (result.ok) {
      notify(item ? "Item updated." : "Item created.");
      router.push(`/${collection}`);
      router.refresh();
    } else if (result.status === 401) {
      setReauth(true);
    } else if (result.status === 404) {
      notify("This item no longer exists.");
      router.push(`/${collection}`);
      router.refresh();
    } else if (result.status === 400 && "fields" in result && result.fields) {
      setFieldErrors(
        Object.fromEntries(
          Object.entries(result.fields).map(([name, messages]) => [name, messages.join(" ")]),
        ),
      );
    } else {
      setBanner(errorMessage(result));
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-5">
        {banner && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {banner}
          </p>
        )}
        {def.fields.map((field) => (
          <Field
            key={field.name}
            id={`${formId}-${field.name}`}
            field={field}
            value={values[field.name]}
            error={fieldErrors[field.name]}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
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

interface FieldProps {
  id: string;
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

function Field({ id, field, value, error, onChange }: FieldProps) {
  const errorId = `${id}-error`;
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

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        {(field.kind === "text" || field.kind === "textarea") && field.maxLength && (
          <span className="text-xs text-muted-foreground">
            {typeof value === "string" ? value.length : 0} / {field.maxLength}
          </span>
        )}
        {field.kind === "list" && field.maxItems && (
          <span className="text-xs text-muted-foreground">
            {Array.isArray(value) ? value.length : 0} / {field.maxItems}
          </span>
        )}
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
      {field.kind === "text" && (
        <input
          {...a11y}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {field.kind === "textarea" && (
        <textarea
          {...a11y}
          rows={5}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {field.kind === "list" && (
        <ChipInput
          a11y={a11y}
          items={Array.isArray(value) ? value.map(String) : []}
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
  onChange: (items: string[]) => void;
}

function ChipInput({ a11y, items, maxItems, onChange }: ChipInputProps) {
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
