<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Portfolio Panel

## Project
Admin panel for Marco Figueroa's portfolio: the owner signs in with Google and edits the site content through the JWT-protected admin endpoints of the sibling `api` repo. No database or secrets of its own.
Next.js 16 (App Router, `proxy.ts`, Server Actions), React 19, TypeScript strict, Tailwind CSS v4. Vercel deploys `main`; a Docker image on Kubernetes is the fallback (`release.yaml`).

## Commands
- Install: `pnpm install` (then `cp .env.example .env.local`; it fails on a dependency build script not approved in `pnpm-workspace.yaml`: approve or deny it with `pnpm run approve-builds`)
- Run: `pnpm dev` · build `pnpm build` · serve `pnpm start`
- Tests: `pnpm test` (Vitest + Testing Library, jsdom; `pnpm test <path>` runs one file)
- Lint: `pnpm lint` (types are checked by `pnpm build`)

## Style and conventions
- TypeScript 5 strict, ESM, pnpm 12 on Node 26; `@/*` path alias.
- Server Components by default; `"use client"` only where interactivity is needed.
- Components in PascalCase, files in kebab-case; Tailwind utilities, no CSS modules.
- Collections are declared in `lib/collections.ts` (mirror of the API DTOs); API calls go through `lib/api.ts` and `lib/upload.ts`.
- Tests sit next to the code as `*.test.ts(x)`; shared helpers in `test/`.
- Code, UI, docs, commits and agent replies in English; commits follow Conventional Commits.

## Rules
- Read `docs/constitution.md` and the active spec (`docs/specs/NNN-*/spec.md`) before touching code.
- The JWT lives only in memory and the httpOnly cookie `panel_session`: never in the repo, logs, `localStorage` or `sessionStorage`.
- Changes to the panel↔api contract (endpoints, DTOs, CORS origins) also update `api` under the same spec.
- Ask before adding or upgrading dependencies.
- Ask before changing `.github/workflows/`, the `Dockerfile`, `next.config.ts` or deployment targets.
- Ask before changing files in `docs/`.
- Do not change personal content (resume, profile, about, experience, contact data) without explicit instruction.

## When finishing any task
- Run `pnpm lint`, `pnpm test` and `pnpm build`; all must pass.
- Update `README.md` when behaviour, environment variables or deployment change.
- Releases: bump `version` in `package.json` (SemVer) in `chore(release): Bump version to vX.Y.Z`; the PR merges as `chore(release): Version X.Y.Z` and is tagged `X.Y.Z`.
