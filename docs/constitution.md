# Constitution — Portfolio Panel

Non-negotiable principles. Every spec, plan and task must meet them.

1. **Fixed stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, pnpm 12 on Node 26; new dependencies require approval.
2. **API client only:** no database or business rules of its own; only `lib/api.ts` and `lib/upload.ts` call `fetch` or `XMLHttpRequest`.
3. **Quality:** `pnpm lint` and `pnpm build` (type check included) finish with 0 errors.
4. **Tests:** every behaviour change ships a Vitest test next to the code (`*.test.ts(x)`); `pnpm test` passes without a running API.
5. **Contract:** `lib/collections.ts` mirrors the API DTOs and is pinned by `lib/collections.test.ts`; contract changes land in `api` under the same spec.
6. **Configuration:** only `API_URL` and `GOOGLE_CLIENT_ID`, read in `lib/config.ts` and inlined by `next.config.ts`; no `.env*` file except `.env.example` is committed.
7. **Session:** the JWT lives in memory and the httpOnly cookie `panel_session`; `app/`, `components/` and `lib/` never use `localStorage` or `sessionStorage`.
8. **Errors:** forms are validated with `lib/validation.ts` before calling the API; API errors are shown to the user, never swallowed.
9. **Language:** code, UI, docs and commits in English; commits follow Conventional Commits.
10. **Delivery:** SemVer in `package.json`; `Panel Tests` (`test.yaml`) passes before merge; the `release.yaml` image starts unattended and passes its `/login` health check.
