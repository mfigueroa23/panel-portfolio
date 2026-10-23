# Tasks 009 — Next.js security update

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `C#` / `U-*` / `E#` = checks and tests listed in the plan's test strategy.

## Phase 0 — Gate

- [x] **T01 — Mark the spec and the plan as approved**
  - **RF:** —
  - **Depends on:** —
  - **Scope:** The owner approved both on 2026-10-23. Set `Status: Approved` in `spec.md` and `plan.md`, with no other line changed. Commit the spec, plan and tasks in `docs(deps): Add the Spec 009 Next.js security update spec, plan and tasks`, as was done for Spec 005.
  - **Done when:** `grep -n "Status" docs/specs/009-next-security-update/{spec,plan}.md` shows `Approved` in both files, and `git log -1 --format=%s` prints that subject.

## Phase 1 — Dependency upgrade

- [x] **T02 — Bump `next` and `eslint-config-next` to 16.4.2**
  - **RF:** RF-01, RF-02, RF-03
  - **Depends on:** T01
  - **Scope:** Run `pnpm add next@16.4.2` and `pnpm add -D eslint-config-next@16.4.2` on top of the current `pnpm-lock.yaml`, without deleting it (D3). Both stay pinned exactly, with no `^` (D1, D2). `sharp` stays at 0.35.5.
  - **Done when:** C1 shows `16.4.2` for both packages with no `^` in `package.json`. C2 finds no `next` in 16.0.0–16.4.0 and no Next package left at `16.3.8`. `git diff --stat` touches only `package.json` and `pnpm-lock.yaml`, and the lockfile diff is about the size of `aff288a` (around 100 lines).

- [x] **T03 — Review the 16.4 deprecations and pass the quality gate**
  - **RF:** RF-05, RF-06, RF-07
  - **Depends on:** T02
  - **Scope:** Read the 16.4 notes in `node_modules/next/dist/docs/` (D6), looking at what touches `proxy.ts`, `cookies()`, Server Actions, `output: "standalone"` and ESLint rules. Fix only what `pnpm lint` or `pnpm build` reports inside `app/`, `components/`, `lib/` or `proxy.ts`. Keep `next-env.d.ts` if the build rewrites it. If a fix needs `next.config.ts`, the `Dockerfile` or `.github/`, stop and ask the owner. Tests stay as they are (D4).
  - **Done when:** `pnpm lint` and `pnpm build` finish with 0 errors. `pnpm test` passes with U-S1, U-S2 and U-S3 (`app/actions/session.test.ts`), U-P1 (`proxy.test.ts`) and U-F1 (`components/files/file-library.test.tsx`, `components/content/file-field.test.tsx`), and no test file was changed. Any deprecation that applies is written down for the PR description, or the note says there was none.

## Phase 2 — Manual verification

- [ ] **T04 — Check the session and the previews in the browser**
  - **RF:** RF-05, RF-06, RF-07
  - **Depends on:** T03 (can run in parallel with T05)
  - **Scope:** E1 against a local or production api.
  - **Progress (2026-10-23):** Checked automatically on a local production build: `/login` answers 200 and `/files` without a cookie redirects to `/login` (307). Still pending: the Google sign-in and the cookie checks, which need the owner's account.
  - **Done when:** E1 passes. On `pnpm dev`: sign in with Google, reload an admin page and open one in a new tab without being asked to sign in, see the image previews in Files and in the file picker, and log out so that a reload goes to `/login`. On `pnpm build && pnpm start`, `panel_session` shows `HttpOnly`, `Secure` and `SameSite=Strict` in devtools.

- [x] **T05 — Check the Docker image**
  - **RF:** RF-08
  - **Depends on:** T03 (can run in parallel with T04)
  - **Scope:** E2: run `docker build` and `docker run -p 3000:3000` with the commands in `README.md`. The `Dockerfile` doesn't change.
  - **Done when:** `docker ps` shows the container as `healthy`, and `curl -o /dev/null -w "%{http_code}" http://localhost:3000/login` prints `200`.

- [x] **T06 — Commit the upgrade**
  - **RF:** RF-01 – RF-03
  - **Depends on:** T04, T05
  - **Scope:** Commit `fix(deps): Bump next and eslint-config-next to 16.4.2` (D7), with any fixes from T03. The body names alerts #8 and #9 and the advisories GHSA-2464-fhr4-w9xw and GHSA-p3m5-59mp-jv5r (CVE-2026-94482).
  - **Done when:** `git log -1 --format=%s` prints that subject, and `git status` is clean. (Committed as `31d907b` at the end of Phase 1, as the owner asked for one commit per phase.)

## Phase 3 — Documentation and release

- [x] **T07 — Review the README**
  - **RF:** —
  - **Depends on:** T03 (can run in parallel with T04–T06)
  - **Scope:** Following `AGENTS.md`, check whether behaviour, environment variables or deployment changed. The plan expects no change. Update `README.md` only if T03 found a deprecation that changes how the panel is run.
  - **Done when:** `git diff main -- README.md` is empty, or it shows only the change from the T03 finding.

- [x] **T08 — Bump the version to 5.1.1**
  - **RF:** —
  - **Depends on:** T06, T07
  - **Scope:** Set `version` in `package.json` to `5.1.1` (fix → patch) and commit it as `chore(release): Bump version to v5.1.1` (D7).
  - **Done when:** `jq -r .version package.json` prints `5.1.1`, and `git log -1 --format=%s` prints `chore(release): Bump version to v5.1.1`.

- [ ] **T09 — Open the pull request**
  - **RF:** —
  - **Depends on:** T08
  - **Scope:** Run `/create-pr` from `fix/spec-009` to `main`. The PR names both alerts and the manual checks E1 and E2.
  - **Done when:** `gh pr checks` shows `Panel Tests` (Lint, Tests and Build) as passed.

- [ ] **T10 — Merge and confirm the deployment**
  - **RF:** RF-08
  - **Depends on:** T09
  - **Scope:** Merge as `chore(release): Version 5.1.1` (D8: no release order against `api` or `web`). Vercel deploys `main`, and `release.yaml` rolls out the `5.1.1` image to `deployment/panel`.
  - **Done when:** the `Panel Release` run on `main` finishes green with the rollout done, the Vercel production deployment is `Ready`, and `https://panel.figueroa-sanchez.com/login` loads and sign-in works.

- [ ] **T11 — Confirm the alerts are closed and tag the release**
  - **RF:** RF-04
  - **Depends on:** T10
  - **Scope:** E3, after Dependabot's next scan of `main`. Never dismiss the alerts by hand. Then run `/tag-release` for `5.1.1`.
  - **Done when:** `gh api repos/{owner}/{repo}/dependabot/alerts --jq '[.[]|select(.state=="open")]|length'` prints `0`, alerts #8 and #9 show `fixed`, and `gh release view 5.1.1` exists.

## RF → tasks

| RF | Tasks |
|---|---|
| RF-01, RF-02 | T02, T06 |
| RF-03 | T02, T06 |
| RF-04 | T11 |
| RF-05, RF-06 | T03, T04 |
| RF-07 | T03, T04 |
| RF-08 | T05, T10 |
