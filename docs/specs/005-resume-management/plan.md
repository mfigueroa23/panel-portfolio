# Plan 005 — Resume management

- **Spec:** [spec.md](spec.md) (approved 2026-10-18)
- **Status:** Approved
- **Version:** 5.1.0 (feat → minor)

The panel stays an api client (constitution §2): the resume calls go through `apiFetch` in a new `lib/resume.ts`, and uploads keep using `lib/upload.ts` through the existing file picker. The assignment types mirror the api DTO and are pinned by a test (§5), every behaviour change ships a Vitest test next to the code (§4), the session cookie stays `HttpOnly` in every mode (§7), and api errors are always shown (§8). The api contract is the one released in api v6.1.0 (api Plan 005), so `api` does not change. Nothing needs approval: no new dependency, no environment variable, and no change to `next.config.ts`, the `Dockerfile` or `.github/workflows/`.

## Endpoints

All of them already exist in api v6.1.0; the panel starts calling them.

| Method and route | Auth | Response | RF |
|---|---|---|---|
| `GET /resume/assignments` | Bearer | `{ en, es }`, each `{ file: StoredFile, assignedAt }` or `null`; 401 | RF-02 – RF-07, RF-21, RF-22 |
| `PUT /resume/assignments/:lang` body `{ fileId }` | Bearer | The full assignment (200); 400, 401, 404, 409 | RF-09 – RF-13, RF-19 – RF-22 |
| `DELETE /resume/assignments/:lang` | Bearer | 204; 401, 409 | RF-15, RF-17, RF-19 – RF-22 |
| `GET /resume?lang=en\|es` | — | The PDF; only linked to, never fetched by the panel | RF-06 |
| `GET /files/:id/references` (existing call) | Bearer | Now may include `{ collection: 'resume', id: 'en' \| 'es', title }` | RF-23, RF-24 |
| `DELETE /files/:id` (existing call) | Bearer | Now 409 `File is the current resume.` while assigned | RF-25 |

## Modules

### New: `lib/resume.ts` (resume api client)
| File | Responsibility | RF |
|---|---|---|
| `lib/resume.ts` | `ResumeLang` (`"en" \| "es"`), `RESUME_LANGS` (`["en", "es"]`, English first), `LANG_LABELS` (`English`, `Spanish`), the `ResumeAssignment` (`{ file: StoredFile; assignedAt: string }`) and `ResumeAssignments` (`Record<ResumeLang, ResumeAssignment \| null>`) types copied from the api DTO. `getAssignments(token)` (GET, `cache: "no-store"`), `assignResume(lang, fileId, token)` (PUT), `clearResume(lang, token)` (DELETE), all through `apiFetch` with the `lang` URL-encoded like `lib/files.ts`. `publicResumeUrl(lang)` builds `${API_URL}/resume?lang=<lang>` from `lib/config.ts`. | RF-02, RF-06, RF-09, RF-15 |
| `lib/resume.test.ts` | U-L1 – U-L5. | — |

### New: `app/(admin)/resume/` (Resume page)
| File | Responsibility | RF |
|---|---|---|
| `page.tsx` | Static segment like `app/(admin)/files/page.tsx` (so `[collection]` never receives `resume`), with `metadata` `Resume · Portfolio Panel`, a heading and `<ResumeManager />`. A Server Component that renders a client one. | RF-01, RF-02 |

### New: `components/resume/` (client components)
| File | Responsibility | RF |
|---|---|---|
| `resume-manager.tsx` | Loads the assignment with `getAssignments` and the token from `useSession()`, keyed by token like `FileLibrary` so a new sign-in reloads it. Holds the assignment, the language being picked, the language being cleared, a pending language and one error per language. Opens `FilePickerDialog` with `accept={["pdf"]}`; on pick or upload it closes the picker and calls `assignResume`. Opens `DeleteDialog` to confirm clearing. On 200/204 it replaces the shown assignment (with the returned one, or by setting the language to `null`) and calls `notify`. On 409 it reloads with `getAssignments`. On 401 from any call it opens `ReauthDialog` and keeps the state. While the load fails with another status it shows `errorMessage` in a `role="alert"` box with "Try again" and renders no sections. | RF-02, RF-07 – RF-12, RF-14 – RF-16, RF-19 – RF-22 |
| `resume-section.tsx` | One language card, presentational: heading (`English` / `Spanish`), the file's name, `formatSize`, the `assignedAt` date and an "Open PDF" link to `file.url` (`target="_blank" rel="noopener noreferrer"`), or the empty-state text (English: download unavailable; Spanish: visitors get the English resume). The public URL with "Copy link" (`navigator.clipboard`, as `FileLibrary.copy`) and "Open" links. Buttons "Choose PDF"/"Replace" and "Clear", disabled with an explanatory line by the ordering rules or while pending; no "Clear" without a file. The section's error in `role="alert"`. | RF-03 – RF-06, RF-08, RF-13, RF-17 – RF-20 |
| `resume-manager.test.tsx`, `resume-section.test.tsx` | U-C1 – U-C17. | — |

### Changed
| File | Change | RF |
|---|---|---|
| `lib/collections.ts` | `NAV_GROUPS` Media group gains `{ href: "/resume", label: "Resume" }` after Files. `NavLinks` already marks the active link by `pathname`, so it needs no change. | RF-01 |
| `lib/collections.test.ts`, `components/nav/sidebar.test.tsx`, `components/nav/mobile-nav.test.tsx` | Expect the Resume link in Media, and Resume as active on `/resume` (U-N1, U-N2). | RF-01 |
| `lib/files.ts` | `FileReference.id` widens to `number \| string` (api Plan 005 D10). | RF-23 |
| `components/files/delete-file-dialog.tsx` | A resume reference shows as `Resume · English`/`Resume · Spanish` from its `id` and `LANG_LABELS`. While any reference is a resume, "Delete file" is disabled and a line explains that the file must be replaced or cleared first, with a `Link` to `/resume`. The existing failure branch already shows `errorMessage` and does not call `onDeleted` on 409; a test pins it. | RF-23 – RF-25 |
| `components/files/delete-file-dialog.test.tsx` | U-C18 – U-C21. | — |
| `components/content/delete-dialog.tsx` | Two optional props, `confirmLabel` (default `Delete`) and `pendingLabel` (default `Deleting…`), so the clear confirmation reads "Clear"/"Clearing…". Current callers keep the defaults. | RF-14 |
| `app/actions/session.ts` | `createSession` sets `secure: process.env.NODE_ENV !== "development"`; the other attributes are unchanged. A comment explains that Safari drops `Secure` cookies on `http://localhost` (D9). | RF-26, RF-27 |
| `app/actions/session.test.ts` | U-S1 – U-S3; the existing "httpOnly, Secure, SameSite=Strict" test stays as the production (`test` env) case. | RF-26, RF-27, RF-29 |

### Infrastructure
| File | Change |
|---|---|
| `README.md` | Intro mentions the resume. New "Resume" section (the Resume page, the ordering rules, clearing with confirmation, the public link, the delete dialog). A note in Getting started that the dev server's cookie is not `Secure`, so Safari keeps the session on `http://localhost`, while every production build sends `Secure`. "The panel v5.1 needs the api v6.1 (resume endpoints): release the api first." |
| `package.json` | `version` → `5.1.0` in `chore(release): Bump version to v5.1.0`. |

## Data model

No schema: the panel has no database. The client types mirror the api DTO (`ResumeService.assignments`, api Plan 005):

```ts
// Mirror of the api's resume assignment (api Spec 005). A DTO change in `api`
// must update these types under the same spec.
export type ResumeLang = "en" | "es";
export interface ResumeAssignment {
  file: StoredFile; // { id, name, mime, size, createdAt, url }
  assignedAt: string; // ISO date
}
export type ResumeAssignments = Record<ResumeLang, ResumeAssignment | null>;
```

- Always both keys; `null` means no resume in that language.
- `es` can be non-null only while `en` is (api RF-08, RF-12), and the panel's ordering rules rely on that.

## Decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | The resume client and types live in a new `lib/resume.ts`, pinned by `lib/resume.test.ts` | Adding them to `lib/collections.ts` | `collections.ts` is the registry of content collections with field definitions and forms; the resume has neither. `lib/files.ts` already holds a non-collection contract (`StoredFile`, `FileReference`) with its own test, and the resume follows it (§5). |
| D2 | `ResumeManager` loads the assignment on the client, keyed by the session token | Loading it in the Server Component like `CollectionPage`, with `router.refresh()` after each change | RF-21 reloads after a 409 and RF-22 asks to sign in again while keeping the page, which `FileLibrary` already does on the client with `ReauthDialog` and `setToken`. A server load sends failures to `error.tsx` and 401s to a redirect, which loses the page (RF-22 says "change nothing"). |
| D3 | 401 opens `ReauthDialog` | `onUnauthorized()` (back to `/login?expired=1`), as `CollectionList` does | RF-22 asks to change nothing. The dialog keeps the open picker or confirmation state and, after `setToken`, the token-keyed load picks up the fresh session. |
| D4 | After a successful assign, the shown assignment is the api's response; after a clear, the language is set to `null` locally | Reloading `GET /resume/assignments` after every change | `PUT` already returns the full assignment (RF-10) and `DELETE` answers 204 with a known outcome (RF-15). A reload is kept for 409 only, the one case where the page is known to be stale (RF-21). |
| D5 | The PDF is chosen with the existing `FilePickerDialog` (`accept={["pdf"]}`), which lists only PDFs and uploads through `uploadFile` | A dedicated upload input on the Resume page | The picker already lists PDFs, validates type and size with `validateFile`, shows progress and returns the stored file through `onPick`/`onUploaded` (RF-08, RF-09). Closing it calls `onClose` and nothing else (RF-12). |
| D6 | The ordering rules are derived from the loaded assignment: Spanish "Choose PDF" is disabled while `en` is `null`, English "Clear" while `es` is not `null` | Leaving buttons enabled and relying on the api's 409 | The spec's decision (RF-13, RF-17). The 409 path stays for a stale page (RF-21). |
| D7 | The clear confirmation reuses `DeleteDialog` with new `confirmLabel`/`pendingLabel` props and the effect text in `title` | A new `ClearResumeDialog` | `DeleteDialog` already has the heading, cancel and pending states and its tests. Two optional props with today's defaults leave every caller as it is, while a copy would duplicate the markup and its accessibility. |
| D8 | Resume references in the delete dialog are labelled from their `id` (`en`/`es`) with `LANG_LABELS` | Showing the api's `title` (`English resume`) after `Resume ·` as for other collections | The api title would read "Resume · English resume". RF-23 asks for "Resume · English", and the `id` is the stable key (api Plan 005 D10). |
| D9 | `createSession` drops `Secure` only when `process.env.NODE_ENV === "development"` (`next dev`) | Deciding by the request's protocol (`x-forwarded-proto`) | The Docker image runs behind the Cloudflare tunnel and sees plain HTTP, so a protocol check would drop `Secure` in production and break RF-27. `next dev` always sets `development`, `next build`/`next start` always set `production`, and Vitest sets `test`, so anything that is not the dev server stays `Secure` (fail-safe). |
| D10 | Fix the cookie in code | Running the dev server with `next dev --experimental-https` | HTTPS in development needs a locally trusted certificate in Safari and `https://localhost:3000` added to the Google OAuth client and the local `cors_origin` table, and it changes the `dev` script for everyone. The spec only asks the dev server to keep the session (RF-26, RF-28). |
| D11 | `deleteSession` and the `proxy.ts` expiry redirect stay as they are | Passing the cookie attributes to `delete` | Per the Next 16 docs, `cookies().delete(name)` only needs the same domain and protocol as the `set`, which holds on the dev server, so logout and expiry already clear the non-`Secure` cookie (RF-29). A test pins it. |
| D12 | The public URL is shown per language as `${API_URL}/resume?lang=<lang>`, including `?lang=en` | Showing `/resume` without `lang` for English | Both serve English (api RF-14), but an explicit `lang` makes the two links read the same and says which one each section copies (RF-06). |

## RF coverage

| RF | Where | Tests |
|---|---|---|
| RF-01 | `NAV_GROUPS` in `lib/collections.ts`; `NavLinks` (unchanged) | U-N1, U-N2 |
| RF-02 | `getAssignments`; `ResumeManager` load; `app/(admin)/resume/page.tsx` | U-L1, U-C1 |
| RF-03 | `ResumeSection` file details | U-C2 |
| RF-04, RF-05 | `ResumeSection` empty states | U-C3 |
| RF-06 | `publicResumeUrl`; `ResumeSection` copy and open | U-L4, U-C4 |
| RF-07 | `ResumeManager` load failure | U-C5 |
| RF-08 | `ResumeManager` → `FilePickerDialog accept={["pdf"]}` | U-C6 |
| RF-09, RF-10 | `assignResume`; `ResumeManager` on pick or upload | U-L2, U-C7 |
| RF-11 | `ResumeManager` only calls `assignResume` on replace | U-C8 |
| RF-12 | Picker `onClose` | U-C9 |
| RF-13 | `ResumeSection` disabled Spanish choose (D6) | U-C10 |
| RF-14, RF-16 | `ResumeManager` + `DeleteDialog` labels (D7) | U-C11, U-C12 |
| RF-15 | `clearResume`; `ResumeManager` on 204 | U-L3, U-C11 |
| RF-17, RF-18 | `ResumeSection` English clear disabled / no clear without file (D6) | U-C10 |
| RF-19 | `ResumeManager` pending language | U-C13 |
| RF-20 | `ResumeManager` section error | U-C14 |
| RF-21 | `ResumeManager` reload on 409 | U-C15 |
| RF-22 | `ResumeManager` → `ReauthDialog` (D3) | U-C16, U-C17 |
| RF-23 | `DeleteFileDialog` resume labels (D8); `FileReference.id` | U-C18 |
| RF-24 | `DeleteFileDialog` disabled delete and link | U-C19 |
| RF-25 | `DeleteFileDialog` failure branch | U-C20, U-C21 |
| RF-26, RF-27 | `createSession` (D9) | U-S1, U-S2, manual check |
| RF-28 | Cookie stored by Safari on the dev server | Manual check (jsdom has no cookie jar or Safari rules) |
| RF-29 | `deleteSession` (D11) | U-S3, manual check |

## Test strategy

Unit and component tests with Vitest and Testing Library (jsdom), mocking `fetch` the way `lib/files.test.ts` and `components/files/*.test.tsx` do (`jsonResponse`, `API_URL` = `http://api.test`). `FilePickerDialog` is mocked in the manager tests with a stub that exposes pick, upload and close buttons, so they do not depend on the library's own fetches. The panel has no e2e suite.

**Lib (`lib/resume.test.ts`)**
- U-L1 — `getAssignments` sends `GET http://api.test/resume/assignments` with `Authorization: Bearer <token>` and `cache: "no-store"`, and returns `{ en, es }` as received.
- U-L2 — `assignResume("es", id, token)` sends `PUT /resume/assignments/es` with the JSON body `{ fileId }` and the token.
- U-L3 — `clearResume("en", token)` sends `DELETE /resume/assignments/en` with the token; 204 is `{ ok: true }`.
- U-L4 — `publicResumeUrl` returns `http://api.test/resume?lang=en` and `…?lang=es`.
- U-L5 — `RESUME_LANGS` is `["en", "es"]` and a sample api payload type-checks as `ResumeAssignments` (the contract pin, §5); 400/404/409 bodies come back as `{ ok: false, status, error }`.

**Components (`components/resume/*.test.tsx`)**
- U-C1 — The page loads the assignment with the token and shows English before Spanish.
- U-C2 — An assigned language shows the file name, size, assignment date and an "Open PDF" link to `file.url` with `target="_blank"`.
- U-C3 — Empty English says the download is unavailable; empty Spanish says visitors get the English resume.
- U-C4 — Each section shows its public URL; "Copy link" writes it to `navigator.clipboard` and notifies; "Open" links to it in a new tab.
- U-C5 — A failed load (500 with `{ error }`, and status 0) shows the message in an alert and no Choose/Replace/Clear buttons; "Try again" reloads.
- U-C6 — "Choose PDF" opens the picker with `accept` `["pdf"]`; with a file assigned the button reads "Replace".
- U-C7 — Picking a file sends `PUT` for that language, shows the returned assignment in both sections and notifies "Resume updated."; the same for a file uploaded through the picker.
- U-C8 — Replacing sends exactly one request, the `PUT`, and never `DELETE /files/:id`.
- U-C9 — Closing the picker sends no request and leaves both sections unchanged.
- U-C10 — With no English, Spanish "Choose PDF" is disabled with its hint; with Spanish assigned, English "Clear" is disabled with its hint; a section without a file has no "Clear".
- U-C11 — "Clear" opens a confirmation with the effect text for that language and "stays in Files"; confirming sends `DELETE`, shows the empty state and notifies.
- U-C12 — Cancelling the confirmation sends no request and keeps the file shown.
- U-C13 — While a `PUT` or `DELETE` is pending, that section's buttons are disabled and the other section's are not.
- U-C14 — A 400/404 on assign and a 500 on clear show the api's message in that section and keep the previous file; status 0 shows the connection error.
- U-C15 — A 409 on assign or clear shows the message and calls `GET /resume/assignments` again, then shows the reloaded state.
- U-C16 — A 401 on load opens the sign-in dialog; after a new token the assignment is loaded with it.
- U-C17 — A 401 on assign or clear opens the sign-in dialog and leaves the shown assignment unchanged.

**Delete dialog (`components/files/delete-file-dialog.test.tsx`)**
- U-C18 — References `{ collection: "resume", id: "en" }` and `id: "es"` show as "Resume · English" and "Resume · Spanish", next to other references.
- U-C19 — With a resume reference, "Delete file" is disabled and the dialog links to `/resume`; without one it is enabled as today.
- U-C20 — A 409 from `DELETE /files/:id` shows `File is the current resume.` and does not call `onDeleted`.
- U-C21 — `DeleteDialog` without the new props still reads "Delete"/"Deleting…" (current callers unchanged), and with them "Clear"/"Clearing…".

**Navigation (`lib/collections.test.ts`, `components/nav/*.test.tsx`)**
- U-N1 — `NAV_GROUPS` Media is `[Files, Resume]` with `/files` and `/resume`; the sidebar and the drawer render the link.
- U-N2 — On `/resume` the Resume link has `aria-current="page"` and Files does not.

**Session (`app/actions/session.test.ts`)**
- U-S1 — With `vi.stubEnv("NODE_ENV", "development")`, `createSession` sets the cookie with `secure: false`, `httpOnly: true`, `sameSite: "strict"`, `path: "/"` and `maxAge` = seconds left.
- U-S2 — With `NODE_ENV` `production` (and with the default `test`), `secure` is `true` and every other attribute is as today.
- U-S3 — In `development`, `deleteSession` deletes `panel_session`.

**Not covered automatically:** jsdom has no cookie jar and no Safari, so whether Safari stores the cookie and keeps the session across reloads (RF-28) and the real logout (RF-29) are checked by hand. The same goes for the public link serving the new PDF after a replace, which depends on the api's caching.

## Implementation order

1. `app/actions/session.ts` with U-S1 – U-S3 (D9, D11). Independent, and it makes the rest testable in Safari.
2. `lib/resume.ts` with U-L1 – U-L5 (D1, D12).
3. `lib/files.ts` (`FileReference.id`) and `components/files/delete-file-dialog.tsx` with U-C18 – U-C20 (D8).
4. `components/content/delete-dialog.tsx` labels with U-C21 (D7).
5. `components/resume/resume-section.tsx`, then `resume-manager.tsx`, with U-C1 – U-C17 (D2 – D6).
6. `app/(admin)/resume/page.tsx` and the `NAV_GROUPS` link with U-N1, U-N2.
7. `README.md`, then `pnpm lint`, `pnpm test`, `pnpm build`, and the manual check.
8. `chore(release): Bump version to v5.1.0`.

## Release

1. Check that api ≥ 6.1.0 is live (`GET /resume/assignments` answers 401 without a token, not 404). Its `resume` migration was deployed with the api.
2. Merge to `main`: Vercel deploys the panel and `Panel Tests` must pass first. The fallback image from `release.yaml` needs no change.
3. Sign in on production, open Resume, assign the English PDF (then Spanish, if any), and open both public links.
4. In the browser's developer tools, check that the production `panel_session` cookie is still `HttpOnly`, `Secure`, `SameSite=Strict`.
5. Tag `5.1.0` after the merge (`chore(release): Version 5.1.0`).

## Risks

- **A `development` NODE_ENV in a production deploy would drop `Secure`.** `next build`/`next start` always set `production`, and Vercel and the Dockerfile do not override it. U-S2 pins the production case, and release step 4 checks it on the live site.
- **The api's resume contract drifts** (field names, the `title`/`id` of references). The types are pinned by U-L5 and the dialog labels by U-C18. A later api change has to update `lib/resume.ts` under its own spec (§5).
- **A stale page after editing in another tab.** The panel's guards use the loaded state. The api's 409 and the reload on 409 (RF-21, U-C15) bring the page back in line.
- **The clipboard is unavailable** (non-secure context, denied permission). "Copy link" notifies "Could not copy the link." as `FileLibrary` does, and the URL stays visible to copy by hand.
