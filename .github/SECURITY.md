# Security Policy

## Supported Versions

Only the latest version deployed at [https://www.aniraku.tech] receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, please report them privately:

1. **Preferred**: Email `security@aniraku.dev` (if configured) or open a [private security advisory](https://github.com/Aniraku/Aniraku/security/advisories/new) on GitHub.
2. Include a detailed description, steps to reproduce, and any proof-of-concept code.
3. You will receive a response within **72 hours** with next steps.
4. We will coordinate a fix and disclose the vulnerability responsibly after it's patched.

## Scope

Security issues in the following areas are in scope:

- **Authentication & authorization** — Supabase JWT handling, session management
- **Data exposure** — Unintended data leaks via API responses or client-side state
- **Injection vectors** — XSS via anime metadata, search inputs, or URL parameters
- **CSP bypass** — Content Security Policy weaknesses in `index.html` or `vercel.json`
- **Dependency vulnerabilities** — Critical/high CVEs in npm dependencies

## Out of Scope

- Issues in the separate Go backend repository (report those there)
- Issues in third-party services (AniList, Supabase)
- Phishing or social engineering attacks
- Missing security headers already covered by `vercel.json`

## Disclosure Policy

- We follow a **90-day responsible disclosure** timeline.
- We ask that you not publicly disclose the vulnerability until we have released a fix.
- We will credit researchers who responsibly report valid vulnerabilities (if desired).
