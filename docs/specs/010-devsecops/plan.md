# Plan 010 — DevSecOps: CodeQL, Dependabot and SCA

- **Spec:** [spec.md](spec.md) (approved 2026-10-27)
- **Status:** Approved
- **Version:** 5.2.0 (feat → minor)

The plan ports `web` Spec 009 as it runs today in `mfigueroa23/portfolio` (workflows, `dependabot.yml`, `scripts/sca-gate.mjs`, `scripts/dependabot-bump.mjs`) to the panel. It touches CI, the `Dockerfile`, two Node scripts under a new `scripts/` folder, `package.json` scripts and `pnpm-workspace.yaml`. The panel's code, routes, `proxy.ts` and `next.config.ts` do not change (constitution §2, §5–§8). No dependency is added (§1): CodeQL, Grype and Syft run as pinned actions or downloaded CLIs in CI, and the scripts use only Node's standard library. Their tests run with Vitest under `pnpm test` (§4, D3). `Panel Tests` keeps gating `main`, and the release keeps pinning by digest and passing `/login` (§10). The owner approved the infra/CI work, the `Dockerfile` hardening and in-range dependency fixes on 2026-10-27 (spec Constraints). Owner actions still pending, listed in **Release**: install the bump App on `panel-portfolio`, add its variable and secret, create the labels, disable CodeQL default setup (configured today, `default` suite, weekly) and enable the `Branch Ruleset` (disabled today) with the new checks.

## Modules

### New: `.github/workflows/codeql.yaml` (`Panel CodeQL`)
| File | Responsibility | RF |
|---|---|---|
| `codeql.yaml` | Copy of `web`'s `codeql.yaml`. Triggers: `pull_request` into `main`, `push` to `main`, `schedule` daily (`0 7 * * *` UTC) and `workflow_dispatch`. Job `Analyze (${{ matrix.language }})`, matrix `actions` and `javascript-typescript`, `build-mode: none` (D4), `init` with `config-file: ./.github/codeql/codeql-config.yaml`, then `analyze` with `category: /language:<lang>`. Permissions `actions: read`, `contents: read`, `security-events: write`. Actions pinned by SHA with `# vX.Y.Z`. | RF-01–RF-05, RF-47 |

### New: `.github/codeql/codeql-config.yaml`
| File | Responsibility | RF |
|---|---|---|
| `codeql-config.yaml` | `name: 'Panel CodeQL'`; `queries: [uses: security-extended]`; `paths-ignore`: `.next`, `node_modules`, `coverage`. | RF-01, RF-08 |

### New: `.github/dependabot.yml`
| File | Responsibility | RF |
|---|---|---|
| `dependabot.yml` | Same as `web`'s (D12): three `updates` on `/` (`npm`, `github-actions`, `docker`), weekly on Monday at 06:00 `America/Santiago`; `groups.<eco>-minor-patch` (`applies-to: version-updates`, `update-types: [minor, patch]`), so majors stay one per PR; literal prefixes `build(deps)` (npm, also `prefix-development`; docker) and `ci(deps)` (actions); `labels: [dependencies, <ecosystem>]`. No auto-merge. | RF-10–RF-12, RF-14, RF-15, RF-17 |

### New: `.github/workflows/sca.yaml` (`Panel SCA`)
| File | Responsibility | RF |
|---|---|---|
| `sca.yaml` | Copy of `web`'s `sca.yaml`. Triggers: `pull_request` into `main`, `schedule` daily (`30 7 * * *` UTC), `workflow_dispatch`. Job `Lockfile Scan`: checkout (`persist-credentials: false`, no install, D4), `anchore/scan-action/download-grype` (Grype v0.120.1, DB cached), `grype file:pnpm-lock.yaml -o json=grype.json -o sarif=grype.sarif`, `node scripts/sca-gate.mjs --title Lockfile --report grype.json`, then `upload-sarif` (`category: sca-lockfile`) under `always()` and not for fork PRs. Permissions `contents: read`, `security-events: write`. | RF-27–RF-31, RF-42–RF-44, RF-47 |

### New: `.github/workflows/dependabot-bump.yaml` (`Panel Version Bump`)
| File | Responsibility | RF |
|---|---|---|
| `dependabot-bump.yaml` | Copy of `web`'s workflow (D5). Job `request` on `pull_request` (`opened`, `synchronize`, `reopened`) for PRs authored by `dependabot[bot]` and pushed by Dependabot or a human: no checkout, `actions: write` only, `gh workflow run dependabot-bump.yaml --ref main -f pr=<n>`. Job `bump` on `workflow_dispatch` (input `pr`), on `push` to `main` with `paths: [package.json]`, and hourly (`17 * * * *`): checkout `main`, `actions/create-github-app-token` (`vars.BUMP_APP_ID`, `secrets.BUMP_APP_PRIVATE_KEY`; contents, pull-requests, statuses, workflows: write), `node scripts/dependabot-bump.mjs [--pr N]`. `concurrency: dependabot-bump`, not cancelled. | RF-18, RF-20–RF-26, RF-47, RF-48 |

### New: `scripts/` (CI scripts, D1–D3)
| File | Responsibility | RF |
|---|---|---|
| `scripts/sca-gate.mjs` | Copied from `web` unchanged. CLI `--report` (repeatable, each with its `--title`), `--exceptions` (default `.github/sca-exceptions.json`). Pure exports `validateExceptions`, `classify` (`blocking` = Critical/High with `fix.state: fixed`; an exception matches `vulnerability.id` or a `relatedVulnerabilities[].id`), `findings`, `summary`. Writes to `$GITHUB_STEP_SUMMARY`. Exits 1 on a blocking finding, an invalid entry or an unreadable report. | RF-29–RF-31, RF-34, RF-35, RF-42–RF-44 |
| `scripts/sca-gate.test.mjs` | U-SG-1…U-SG-11, ported to Vitest (D3). | |
| `scripts/dependabot-bump.mjs` | Copied from `web` unchanged; it already reads the repository from `GITHUB_REPOSITORY`. Pure exports `nextPatch`, `setVersion` (edits only the top-level `"version"` value), `isBumpCommit`, `decide` (`skip`/`noop`/`rebump`), `trailingBump`; `rebump` works only through GitHub's API (moves the ref back, `POST /merges` from `main`, GraphQL `createCommitOnBranch` with `expectedHeadOid`), so every commit is signed. It sets the `Version bump` commit status and, on failure, comments once per head asking for `@dependabot recreate`. | RF-18–RF-25 |
| `scripts/dependabot-bump.test.mjs` | U-DB-1…U-DB-15, ported to Vitest (D3); `rebump` runs against the existing in-memory API fake. | |

### New: `.github/sca-exceptions.json`
| File | Responsibility | RF |
|---|---|---|
| `sca-exceptions.json` | `[]` to start (see **Data model**). Shared by the lockfile and image scans (D7). | RF-42–RF-44 |

### Changed: `.github/workflows/release.yaml` (`Panel Release`)
| File | Change | RF |
|---|---|---|
| `release.yaml` | `build` job unchanged apart from version comments. `package` job renamed `Build, Scan and Publish Image`, `timeout-minutes: 45`, permissions `contents: read`, `security-events: write`. A `registry:3` service (pinned by digest as in `web`) on `localhost:5000`. Buildx with `driver-opts: network=host` and an HTTP `buildkitd-config-inline` for that registry. `build-push-action` pushes `localhost:5000/portfolio-panel:${{ github.sha }}` instead of Docker Hub (D8); the login stays before it so base images pull with a quota. New steps: download Grype and Syft (pinned), then scan `linux/amd64` and `linux/arm64` (`GRYPE_REGISTRY_INSECURE_USE_HTTP=true`) to JSON and SARIF. Then `sca-gate.mjs` over both reports, titled `portfolio-panel (linux/<arch>)`, which fails the job before anything is published. Then `upload-sarif` per platform (`category: sca-image-panel-<arch>`, `always()`). Only then does `docker buildx imagetools create` copy the manifest list to `latest`, `<version>` and `sha-<sha>` on Docker Hub, failing if Docker Hub reports a digest other than the scanned one. Last come the Syft SBOMs (SPDX JSON, one per platform, `--source-name <user>/portfolio-panel:<version>`) in the artifact `portfolio-panel-<version>-sbom` (D9). The `digest` output stays the build digest. `deploy` is unchanged. | RF-33–RF-37, RF-46–RF-48 |

### Changed: other files
| File | Change | RF |
|---|---|---|
| `.github/workflows/test.yaml` | Only `# vX.Y.Z` comments on the existing pins (D10). Script tests run inside `pnpm test` (D3), so no new step. | RF-16, RF-45 |
| `Dockerfile` | Both `FROM node:26-alpine` lines become `node:26-alpine@sha256:<digest>` (D10). The runtime stage adds `RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx` before `USER node`, with a comment citing the spec (D11). The build stage, `HEALTHCHECK` and `CMD` are unchanged. | RF-10, RF-38–RF-41 |
| `package.json` | Script `"approve-builds": "pnpm approve-builds"` (D13). `version` → `5.2.0`. Packages with a blocking finding move within their current ranges (D14). | RF-32, RF-49 |
| `pnpm-lock.yaml` | Updated transitive packages for D14, if the first scan finds any. | RF-32 |
| `pnpm-workspace.yaml` | Comment above `allowBuilds` (as in `web`): installs fail on unapproved build scripts by design; approve with `pnpm run approve-builds`. `overrides` only where a parent pins a vulnerable version, each with its advisory and removal condition (D14). | RF-32, RF-49–RF-51 |
| `AGENTS.md` | Commands: the install note about `pnpm run approve-builds`, as in `web`. | RF-49 |
| `README.md` | **Scripts**: `approve-builds`. **Deployment**: `BUMP_APP_ID` and `BUMP_APP_PRIVATE_KEY` added to the variables and secrets list. **CI/CD**: Panel CodeQL, Panel SCA, Panel Version Bump, Dependabot, the image scan and SBOMs in Panel Release, the exceptions file and its format. | RF-42, RF-49 |

### Infrastructure (owner, outside the repo)
| Item | Change |
|---|---|
| GitHub App | Add `mfigueroa23/panel-portfolio` to the existing `portfolio-version-bump` installation (its permissions already cover Contents, Pull requests, Commit statuses and Workflows). Add `BUMP_APP_ID` as an Actions variable and `BUMP_APP_PRIVATE_KEY` as an Actions secret, not a Dependabot secret. |
| Code scanning | Disable default setup: `gh api -X PATCH repos/mfigueroa23/panel-portfolio/code-scanning/default-setup -f state=not-configured`. |
| Ruleset on `main` | `Branch Ruleset` (id 24442608, now `disabled`: no deletion, no force push, signed commits, PR required, check `Lint, Tests and Build`) gains `Analyze (actions)`, `Analyze (javascript-typescript)` and `Lockfile Scan` plus the code scanning rule for CodeQL (security alerts `high_or_higher`, alerts `none`), and is set to `active`. |
| Labels | `dependencies`, `npm`, `github-actions`, `docker`. |

## Data model

No database or schema change. The only new data structure is the exceptions file, whose format is the same as in `web`:

```json
[
  { "id": "GHSA-xxxx-xxxx-xxxx", "reason": "Why it is accepted and what removes it", "expires": "YYYY-MM-DD" }
]
```

- Zero or more entries; `id` is a GHSA or CVE id and also covers the related ids of the same advisory.
- An entry is valid through the UTC day of `expires`; a missing `id`/`reason`, an empty `reason` or a non-ISO date fails the check (RF-44).
- Reverting it means deleting the entry; nothing else reads the file.

## Decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | Copy `web`'s workflows and scripts, changing only names, paths and image names. A header comment in each script names its origin. | A reusable workflow called from `mfigueroa23/portfolio` | The `web` version is proven: Dependabot PRs merged with signed bump and merge commits (`49e682f`, `b0eb4c3` show `verified: true`). A cross-repo `uses:` would make the panel's required checks depend on another repo's `main` and on its permissions. The scripts are already repo-agnostic (`GITHUB_REPOSITORY`). |
| D2 | Scripts stay `.mjs` using only Node's standard library, in a new `scripts/` folder. | Rewrite them in TypeScript and run them with Node 26 type stripping | The bump job runs them on bare `node` with no install (RF-26), and they stay byte-identical to `web` for later fixes. Adding them to `tsconfig`'s `**/*.ts` would put CI scripts into the Next.js type check. |
| D3 | The script tests become Vitest files (`import { describe, it } from 'vitest'`, `node:assert/strict` kept, `// @vitest-environment node`) and run with `pnpm test`. | Keep `node:test` and add a `node --test scripts/` step, as `web` does | Constitution §4 and `AGENTS.md` require Vitest tests next to the code, run by `pnpm test`. Vitest's default include already matches `*.test.mjs`, and `test.yaml` needs no new step. The node environment avoids jsdom for `spawnSync` and the file system. |
| D4 | No job that holds a write token or a secret installs dependencies or runs PR code. CodeQL uses `build-mode: none`, SCA reads the lockfile as a file, and the Dependabot-triggered run only dispatches the bump on `main`. | Install (`pnpm install`) before analysing, or keep the App key as a Dependabot secret | RF-26 and RF-48: an install runs approved build scripts, and a Dependabot secret would reach PR runs. JS/TS CodeQL needs no build (`web` D1, D2). |
| D5 | Bump through the shared `portfolio-version-bump` App with GitHub API commits, plus a `push` trigger on `main`'s `package.json` and an hourly fallback. | `GITHUB_TOKEN` pushes, or a second App for the panel | This was the owner's choice. The panel ruleset includes `required_signatures`, so local commits would be unmergeable, and `GITHUB_TOKEN` pushes trigger no checks (RF-20). The `push` trigger covers RF-21, and the schedule covers a lost dispatch (`web` D3, D15). |
| D6 | Grype for vulnerabilities and Syft for SBOMs as pinned CLIs (the same versions as `web`). CodeQL gating comes from the ruleset's code scanning rule. | Trivy for all three, or a script that parses CodeQL's SARIF | Trivy's actions and a release were compromised in March 2026. The ruleset rule compares the PR with `main` natively, which is what RF-06 and RF-07 ask for (`web` D4). |
| D7 | Our own exceptions file and gate (`sca-gate.mjs`) over Grype's JSON, shared by both scans. | Grype's `ignore` rules in `.grype.yaml` | Grype's ignores have no expiry and drop the finding from the report. RF-42 asks to report it as excepted, RF-43 to name expired entries and RF-44 to reject incomplete ones (`web` D5). |
| D8 | The image goes to a job-local registry, is scanned there and is copied to Docker Hub with `imagetools create`. | Push a candidate tag to Docker Hub, or rebuild after scanning | RF-34 forbids publishing before the gate, and a rebuild may not produce the scanned bytes. The copy keeps the digest that `deploy` pins (RF-46, `web` D7). |
| D9 | SBOMs in SPDX JSON, one per platform, in one artifact `portfolio-panel-<version>-sbom`. | CycloneDX | Both satisfy RF-36. SPDX matches GitHub's dependency graph export and `web`'s artifacts. The amd64 and arm64 layers differ (native `sharp` binaries), so each platform gets its own SBOM. |
| D10 | Both stages use `node:26-alpine@sha256:<digest>`, resolved at implementation (the digest `web` pins today, `40cd011b…`, unless the tag has moved), and existing action pins get `# vX.Y.Z` comments. | Keep the floating `node:26-alpine` and bare SHAs | With a floating tag, Dependabot has nothing to propose (RF-10, RF-38). The comments let Dependabot and the reviewer see the versions (RF-16). The same digest as `web` makes both repos move on the same Dependabot PRs. |
| D11 | Only the runtime stage runs `apk upgrade --no-cache` and deletes npm and npx. The build stage keeps npm to install pnpm. | Harden the build stage too, or switch the runtime to a distroless image | Only the runtime image is published and scanned (RF-33, RF-39, RF-40). The build stage needs npm for `npm install -g pnpm`. Distroless would drop busybox `wget`, which `HEALTHCHECK` uses for `/login` (RF-41, constitution §10). The server only runs `node server.js`. |
| D12 | `dependabot.yml` is identical to `web`'s in schedule, groups and literal prefixes, with no Docker security updates. | `prefix: build` + `include: scope`, or a custom image-advisory job | `include: scope` gives `build(deps-dev)` (RF-14). GitHub has no container advisories, so base images rely on RF-10 and RF-33 (spec Decisions, `web` D10, D11). |
| D13 | `pnpm run approve-builds` wraps pnpm's interactive `approve-builds`. CI keeps pnpm's default of failing on unapproved build scripts. | `pnpm approve-builds --all` in CI, or `--ignore-scripts` installs | RF-50 holds with `unrs-resolver` approved. RF-51 needs a new script to fail until the owner decides, which auto-approval would hide (`web` D12). |
| D14 | The blocking findings of the first lockfile scan are fixed in this branch (`build(deps)`), within current ranges and with `overrides` only when a parent pins a vulnerable version. | Time-boxed exceptions, or leaving them to Dependabot after the merge | This was the owner's choice. Otherwise `Lockfile Scan` would fail this very PR (RF-29, RF-32). The panel shares `mermaid`/`dompurify`, `vite` and `undici` paths with `web`, which had 15 such findings. |
| D15 | Required checks come through the existing `Branch Ruleset`, enabled, with the new checks and the code scanning rule. | Classic branch protection | The ruleset already holds signed commits, PR, `Lint, Tests and Build` and no force push, as in `web`. Only rulesets offer the code scanning rule that implements RF-06. |

## RF coverage

| RF | Where | Tests |
|---|---|---|
| RF-01 | `codeql.yaml`, `codeql-config.yaml` | E1 |
| RF-02, RF-03, RF-04 | `codeql.yaml` triggers | E1, E13 |
| RF-05 | `codeql.yaml` (`analyze` uploads) | E1, E13 |
| RF-06, RF-07 | Ruleset code scanning rule (D6, D15) | E1, E2 |
| RF-08 | `codeql-config.yaml` `paths-ignore` | E1 |
| RF-09 | Default setup disabled (Release step 2) | E13 |
| RF-10 | `dependabot.yml`, `Dockerfile` digests (D10) | E5 |
| RF-11, RF-12 | `dependabot.yml` `groups` | E5 |
| RF-13 | Repository security updates + `dependabot.yml` (D12) | E5 |
| RF-14, RF-15 | `dependabot.yml` `commit-message`, `labels` | E5 |
| RF-16 | Dependabot `github-actions` + `# vX.Y.Z` comments | E5, E14 |
| RF-17 | No auto-merge configured | E5 |
| RF-18, RF-19 | `dependabot-bump.mjs` (`nextPatch`, `setVersion`, `rebump`) | U-DB-1–U-DB-4, U-DB-11, U-DB-12, E5 |
| RF-20 | App token + API commits (D5) | U-DB-11, E5 |
| RF-21 | `bump` on `push` to `main`, `decide` → `rebump` | U-DB-6, E6 |
| RF-22 | `decide` → `noop` | U-DB-5, E5 |
| RF-23 | `request` on `synchronize` after recreate | U-DB-7, U-DB-10, E7 |
| RF-24 | `request` condition, `decide` → `skip` | U-DB-8, E8 |
| RF-25 | Conflict path, `Version bump` status, head restore | U-DB-13–U-DB-15, E9 |
| RF-26 | D4: dispatch only; `main`'s scripts, no install | U-DB-11, E14 |
| RF-27, RF-28 | `sca.yaml` triggers | E3, E13 |
| RF-29, RF-30 | `sca-gate.mjs` `classify` | U-SG-1–U-SG-4, E3 |
| RF-31 | `summary`, `upload-sarif` | U-SG-10, E3 |
| RF-32 | D14 updates, `Lockfile Scan` on this PR | E16 |
| RF-33 | `release.yaml` scan steps | E10 |
| RF-34 | Gate before `imagetools create` | U-SG-1, U-SG-11, E11 |
| RF-35 | Gate passes, SARIF and summary | U-SG-2, U-SG-10, E10 |
| RF-36, RF-37 | Syft steps, `upload-artifact` | E10 |
| RF-38 | `Dockerfile` digests | E5, E15 |
| RF-39, RF-40 | Runtime stage `apk upgrade`, npm removal (D11) | E15 |
| RF-41 | Unchanged `HEALTHCHECK` on the hardened image | E15, E10 |
| RF-42 | `validateExceptions`, `classify` → `excepted` | U-SG-5, U-SG-6, E4 |
| RF-43 | Expired entries | U-SG-7, E4 |
| RF-44 | Invalid entries | U-SG-8, U-SG-9, E4 |
| RF-45 | `test.yaml` unchanged; runs on Dependabot PRs | E5, E12 |
| RF-46 | `release.yaml` outputs and `deploy` unchanged | E10 |
| RF-47 | `permissions` blocks and SHA pins in every workflow | E14 |
| RF-48 | D4; no `secrets.` reachable from a Dependabot `pull_request` run | E14 |
| RF-49 | `approve-builds` script | E12 |
| RF-50 | `allowBuilds` (`unrs-resolver`); installs in `test.yaml`, `release.yaml`, Docker build | E10, E12 |
| RF-51 | pnpm default on unapproved builds (D13) | E12 |

## Test strategy

**Unit** (Vitest, `pnpm test`, no network; ported from `web` with the same ids and assertions, D3):

- `scripts/sca-gate.test.mjs`
  - U-SG-1 — A `High` match with `fix.state: fixed` is `blocking`; the CLI exits 1.
  - U-SG-2 — A `Critical` match with `fix.state: not-fixed` is `reported`; exit 0.
  - U-SG-3 — A `Medium` match with a fix is `reported`; exit 0.
  - U-SG-4 — An empty `matches` array passes and prints "no findings".
  - U-SG-5 — A valid exception for the match's `vulnerability.id` makes it `excepted`; exit 0.
  - U-SG-6 — An exception for a GHSA covers the match whose `relatedVulnerabilities` include it.
  - U-SG-7 — An exception that expired yesterday is listed as expired and the finding is `blocking`; one expiring today is valid.
  - U-SG-8 — An entry without `reason` (or with an empty one) is invalid, named in the output, and exits 1 even with no findings.
  - U-SG-9 — An entry without `id` or with a non-ISO `expires` is invalid.
  - U-SG-10 — The summary has one row per finding (package, installed, fixed in, severity, advisory, status), and several `--report` files are merged under their titles.
  - U-SG-11 — A missing or malformed report exits 1 with a one-line error and no stack trace.
- `scripts/dependabot-bump.test.mjs`
  - U-DB-1 — `nextPatch('5.2.0')` is `5.2.1`; `nextPatch('5.2.9')` is `5.2.10`.
  - U-DB-2 — `nextPatch` throws on `5.2`, `v5.2.0` or a pre-release.
  - U-DB-3 — `setVersion` changes only the version value of the panel's real `package.json`; every other byte is identical.
  - U-DB-4 — `setVersion` ignores a nested `"version"` key further down.
  - U-DB-5 — `decide` returns `noop` when the PR version is `main` + 1 patch.
  - U-DB-6 — `decide` returns `rebump` when `main` moved.
  - U-DB-7 — `decide` returns `rebump` when the PR has `main`'s version (bump lost on recreate).
  - U-DB-8 — `decide` returns `skip` for any author other than Dependabot.
  - U-DB-9 — `isBumpCommit` matches the bump subject only (`chore(release): Version 5.2.0` is not one).
  - U-DB-10 — `trailingBump` keeps the last non-bump commit, drops only trailing bumps, and refuses a branch with only bumps or with a commit after a bump.
  - U-DB-11 — `rebump` on a stale, behind branch moves the ref back, merges `main`, and adds one bump commit expecting the merge as head.
  - U-DB-12 — `rebump` on an up-to-date branch without a bump only adds the bump commit.
  - U-DB-13 — A merge conflict restores the original head and adds no commit.
  - U-DB-14 — A head that moved before or during the run gets no write, and the restore never overwrites another push.
  - U-DB-15 — A bump commit followed by another commit is never reset.

**End to end** (on GitHub and Docker during this release; no fake can emulate Dependabot, code scanning, rulesets or a registry):

- E1 — A throwaway PR that writes a query parameter into `innerHTML` (or `dangerouslySetInnerHTML`) gets a high CodeQL alert and is blocked; removing it unblocks. No alert comes from `.next/`.
- E2 — A throwaway PR with a medium-only alert passes its checks, and the alert shows in Security.
- E3 — A throwaway PR pinning a package to a version with a fixed high advisory fails `Lockfile Scan`, with the table in the summary and the alert in Security.
- E4 — The same PR plus a valid exception passes and lists the finding as excepted; with a past `expires` it fails naming the entry; without `reason` it fails naming the entry.
- E5 — "Check for updates" in Dependabot opens one grouped minor/patch PR per ecosystem with the right prefix and labels, majors apart, Actions still SHA-pinned, and the `Dockerfile` digest updated. Each PR gets exactly one signed bump commit to `main` + 1 patch, and `Panel Tests`, CodeQL and SCA run on the new head. A re-run adds no commit.
- E6 — Merging one Dependabot PR re-bumps the other open ones to the new version within minutes.
- E7 — `@dependabot recreate` brings the bump commit back.
- E8 — A PR from a feature branch is never touched by the bump workflow.
- E9 — A forced conflict (`main` edits the PR's dependency lines in `package.json`) produces no push, a failed `Version bump` status and one comment.
- E10 — Merging this feature: the release scans both platforms, publishes three tags with the scanned digest, `deploy` pins it and passes `rollout status`, and the artifact `portfolio-panel-5.2.0-sbom` holds two SPDX files.
- E11 — Grype and `sca-gate.mjs` run locally against an old `node:26-alpine` with known fixed highs exit 1. Review the YAML to confirm `imagetools create`, the only push to Docker Hub, comes after the gate. (Forcing a blocking finding in the real release would deploy on purpose.)
- E12 — A throwaway PR adding a package with a `postinstall` script fails `Panel Tests`, naming it; `pnpm run approve-builds` plus a commit makes it pass.
- E13 — The next day, scheduled CodeQL and SCA runs appear in Actions and no "default setup" CodeQL run does.
- E14 — Review: every workflow has `permissions`, every third-party action is SHA-pinned with its version comment, and no job reachable from a Dependabot `pull_request` run references `secrets.`.
- E15 — The hardened image built locally (`docker build`, both platforms through Buildx) has no `npm`/`npx` (`docker run --entrypoint sh … -c 'command -v npm npx'` prints nothing), `apk list -u` is empty, and it starts with no input and answers `/login` (health status `healthy`).
- E16 — `Lockfile Scan` on this PR passes with no blocking finding after D14.

What is not automated: everything that depends on GitHub (Dependabot, code scanning, ruleset, App tokens) and the release itself, which E5–E14 cover by hand. The unit tests use the same in-memory API fake as `web`, which does not check real signatures; E5 checks the `Verified` badge.

## Implementation order

1. `scripts/sca-gate.mjs` and its Vitest tests; `.github/sca-exceptions.json`.
2. `scripts/dependabot-bump.mjs` and its Vitest tests.
3. `codeql.yaml` and `codeql-config.yaml`.
4. `sca.yaml`; run Grype on the lockfile and apply D14 if it finds blockers (`build(deps)` commit).
5. `dependabot-bump.yaml`.
6. `Dockerfile` digests and hardening; E15 locally.
7. `release.yaml`: local registry, scan, gate, SARIF, copy to Docker Hub, SBOMs; version comments on every pin in `release.yaml` and `test.yaml` (resolve the tags of `pnpm/setup@fbda4c85…` and `docker/login-action@dbcb8138…`, which `web` no longer uses).
8. `dependabot.yml`.
9. `package.json` `approve-builds`, the `pnpm-workspace.yaml` comment, `AGENTS.md`, `README.md`.
10. Closing checklist (`pnpm lint`, `pnpm test`, `pnpm build`), then `chore(release): Bump version to v5.2.0`.

## Release

1. Owner: add `panel-portfolio` to the `portfolio-version-bump` installation; add `BUMP_APP_ID` (variable) and `BUMP_APP_PRIVATE_KEY` (secret); create the four labels.
2. Open the PR, then disable CodeQL default setup (advanced uploads are rejected while it is on).
3. Check that `Panel CodeQL`, `Panel SCA` and `Panel Tests` pass on the PR (E16). Run E1–E4 and E12 on throwaway branches off it.
4. Update and enable `Branch Ruleset` with the check names the PR shows and the code scanning rule.
5. Merge. Vercel deploys as usual; watch `Panel Release` (E10). If a new step fails, revert the merge: the previous `release.yaml` publishes as before, and the cluster keeps running the version from before the merge meanwhile.
6. Trigger Dependabot from the dependency graph (E5–E9); check E13 the next day.
7. `/tag-release` 5.2.0.

## Risks

- **Vercel is not behind the image scan:** Vercel builds `main` on its own, so only the required lockfile and CodeQL checks protect it. The base image only matters for the Kubernetes fallback. That is in line with the spec's Out of scope.
- **ESLint on `.mjs`:** `eslint-config-next` also lints `scripts/`. If it flags the copied code, fix the style only and keep the logic identical to `web` (D1, D2); do not add an ignore without a reason.
- **Other tools bundled in `node:26-alpine`:** if the image scan blocks on something other than npm (for example yarn, if present), remove it only if the server never uses it and record it in D11; otherwise add a time-boxed exception.
- **`apk upgrade` at build time:** builds depend on the Alpine mirrors and are not byte-reproducible. A mirror outage fails the release closed.
- **Grype DB download fails:** the scan and the release stop (fail closed). The DB is cached and a re-run retries.
- **Shared App key:** a leak would affect both repos. The App is limited to the two repositories with minimal permissions, and rotating the key means updating the secret in both.
- **Script drift between `web` and `panel`:** fixes have to land in both. The header comment of each script points at its twin.
- **Release time:** two scans and two SBOMs add an estimated 2–3 minutes to `package`.
- **Dispatch from a Dependabot run without secrets:** this works in `web` (E5 there); if it ever stops, the hourly schedule still bumps.
