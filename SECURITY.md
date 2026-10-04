# Security Policy

## Supported versions
Only the live panel at [panel.figueroa-sanchez.com](https://panel.figueroa-sanchez.com) and the latest `main` branch receive security fixes.

## Reporting a vulnerability
Please **do not** open a public issue for security problems. Instead, email [marco@figueroa-sanchez.com](mailto:marco@figueroa-sanchez.com) with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact

## What to expect
- An acknowledgement within 72 hours.
- Updates as the report is triaged and fixed.
- Credit for the discovery once it's resolved, if you'd like it.

## Scope
**In scope:**
- Sign-in and session handling, for example bypassing the Google sign-in, the session cookie or the route protection
- Token exposure, for example the API token or the Google ID token reaching Web Storage, logs, URLs or third parties
- Unauthorized content changes made through the panel
- Cross-site scripting (XSS) in the panel

**Out of scope:**
- The API and the web (see the [`api`](../api/SECURITY.md) and [`web`](../web) projects' policies)
- Third-party services the panel depends on (e.g. Google sign-in, Vercel)
- Denial-of-service or high-volume testing
