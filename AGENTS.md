<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Portfolio Panel

## Project
Admin panel for Marco Figueroa's portfolio: edits the site content served by the API (`api.figueroa-sanchez.com`, repo `api`) through its JWT-protected admin endpoints; no backend or database of its own.
Next.js 16 (App Router, `app/`), React 19, Tailwind CSS v4, TypeScript strict.
Part of the Portfolio workspace (`../AGENTS.md`) next to `web` and `api`.

## Content (Spec 003)
- Collections live in the registry `lib/collections.ts` (mirror of the API DTOs, pinned by `lib/collections.test.ts`), grouped in the navigation as Home sections, Pages (projects, experience, certifications, posts) and Media (files library at `/files`).
- Projects and posts are publishable: drafts are listed from the admin `…/all` endpoints with the token; the form offers Save draft / Publish / Unpublish and proposes the slug from the title (`lib/slug.ts`).
- Files (images ≤ 5 MiB, PDF ≤ 10 MiB) are stored in the API database, not here: `lib/files.ts` and `lib/upload.ts` (XHR upload with progress) call `/files`; the library lists, filters, picks and deletes them after showing their references.
- Markdown bodies use `MarkdownEditor`; the preview is rendered by the API (`POST /markdown/render`) and its Mermaid diagrams by the lazily loaded `mermaid` with `MERMAID_CONFIG`, which must stay equal to the web's.

## Testimonial review (Spec 004)
- Testimonials are `reviewable` in the registry: the list comes from `GET /content/testimonials/all` with the token, sorted by `byReview` (pending by submission date, newest first, then approved by position); `position` is `createHidden` and `approvedOnly`.
- A pending item's form shows email, language and submission date read-only and offers Save / Approve (`approveItem`, validates first) / Reject (`DeleteDialog` "Reject testimonial?").
- `PendingCountProvider` (in `app/(admin)/layout.tsx`) loads `pendingCount` with the token; `NavLinks` shows the badge and `ItemForm` calls `refresh()` after approve or reject.

## Deployment
- Primary: Vercel (Git integration) deploys `main` to production at `panel.figueroa-sanchez.com`.
- Fallback: `release.yaml` builds the Docker image `portfolio-panel` (standalone Next output) and rolls it out to `deployment/panel` in Kubernetes behind the Cloudflare tunnel; switching DNS between them is manual (runbook in `README.md`).
- `API_URL` and `GOOGLE_CLIENT_ID` are inlined at build time (Vercel env vars, Docker build args, CI secrets/vars).

## Commands
- Install: `pnpm install`
- Run: `pnpm dev` · build `pnpm build` · serve `pnpm start`
- Tests: `pnpm test` (Vitest + Testing Library, jsdom; `pnpm test <path>` runs one file)
- Lint: `pnpm lint`

## Style and conventions
- TypeScript 5 strict, ESM, pnpm; `@/*` path alias.
- Server Components by default; `"use client"` only where interactivity is needed.
- Components in PascalCase, files kebab-case; Tailwind utilities, no CSS modules unless required.
- Read `node_modules/next/dist/docs/` before using Next.js APIs; heed deprecations.
- Code, UI, docs, commits and agent replies in English; commits follow Conventional Commits.

## Rules
- Read `docs/constitution.md`, the workspace `../AGENTS.md` and `../docs/constitution.md`, and the active spec (`docs/specs/NNN-*/spec.md`; cross-repo specs in `../docs/specs/`) before touching code.
- The panel never stores secrets: the JWT lives only in memory or an httpOnly cookie, never in the repo, logs or localStorage.
- Changes to the panel↔api contract (endpoints, DTOs, CORS origins) update `api` under the same spec.
- Do not add dependencies, change `.github/workflows/`, the `Dockerfile` or deployment targets without asking.
- Do not change personal content (resume, profile, about, experience, contact data) without explicit instruction.

## When finishing any task
- Run `pnpm lint`, `pnpm test` and `pnpm build`; all must pass.
