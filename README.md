# Portfolio Panel
Admin panel for [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com), Marco Figueroa's personal portfolio. The owner signs in with Google and lists, creates, edits and deletes the site content (social links, technologies, highlights, testimonials, contact info, projects, experience, certifications and blog posts), reviews the testimonials visitors submit, writes each text in English and Spanish, publishes projects and posts, writes their Markdown bodies with a live preview and manages uploaded files through the [`api`](../api)'s admin endpoints. The panel has no database and no secrets of its own: uploaded files are stored in the API database.

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

## Getting started
```bash
pnpm install
cp .env.example .env.local  # then set API_URL and GOOGLE_CLIENT_ID (see Environment)
pnpm dev                    # http://localhost:3000 (use -p <port> if the API already uses 3000)
```
Signing in locally needs `http://localhost:3000` (or the port you use) as an authorized origin in the Google OAuth client and in the local `cors_origin` table (see [Deployment](#deployment)).

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

The Docker Hub repository `portfolio-panel`, the GitHub variables `DOCKERHUB_USERNAME` and `GOOGLE_CLIENT_ID`, and the secrets `DOCKERHUB_TOKEN`, `API_URL`, `LOCAL_NETWORK` and `KUBE_CONFIG` must exist too.

To build and run the image locally:
```bash
docker build --build-arg API_URL=https://api.figueroa-sanchez.com --build-arg GOOGLE_CLIENT_ID=<client id> -t panel .
docker run -p 3000:3000 panel
```

## CI/CD
- **Panel Tests** (`.github/workflows/test.yaml`): lint, tests and build on every push and on pull requests to `main`.
- **Panel Release** (`.github/workflows/release.yaml`): on push to `main`, verifies the build, builds a multi-platform Docker image (`linux/amd64`, `linux/arm64`), pushes it to Docker Hub tagged `latest`, the `package.json` version and `sha-<commit>`, and rolls it out to `deployment/panel`, waiting for the rollout.
- **Vercel**: deploys `main` to production through its Git integration.

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
