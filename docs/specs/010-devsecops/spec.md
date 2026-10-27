# Spec 010 — DevSecOps: CodeQL, Dependabot and SCA

- **Status:** Approved
- **Date:** 2026-10-27
- **Scope:** `panel` repository CI (GitHub Actions, Dependabot, repository security settings), the `Dockerfile` and dependency fixes within current ranges; no change to the panel's runtime behaviour. Adapts `web` Spec 009 (`docs/specs/009-devsecops` in `web`).

## Why

The panel holds the owner's session and edits the whole site through the API, yet its static
analysis and dependency updates run on GitHub's defaults: CodeQL in default setup with the `default`
suite, never gating a pull request, and Dependabot only opening security PRs configured from the
repository settings. Nothing versioned decides what is analysed, how often, or what blocks a merge.
Every merge into `main` deploys: Vercel builds production and `release.yaml` publishes
`portfolio-panel` to Docker Hub and rolls it out on Kubernetes, so a vulnerable dependency or base
image can reach production without any check stopping it. Spec 009 of the panel (the `next` RCE
and DoS advisories) showed that alerts are only acted on by hand.

Dependabot PRs also break the delivery rule (constitution §10 and the closing checklist of
`AGENTS.md`): each change into `main` bumps `version` in `package.json`, and those PRs never do.
The base image is not pinned by digest, there is no composition analysis of the lockfile or of the
published image, and no inventory (SBOM) of what the image contains. The `web` repository already
solved all of this in its Spec 009; this spec brings the panel to the same level.

## Decisions

| Topic | Decision |
|---|---|
| Source | Same capabilities as `web` Spec 009, adapted to the panel: one image (`portfolio-panel`, two platforms), no SSR CSP check, Next.js build output excluded. |
| CodeQL setup | Versioned advanced setup replaces the default setup; languages `actions` and `javascript-typescript`. |
| CodeQL queries | `security-extended` suite. |
| CodeQL triggers | Every PR into `main`, every push to `main` and a daily scheduled scan. |
| CodeQL gating | A new alert of high or critical security severity fails the check and blocks the merge. |
| Dependabot ecosystems | npm (pnpm), GitHub Actions and Docker base images. |
| Docker security updates | Not available from GitHub; base images are covered by weekly digest updates and the release image scan (as in `web`). |
| Dependabot updates | Weekly version updates; minor and patch grouped in one PR per ecosystem, each major in its own PR; security updates open immediately. |
| Version bump | Every Dependabot PR carries `chore(release): Bump version to vX.Y.Z` with a patch bump over `main`'s version, whatever the kind of update. |
| Bump identity | The GitHub App already used by `web` for the bump is installed on the panel repository and reused; its commits are signed and trigger the PR checks. A separate App and `GITHUB_TOKEN` pushes were turned down. |
| Stale bumps | The bump is recomputed whenever `main`'s version changes while the PR is open (default, not asked). |
| Auto-merge | None: every merge deploys, so the owner reviews each Dependabot PR. |
| SCA scope | `pnpm-lock.yaml` on every PR into `main` and daily; the `portfolio-panel` image (linux/amd64 and linux/arm64) in the release before it is published; an SBOM per platform of the published image. |
| SCA gating | Critical or high findings with a fixed version block; findings without a fix are reported only. |
| Exceptions | A versioned exceptions file; each entry needs the advisory id, a reason and an expiry date (default, not asked). |
| Reporting | Findings appear in code scanning (Security tab) and in the job summary (default, not asked). |
| Image hardening | Approved by the owner on 2026-10-27: base images pinned by tag and digest, Alpine packages upgraded at build time, and no npm/npx in the runtime image. Digest pinning alone, or not touching the `Dockerfile`, was turned down. |
| Initial findings | Approved by the owner on 2026-10-27: packages with a blocking finding are updated within their current ranges, with `pnpm-workspace.yaml` overrides when a parent pins a vulnerable version. "Exceptions only" and "ask after the scan" were turned down. |
| Dependency build scripts | One project command records approved build scripts in `allowBuilds` of `pnpm-workspace.yaml`; a new, unapproved build script still fails the install (default, not asked). |
| Spec number and branch | 010 (numbers are shared across `api`, `web` and `panel`, and 009 is taken in both) on `feat/spec-010`. |
| This spec's version | Minor bump (5.2.0): new CI capability. |

## Functional requirements

"The pipeline" is the set of GitHub Actions workflows and the Dependabot configuration versioned in
this repository. "Owner" is the repository owner. "Dependabot PR" is a pull request opened by
Dependabot against `main`. "Blocking finding" is a vulnerability of critical or high severity that
has a fixed version and is not covered by a valid exception. "The image" is `portfolio-panel`, built
from the `Dockerfile` for linux/amd64 and linux/arm64.

### SAST (CodeQL)

- **RF-01** — The pipeline shall analyse the repository with CodeQL for the `actions` and `javascript-typescript` languages using the `security-extended` query suite.
- **RF-02** — When a pull request into `main` is opened or updated, the pipeline shall run the CodeQL analysis and report it as a check on the PR.
- **RF-03** — When a commit is pushed to `main`, the pipeline shall run the CodeQL analysis.
- **RF-04** — The pipeline shall run the CodeQL analysis on `main` once a day on a schedule.
- **RF-05** — When a CodeQL analysis finishes, the pipeline shall publish its alerts in the repository's code scanning (Security tab).
- **RF-06** — If a pull request introduces a CodeQL alert of high or critical security severity, then the CodeQL check shall fail and the PR shall not be mergeable.
- **RF-07** — If a pull request introduces only alerts below high severity, then the CodeQL check shall pass and the alerts shall still be published.
- **RF-08** — The pipeline shall exclude build output, test coverage and installed dependencies (`.next/`, `coverage/`, `node_modules/`) from the CodeQL analysis.
- **RF-09** — While the advanced CodeQL setup is active, the repository shall not run the CodeQL default setup.

### Dependency updates (Dependabot)

- **RF-10** — The pipeline shall check npm, GitHub Actions and `Dockerfile` base-image dependencies for version updates once a week.
- **RF-11** — The pipeline shall group the minor and patch version updates of each ecosystem into a single Dependabot PR.
- **RF-12** — The pipeline shall open each major version update in its own Dependabot PR.
- **RF-13** — When a security advisory affects an npm or GitHub Actions dependency, the pipeline shall open a security-update Dependabot PR without waiting for the weekly check.
- **RF-14** — The pipeline shall title Dependabot commits and PRs with Conventional Commits: `build(deps)` for npm and Docker, `ci(deps)` for GitHub Actions.
- **RF-15** — The pipeline shall label every Dependabot PR with `dependencies` and its ecosystem.
- **RF-16** — The pipeline shall keep GitHub Actions pinned by full commit SHA when it updates them.
- **RF-17** — The pipeline shall not merge any Dependabot PR automatically.

### Version bump in Dependabot PRs

- **RF-18** — When a Dependabot PR is opened, the pipeline shall add to it one commit `chore(release): Bump version to vX.Y.Z` that sets `version` in `package.json` to `main`'s version with the patch number increased by one.
- **RF-19** — The bump commit shall change only the `version` field of `package.json`.
- **RF-20** — The bump commit shall be signed and shall trigger the PR's checks like any other push.
- **RF-21** — When `main`'s version changes while a Dependabot PR is open, the pipeline shall update the PR's bump so its version is the new `main` version plus one patch, still as a single bump commit.
- **RF-22** — When a Dependabot PR is updated and its `version` already equals `main`'s version plus one patch, the pipeline shall not add another commit.
- **RF-23** — When Dependabot rebases or recreates its PR and the bump commit is lost, the pipeline shall add it again as in RF-18.
- **RF-24** — If a pull request is not authored by Dependabot, then the pipeline shall not change its version or push to its branch.
- **RF-25** — If the bump commit cannot be pushed to the Dependabot PR, then the pipeline shall fail a visible check on that PR and leave the branch unchanged.
- **RF-26** — The bump step shall not install or execute code from the Dependabot PR while it holds a token with write permission.

### SCA — dependencies

- **RF-27** — When a pull request into `main` is opened or updated, the pipeline shall scan `pnpm-lock.yaml` for known vulnerabilities and report it as a check on the PR.
- **RF-28** — The pipeline shall scan `main`'s `pnpm-lock.yaml` once a day on a schedule.
- **RF-29** — If the lockfile scan finds a blocking finding, then the SCA check shall fail and the PR shall not be mergeable.
- **RF-30** — If the lockfile scan finds only findings without a fixed version or below high severity, then the SCA check shall pass and report them.
- **RF-31** — When a lockfile scan finishes, the pipeline shall publish its findings in code scanning and list them (package, installed version, fixed version, severity, advisory id) in the job summary.
- **RF-32** — When this spec's change reaches `main`, the lockfile scan of `main` shall report no blocking finding.

### SCA — image and SBOM

- **RF-33** — When `release.yaml` builds the image, the pipeline shall scan it on both platforms for known vulnerabilities of its OS packages and Node dependencies before publishing it.
- **RF-34** — If the image scan finds a blocking finding, then the release shall not publish any tag to Docker Hub and shall not deploy, and the cluster shall keep the running version.
- **RF-35** — If the image scan finds only non-blocking findings, then the release shall publish and deploy as today and report the findings in the job summary and in code scanning.
- **RF-36** — When the image is published, the pipeline shall generate one SBOM per platform in a standard format (SPDX or CycloneDX) naming the image, its version and its digest.
- **RF-37** — The pipeline shall keep each SBOM as a downloadable artifact of the release run, named with the image, the platform and the version.

### Image hardening

- **RF-38** — The `Dockerfile` shall reference each base image by tag and digest, so Dependabot updates the digest.
- **RF-39** — The runtime image shall include the Alpine package updates available when it is built.
- **RF-40** — The runtime image shall not contain `npm` or `npx`.
- **RF-41** — When the hardened image starts with no further input, it shall answer its `/login` health check successfully (constitution §10).

### Exceptions

- **RF-42** — Where a finding is listed in the versioned exceptions file with its advisory id, a reason and an expiry date in the future, the SCA checks shall report it as excepted and not count it as blocking.
- **RF-43** — If an exception has expired, then the SCA checks shall treat the finding as if it had no exception and name the expired entry in the job summary.
- **RF-44** — If an exception lacks the advisory id, the reason or the expiry date, then the SCA checks shall fail and name the invalid entry.

### Integration with the existing pipeline

- **RF-45** — `Panel Tests` (`test.yaml`: lint, tests, build) shall keep running and gating PRs into `main` as today, including Dependabot PRs.
- **RF-46** — `release.yaml` shall keep publishing `portfolio-panel` with the `latest`, version and `sha-` tags, pinning the deployment by digest and checking `rollout status` when no blocking finding exists.
- **RF-47** — Every workflow of the pipeline shall declare the minimum token permissions it needs and pin third-party actions by full commit SHA.
- **RF-48** — The pipeline shall not expose `API_URL`, `DOCKERHUB_TOKEN`, `KUBE_CONFIG`, `LOCAL_NETWORK`, the bump App's private key or any other secret to Dependabot PR runs or to SCA/CodeQL reports.

### Dependency build scripts

- **RF-49** — The repository shall provide one command that records the approval of the dependencies' build scripts in `allowBuilds` of `pnpm-workspace.yaml`.
- **RF-50** — When the pipeline installs dependencies (`test.yaml`, `release.yaml`, the Docker build, the CodeQL and SCA jobs and Dependabot's lockfile updates), the install shall finish without errors about build scripts pending approval.
- **RF-51** — If a dependency update introduces a package with a build script that is not in `allowBuilds`, then the install shall fail naming the package, and the PR shall stay unmergeable until the owner approves it with the command of RF-49.

## Out of scope

- Automatic merge of Dependabot PRs (every merge deploys).
- A bump other than patch for dependency PRs.
- A separate GitHub App for the panel, or pushes with `GITHUB_TOKEN` (turned down).
- CodeQL `security-and-quality` suite or custom queries.
- Major upgrades or new packages to clear the initial findings (turned down: only updates within the current ranges and overrides).
- Gating Vercel's own production build beyond the required checks on `main`.
- Licence compliance, DAST, IaC scanning of Kubernetes manifests and secret-scanning changes.
- Image signing or SBOM attestations pushed to the registry; scanning the image on pull requests.
- The `api` and `web` repositories, and any change to the panel's code, routes, `proxy.ts`, `next.config.ts` or runtime behaviour.

## Constraints

- **Infra/CI approval (AGENTS.md):** granted by the owner on 2026-10-27 for new and changed files under `.github/` (CodeQL, SCA and bump workflows, `dependabot.yml`, CodeQL config, exceptions file), changes to `release.yaml`, the `Dockerfile` hardening (RF-38 to RF-41) and the command of RF-49 (`package.json` script).
- **Dependencies (AGENTS.md, constitution §1):** granted on 2026-10-27 only to update packages with a blocking finding within their current ranges, and to add `pnpm-workspace.yaml` overrides when a parent pins a vulnerable version; each override is documented with its advisory and removal condition. Anything else is a new approval. SCA tools run inside CI, not as project dependencies.
- **Repository settings (manual, owner):** disable CodeQL default setup (RF-09); require the CodeQL, SCA and `Panel Tests` checks on `main` (RF-06, RF-29); create the Dependabot labels; install the bump App on `panel` and add `BUMP_APP_ID` (variable) and `BUMP_APP_PRIVATE_KEY` (secret); allow the App to push to Dependabot branches under the `main` ruleset.
- **Reuse:** the plan starts from `web`'s implementation (workflows, `dependabot.yml`, gate script, exceptions format) and its plan decisions, including Dependabot's pnpm 12 support and the trigger justification for the bump (RF-26).
- Constitution §6: CI secrets stay in GitHub and never reach Dependabot runs or reports.
- Constitution §9 and §10: Conventional Commits and SemVer; `Panel Tests` keeps gating `main`; the `release.yaml` image starts unattended and passes `/login`.

## Done criteria

- [ ] A throwaway PR with a deliberately vulnerable pattern fails the CodeQL check; removing it makes the check pass.
- [ ] A throwaway PR pinning a dependency with a known critical/high advisory with a fix fails the SCA check; a valid exception makes it pass; an expired or incomplete one makes it fail again.
- [ ] A Dependabot PR receives exactly one signed `chore(release): Bump version to vX.Y.Z` commit with `main`'s version plus one patch, and its checks rerun; after bumping `main`, the PR's bump is updated; a PR not authored by Dependabot is left untouched.
- [ ] The scheduled CodeQL and SCA runs appear daily in the Actions tab and their alerts in the Security tab.
- [ ] A release run scans the image on both platforms, uploads one SBOM per platform, and still publishes, pins by digest and passes `rollout status`; a forced blocking finding stops it before publishing.
- [ ] The hardened image built locally has no `npm`/`npx`, starts with no input and answers `/login`.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass; the lockfile scan of the branch reports no blocking finding.
- [ ] Installs in CI and in the Docker build show no build-script approval errors; a test PR adding a package with an unapproved build script fails until the RF-49 command approves it.
- [ ] CodeQL default setup is disabled, the required checks are configured on `main`, and the bump App is installed on `panel`.
- [ ] `README.md` documents the new workflows, the exceptions file, the build-script command and the manual settings.
- [ ] `version` in `package.json` bumped to 5.2.0 in `chore(release): Bump version to v5.2.0`.
