# Plan 009 — Next.js security update

- **Spec:** [spec.md](spec.md) (approved 2026-10-23)
- **Status:** Approved
- **Version:** 5.1.1 (fix → patch)

The change is limited to the two Next.js packages that the spec approves (constitution §1). `next` 16.4.2 accepts the React 19.2.8 already in use (peer `^19.0.0`) and Node 26 (engines `>=20.9.0`), so nothing else in the stack moves. `pnpm lint`, `pnpm test` and `pnpm build` must stay at 0 errors (§3, §4), the session cookie keeps every attribute it has today (§7), and the `release.yaml` image must still start unattended and pass its `/login` health check (§10). Nothing else needs approval: `next.config.ts`, the `Dockerfile`, `.github/` and the environment variables don't change. It follows the earlier security bump to 16.3.8 (`aff288a fix(deps): Bump next and eslint-config-next to 16.3.8`, released as 5.0.3).

## Modules

### Changed
| File | Change | RF |
|---|---|---|
| `package.json` | `next` `16.3.8` → `16.4.2` (dependencies) and `eslint-config-next` `16.3.8` → `16.4.2` (devDependencies), both pinned exactly as today. | RF-01, RF-02 |
| `pnpm-lock.yaml` | Regenerated for those two packages only: `next`, `@next/env`, `@next/swc-*`, `@next/eslint-plugin-next` and `eslint-config-next` resolve to 16.4.2. `sharp` stays at 0.35.5, which already satisfies 16.4.2's `^0.35.5`. | RF-01 – RF-03 |
| `next-env.d.ts` | Only if `pnpm build` rewrites it. The build generates this file, so whatever it writes is kept as is. | — |

### Infrastructure
| File | Change |
|---|---|
| `package.json` | `version` → `5.1.1` in `chore(release): Bump version to v5.1.1`. |
| `README.md` | No change expected. The stack line already says "Next.js 16" with no minor version, and nothing in behaviour, environment or deployment changes. It's updated only if D6 finds a deprecation that changes how the panel is run. |

## Data model

None. The panel has no database, and no DTOs change.

## Decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | Pin `next` to exactly `16.4.2` | A range such as `^16.4.2` | RF-01 asks for exactly that version, and `package.json` already pins `next`, `react` and `react-dom` exactly. A caret would let a fresh install move to 16.4.3, which the spec turned down because it came out on the day of the spec. |
| D2 | Bump `eslint-config-next` to `16.4.2` in the same commit | Keeping it at 16.3.8, since it has no advisory | RF-02. Its `@next/eslint-plugin-next` follows the rules of each Next release, and the bump to 16.3.8 (`aff288a`) moved both packages together. |
| D3 | Update with `pnpm add next@16.4.2` and `pnpm add -D eslint-config-next@16.4.2` on top of the current lockfile | Deleting `pnpm-lock.yaml` and reinstalling | A fresh lockfile would also bump every transitive dependency with a range, and the spec rules out upgrading anything else. Keeping the lockfile limits the diff to the Next packages, as in `aff288a`, and keeps `--frozen-lockfile` (in the `Dockerfile` and CI) reproducible. |
| D4 | Add no new tests; the existing Vitest suite is the regression net for RF-05 – RF-07 | A test that reads `package.json` and asserts the `next` version | The spec changes no behaviour, so §4 asks for no new test. A version test would only repeat RF-01 and would have to change on every future bump. Dependabot (RF-04) and the lockfile check already watch the version. |
| D5 | Leave `next.config.ts` as it is | Setting `images.unoptimized` so that `/_next/image` never runs | The spec turned it down: 16.4.2 closes GHSA-2464-fhr4-w9xw, and `AGENTS.md` asks for approval before changing `next.config.ts`. The panel uses plain `<img>`, which this plan doesn't change, so the previews in RF-07 don't depend on the optimizer. |
| D6 | Before building, read the 16.4 deprecation notices in `node_modules/next/dist/docs/`, and fix only what `pnpm lint` or `pnpm build` reports inside `app/`, `components/`, `lib/` or `proxy.ts` | Fixing every deprecation the docs mention, or ignoring the docs and relying on the build | `AGENTS.md` asks for the docs to be read first. Limiting fixes to what the tools flag keeps a patch release small. If a fix would need `next.config.ts`, the `Dockerfile` or `.github/`, work stops and the owner is asked (spec Constraints). |
| D7 | Two commits: `fix(deps): Bump next and eslint-config-next to 16.4.2`, then `chore(release): Bump version to v5.1.1` | A single commit with the bump and the version | That's the order of `aff288a` and `6394733` and the release convention in `AGENTS.md`. The fix commit names alerts #8 and #9 and both advisories in its context. |
| D8 | Release the panel alone, with no order against `api` or `web` | Waiting for a release in a sibling repo | The spec covers `panel` only and changes no contract, so the release has no ordering to follow. |

## RF coverage

| RF | Where | Tests |
|---|---|---|
| RF-01, RF-02 | `package.json` (D1, D2) | C1 |
| RF-03 | `pnpm-lock.yaml` (D3) | C1, C2 |
| RF-04 | Dependabot on `main` after the merge | E3 |
| RF-05, RF-06 | `app/actions/session.ts` (unchanged) on the new Next | U-S1 – U-S3, E1 |
| RF-07 | `proxy.ts`, the admin layout and the previews in `components/files/file-library.tsx` and `components/content/file-field.tsx` (unchanged) | U-P1, U-F1, E1 |
| RF-08 | The `Dockerfile` standalone image (unchanged) | E2 |

## Test strategy

The tests and checks below are ones that already exist. They must pass on 16.4.2 without changes (D4).

**Checks (C\*)**, run after the install:
- **C1** — `pnpm list next eslint-config-next` shows `16.4.2` for both, and `package.json` shows them without `^`.
- **C2** — `grep -E "^  next@16\.(([0-3])\.|4\.0[:(])" pnpm-lock.yaml` finds nothing (no `next` in 16.0.0 – 16.4.0), and `grep -c "16.3.8" pnpm-lock.yaml` shows no Next package left on the old version.

**Unit (U-\*)**, the current suite under `pnpm test`, with no running api:
- **U-S1 – U-S3** — `app/actions/session.test.ts`. U-S1: `createSession` sets an `httpOnly`, `Secure`, `SameSite=Strict` cookie with `Max-Age` equal to the token's remaining life. U-S2: on the dev server, it sets the cookie without `Secure`. U-S3: `deleteSession` deletes the cookie, on the dev server too, and nothing touches Web Storage.
- **U-P1** — `proxy.test.ts`: admin routes go to `/login` without a live cookie and pass with one.
- **U-F1** — `components/files/file-library.test.tsx` and `components/content/file-field.test.tsx`: image previews render with the file URL, and PDFs show none.
- The rest of the suite runs unchanged as a general regression check.

**End to end (E#)**, by hand, because Vitest doesn't run the real Next server, the Server Action runtime or Docker:
- **E1** — On `pnpm dev`: sign in with Google, reload an admin page and open one in a new tab without being asked to sign in again, open Files and the file picker and see the image previews, then log out and see that a reload goes to `/login` (RF-05 – RF-07). Then `pnpm build && pnpm start`: the `panel_session` cookie shows `Secure` in the browser's devtools (RF-05).
- **E2** — `docker build` and `docker run` as in `README.md`. The container reaches `healthy` (the `/login` health check), and `/login` answers 200 (RF-08).
- **E3** — After the merge, `gh api repos/{owner}/{repo}/dependabot/alerts --jq '[.[]|select(.state=="open")]|length'` returns `0`, and alerts #8 and #9 show `fixed` (RF-04).

What isn't covered automatically: the advisories themselves. No test reproduces the RCE or the DoS. Closing them depends on the patched version (C1, C2) and on Dependabot's own check (E3).

## Implementation order

1. On `fix/spec-009`, read the 16.4 notes in `node_modules/next/dist/docs/` after the install (D6).
2. Run `pnpm add next@16.4.2` and `pnpm add -D eslint-config-next@16.4.2` (D1 – D3), then C1 and C2.
3. Run `pnpm lint`, `pnpm test` and `pnpm build`. Fix only what they flag, within D6's limits.
4. Run E1 and E2.
5. Commit `fix(deps): Bump next and eslint-config-next to 16.4.2` (D7).
6. Commit `chore(release): Bump version to v5.1.1`, with `version` set to `5.1.1`.
7. Open the PR with `/create-pr`. `Panel Tests` must pass before the merge.

## Release

1. Merge the PR into `main` as `chore(release): Version 5.1.1`. Vercel deploys `main`, and `release.yaml` builds and rolls out the `5.1.1` image to `deployment/panel` (D8).
2. Check that the Vercel deployment and the Kubernetes rollout finish, and that `https://panel.figueroa-sanchez.com/login` loads and sign-in works.
3. Run E3, then tag `5.1.1` with `/tag-release`.

## Risks

- **16.4 changes something the panel relies on** (a deprecation in `proxy.ts`, cookies, Server Actions or the standalone output): the build fails or behaviour changes. Mitigation: D6, the current suite (U-S, U-P, U-F) and E1 and E2 before the merge. If a fix falls outside the allowed files, work stops and the owner is asked.
- **The lockfile update moves more than the Next packages**: a bigger, riskier diff. Mitigation: D3, and checking `git diff --stat pnpm-lock.yaml` against the size of `aff288a` (about 100 lines) before committing.
- **Dependabot keeps the alerts open after the merge** (its scan lags behind): RF-04 isn't met right away. Mitigation: check E3 again after Dependabot's next scan before tagging, and don't dismiss the alerts by hand.
- **A newer advisory affects 16.4.2**: the release closes these two alerts but leaves a new one. Mitigation: run E3 before tagging. A new alert would get its own spec, since automated upgrade PRs are out of scope.
