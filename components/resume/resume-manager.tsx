"use client";

import { useEffect, useRef, useState } from "react";
import { ReauthDialog } from "@/components/auth/reauth-dialog";
import { DeleteDialog } from "@/components/content/delete-dialog";
import { useNotice } from "@/components/content/notice-provider";
import { ghostButton } from "@/components/files/file-library";
import { FilePickerDialog } from "@/components/files/file-picker-dialog";
import { useSession } from "@/components/session/session-provider";
import { errorMessage, type ApiFailure, type ApiResult } from "@/lib/api";
import type { StoredFile } from "@/lib/files";
import {
  LANG_LABELS,
  RESUME_LANGS,
  assignResume,
  clearResume,
  getAssignments,
  type ResumeAssignments,
  type ResumeLang,
} from "@/lib/resume";
import { ResumeSection } from "./resume-section";

const CLEAR_EFFECT: Record<ResumeLang, string> = {
  en: "The public download will stop working until another English PDF is assigned.",
  es: "Visitors of the Spanish site will get the English resume.",
};

type PerLang<T> = Record<ResumeLang, T>;

const NOT_PENDING: PerLang<boolean> = { en: false, es: false };
const NO_ERRORS: PerLang<string | null> = { en: null, es: null };

// Loaded on the client, keyed by the session token like FileLibrary, so a 409
// can reload in place and a new sign-in picks up the fresh token (plan D2, D3).
export function ResumeManager() {
  const { token, setToken } = useSession();
  const { notify } = useNotice();
  // Bumped by "Try again" and after a 409 to load the assignment again.
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ data?: ResumeAssignments; error?: ApiFailure } | null>(
    null,
  );
  const [pending, setPending] = useState(NOT_PENDING);
  const [errors, setErrors] = useState(NO_ERRORS);
  const [picking, setPicking] = useState<ResumeLang | null>(null);
  const [clearing, setClearing] = useState<ResumeLang | null>(null);
  const [reauth, setReauth] = useState(false);
  // Counts successful changes, so a load that started before one never
  // overwrites what the change returned.
  const writes = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = writes.current;
    void getAssignments(token).then((result) => {
      if (cancelled || writes.current !== startedAt) return;
      if (result.ok) setLoaded({ data: result.data });
      else {
        setLoaded({ error: result });
        if (result.status === 401) setReauth(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  async function change<T>(
    lang: ResumeLang,
    request: () => Promise<ApiResult<T>>,
    onSuccess: (data: T) => void,
  ) {
    setPending((state) => ({ ...state, [lang]: true }));
    setErrors((state) => ({ ...state, [lang]: null }));
    const result = await request();
    setPending((state) => ({ ...state, [lang]: false }));
    if (result.ok) {
      writes.current += 1;
      onSuccess(result.data);
    } else if (result.status === 401) {
      setReauth(true);
    } else {
      setErrors((state) => ({ ...state, [lang]: errorMessage(result) }));
      // The page was stale (another tab changed it): show what the api has.
      if (result.status === 409) setAttempt((n) => n + 1);
    }
  }

  function assign(lang: ResumeLang, file: StoredFile) {
    setPicking(null);
    // The previous file stays in the library; only the assignment changes.
    void change(lang, () => assignResume(lang, file.id, token), (data) => {
      setLoaded({ data });
      notify("Resume updated.");
    });
  }

  async function clear(lang: ResumeLang) {
    await change(lang, () => clearResume(lang, token), () => {
      setLoaded((state) => (state?.data ? { data: { ...state.data, [lang]: null } } : state));
      notify("Resume cleared.");
    });
    setClearing(null);
  }

  const data = loaded?.data;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {loaded?.error && loaded.error.status !== 401 && (
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage(loaded.error)}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoaded(null);
              setAttempt((n) => n + 1);
            }}
            className={ghostButton}
          >
            Try again
          </button>
        </div>
      )}

      {!loaded && <p className="text-sm text-muted-foreground">Loading the resume…</p>}

      {data &&
        RESUME_LANGS.map((lang) => (
          <ResumeSection
            key={lang}
            lang={lang}
            assignments={data}
            pending={pending[lang]}
            error={errors[lang]}
            onChoose={() => setPicking(lang)}
            onClear={() => setClearing(lang)}
          />
        ))}

      {picking && (
        <FilePickerDialog
          accept={["pdf"]}
          onPick={(file) => assign(picking, file)}
          onClose={() => setPicking(null)}
        />
      )}
      {clearing && (
        <DeleteDialog
          heading={`Clear the ${LANG_LABELS[clearing]} resume?`}
          title={`${CLEAR_EFFECT[clearing]} The PDF stays in Files.`}
          confirmLabel="Clear"
          pendingLabel="Clearing…"
          pending={pending[clearing]}
          onCancel={() => setClearing(null)}
          onConfirm={() => void clear(clearing)}
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
