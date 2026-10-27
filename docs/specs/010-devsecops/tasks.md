# Tasks 010 — DevSecOps: CodeQL, Dependabot and SCA

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `U-*` / `E#` = tests listed in the plan's test strategy.
- **Workflow checks:** "actionlint is clean" means `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:<pinned tag>` reports no errors. "Grype locally" means `anchore/grype:v0.120.1` run through Docker, the same version as CI (D6).

## Phase 0 — Gate

- [x] **T01 — Commit the approved spec, plan and tasks**
  - **RF:** —
  - **Depends on:** —
  - **Scope:** The owner approved the spec and the plan on 2026-10-27, and `Status: Approved` is already set in both. Commit `docs/specs/010-devsecops/` on `feat/spec-010` as `docs(devsecops): Add the Spec 010 DevSecOps spec, plan and tasks`.
  - **Done when:** `grep -n "Status" docs/specs/010-devsecops/{spec,plan}.md` shows `Approved` in both, and `git log -1 --format=%s` prints that subject.

- [x] **T02 — Answer the plan's open questions**
  - **RF:** —
  - **Depends on:** — (can run in parallel with T01, T03)
  - **Scope:** The owner answers three questions raised in the plan report:
    1. Is it acceptable that `portfolio-version-bump` gains write access to `panel-portfolio` as well (D5, Risks: shared App key)?
    2. If the image scan blocks on a tool bundled in `node:26-alpine` other than npm/npx, may it be removed under the approved hardening (D11, Risks)?
    3. Does ESLint lint `scripts/*.mjs` as copied, or is the folder excluded (D2, Risks)?
    Record each answer in the plan, as a line in D5, D11 or Risks, without changing any RF.
  - **Done when:** `plan.md` holds the three answers dated 2026-10-27 or later, and T09, T10 and T04 follow them.

- [ ] **T03 — Owner setup on GitHub**
  - **RF:** RF-13, RF-15, RF-20
  - **Depends on:** — (can run in parallel with T01, T02)
  - **Scope:** Owner actions from the plan's **Infrastructure** table and Release step 1:
    - Add `mfigueroa23/panel-portfolio` to the `portfolio-version-bump` installation.
    - Create the `BUMP_APP_ID` Actions variable and the `BUMP_APP_PRIVATE_KEY` Actions secret (not a Dependabot secret, D4).
    - Create the labels `dependencies`, `npm`, `github-actions` and `docker`.
    - Keep Dependabot security updates enabled.
  - **Done when:**
    - `gh variable list -R mfigueroa23/panel-portfolio` shows `BUMP_APP_ID`.
    - `gh secret list -R mfigueroa23/panel-portfolio` shows `BUMP_APP_PRIVATE_KEY` (Actions).
    - `gh label list -R mfigueroa23/panel-portfolio` shows all four labels.
    - `gh api repos/mfigueroa23/panel-portfolio/automated-security-fixes` returns `"enabled":true`.

## Phase 1 — Scripts

- [x] **T04 — SCA gate script and exceptions file**
  - **RF:** RF-29, RF-30, RF-31, RF-34, RF-35, RF-42, RF-43, RF-44
  - **Depends on:** T01, T02
  - **Scope:**
    - Copy `web`'s `scripts/sca-gate.mjs` unchanged, plus a header comment naming its twin in `web` (D1, D2).
    - Port `scripts/sca-gate.test.mjs` to Vitest: `describe`/`it` from `vitest`, `node:assert/strict` kept, `// @vitest-environment node`, same ids and assertions (D3).
    - Add `.github/sca-exceptions.json` with `[]` (plan **Data model**, D7).
    - If ESLint flags the copied code, change style only (plan Risks), following T02's answer.
  - **Done when:**
    - `pnpm test scripts/sca-gate.test.mjs` passes U-SG-1, U-SG-2, U-SG-3, U-SG-4, U-SG-5, U-SG-6, U-SG-7, U-SG-8, U-SG-9, U-SG-10 and U-SG-11.
    - `pnpm lint` is clean.
    - `diff` against `web`'s `scripts/sca-gate.mjs` shows only the header comment, plus style fixes if any.

- [x] **T05 — Dependabot bump script**
  - **RF:** RF-18, RF-19, RF-21, RF-22, RF-23, RF-24, RF-25
  - **Depends on:** T01, T02 (can run in parallel with T04)
  - **Scope:**
    - Copy `web`'s `scripts/dependabot-bump.mjs` unchanged, plus the header comment (D1, D2).
    - Port `scripts/dependabot-bump.test.mjs` to Vitest as in T04 (D3), with the in-memory API fake included. U-DB-1 uses the plan's `5.2.x` examples, and U-DB-3 reads the panel's own `package.json`.
  - **Done when:**
    - `pnpm test scripts/dependabot-bump.test.mjs` passes U-DB-1, U-DB-2, U-DB-3, U-DB-4, U-DB-5, U-DB-6, U-DB-7, U-DB-8, U-DB-9, U-DB-10, U-DB-11, U-DB-12, U-DB-13, U-DB-14 and U-DB-15.
    - `pnpm lint` is clean.

## Phase 2 — Analysis workflows

- [ ] **T06 — CodeQL advanced setup**
  - **RF:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-08, RF-47
  - **Depends on:** T01
  - **Scope:**
    - Add `.github/workflows/codeql.yaml` (`Panel CodeQL`): the triggers, matrix, `build-mode: none` and permissions from the plan (D4, D6).
    - Add `.github/codeql/codeql-config.yaml` with `security-extended` and `paths-ignore` `.next`, `node_modules`, `coverage`.
    - Pin actions by SHA with `# vX.Y.Z`, the same pins as `web`.
  - **Done when:**
    - actionlint is clean.
    - The file has `permissions` at the workflow and job level and no `secrets.` reference.
    - The config lists the three ignored paths.

- [ ] **T07 — Lockfile SCA workflow**
  - **RF:** RF-27, RF-28, RF-30, RF-31, RF-47
  - **Depends on:** T04
  - **Scope:** Add `.github/workflows/sca.yaml` (`Panel SCA`, job `Lockfile Scan`) as in the plan: no install (D4), Grype v0.120.1 with the DB cached, `sca-gate.mjs --title Lockfile`, then `upload-sarif` with `category: sca-lockfile`, skipped for forks.
  - **Done when:**
    - actionlint is clean.
    - Grype locally on `pnpm-lock.yaml` followed by `node scripts/sca-gate.mjs --title Lockfile --report grype.json` prints the summary table. Its blocking findings, if any, are listed for T08.

- [ ] **T08 — Clear the blocking lockfile findings**
  - **RF:** RF-32
  - **Depends on:** T07
  - **Scope:** D14.
    - Update only the packages that T07 lists as blocking, within their current ranges.
    - Add an `overrides` entry in `pnpm-workspace.yaml` only when a parent pins a vulnerable version, with a comment giving the advisory and the removal condition.
    - No majors and no new packages.
    - Commit as `build(deps): …`.
    - If nothing blocks, record "no blocking findings" in this task and change nothing.
  - **Done when:**
    - Grype locally plus `sca-gate.mjs` exit 0 on the updated lockfile.
    - `pnpm test` and `pnpm build` pass.
    - `git diff main -- package.json` shows no major version change and no new package.

- [ ] **T09 — Dependabot version bump workflow**
  - **RF:** RF-18, RF-20, RF-21, RF-23, RF-24, RF-25, RF-26, RF-47, RF-48
  - **Depends on:** T05
  - **Scope:** Add `.github/workflows/dependabot-bump.yaml` (`Panel Version Bump`), copied from `web`:
    - Job `request`: dispatch only, `actions: write`, no checkout (D4).
    - Job `bump`: `workflow_dispatch`, `push` to `main` on `package.json`, and hourly; checkout `main`; App token from `vars.BUMP_APP_ID` and `secrets.BUMP_APP_PRIVATE_KEY`; `node scripts/dependabot-bump.mjs`; `concurrency: dependabot-bump` without cancelling (D5).
  - **Done when:**
    - actionlint is clean.
    - The `request` job references no `secrets.` and has no `actions/checkout`.
    - The `bump` job only runs when the event is not `pull_request` and the ref is `refs/heads/main`.

## Phase 3 — Image and release

- [ ] **T10 — Pin and harden the Dockerfile**
  - **RF:** RF-38, RF-39, RF-40, RF-41
  - **Depends on:** T01, T02 (can run in parallel with T04–T09)
  - **Scope:**
    - Both `FROM` lines become `node:26-alpine@sha256:<digest>` (D10). Use `web`'s current digest, unless `docker buildx imagetools inspect node:26-alpine` shows that the tag has moved.
    - The runtime stage gets `apk upgrade --no-cache` and the npm/npx removal before `USER node`, with a comment citing Spec 010 (D11).
    - Other bundled tools are removed only as T02 allows.
    - The build stage, `HEALTHCHECK` and `CMD` stay unchanged.
  - **Done when:** E15 passes for `linux/amd64` and `linux/arm64`:
    - `command -v npm npx` prints nothing.
    - `apk list -u` is empty.
    - The container started with no input reaches `healthy` and `/login` answers 200.
    - Grype locally on the image plus `sca-gate.mjs` exit 0.

- [ ] **T11 — Scan, gate and SBOMs in the release**
  - **RF:** RF-16, RF-33, RF-34, RF-35, RF-36, RF-37, RF-46, RF-47, RF-48
  - **Depends on:** T04, T10
  - **Scope:** Change `.github/workflows/release.yaml` as the plan's table says:
    - A `registry:3` service and Buildx on the host network; build to `localhost:5000/portfolio-panel:<sha>` (D8).
    - Grype for both platforms, `sca-gate.mjs`, then `upload-sarif` per platform (`sca-image-panel-<arch>`).
    - `imagetools create` to the three tags with the digest check.
    - Syft SPDX per platform into the artifact `portfolio-panel-<version>-sbom` (D9).
    - `deploy` unchanged.
    - Add `# vX.Y.Z` comments to every pin in `release.yaml` and `test.yaml`, resolving the tags of `pnpm/setup@fbda4c85…` and `docker/login-action@dbcb8138…` (D10).
  - **Done when:**
    - actionlint is clean.
    - E11: Grype locally against an old `node:26-alpine` with known fixed highs, plus `sca-gate.mjs`, exits 1.
    - `grep -n "Check Findings\|imagetools create\|build-push-action" .github/workflows/release.yaml` shows the build, then the gate, then the only Docker Hub push, in that order.
    - Every `uses:` line in both files has a version comment.

- [ ] **T12 — Dependabot configuration**
  - **RF:** RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17
  - **Depends on:** T10, T11
  - **Scope:** Add `.github/dependabot.yml`, identical to `web`'s in schedule, groups, prefixes and labels (D12), with a header comment citing Spec 010 and `dependabot-bump.yaml`. No auto-merge.
  - **Done when:**
    - The file has three `updates` entries (`npm`, `github-actions`, `docker`), each with a `<eco>-minor-patch` group, the literal prefix and two labels.
    - `diff` against `web`'s file shows only the comments.

## Phase 4 — Build scripts and documentation

- [ ] **T13 — Build-script approval command**
  - **RF:** RF-49, RF-50, RF-51
  - **Depends on:** T08 (it touches `pnpm-workspace.yaml` too)
  - **Scope:**
    - `package.json` gets the script `"approve-builds": "pnpm approve-builds"` (D13).
    - `pnpm-workspace.yaml` gets the comment above `allowBuilds`.
    - The `AGENTS.md` install line gets the `pnpm run approve-builds` note, as in `web`.
  - **Done when:**
    - `pnpm install --frozen-lockfile` finishes with no build-script approval error.
    - `pnpm run approve-builds` reports nothing pending.
    - `grep -n approve-builds package.json AGENTS.md pnpm-workspace.yaml` finds all three.

- [ ] **T14 — README**
  - **RF:** RF-42, RF-49
  - **Depends on:** T06, T07, T09, T11, T12, T13
  - **Scope:** In `README.md`:
    - **Scripts:** `approve-builds`.
    - **Deployment:** `BUMP_APP_ID` and `BUMP_APP_PRIVATE_KEY` added to the variables and secrets list.
    - **CI/CD:** Panel CodeQL, Panel SCA, Panel Version Bump, Dependabot, and the image scan and SBOM artifact in Panel Release.
    - The exceptions file with its format and expiry rule.
  - **Done when:** `README.md` names the three new workflows, `.github/sca-exceptions.json` with the `id`/`reason`/`expires` fields, both bump App settings and `pnpm run approve-builds`.

## Phase 5 — Verification and release

- [ ] **T15 — Quality gate and workflow review**
  - **RF:** RF-26, RF-45, RF-47, RF-48
  - **Depends on:** T04–T14
  - **Scope:** The closing checklist of `AGENTS.md`, plus E14 over every workflow.
  - **Done when:**
    - `pnpm lint`, `pnpm test` (with U-SG-1…U-SG-11 and U-DB-1…U-DB-15) and `pnpm build` pass.
    - actionlint is clean on `.github/workflows/`.
    - E14 holds: every workflow has `permissions`, every third-party `uses:` is pinned by SHA with a version comment, and no job reachable from a Dependabot `pull_request` run references `secrets.`.
    - `test.yaml` is unchanged except for the comments.

- [ ] **T16 — Bump the version to 5.2.0**
  - **RF:** —
  - **Depends on:** T15
  - **Scope:** Set `version` in `package.json` to `5.2.0` in its own commit, `chore(release): Bump version to v5.2.0`.
  - **Done when:** `jq -r .version package.json` prints `5.2.0`, and `git log -1 --format=%s` prints that subject.

- [ ] **T17 — Open the PR and check the gates on it**
  - **RF:** RF-02, RF-06, RF-07, RF-08, RF-09, RF-27, RF-29, RF-31, RF-32, RF-42, RF-43, RF-44, RF-50, RF-51
  - **Depends on:** T03, T16
  - **Scope:**
    - Open the PR with `/create-pr`, then disable CodeQL default setup (`gh api -X PATCH …/code-scanning/default-setup -f state=not-configured`).
    - Run E1, E2, E3, E4 and E12 on throwaway branches off the PR, and delete them afterwards.
  - **Done when:**
    - E16: `Panel CodeQL` (`Analyze (actions)`, `Analyze (javascript-typescript)`), `Panel SCA` (`Lockfile Scan`) and `Panel Tests` pass on the PR.
    - E1, E2, E3, E4 and E12 pass as described in the plan.
    - `gh api …/code-scanning/default-setup --jq .state` prints `not-configured`.

- [ ] **T18 — Enable the ruleset on `main`**
  - **RF:** RF-06, RF-29, RF-45
  - **Depends on:** T17
  - **Scope:** Update `Branch Ruleset` (id 24442608): add `Analyze (actions)`, `Analyze (javascript-typescript)` and `Lockfile Scan` to the required checks, add the code scanning rule (CodeQL, security alerts `high_or_higher`, alerts `none`), and set `enforcement: active` (D15).
  - **Done when:** `gh api repos/mfigueroa23/panel-portfolio/rulesets/24442608` shows `active`, the four required checks, `required_signatures` and the `code_scanning` rule; the PR shows them as required.

- [ ] **T19 — Merge and watch the release**
  - **RF:** RF-33, RF-35, RF-36, RF-37, RF-41, RF-46
  - **Depends on:** T18
  - **Scope:** Merge the PR as `chore(release): Version 5.2.0`. Watch `Panel Release` and the Vercel deployment. If a new step fails, revert the merge (plan Release step 5).
  - **Done when:** E10 passes:
    - The release scans both platforms.
    - Docker Hub's `sha-<commit>` digest equals the `digest` output that `deploy` pins.
    - `rollout status` succeeds.
    - The artifact `portfolio-panel-5.2.0-sbom` holds two SPDX files.
    - Two `sca-image-panel-*` categories appear in code scanning.

- [ ] **T20 — Verify Dependabot and the bump end to end**
  - **RF:** RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-38, RF-45
  - **Depends on:** T19
  - **Scope:** Trigger "Check for updates" for each ecosystem from the dependency graph. Run E5, E6, E7, E8 and E9 as the plan describes, and review every Dependabot PR before merging (RF-17).
  - **Done when:**
    - E5, E6, E7, E8 and E9 pass.
    - Each Dependabot PR has exactly one bump commit with the `Verified` badge, and `Panel Tests`, CodeQL and SCA ran on its head.
    - The PRs from feature branches have no bump commit.

- [ ] **T21 — Scheduled runs and the release tag**
  - **RF:** RF-04, RF-09, RF-28
  - **Depends on:** T19 (can run in parallel with T20)
  - **Scope:** E13 the day after the merge, then `/tag-release` 5.2.0 on the merge commit. Tick the spec's done criteria.
  - **Done when:**
    - E13: Actions shows a scheduled `Panel CodeQL` and `Panel SCA` run on `main`, and no default-setup CodeQL run.
    - `git tag -v 5.2.0` verifies on the merge commit.
    - The GitHub release 5.2.0 exists.
    - Every box under the spec's **Done criteria** is ticked.

## RF → tasks

| RF | Tasks |
|---|---|
| RF-01, RF-03, RF-05 | T06, T17 |
| RF-02, RF-08 | T06, T17 |
| RF-04 | T06, T21 |
| RF-06, RF-07 | T17, T18 |
| RF-09 | T17, T21 |
| RF-10, RF-11, RF-12, RF-14, RF-17 | T12, T20 |
| RF-13, RF-15 | T03, T12, T20 |
| RF-16 | T11, T12, T20 |
| RF-18, RF-21, RF-23, RF-24, RF-25 | T05, T09, T20 |
| RF-19, RF-22 | T05, T20 |
| RF-20 | T03, T09, T20 |
| RF-26 | T09, T15 |
| RF-27 | T07, T17 |
| RF-28 | T07, T21 |
| RF-29 | T04, T17, T18 |
| RF-30 | T04, T07 |
| RF-31 | T04, T07, T17 |
| RF-32 | T08, T17 |
| RF-33, RF-36, RF-37 | T11, T19 |
| RF-34 | T04, T11 |
| RF-35 | T04, T11, T19 |
| RF-38 | T10, T20 |
| RF-39, RF-40 | T10 |
| RF-41 | T10, T19 |
| RF-42 | T04, T14, T17 |
| RF-43, RF-44 | T04, T17 |
| RF-45 | T15, T18, T20 |
| RF-46 | T11, T19 |
| RF-47 | T06, T07, T09, T11, T15 |
| RF-48 | T09, T11, T15 |
| RF-49 | T13, T14 |
| RF-50, RF-51 | T13, T17 |
