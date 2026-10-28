# Tasks 011 — BusyBox-free runtime image

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `E#` = tests listed in the plan's test strategy (the plan has no unit tests).

## Phase 0 — Gate

- [x] **T01 — Local image tooling**
  - **RF:** —
  - **Depends on:** — (can run in parallel with T02)
  - **Scope:** Start Docker Desktop and make Grype available, either installed (`brew install grype`, owner approval) or run as the `anchore/grype` container. Needed by E1–E4 and E6 (plan, Test strategy).
  - **Done when:** `docker version` prints a `Server` section, and `grype version` (or `docker run --rm anchore/grype version`) prints a version.
  - **Result (2026-10-28):** Docker Desktop server 29.9.2 (linux/arm64, containerd image store); Grype runs as the `anchore/grype:v0.120.1` container, the version `release.yaml` uses, so nothing is installed on the host.

- [x] **T02 — Cluster probes need no shell (owner)**
  - **RF:** RF-07
  - **Depends on:** — (can run in parallel with T01; blocks only T09)
  - **Scope:** The owner runs `kubectl get deployment panel -n portfolio -o yaml` and checks that no liveness/readiness/startup probe is `exec` through `sh` or `wget` and that no `command`/`args` calls a shell (plan, Release step 1). If one does, switch it to `httpGet` on `/login`, port 3000, before merging.
  - **Done when:** the owner confirms in the PR that the deployment's probes are `httpGet`/`tcpSocket` (or absent) and no `command` calls a shell.
  - **Result (2026-10-28):** read with the owner's `home-server-01` context: liveness and readiness are `httpGet` on `/login`, port 3000; no startup probe; `command` and `args` are unset; the container already runs with `readOnlyRootFilesystem` and all capabilities dropped. The PR repeats this for the owner's confirmation.

## Phase 1 — Runtime image

- [x] **T03 — Remove BusyBox, clear the entrypoint, node health check**
  - **RF:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07
  - **Depends on:** T01
  - **Scope:** `Dockerfile`, runtime stage only. The single `RUN` keeps `apk upgrade --no-cache` and the npm/npx removal, also deletes `/usr/local/bin/docker-entrypoint.sh`, and ends with `apk del --no-cache busybox busybox-binsh ssl_client` (D1, D2). Add `ENTRYPOINT []` before the unchanged `CMD ["node", "server.js"]` (D3). Replace the `HEALTHCHECK` with the exec-form `node -e` fetch of `http://127.0.0.1:3000/login`, same interval and timeout, healthy only on a 2xx (D4, D5). Comments cite Spec 011 and D1–D5. Build stage, digests, `ENV`, `USER`, `EXPOSE` untouched.
  - **Done when:** E1 passes (the `linux/amd64,linux/arm64` build finishes) and E2 passes on both platforms (`docker run --rm --entrypoint sh` fails; `/bin/sh`, `/bin/busybox`, npm, npx and `docker-entrypoint.sh` are absent; `/lib/apk/db/installed` lists no `busybox`, `busybox-binsh` or `ssl_client`).
  - **Result (2026-10-28):** checks run first against the 5.2.3 runtime (red: `sh`, `/bin/busybox`, `docker-entrypoint.sh` and the three packages present), then green on the new image for both platforms. A plain `apk del` refused because `alpine-baselayout` requires `/bin/sh`; resolved by plan D8 (`alpine-baselayout-data` kept in the world, `alpine-baselayout` removed). The build purges exactly `alpine-baselayout`, `busybox-binsh`, `ssl_client` and `busybox` (15 packages left).

- [x] **T04 — Container starts and reports its health**
  - **RF:** RF-02, RF-04, RF-05, RF-06, RF-07
  - **Depends on:** T03 (can run in parallel with T05)
  - **Scope:** Run the T03 image as the plan describes, with no further input and then with `-e PORT=3001`; smoke test sign-in and one edit against the production API if a local client ID is at hand.
  - **Done when:** E3 passes (`/login` returns 200, health `healthy`, `Entrypoint` empty, `Cmd` `[node server.js]`, `User` `node`), E4 passes (`unhealthy` after three intervals) and E5 passes or is noted in the PR as skipped with the reason.
  - **Result (2026-10-28):** E3 and E4 pass on linux/arm64 (the cluster node's architecture) and linux/amd64: `Entrypoint` null, `Cmd` `["node","server.js"]`, `User` `node`, `healthy` and `/login` 200; `unhealthy` with `PORT=3001`. E5 skipped: it needs the owner's interactive Google sign-in and an image built with the production client ID; it is left for the owner on the PR.

- [x] **T05 — Local image scan**
  - **RF:** RF-01, RF-08
  - **Depends on:** T03 (can run in parallel with T04)
  - **Scope:** Grype on the T03 image for `linux/amd64` and `linux/arm64`, compared with the 5.2.3 findings in code scanning.
  - **Done when:** E6 passes: no CVE-2025-60876 on either platform and no critical or high finding that 5.2.3 did not have.
  - **Result (2026-10-28):** Grype v0.120.1 (database built 2026-10-28) on `docker save` archives: 0 matches on linux/amd64 and linux/arm64, against 3 on the 5.2.3 runtime (CVE-2025-60876 in `busybox`, `busybox-binsh`, `ssl_client`).

## Phase 2 — Documentation, verification and release

- [x] **T06 — README: image without a shell**
  - **RF:** RF-02, RF-04
  - **Depends on:** — (can run in parallel with T03–T05)
  - **Scope:** `README.md`, **5. Cluster objects**: the image has no shell or BusyBox; the health check runs `node` against `/login`; probes must be `httpGet` or `tcpSocket`, never `exec` with a shell; debugging with `kubectl debug -it <pod> --image=busybox --target=panel -n portfolio` (D6).
  - **Done when:** `README.md` section 5 states those four points and the local `docker build`/`docker run` example is unchanged.
  - **Result (2026-10-28):** a check over section 5 failed on the four points before the edit and passes after it; the `docker build`/`docker run` example is unchanged.

- [x] **T07 — Quality gate**
  - **RF:** —
  - **Depends on:** T03, T06
  - **Scope:** The closing checklist of `AGENTS.md`.
  - **Done when:** `pnpm lint`, `pnpm test` and `pnpm build` finish with 0 errors (part of E1).
  - **Result (2026-10-28):** `pnpm lint` exit 0, `pnpm test` 520 tests in 38 files pass, `pnpm build` exit 0.

- [x] **T08 — Version 5.2.4**
  - **RF:** —
  - **Depends on:** T04, T05, T07
  - **Scope:** `version` in `package.json` from 5.2.3 to 5.2.4 (fix → patch).
  - **Done when:** the last commit of the branch is `chore(release): Bump version to v5.2.4` and changes only `version`.
  - **Result (2026-10-28):** ticked with T06 and T07; the bump is the commit that follows.

- [ ] **T09 — Pull request and merge**
  - **RF:** RF-10
  - **Depends on:** T02, T08
  - **Scope:** Open the PR from `fix/spec-011` (`/create-pr`) with T02's confirmation and E1–E6 results; merge as `chore(release): Version 5.2.4` and tag `5.2.4` (`/tag-release`).
  - **Done when:** `Panel Tests`, CodeQL and `Lockfile Scan` are green on the PR, it is merged into `main`, and tag `5.2.4` points at the merge commit.

- [ ] **T10 — Release verification**
  - **RF:** RF-08, RF-09, RF-10
  - **Depends on:** T09
  - **Scope:** Watch the `Panel Release` run of the merge commit and the Security tab; try the README debugging command on the new pod.
  - **Done when:** E8 passes (`Check Findings` green, image published, `rollout status` succeeds, alerts #6–#11 shown as fixed) and E7 passes (`kubectl debug` opens a shell next to the server).

## RF → tasks
| RF | Tasks |
|---|---|
| RF-01 | T03, T05 |
| RF-02 | T03, T04, T06 |
| RF-03 | T03 |
| RF-04 | T03, T04, T06 |
| RF-05 | T03, T04 |
| RF-06 | T03, T04 |
| RF-07 | T02, T03, T04 |
| RF-08 | T05, T10 |
| RF-09 | T10 |
| RF-10 | T09, T10 |
