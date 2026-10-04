# Constitution — Portfolio Panel

1. Fixed stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, pnpm. New dependencies require approval.
2. The panel is a client of the API only: no database, no own business logic, no secrets in the repo.
3. Every admin request goes to the API with the JWT; the token is never logged or put in localStorage.
4. Server Components by default; client components only for interactivity.
5. All external input (forms) is validated before reaching the API; API errors are shown, never swallowed.
6. Every component and util with logic has a Vitest + Testing Library test.
7. `pnpm lint`, `pnpm test` and `pnpm build` pass before each commit.
8. The panel↔api contract changes in both repos under the same spec.
9. New features start from a spec in `docs/specs/NNN-*/spec.md`.
10. Code, UI, docs and commits in English; commits follow Conventional Commits.
