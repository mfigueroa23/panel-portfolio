"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { FilePickerDialog } from "@/components/files/file-picker-dialog";
import { useSession } from "@/components/session/session-provider";
import { errorMessage } from "@/lib/api";
import { markdownFor, type StoredFile } from "@/lib/files";
import { renderMarkdown } from "@/lib/markdown";
import { useMermaid } from "@/lib/mermaid";

type Mode = "split" | "write" | "preview";

const PREVIEW_DELAY_MS = 400;

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The preview got 401: the form offers the sign-in again. */
  onUnauthorized?: () => void;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
}

interface Edit {
  value: string;
  selection: [number, number];
}

// Each toolbar action turns (text, selection) into the new text and selection.
type Action = (value: string, start: number, end: number) => Edit;

function replace(value: string, start: number, end: number, text: string, select?: [number, number]): Edit {
  const next = value.slice(0, start) + text + value.slice(end);
  return { value: next, selection: select ?? [start + text.length, start + text.length] };
}

// Wraps the selection, or a placeholder that stays selected for typing over.
const wrap =
  (before: string, after: string, placeholder: string): Action =>
  (value, start, end) => {
    const inner = value.slice(start, end) || placeholder;
    const from = start + before.length;
    return replace(value, start, end, `${before}${inner}${after}`, [from, from + inner.length]);
  };

// A fenced block on its own lines.
const block =
  (open: string, placeholder: string): Action =>
  (value, start, end) => {
    const inner = value.slice(start, end) || placeholder;
    const lead = start === 0 || value[start - 1] === "\n" ? "" : "\n";
    return replace(value, start, end, `${lead}${open}\n${inner}\n\`\`\`\n`);
  };

const heading: Action = (value, start, end) => {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  if (value.startsWith("## ", lineStart)) return { value, selection: [start, end] };
  return { value: `${value.slice(0, lineStart)}## ${value.slice(lineStart)}`, selection: [start + 3, end + 3] };
};

const TOOLS: { label: string; content: ReactNode; named?: boolean; action: Action }[] = [
  { label: "Heading", content: "H2", action: heading },
  { label: "Bold", content: <span className="font-bold">B</span>, action: wrap("**", "**", "bold text") },
  {
    label: "Link",
    content: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
      </svg>
    ),
    action: wrap("[", "](https://)", "text"),
  },
  { label: "Code block", content: <span className="font-mono">&lt;/&gt;</span>, action: block("```", "code") },
  { label: "Mermaid", content: "Mermaid", named: true, action: block("```mermaid", "flowchart LR\n  A --> B") },
];

const MODES: [Mode, string][] = [
  ["split", "Split"],
  ["write", "Write"],
  ["preview", "Preview"],
];

const toolClass =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-foreground hover:bg-muted";

export function MarkdownEditor({ id, label, value, onChange, onUnauthorized, textareaProps }: Props) {
  const { token } = useSession();
  const [mode, setMode] = useState<Mode>("split");
  const [picking, setPicking] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  // Where the next insertion goes; kept while the file picker has the focus.
  const cursor = useRef<[number, number] | null>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  }, [onUnauthorized]);

  const showEditor = mode !== "preview";
  const showPreview = mode !== "write";

  function selection(): [number, number] {
    const element = textarea.current;
    if (element) return [element.selectionStart, element.selectionEnd];
    return [value.length, value.length];
  }

  function apply(action: Action, at: [number, number] = selection()) {
    const edit = action(value, at[0], at[1]);
    pendingSelection.current = edit.selection;
    onChange(edit.value);
  }

  // Puts the caret back after the controlled value changed.
  useLayoutEffect(() => {
    const target = pendingSelection.current;
    const element = textarea.current;
    if (!target || !element) return;
    pendingSelection.current = null;
    element.focus();
    element.setSelectionRange(target[0], target[1]);
  }, [value]);

  function insertFile(file: StoredFile) {
    setPicking(false);
    const snippet = markdownFor(file);
    apply((text, start, end) => replace(text, start, end, snippet), cursor.current ?? selection());
    cursor.current = null;
  }

  const [rendered, setRendered] = useState<{ html?: string; error?: string } | null>(null);
  const empty = value.trim() === "";

  // The API renders the preview (same renderer as the site), at most once per
  // pause in typing.
  useEffect(() => {
    if (!showPreview || empty) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await renderMarkdown(value, token);
      if (cancelled) return;
      if (result.ok) setRendered({ html: result.data.html });
      else {
        if (result.status === 401) unauthorized.current?.();
        setRendered({ error: `Preview unavailable: ${errorMessage(result)}` });
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, token, showPreview, empty]);

  const html = !empty && rendered?.html ? rendered.html : "";
  useMermaid(preview, html);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-2.5 py-2">
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5">
          {TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              aria-label={tool.named ? undefined : tool.label}
              onClick={() => apply(tool.action)}
              className={toolClass}
            >
              {tool.content}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              cursor.current = selection();
              setPicking(true);
            }}
            className={`${toolClass} gap-1 text-primary`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
            Insert file
          </button>
        </div>
        <div role="group" aria-label="Editor view" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {MODES.map(([option, name]) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`min-h-9 rounded-md px-3.5 text-sm text-muted-foreground aria-pressed:bg-secondary aria-pressed:font-semibold aria-pressed:text-secondary-foreground ${
                option === "split" ? "hidden lg:inline-block" : ""
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className={`grid grid-cols-1 ${mode === "split" ? "lg:grid-cols-2" : ""}`}>
        {showEditor && (
          <textarea
            {...textareaProps}
            ref={textarea}
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck
            className="min-h-80 w-full resize-y bg-background p-4 font-mono text-sm leading-relaxed text-foreground focus:outline-none lg:min-h-130"
          />
        )}
        {showPreview && (
          <div
            role="region"
            aria-label={`${label} preview`}
            className={`min-w-0 p-5 ${mode === "split" ? "border-t border-border lg:border-t-0 lg:border-l" : ""}`}
          >
            {html ? (
              <div
                ref={preview}
                data-testid="markdown-preview"
                className="md-preview"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div ref={preview} data-testid="markdown-preview" className="md-preview">
                {empty ? (
                  <p className="text-muted-foreground">Nothing to preview yet.</p>
                ) : rendered?.error ? (
                  <p role="alert" className="text-sm text-red-300">
                    {rendered.error}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Rendering preview…</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {picking && (
        <FilePickerDialog
          onPick={insertFile}
          onClose={() => {
            cursor.current = null;
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
