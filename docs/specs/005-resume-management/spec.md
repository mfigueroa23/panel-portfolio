# Spec 005 — Resume management

- **Status:** Approved
- **Date:** 2026-10-18
- **Scope:** `panel` only (builds on api Spec 005, released in api v6.1.0), plus the session cookie in local development

## Why

The api now keeps one current resume PDF per language and serves it at a stable public URL that never changes when the PDF is replaced (api Spec 005). The panel has no screen for it, so the owner can only assign, replace or clear the resume with hand-written HTTP calls carrying the admin token. Until the panel offers it, keeping the site's resume current is error-prone and out of reach from the place where the rest of the content is edited.

The file library is also unaware of the resume: it offers to delete a PDF that the api will refuse to delete because it is a current resume, and it does not explain why.

Separately, signing in on the development server (`pnpm dev`, `http://localhost`) does not last in Safari: the session cookie is never stored, so every reload or new tab sends the owner back to the login screen. Chrome and Firefox keep it. This slows down local work on the panel, including this feature, and only affects Safari in development.

## Decisions

| Topic | Decision |
|---|---|
| Spec number | 005, the same number as the api spec it completes; numbers are shared across repos. |
| Placement | A dedicated Resume page in the navigation's Media group, next to Files, with one section per language. No action inside the file library grid. |
| Choosing the PDF | The existing file picker, limited to PDFs; it also uploads a new PDF to the library. Uploading stays on `POST /files`. |
| Ordering rules | The panel prevents what the api would refuse: Spanish cannot be chosen without English, and English cannot be cleared while Spanish is assigned. A 409 that still happens (stale page) is shown and the assignment is reloaded. |
| Clearing | Asks for confirmation first, stating the effect on the public link. Replacing does not ask: the previous PDF stays in the library and can be assigned again. |
| File library | Only the delete dialog changes: it names resume references and blocks deleting a current resume. No resume badges in the grid. |
| Public link | Each section shows the stable public URL of its language (`<API_URL>/resume?lang=<lang>`), with copy and open actions. |
| Safari session in development | Only the development server sets the session cookie without `Secure`; every production build (Vercel, Docker, a local `pnpm start`) keeps today's attributes. |
| Release | Minor version (5.1.0); needs api ≥ 6.1.0 released first. |

## Functional requirements

"The panel" is this application. "Owner" is the signed-in user with a live session. `lang` is `en` (English, required base) or `es` (Spanish, optional, falls back to English on the site). "The assignment" is the `{ en, es }` object of `GET /resume/assignments`, where each language is `{ file: { id, name, mime, size, createdAt, url }, assignedAt }` or `null`.

### Navigation and reading

- **RF-01** — The panel shall show a "Resume" link in the Media navigation group, after Files, that opens `/resume` and is marked as the current page while there.
- **RF-02** — When the owner opens `/resume`, the panel shall request the assignment from `GET /resume/assignments` with the session token and show one section for English followed by one for Spanish.
- **RF-03** — While a language has an assigned file, the panel shall show in its section the file's name, size and assignment date, and a link that opens the file's own URL in a new tab.
- **RF-04** — While English has no assigned file, the panel shall show in its section that the public resume download is unavailable until an English PDF is assigned.
- **RF-05** — While Spanish has no assigned file, the panel shall show in its section that visitors of the Spanish site receive the English resume.
- **RF-06** — The panel shall show in each section the stable public URL `<API_URL>/resume?lang=<lang>`, with an action that copies it and a link that opens it in a new tab.
- **RF-07** — If loading the assignment fails with a status other than 401, then the panel shall show the api's error message (or the connection error) and offer no assign or clear actions.

### Assigning and replacing

- **RF-08** — When the owner chooses "Choose PDF" (or "Replace" when a file is assigned) in a section, the panel shall open the file picker showing only PDFs, with upload available.
- **RF-09** — When the owner picks a PDF from the picker or uploads one through it, the panel shall send `PUT /resume/assignments/:lang` with `{ fileId }` for that section's language.
- **RF-10** — When an assignment succeeds (200), the panel shall show both sections from the returned assignment and a success notice.
- **RF-11** — When an assignment replaces a previous file, the panel shall send no request to delete or change the previous file.
- **RF-12** — When the owner closes the picker without choosing a file, the panel shall send no assignment request and change nothing.
- **RF-13** — While English has no assigned file, the panel shall disable choosing a Spanish PDF and state that an English resume must be assigned first.

### Clearing

- **RF-14** — When the owner chooses "Clear" in a section with an assigned file, the panel shall ask for confirmation, stating the effect on the public link (English: the download becomes unavailable; Spanish: visitors receive the English resume) and that the PDF stays in Files.
- **RF-15** — When the owner confirms clearing, the panel shall send `DELETE /resume/assignments/:lang` and, on 204, show that language as unassigned with a success notice.
- **RF-16** — When the owner cancels the confirmation, the panel shall send no request and change nothing.
- **RF-17** — While Spanish has an assigned file, the panel shall disable clearing English and state that the Spanish resume must be cleared first.
- **RF-18** — While a section shows no assigned file, the panel shall offer no "Clear" action in it.

### Errors and session

- **RF-19** — While an assign or clear request for a language is pending, the panel shall disable that section's actions.
- **RF-20** — If an assign or clear request fails with a status other than 401, then the panel shall show the api's error message (or the connection error) in that language's section and keep the assignment it was showing.
- **RF-21** — If an assign or clear request answers 409, then the panel shall also reload the assignment from `GET /resume/assignments`, so the page matches the api.
- **RF-22** — If any resume request answers 401, then the panel shall ask the owner to sign in again, as the other admin pages do, and change nothing.

### File library

- **RF-23** — When the file delete dialog lists the references of a file that is a current resume, the panel shall show each resume reference as "Resume · English" or "Resume · Spanish".
- **RF-24** — While the references of the file include a resume, the delete dialog shall disable "Delete file" and state that the file must first be replaced or cleared on the Resume page, with a link to it.
- **RF-25** — If `DELETE /files/:id` answers 409, then the delete dialog shall show the api's message and the file shall stay in the library list.

### Session in local development

- **RF-26** — While the panel runs as the development server (`pnpm dev`), the panel shall set the `panel_session` cookie on sign-in without the `Secure` attribute, keeping `HttpOnly`, `SameSite=Strict`, `Path=/` and a `Max-Age` equal to the token's remaining life.
- **RF-27** — While the panel runs as a production build, the panel shall set the `panel_session` cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` and a `Max-Age` equal to the token's remaining life, as it does today.
- **RF-28** — When the owner reloads an admin page or opens one in a new tab on the development server while the token is live, the panel shall show the page without asking to sign in again, in Safari as well as in Chrome and Firefox.
- **RF-29** — When the owner logs out on the development server, the panel shall remove the `panel_session` cookie, so the next reload of an admin page goes to `/login`.

## Out of scope

- Any change to the api: the contract is the one released in api v6.1.0 (api Spec 005).
- The `web` download link that points at `GET /resume` (a later spec in `web`).
- A "Set as resume" action or resume badges in the Files library grid (discarded in favor of the Resume page and the delete dialog).
- Letting the api's 409 be the only guard for the ordering rules (discarded: the panel prevents them).
- Clearing without confirmation (discarded).
- Embedding a PDF preview inside the panel; the file and the public URL open in a new tab.
- Version history of earlier resumes, languages other than `en` and `es`, other formats than PDF, generating or editing the PDF's contents.
- Sessions in Safari for a production build served over plain `http://localhost` (a local `pnpm start` or Docker run): production builds always send `Secure`, so testing them in Safari needs HTTPS.
- Any change to the session lifetime, the token, or how the api issues it.

## Constraints

- Needs api ≥ 6.1.0 in production before the panel release; `README.md` states the release order, as for earlier versions.
- No new dependencies (constitution §1); requests go through the existing api clients only (§2).
- The assignment shape mirrors the api DTO and is pinned by a test, like the other contract types (§5). Resume references carry a text `id` (`en`/`es`) instead of a number.
- The token stays in memory and the `panel_session` cookie (§7); api errors are shown, never swallowed (§8). UI text in English (§9).
- The cookie stays `HttpOnly` in every mode (§7), and the production cookie keeps every attribute it has today. The development change is decided at runtime, with no new environment variable (§6) and no change to `next.config.ts`.

## Done criteria

- [ ] Every RF has a Vitest test next to the code (page, sections, confirmation, delete dialog, api client, cookie attributes in development and production), passing without a running api.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] `README.md` documents the Resume page, the ordering rules, the delete-dialog behavior, that panel v5.1 needs api v6.1 (release the api first), and that the development server's session cookie is not `Secure` so Safari keeps it.
- [ ] `package.json` bumped to `5.1.0` in `chore(release): Bump version to v5.1.0`.
- [ ] Manual check against a local api 6.1.0: upload and assign an English PDF from `/resume`, open its public URL, assign a Spanish PDF, see "Clear" disabled for English, replace English and see the new PDF at the same public URL, clear Spanish after confirming, and see "Delete file" disabled for the English PDF in Files with "Resume · English" listed.
- [ ] Manual check in Safari on `pnpm dev`: sign in, reload `/resume` and open it in a new tab without being asked to sign in, then log out and see a reload go to `/login`. In a production build, the cookie still shows `Secure`.
