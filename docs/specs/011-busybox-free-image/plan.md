# Plan 011 — BusyBox-free runtime image

- **Spec:** [spec.md](spec.md) (approved 2026-10-28)
- **Status:** Approved
- **Version:** 5.2.4 (fix → patch)

The plan changes only the runtime stage of the `Dockerfile`, `README.md` and `version` in `package.json`. The panel's code, routes, `proxy.ts`, `next.config.ts`, the workflows and the Spec 010 gate (`scripts/sca-gate.mjs`) stay as they are (constitution §2, §5–§8). No npm dependency or Alpine package is added (§1): the health check uses the `node` binary the image already runs. `Panel Tests` keeps gating `main` and the release image still starts unattended and passes `/login` (§10). The owner approved the runtime-stage `Dockerfile` changes on 2026-10-28 (spec Constraints); this plan also clears the base image's `ENTRYPOINT` (D3), which is part of that runtime stage. Pending, listed in **Release**: the owner checks that the probes of `deployment/panel`, which lives outside this repository, need no shell.

## Modules

### Changed: `Dockerfile` (runtime stage only)
| File | Change | RF |
|---|---|---|
| `Dockerfile` | The existing `RUN apk upgrade --no-cache && rm -rf …npm…npx` (Spec 010, D11) also deletes `/usr/local/bin/docker-entrypoint.sh` and ends with `apk del --no-cache busybox busybox-binsh ssl_client` as its **last** command (D1, D2). It stays the stage's only `RUN`. | RF-01–RF-03, RF-08 |
| `Dockerfile` | `ENTRYPOINT []` before `CMD`, so the inherited `docker-entrypoint.sh` (a `#!/bin/sh` script) no longer wraps the start command; `CMD ["node", "server.js"]`, `USER node`, `EXPOSE 3000` and `ENV` are unchanged (D3). | RF-02, RF-07 |
| `Dockerfile` | `HEALTHCHECK` in exec form: `CMD ["node", "-e", "<fetch of http://127.0.0.1:3000/login; exit 0 on a 2xx, 1 on any other status or error>"]`, same `--interval=30s --timeout=3s` (D4, D5). | RF-04–RF-06 |
| `Dockerfile` | The stage comments cite Spec 011 and the decisions (D1–D5), as the Spec 010 comments do. | — |

### Infrastructure
| File | Change |
|---|---|
| `README.md` | **5. Cluster objects**: the image has no shell or BusyBox; the health check runs `node` against `/login`; probes must be `httpGet` (or `tcpSocket`), never `exec` with a shell; debugging uses `kubectl debug -it <pod> --image=busybox --target=panel -n portfolio` (D6). The local `docker run` example stays valid. |
| `package.json` | `version` 5.2.3 → 5.2.4 in `chore(release): Bump version to v5.2.4`. |

## Decisions
| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | Remove the packages with `apk del` in the runtime stage, on top of `node:26-alpine`. | Copy the hardened root filesystem into a `FROM scratch` stage. | `apk del` keeps the base image's metadata (`PATH`, `NODE_VERSION`), its digest pinning and Dependabot updates (RF-03), and removes the packages from the apk database Grype reads in the squashed image (RF-01, RF-08). A `scratch` copy needs every `ENV` restated by hand and changes what the SBOM describes for no extra finding cleared. The lower layers still hold the old files, but no scan or runtime path sees them. |
| D2 | `apk del` is the last command of the stage's single `RUN`; nothing after it needs a shell (`COPY`, `USER`, `ENV` do not). | A second `RUN` after the removal, or `rm` after `apk del`. | Every `RUN` needs `/bin/sh` and every `rm` is a BusyBox applet: once `busybox-binsh` is gone, the build could not run either (RF-02). The shell already running the chain keeps working until it exits. |
| D3 | `ENTRYPOINT []` and the same `CMD ["node", "server.js"]`. | `ENTRYPOINT ["node"]` with `CMD ["server.js"]`. | The base image's entrypoint is a shell script and would stop the container from starting without `/bin/sh` (RF-02, RF-04). Clearing it keeps `CMD` byte for byte (RF-07), so a deployment that overrides `command` or `args` behaves as it does today. |
| D4 | Health check as an inline `node -e` with `fetch`, in exec form. | A `scripts/healthcheck.mjs` copied into the image with a Vitest test. | It is one request with one condition, and Node 26 ships `fetch`. A separate file adds a `COPY` outside the traced standalone output and a test of a one-liner, while the behaviour that matters (healthy/unhealthy in Docker) is only observable in a running container (E3, E4). |
| D5 | Same URL (`http://127.0.0.1:3000/login`), interval and timeout as today; only a 2xx after redirects counts as healthy. | Probe `/` or a new health route. | `wget -q` behaved the same way (follows redirects, fails on non-2xx), so health semantics do not change (RF-04, RF-05); `/login` is outside the `proxy.ts` matcher and answers without a session. A new route is out of scope. |
| D6 | Debug with an ephemeral container (`kubectl debug --target=panel`), documented in the README. | Keep a debug image tag with a shell. | The owner turned down any shell in the image (spec Decisions); an ephemeral container shares the pod's process namespace without changing what is published. |
| D7 | No change to `release.yaml` or the gate: the next release's Grype scan closes alerts #6–#11 by no longer reporting them. | Dismiss the alerts or add an exception now. | Code scanning marks an alert fixed when a later upload of the same category (`sca-image-panel-amd64`/`-arm64`) no longer contains it (RF-09, RF-10); both alternatives were turned down in the spec. |

## RF coverage
| RF | Where | Tests |
|---|---|---|
| RF-01 | `Dockerfile` `RUN … apk del` (D1, D2) | E2 |
| RF-02 | `Dockerfile` `apk del` + `ENTRYPOINT []` (D2, D3) | E2, E3 |
| RF-03 | `Dockerfile` (digests, `apk upgrade`, npm/npx removal unchanged) | E1, E2 |
| RF-04, RF-06 | `Dockerfile` `HEALTHCHECK` exec form (D4, D5) | E3 |
| RF-05 | `Dockerfile` `HEALTHCHECK` (D5) | E4 |
| RF-07 | `Dockerfile` `ENTRYPOINT []`, unchanged `CMD`/`USER`/`EXPOSE`/`ENV` (D3) | E3, E5 |
| RF-08 | `Dockerfile` (D1) | E6, E8 |
| RF-09, RF-10 | No change to `release.yaml` (D7) | E8 |

## Test strategy
There is no unit test: no application or script code changes, so `pnpm test` keeps passing as it is (constitution §4 covers behaviour changes in code). The checks run against the built image; they need Docker Desktop running locally (it is not running today) and Grype installed locally (`brew install grype`) or run as a container.

- **E1** — `docker buildx build --platform linux/amd64,linux/arm64` with the same build args as `release.yaml` finishes without errors; `pnpm lint`, `pnpm test` and `pnpm build` pass.
- **E2** — On each platform: `docker run --rm --entrypoint sh panel` fails (no such file); `docker run --rm --entrypoint node panel -e "…"` confirms that `/bin/sh`, `/bin/busybox`, `/usr/local/bin/npm`, `/usr/local/bin/npx` and `/usr/local/bin/docker-entrypoint.sh` do not exist and that `/lib/apk/db/installed` lists no `busybox`, `busybox-binsh` or `ssl_client`.
- **E3** — `docker run -d -p 3000:3000 panel` with no further input: the logs show the server listening, `curl -I http://localhost:3000/login` returns 200, and `docker inspect --format '{{.State.Health.Status}}'` reaches `healthy`; `docker inspect` shows `Entrypoint` empty, `Cmd` `[node server.js]` and `User` `node`.
- **E4** — The health check fails when `/login` does not answer: a container started with `-e PORT=3001`, so the server listens where the health check does not look, reaches `unhealthy` after three intervals.
- **E5** — Signing in with Google and editing one item through the containerised panel against the production API works as in 5.2.3 (smoke test only; RF-07).
- **E6** — `grype panel --platform linux/<arch>` on both platforms reports no CVE-2025-60876 and no critical or high finding that 5.2.3 did not have.
- **E7** — `kubectl debug -it <pod> --image=busybox --target=panel -n portfolio` opens a shell next to the server (after the rollout; validates the README instructions).
- **E8** — After the merge: the release run passes `Check Findings`, publishes, `rollout status` succeeds and alerts #6–#11 show as fixed in the Security tab.

Not covered automatically: E3–E8 are manual; nothing in CI fails if BusyBox comes back (turned down in the spec; the scan reports it).

## Implementation order
1. `Dockerfile` runtime stage: extend the `RUN` (D1, D2), add `ENTRYPOINT []` (D3), replace the `HEALTHCHECK` (D4, D5), update comments.
2. Build and check locally: E1, E2, E3, E4, E6 (and E5 if a local client ID is at hand).
3. `README.md` (D6).
4. `pnpm lint`, `pnpm test`, `pnpm build`.
5. `chore(release): Bump version to v5.2.4`.

## Release
1. Before merging, the owner checks the probes of `deployment/panel` (`kubectl get deployment panel -n portfolio -o yaml`): none may be `exec` through `sh` or `wget`, and no `command` may call a shell. If any does, switch it to `httpGet` on `/login`, port 3000, before merging.
2. Merge as `chore(release): Version 5.2.4`; tag `5.2.4` with `/tag-release`.
3. Watch the release run (E8) and, once rolled out, try E7.
4. Follow-up: a spec for `web` and `api`, reusing D1–D5.

## Risks
- **`apk del` refuses because another installed package depends on BusyBox:** the build fails at step 1, before anything is published. Mitigation: E1 shows it locally; the packages the base image adds (`libstdc++`, `libgcc`) do not depend on it. If one does, stop and bring the owner the alternative of D1.
- **BusyBox applet symlinks left dangling** (`/bin/ls` → `/bin/busybox`): they are not packages, are not scanned and execute nothing. Accepted; E2 checks that no shell answers.
- **The pod fails to start or turns unready in the cluster** because of an `exec` probe or a `command` that calls a shell: the rollout fails and `rollout status` reports it, while the old ReplicaSet keeps serving. Mitigation: Release step 1.
- **A future base-image digest brings BusyBox back or adds a dependency on it:** the build fails or the scan reports the CVE again; accepted by the spec (no guard).
- **The `node -e` health check costs one short-lived Node process every 30 s:** a few tens of MB for well under a second; it only applies where Docker's `HEALTHCHECK` is honoured (not by Kubernetes, which uses its own probes).
