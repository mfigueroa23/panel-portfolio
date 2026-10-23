# Spec 009 — Next.js security update

- **Status:** Approved
- **Date:** 2026-10-23
- **Scope:** `panel` only

## Why

Dependabot reports two open alerts on the panel's direct runtime dependency `next`, pinned at 16.3.8. Both affect every release from 16.0.0 to 16.4.0 and are fixed from 16.4.1 on:

| Alert | Severity | Advisory | Summary |
|---|---|---|---|
| #9 | Critical | GHSA-2464-fhr4-w9xw | Unauthenticated remote code execution in the Image Optimization API when SVG files are used |
| #8 | High | GHSA-p3m5-59mp-jv5r (CVE-2026-94482) | Denial of service in the App Router using Server Actions |

The panel is reachable on the internet and holds the owner's session. The image optimization endpoint is served by default even though the panel never uses it, and the sign-in flow runs on a Server Action, so the denial of service can lock the owner out of editing the site. An unauthenticated attacker can exploit either one without any action by the owner. The site content managed through the panel is exposed until the dependency is updated.

## Decisions

| Topic | Decision |
|---|---|
| Target version | `next` 16.4.2: the latest 16.4 patch that is more than a week old. 16.4.1 (the minimum fix) and 16.4.3 (released the same day as this spec) were turned down. |
| Lint config | `eslint-config-next` moves to the same version as `next`, as it does today. |
| Hardening | Upgrade only. Turning off the image optimization endpoint in the Next.js configuration was turned down: the patched release closes the advisory. |
| Dependabot configuration | Not added. Automated upgrade pull requests are left for a later spec. |
| Spec number | 009. Numbers are shared across `api`, `web` and `panel`, and `web` already reaches 008. |
| Release | Patch version (5.1.1): a security fix with no behaviour change. |

## Functional requirements

"The panel" is this application. "Owner" is the signed-in user with a live session. "The vulnerable range" is `next` from 16.0.0 to 16.4.0, both included.

### Dependency

- **RF-01** — The panel shall declare `next` at exactly version 16.4.2 as a runtime dependency.
- **RF-02** — The panel shall declare `eslint-config-next` at exactly the same version as `next`.
- **RF-03** — The panel's lockfile shall resolve no `next` package within the vulnerable range.

### Alerts

- **RF-04** — When the change reaches `main`, the repository shall show Dependabot alerts #8 and #9 as fixed and no open alert for `next`.

### No regressions

- **RF-05** — When the owner signs in with Google, the panel shall set the `panel_session` cookie with the same attributes it sets today in development and in production builds.
- **RF-06** — When the owner logs out, the panel shall remove the `panel_session` cookie, so the next reload of an admin page goes to `/login`.
- **RF-07** — When the owner opens an admin page with a live session, the panel shall show it without asking to sign in again, including the image previews in Files and in the file picker.
- **RF-08** — When the standalone Docker image starts with no further input, the panel shall answer its `/login` health check successfully.

## Out of scope

- Turning off image optimization or any other change to `next.config.ts` (turned down).
- Adding `.github/dependabot.yml` or any other change to `.github/` (turned down).
- Upgrading any other dependency (React, Tailwind, the test toolchain), or moving to 16.4.3 or later.
- The `api` and `web` repos, which these alerts don't cover.

## Constraints

- This dependency upgrade is approved by this spec (constitution §1, `AGENTS.md`). Before code changes, read the 16.4 deprecation notices in `node_modules/next/dist/docs/`, as `AGENTS.md` asks.
- No changes to `next.config.ts`, the `Dockerfile`, workflows or deployment targets.
- `pnpm lint` and `pnpm build` finish with 0 errors (§3). `pnpm test` passes without a running api (§4). The `release.yaml` image starts unattended and passes its `/login` health check (§10).
- The session cookie keeps every attribute it has today (§7).

## Done criteria

- [ ] The existing Vitest suite passes unchanged, including the session cookie tests that cover RF-05 and RF-06. A test is added only if the upgrade changes behaviour.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] `pnpm-lock.yaml` resolves `next` and `eslint-config-next` at 16.4.2.
- [ ] `package.json` bumped to `5.1.1` in `chore(release): Bump version to v5.1.1`. `README.md` changes only if behaviour or deployment changes.
- [ ] After the merge, `gh api repos/{owner}/{repo}/dependabot/alerts` shows no open alerts.
- [ ] Manual check on `pnpm dev`: sign in, reload an admin page and open one in a new tab without being asked to sign in, open Files and the file picker and see image previews, then log out and see a reload go to `/login`.
- [ ] The `release.yaml` image builds and passes its `/login` health check.
