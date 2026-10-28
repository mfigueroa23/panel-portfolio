# Spec 011 — BusyBox-free runtime image

- **Status:** Approved
- **Date:** 2026-10-28
- **Scope:** `panel` repository: the runtime stage of the `Dockerfile` and `README.md`; no change to the panel's code, routes or runtime behaviour. `web` and `api` are out of scope.

## Why

Since release 5.2.3, the release image scan (Spec 010, RF-33) publishes six open alerts in code
scanning for `portfolio-panel`: CVE-2025-60876 (medium) in `busybox`, `busybox-binsh` and
`ssl_client` 1.37.0-r31, once per platform (linux/amd64 and linux/arm64). The flaw lets BusyBox
`wget` split an HTTP request line with control characters. Alpine publishes no fixed version, so
upgrading packages at build time (Spec 010, RF-39) cannot clear it, and as a medium finding without
a fix it never blocks the release: the alerts stay open with nothing that will close them.

The runtime image only needs `node` to serve the panel. BusyBox is there because the base image
ships it, and the only thing that uses it is the container health check, which calls `wget`
through `/bin/sh`. Every package the image does not need is one more thing to scan, patch and
explain in the Security tab.

## Decisions

| Topic | Decision |
|---|---|
| Approach | Remove BusyBox and its subpackages from the runtime image; the health check no longer uses `wget`. A versioned exception that hides the findings, and dismissing the alerts in GitHub, were turned down. |
| Scope | `panel` only. `web` (ssr and static images) and `api` have the same alerts and get their own spec. |
| Shell | The runtime image has no shell; the pod is debugged with an ephemeral container (`kubectl debug`). Installing an alternative shell was turned down. |
| Regression | No new check in `release.yaml`: if a base-image update brings BusyBox or a shell back, the existing Grype scan reports it in code scanning without blocking. A blocking guard was turned down. |
| Base image | Stays `node:26-alpine`, pinned by tag and digest (default, not asked). |
| Spec number and branch | 011 (numbers are shared across `api`, `web` and `panel`) on `fix/spec-011` (default, not asked). |
| This spec's version | Patch bump (5.2.4): security fix with no new capability (default, not asked). |

## Functional requirements

"The image" is `portfolio-panel` built from the `Dockerfile` for linux/amd64 and linux/arm64.
"The scan" is the Grype image scan of `release.yaml` (Spec 010, RF-33). "Owner" is the repository
owner.

### Image contents

- **RF-01** — The image shall not contain the `busybox`, `busybox-binsh` or `ssl_client` packages on either platform.
- **RF-02** — The image shall not contain `/bin/sh` or any other command shell.
- **RF-03** — The image shall keep the Spec 010 hardening: base images referenced by tag and digest (RF-38), Alpine package updates available at build time (RF-39) and no `npm` or `npx` (RF-40).

### Health check

- **RF-04** — When the image starts with no further input, the container shall report healthy once `GET /login` answers successfully (constitution §10).
- **RF-05** — If `GET /login` does not answer successfully within the health-check timeout, then the container shall report the check as failed.
- **RF-06** — The health check shall run without a shell.

### Runtime behaviour

- **RF-07** — The image shall serve the panel as today: same start command, port 3000, user `node` and build-time configuration (`API_URL`, `GOOGLE_CLIENT_ID`).

### Findings

- **RF-08** — When the scan runs on an image built after this change, it shall report no CVE-2025-60876 finding on either platform.
- **RF-09** — When the scan of the first release after this change is uploaded, code scanning shall show alerts #6 to #11 as fixed, without dismissing them by hand.
- **RF-10** — The release shall keep publishing, pinning by digest and deploying as today (Spec 010, RF-46).

## Out of scope

- The `web` and `api` images (same CVE; follow-up spec).
- A shell or debugging tools inside the image (turned down; `kubectl debug` instead).
- A check in `release.yaml` that blocks the release when BusyBox or a shell reappears (turned down).
- SCA exceptions, hiding excepted findings from code scanning, or dismissing alerts by hand (turned down).
- Changing the base image to another distribution or a distroless image.
- Any change to the panel's code, `proxy.ts`, `next.config.ts`, workflows or the Spec 010 gate.

## Constraints

- **Dockerfile approval (AGENTS.md):** granted by the owner on 2026-10-28 for the runtime stage changes this spec needs (removing BusyBox and its subpackages, replacing the `HEALTHCHECK`). Any other `Dockerfile`, workflow or deployment change is a new approval.
- **Dependencies (constitution §1):** no new npm dependency or Alpine package.
- **Cluster (manual, owner):** `deployment/panel` lives outside this repository; its liveness/readiness probes must not run commands through a shell or `wget` (an `httpGet` probe keeps working). The owner checks this before merging.
- Constitution §10: the `release.yaml` image starts unattended and passes its `/login` health check.

## Done criteria

- [ ] The image built locally for both platforms has no `busybox`, `busybox-binsh` or `ssl_client` and no `/bin/sh` (e.g. `docker run --entrypoint sh` fails).
- [ ] The image started with no input reaches `healthy` in `docker inspect`; with the server unreachable it becomes `unhealthy`.
- [ ] A local Grype scan of the image reports no CVE-2025-60876, and no new critical or high finding.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] `README.md` documents that the image has no shell, how the health check works and how to debug the pod with `kubectl debug`.
- [ ] `version` in `package.json` bumped to 5.2.4 in `chore(release): Bump version to v5.2.4`.
- [ ] The owner confirmed that the `deployment/panel` probes do not need a shell.
- [ ] After merging, the release run passes the scan, publishes, rolls out (`rollout status`) and alerts #6 to #11 show as fixed in the Security tab.
