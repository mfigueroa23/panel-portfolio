# Portfolio Panel
Admin panel for [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com), Marco Figueroa's personal portfolio. The owner signs in with Google and lists, creates, edits and deletes the site content (social links, technologies, highlights, testimonials, contact info, projects, experience, certifications and blog posts), reviews the testimonials visitors submit, writes each text in English and Spanish, publishes projects and posts, writes their Markdown bodies with a live preview, manages uploaded files and chooses the current English and Spanish resume through the [`api`](../api)'s admin endpoints. The panel has no database and no secrets of its own: uploaded files are stored in the API database.

Live at [panel.figueroa-sanchez.com](https://panel.figueroa-sanchez.com).

## Stack
- [Next.js](https://nextjs.org) 16 (App Router, `proxy.ts`, Server Actions) with React 19
- TypeScript (strict) and [Tailwind CSS](https://tailwindcss.com) v4 with the web's color tokens, Inter and Playfair Display
- Google Identity Services for sign-in; the API issues the session token
- [Mermaid](https://mermaid.js.org), loaded only when a Markdown preview has a diagram
- Vitest and Testing Library for tests, ESLint for code quality
- pnpm as package manager

The frontend lives in the sibling [`web`](../web) project and the backend in [`api`](../api).

## Content
Spec 003 (`../docs/specs/003-content-pages/`) added the content pages:
- **Navigation** grouped as Home sections, Pages (projects, experience, certifications, posts) and Media (files). On phones the menu is a full-height drawer with its own scroll and a fixed Log out.
- **Drafts and publishing** for projects and posts: Save draft, Publish and Unpublish; the slug follows the title until edited or first published; lists show Draft/Published and drafts first. Experience is ordered by the start month and certifications keep a manual position.
- **Markdown editor** for project, experience and post bodies: toolbar (heading, bold, link, code, Mermaid, insert file), Split/Write/Preview, and a preview rendered by the API (`POST /markdown/render`), so it matches the site.
- **Files library** at `/files`: images (PNG, JPEG, WebP, GIF, SVG) up to 5 MiB and PDFs up to 10 MiB, uploaded with progress to the API, which stores them in its database. Filter, copy the URL, pick files into fields and bodies, and delete them after seeing which items use them.

## Testimonial review
Spec 004 (`../docs/specs/004-visitor-testimonials/`) lets visitors submit testimonials from the site; they wait in the panel until the owner reviews them:
- **Pending badge**: the navigation shows the number of pending testimonials next to Testimonials (`99+` above 99, hidden at 0). It is loaded with the token from `GET /content/testimonials/pending-count` and refreshed after each approval or rejection.
- **List**: pending submissions first, newest first, labelled "Pending" with their submission date (and "Notification not sent" when the API could not email the owner); approved testimonials follow by position.
- **Review**: the edit form of a pending testimonial shows its email, language and submission date read-only and offers **Save** (stores the edits, stays pending), **Approve** (validates the form first, then sends its values to `POST /content/testimonials/:id/approve`; the API puts it first and deletes the email) and **Reject** (asks "Reject testimonial?", then deletes it with its email).
- **Create**: the owner's testimonials need no review, no email and no position (the API puts them first); the position is edited once approved. The photo is optional and picked or uploaded like other files; without one the site shows the author's initials.

The panel v4 needs the api v5 (testimonial review endpoints and DTOs): release the api first.

## English and Spanish content
Spec 004 also adds a Spanish version of the site (`/es`). The panel stays in English, and every text visitors read can be written in both languages:
- **Bilingual fields**: titles, descriptions, summaries, bodies, roles, periods, labels, names of certifications, testimonial quotes and roles, and reference titles have a Spanish version (`<field>Es`). Names of people and companies, technologies, tags, URLs, dates, images and files are shared.
- **Language tabs**: the forms of bilingual collections show "English" and "Spanish" tabs over one set of values, so switching never loses input. The Spanish tab shows only the bilingual fields, each with its English value as a hint; references edit a Spanish title per row and keep their URL. The Markdown preview follows the tab being edited.
- **Rules**: each Spanish value has the rules and limits of its English field and is never required; an empty one is sent as `null`.
- **Spanish slug** (`slugEs`) for projects and posts: optional, with the format and reserved words of the English slug; it follows the Spanish title until edited, unless the item was published with one. Empty means the Spanish URL uses the English slug; a clash with another item's Spanish URL is shown on the field.
- **"Missing Spanish"**: lists label the items the API reports as not translated (`translated: false`); such items show in English on the Spanish site. Every bilingual collection is listed from its admin `…/all` endpoint with the token.
- **Spanish testimonial submissions** arrive with only the Spanish role and quote; the English ones must be filled before approving.

The panel v5 needs the api v6 (bilingual DTOs and admin lists): release the api first.

The panel v3 needs the api v4 (new endpoints and DTOs): release the api first.

## Resume
Spec 005 (`docs/specs/005-resume-management/`) adds a **Resume** page under Media. The resume is an ordinary PDF of the file library; the page only chooses which one is current for each language, and the api serves it at a stable public link (`GET /resume?lang=en|es`) that never changes when the PDF is replaced:
- **One section per language**: English, then Spanish. Each shows the current PDF (name, size, assignment date, Open PDF), or that English has no public download yet / that Spanish visitors get the English resume, plus the public link with Copy link and Open link.
- **Choose PDF / Replace** opens the file picker limited to PDFs, where a new PDF can also be uploaded. The previous PDF stays in Files.
- **Clear** asks for confirmation first and says what happens to the public link; the PDF stays in Files.
- **Ordering rules**: Spanish can only be chosen once English is assigned, and English can only be cleared after Spanish. If the api still refuses a change (409, e.g. another tab changed it), the message is shown and the page reloads the current resumes.
- **Files**: the delete dialog lists a file's resume uses as "Resume · English" or "Resume · Spanish" and keeps Delete file disabled, with a link to the Resume page, while the file is a current resume.

The panel v5.1 needs the api v6.1 (resume endpoints): release the api first.

## Getting started
```bash
pnpm install
cp .env.example .env.local  # then set API_URL and GOOGLE_CLIENT_ID (see Environment)
pnpm dev                    # http://localhost:3000 (use -p <port> if the API already uses 3000)
```
Signing in locally needs `http://localhost:3000` (or the port you use) as an authorized origin in the Google OAuth client and in the local `cors_origin` table (see [Deployment](#deployment)).

On the dev server the session cookie is not `Secure`, because Safari refuses `Secure` cookies on `http://localhost` and would ask you to sign in again on every reload. Every production build (`pnpm build`, Vercel, the Docker image) sends it as `Secure`, so testing a local production build in Safari needs HTTPS.

## Environment
Both values are inlined at build time by `next.config.ts`, so changing them needs a new build.

| Variable | Description |
|---|---|
| `API_URL` | Base URL of the API. Defaults to `https://api.figueroa-sanchez.com`. |
| `GOOGLE_CLIENT_ID` | OAuth web client ID from Google Cloud. Public (it is not a secret), and it must match the API's `google_client_id` property. |

The session lives in memory and in the httpOnly cookie `panel_session`, which expires with the API token (1 hour). It never reaches `localStorage` or `sessionStorage`.

## Scripts
| Command | Description |
|---|---|
| `pnpm dev` | Run the development server |
| `pnpm build` | Build the standalone production server |
| `pnpm start` | Run the production build |
| `pnpm test` | Unit and component tests (`pnpm test <path>` runs one file) |
| `pnpm lint` | Lint with ESLint |
| `pnpm run approve-builds` | Approve or deny the build scripts of a new dependency in `pnpm-workspace.yaml` (installs, also in CI, fail until it is approved) |

## Deployment
Vercel serves production from `main`. A Docker image on the Kubernetes cluster, behind the Cloudflare tunnel, is the fallback. Switching between them is a manual DNS change.

### 1. Google Cloud OAuth client
In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** of type **Web application**:
- Authorized JavaScript origins: `https://panel.figueroa-sanchez.com` and `http://localhost:3000` (local development).
- No redirect URIs are needed: the panel uses the Google Identity Services button, which returns the ID token to the page.

Copy the client ID: it is `GOOGLE_CLIENT_ID` here and `google_client_id` in the API.

### 2. API properties and CORS origin (SQL)
Run against the API database **before** releasing the API that brings Google sign-in (see the [`api` README](../api/README.md#release-order-for-the-google-sign-in-version-300)):
```sql
INSERT INTO property (key, value) VALUES
  ('google_client_id', '<client id>.apps.googleusercontent.com'),
  ('admin_google_email', '<owner Google email>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO cors_origin (origin, enabled) VALUES ('https://panel.figueroa-sanchez.com', true)
ON CONFLICT (origin) DO UPDATE SET enabled = true, updated_at = now();
```
For local development, insert `http://localhost:3000` into the **local** `cors_origin` table only.

### 3. Vercel project
1. Import the `panel` repository in Vercel (framework preset: Next.js). The Git integration deploys every push to `main` to production; `output: 'standalone'` is ignored there.
2. Set the environment variables `API_URL` (`https://api.figueroa-sanchez.com`) and `GOOGLE_CLIENT_ID` for Production.
3. Add the domain `panel.figueroa-sanchez.com` and point the `panel` DNS record to Vercel as it indicates.

Preview deployments build, but sign-in fails there because their origins are authorized neither in Google nor in `cors_origin`.

### 4. DNS failover
If Vercel is down, switch the `panel` DNS record in Cloudflare from Vercel to the Cloudflare tunnel route that serves `deployment/panel`. Switch it back when Vercel recovers. The origin stays `https://panel.figueroa-sanchez.com`, so Google sign-in and CORS keep working without changes.

### 5. Cluster objects
`release.yaml` updates an existing deployment, so create these once in the `portfolio` namespace:
- `deployment/panel` with a container named `panel` running `<DOCKERHUB_USERNAME>/portfolio-panel` on port 3000 (the image runs as `node` and has a health check on `/login`).
- A `Service` for port 3000 and the ingress (Traefik) host `panel.figueroa-sanchez.com`.
- The Cloudflare tunnel route for that host (used only while DNS points to the tunnel).

The image has no shell and no BusyBox (Spec 011): it starts `node server.js` directly, and its Docker health check runs `node` to fetch `/login`. Liveness and readiness probes must therefore be `httpGet` (or `tcpSocket`), never `exec` with a shell, and `command`/`args` must not call one. To debug a running pod, attach an ephemeral container that shares its processes:
```bash
kubectl debug -it <pod> --image=busybox --target=panel -n portfolio
```

The Docker Hub repository `portfolio-panel`, the GitHub variables `DOCKERHUB_USERNAME`, `GOOGLE_CLIENT_ID` and `BUMP_APP_ID`, and the Actions secrets `DOCKERHUB_TOKEN`, `API_URL`, `LOCAL_NETWORK`, `KUBE_CONFIG` and `BUMP_APP_PRIVATE_KEY` must exist too. `BUMP_APP_*` belong to the `portfolio-version-bump` GitHub App shared with the web, installed on this repository; they are Actions secrets, never Dependabot secrets.

To build and run the image locally:
```bash
docker build --build-arg API_URL=https://api.figueroa-sanchez.com --build-arg GOOGLE_CLIENT_ID=<client id> -t panel .
docker run -p 3000:3000 panel
```

## CI/CD
- **Panel Tests** (`.github/workflows/test.yaml`): lint, tests and build on every push and on pull requests to `main`.
- **Panel Release** (`.github/workflows/release.yaml`): on push to `main`, verifies the build, builds a multi-platform Docker image (`linux/amd64`, `linux/arm64`) into a registry local to the job and scans both platforms with Grype. A critical or high finding with a fixed version stops the release before anything reaches Docker Hub. Otherwise it copies the scanned image to Docker Hub tagged `latest`, the `package.json` version and `sha-<commit>`, uploads one SPDX SBOM per platform as the artifact `portfolio-panel-<version>-sbom`, and rolls the scanned digest out to `deployment/panel`, waiting for the rollout.
- **Panel CodeQL** (`.github/workflows/codeql.yaml`): CodeQL `security-extended` for `actions` and `javascript-typescript` on pull requests to `main`, on push to `main` and daily. The `main` ruleset blocks a PR that introduces a high or critical alert. It replaces GitHub's default setup, which stays disabled.
- **Panel SCA** (`.github/workflows/sca.yaml`): the `Lockfile Scan` runs Grype on `pnpm-lock.yaml` on pull requests to `main` and daily, and fails on a critical or high finding with a fixed version. Findings go to the job summary and to code scanning.
- **Dependabot** (`.github/dependabot.yml`): weekly npm, GitHub Actions and Docker base-image updates, with minor and patch grouped per ecosystem and each major in its own PR; security updates open at once. Nothing merges automatically.
- **Panel Version Bump** (`.github/workflows/dependabot-bump.yaml`): adds one signed `chore(release): Bump version to vX.Y.Z` commit (`main` + 1 patch) to every Dependabot PR, and redoes it when `main`'s version changes.
- **Vercel**: deploys `main` to production through its Git integration.

### Scan exceptions
A finding that cannot be fixed yet can be accepted for a while in `.github/sca-exceptions.json`, shared by the lockfile and image scans:
```json
[{ "id": "GHSA-xxxx-xxxx-xxxx", "reason": "Why it is accepted and what removes it", "expires": "YYYY-MM-DD" }]
```
An entry covers its advisory (and the related CVE) through its expiry day (UTC) and is listed as excepted. An expired entry stops covering it, and an entry without `id`, `reason` or a valid `expires` fails the check.

## Contributing
Read [`AGENTS.md`](AGENTS.md) and [`docs/constitution.md`](docs/constitution.md) first. New features start from a spec in `docs/specs/NNN-*/spec.md` (cross-repo specs in `../docs/specs/`), and commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Security
See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Contact
- **Email:** [marco@figueroa-sanchez.com](mailto:marco@figueroa-sanchez.com)
- **Website:** [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com)
- **LinkedIn:** [mfigueroa23](https://www.linkedin.com/in/mfigueroa23)

## License
[MIT](LICENSE) © 2026 Marco Antonio Figueroa Sanchez
