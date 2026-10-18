# Tasks 005 — Resume management

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `U-*` = tests listed in the plan's test strategy (the panel has no e2e suite).

## Phase 0 — Gate

- [x] **T01 — Record the approvals**
  - **RF:** —
  - **Depends on:** —
  - **Scope:** The owner approved the spec and the plan on 2026-10-18, including D7 (`DeleteDialog` gains `confirmLabel`/`pendingLabel`) and D8 (resume references labelled from their `id`). Set `Status: Approved` in `spec.md` and `plan.md`. Check that api ≥ 6.1.0 runs locally for the manual checks.
  - **Done when:** `grep -n 'Status' spec.md plan.md` shows `Approved` in both, and a local api answers `GET /resume/assignments` with 401 without a token (not 404).

## Phase 1 — Foundations

- [x] **T02 — Keep the session cookie in Safari on the dev server**
  - **RF:** RF-26, RF-27, RF-29
  - **Depends on:** T01 (can run in parallel with T03 and T04)
  - **Scope:** In `app/actions/session.ts`, `createSession` sets `secure: process.env.NODE_ENV !== "development"`, with a comment on Safari and `http://localhost` (D9). `deleteSession` and `proxy.ts` stay as they are (D11). Add the cases to `app/actions/session.test.ts` with `vi.stubEnv`, and keep the existing Secure test as the `test` env case.
  - **Done when:** `pnpm test app/actions/session.test.ts` passes with U-S1, U-S2 and U-S3.

- [x] **T03 — Resume api client**
  - **RF:** RF-02, RF-06, RF-09, RF-15
  - **Depends on:** T01 (can run in parallel with T02 and T04)
  - **Scope:** New `lib/resume.ts` with `ResumeLang`, `RESUME_LANGS`, `LANG_LABELS`, the `ResumeAssignment`/`ResumeAssignments` types that mirror the api DTO (§5), `getAssignments`, `assignResume`, `clearResume` through `apiFetch`, and `publicResumeUrl(lang)` with an explicit `?lang=` (D1, D12). Tests in `lib/resume.test.ts`, mocking `fetch` as `lib/files.test.ts` does.
  - **Done when:** `pnpm test lib/resume.test.ts` passes with U-L1 – U-L5.

- [ ] **T04 — Custom labels for `DeleteDialog`**
  - **RF:** RF-14
  - **Depends on:** T01 (can run in parallel with T02 and T03)
  - **Scope:** `components/content/delete-dialog.tsx` gains the optional `confirmLabel` (default `Delete`) and `pendingLabel` (default `Deleting…`) props (D7). Current callers (`CollectionList`, testimonial reject) stay untouched.
  - **Done when:** `pnpm test components/content` passes, including U-C21 and the existing `CollectionList` and `ItemForm` tests unchanged.

## Phase 2 — File library integration

- [ ] **T05 — Resume references in the file delete dialog**
  - **RF:** RF-23, RF-24, RF-25
  - **Depends on:** T03
  - **Scope:** `FileReference.id` in `lib/files.ts` widens to `number | string`. `components/files/delete-file-dialog.tsx` labels `collection: "resume"` references `Resume · English`/`Resume · Spanish` from `id` and `LANG_LABELS` (D8), disables "Delete file" while any reference is a resume, and explains it with a `Link` to `/resume`. A test pins that the existing failure branch shows the 409 message without calling `onDeleted`.
  - **Done when:** `pnpm test components/files/delete-file-dialog.test.tsx` passes with U-C18, U-C19 and U-C20, and the existing cases still pass.

## Phase 3 — Resume page

- [ ] **T06 — Resume language section**
  - **RF:** RF-03, RF-04, RF-05, RF-06, RF-13, RF-17, RF-18
  - **Depends on:** T03
  - **Scope:** New presentational `components/resume/resume-section.tsx`: heading, file name, `formatSize`, assignment date, "Open PDF" in a new tab, or the empty-state text per language. The public URL with "Copy link" (`navigator.clipboard` + `notify`, as `FileLibrary.copy`) and "Open". "Choose PDF"/"Replace" and "Clear" disabled with their hints by the ordering rules (D6), no "Clear" without a file, disabled while pending, and an error slot in `role="alert"`. Tests in `components/resume/resume-section.test.tsx`.
  - **Done when:** `pnpm test components/resume/resume-section.test.tsx` passes with U-C2, U-C3, U-C4 and U-C10.

- [ ] **T07 — Load the assignment in `ResumeManager`**
  - **RF:** RF-02, RF-07, RF-22
  - **Depends on:** T06
  - **Scope:** New client `components/resume/resume-manager.tsx`. It loads with `getAssignments` and the `useSession()` token, keyed by token like `FileLibrary` (D2), and renders English then Spanish. A load failure shows `errorMessage` in an alert with "Try again" and no sections. A 401 opens `ReauthDialog`, and `setToken` reloads (D3). Tests in `components/resume/resume-manager.test.tsx`.
  - **Done when:** `pnpm test components/resume/resume-manager.test.tsx` passes with U-C1, U-C5 and U-C16.

- [ ] **T08 — Assign and replace from the picker**
  - **RF:** RF-08, RF-09, RF-10, RF-11, RF-12
  - **Depends on:** T07
  - **Scope:** "Choose PDF"/"Replace" opens `FilePickerDialog` with `accept={["pdf"]}` (D5). On pick or upload, the manager closes the picker, calls `assignResume` and shows the returned assignment with the notice "Resume updated." (D4). Closing the picker sends nothing. The tests mock `FilePickerDialog` with a stub that exposes pick, upload and close.
  - **Done when:** `pnpm test components/resume/resume-manager.test.tsx` passes with U-C6, U-C7, U-C8 and U-C9.

- [ ] **T09 — Clear with confirmation**
  - **RF:** RF-14, RF-15, RF-16
  - **Depends on:** T04, T08
  - **Scope:** "Clear" opens `DeleteDialog` with the heading `Clear the <language> resume?`, the effect text for that language plus "The PDF stays in Files." as `title`, and the labels `Clear`/`Clearing…` (D7). Confirming calls `clearResume`, sets the language to `null` and notifies; cancelling sends nothing (D4).
  - **Done when:** `pnpm test components/resume/resume-manager.test.tsx` passes with U-C11 and U-C12.

- [ ] **T10 — Pending, errors, 409 reload and 401 on changes**
  - **RF:** RF-19, RF-20, RF-21, RF-22
  - **Depends on:** T09
  - **Scope:** In `ResumeManager`, track the pending language and disable only that section. A failed assign or clear shows the error in its section and keeps the shown state. A 409 also reloads with `getAssignments`. A 401 opens `ReauthDialog` without changing the state (D3).
  - **Done when:** `pnpm test components/resume/resume-manager.test.tsx` passes with U-C13, U-C14, U-C15 and U-C17.

## Phase 4 — Integration

- [ ] **T11 — Resume page and navigation link**
  - **RF:** RF-01, RF-02
  - **Depends on:** T10
  - **Scope:** New `app/(admin)/resume/page.tsx`, a static segment like `app/(admin)/files/page.tsx`, with the metadata `Resume · Portfolio Panel`, a heading and `<ResumeManager />`. Add `{ href: "/resume", label: "Resume" }` after Files in the Media group of `NAV_GROUPS` (`lib/collections.ts`), and update `lib/collections.test.ts`, `components/nav/sidebar.test.tsx` and `components/nav/mobile-nav.test.tsx`.
  - **Done when:** `pnpm test lib/collections.test.ts components/nav` passes with U-N1 and U-N2, and `pnpm dev` serves `/resume` with Resume marked as active.

## Phase 5 — Documentation, verification and release

- [ ] **T12 — README**
  - **RF:** —
  - **Depends on:** T02, T05, T11
  - **Scope:** In `README.md`: mention the resume in the intro. Add a "Resume" section covering the page, the ordering rules, clearing with confirmation, the public link and the delete dialog. Add a Getting started note that the dev server's cookie is not `Secure` so Safari keeps the session, while production builds send `Secure`. Add "The panel v5.1 needs the api v6.1 (resume endpoints): release the api first."
  - **Done when:** `README.md` has the Resume section, the Safari note and the api v6.1 release line.

- [ ] **T13 — Quality gate**
  - **RF:** —
  - **Depends on:** T12
  - **Scope:** Run the `AGENTS.md` checks on the whole branch.
  - **Done when:** `pnpm lint` reports 0 errors, `pnpm test` passes (U-L1 – U-L5, U-C1 – U-C21, U-N1, U-N2, U-S1 – U-S3 included) without a running api, and `pnpm build` finishes with 0 type errors.

- [ ] **T14 — Manual end-to-end check**
  - **RF:** RF-28, RF-29 (plus a smoke test of RF-01 – RF-25)
  - **Depends on:** T13
  - **Scope:** Against the local api 6.1.0, in Safari on `pnpm dev`:
    - Sign in, reload `/resume` and open it in a new tab without being asked to sign in.
    - Upload and assign an English PDF and open its public URL.
    - Assign a Spanish PDF and see English "Clear" disabled.
    - Replace English and see the new PDF at the same public URL.
    - Clear Spanish after confirming.
    - In Files, see "Delete file" disabled for the English PDF, with "Resume · English" listed.
    - Log out and see a reload go to `/login`.
    - On a production build (`pnpm build && pnpm start`), check in the developer tools that `panel_session` is `HttpOnly`, `Secure` and `SameSite=Strict`.
  - **Done when:** every step above behaves as described; record the result in the PR description.

- [ ] **T15 — Bump the version**
  - **RF:** —
  - **Depends on:** T14
  - **Scope:** `version` in `package.json` → `5.1.0`.
  - **Done when:** the commit `chore(release): Bump version to v5.1.0` changes only `package.json`, and `pnpm build` still passes.

## RF → tasks
| RF | Tasks |
|---|---|
| RF-01 | T11, T14 |
| RF-02 | T03, T07, T11 |
| RF-03, RF-04, RF-05 | T06 |
| RF-06 | T03, T06 |
| RF-07 | T07 |
| RF-08 | T08 |
| RF-09 | T03, T08 |
| RF-10, RF-11, RF-12 | T08 |
| RF-13 | T06 |
| RF-14 | T04, T09 |
| RF-15 | T03, T09 |
| RF-16 | T09 |
| RF-17, RF-18 | T06 |
| RF-19, RF-20, RF-21 | T10 |
| RF-22 | T07, T10 |
| RF-23, RF-24, RF-25 | T05 |
| RF-26, RF-27 | T02 |
| RF-28 | T14 |
| RF-29 | T02, T14 |
