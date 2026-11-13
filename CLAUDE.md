# Sabr Plan Co. — notes for Claude

Wedding coordination business site (sabrplanco.com, GitHub Pages) plus a private coordinator portal. The owner works mostly from an iPhone, often with the portal installed to the Home Screen. Explain things in plain, non-technical language and say exactly what they need to do (e.g. which SQL file to run, whether to refresh).

## Stack and layout
- Plain HTML/CSS/JS, **no build step, no package.json**. Everything ships as-is from `main`.
- Public pages: `index.html`, `about.html`, `services.html`, `portfolio.html`, `faqs.html`, `inquiry.html`; shared `styles.css` and `script.js`.
- Portal: `portal/index.html` + `portal.js` (large single file, sections marked with `// ---` banners), `portal/service-worker.js`, `portal/pwa.js`, `portal/manifest.webmanifest`.
- Contract signing page: `sign/index.html` + `sign/sign.js`.
- Backend: Supabase (auth, Postgres with RLS, Storage, Edge Functions). Browser-safe config in `portal-config.js` (publishable key only — never put secret/service keys in browser code).
- Email: Resend from `hello@sabrplanco.com`, replies to `sabrplanco@gmail.com`. Website inquiry form also emails via Web3Forms.
- PDFs: jsPDF (generate), PDF.js 6.4.299 legacy build loaded on demand with `import()` (view), pdf-lib in the `contract-signing` function (sign).

## Workflow rules
- The owner wants changes **committed and pushed to `main`** (the live site deploys from it). Also fast-forward `claude/sabrplancos-website-review-bu21uy` to `main` and push it. Ship unapproved/proof-of-concept work to that branch only.
- **Bump the asset version** on every change to CSS/JS: replace `?v=<current>` in `*.html`, `portal/index.html`, `sign/index.html` (format `YYYYMMDD` + letter, e.g. `?v=20261111c`). Otherwise phones mix cached old files with new HTML.
- Use the text arrow `↗︎` (with U+FE0E), never a bare `↗`, which iPhone renders as an emoji. Prefer inline SVG line icons over emoji.
- Match the aesthetic: espresso `#3b261b`, ivory/paper, champagne `#d5bea5`, rust accent `var(--rust)`; Playfair Display (serif) + DM Sans; thin outlined buttons; dark mode via `.portal-app[data-theme="dark"]`.
- Test at iPhone width (no horizontal overflow) and in dark mode. Playwright + Chromium are available; there is no committed test suite, so write throwaway scripts in the scratchpad.

## Database changes
- Add a new file in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`), idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). The owner runs it by hand in the Supabase SQL Editor, so tell them the filename.
- Every table: enable RLS, `REVOKE ALL ... FROM anon, authenticated`, grant only what's needed, admin policies use `(SELECT public.is_portal_admin())`.
- **Grant `service_role` explicitly** on any table an Edge Function writes with the service key — this project does not grant new tables to it automatically.
- The portal must keep working before a migration is applied: detect the missing table/column (`isMissingTableError`, `isMissingColumnError`) and show a "run this migration" message instead of failing.

## Edge Functions (`supabase/functions/`)
- `send-client-document`, `generate-itinerary`: called with the admin's JWT.
- `contract-signing`: deploy with `supabase functions deploy contract-signing --no-verify-jwt` (the public signing page has no login; the function checks the admin session or signing token itself).
- Deploying needs the Supabase CLI on a computer — the owner can't do it from the phone, so call that out.
- Deno is available for type-checking: `npm i deno@2.1.4` in the scratchpad, then `DENO_CERT=/root/.ccr/ca-bundle.crt <path>/deno check supabase/functions/<name>/index.ts`.

## Things that have bitten us
- The service worker must cache CDN files with `mode: "cors"`; opaque copies break the PDF.js module import.
- Supabase errors on a dropped connection must never sign the coordinator out (`isNetworkError`).
- `crypto.randomUUID` only exists on https pages — use `newUuid()` in `portal.js`.
- Contracts snapshot their settings when saved (`contractDetails`): changing Settings must not alter already-saved or signed contracts.

## People
- The owner's wife is the main coordinator and a primary portal user. Plan for separate portal logins per person (each added to `public.portal_admins`).

## Status and next steps (update as things change)
Built: inquiries → clients/calendar → contracts with e-signature (signatures on the lines, signed PDF shown in portal) → itineraries (offline copies) → emailing → settings (contract details, coordinator signature, theme) → portfolio (portal tab + public page) → pull-to-refresh, PDF.js 6 → phone bottom tab bar (Home = clients with Upcoming/Past + summary cards, Calendar, Inquiries with badge, Portfolio, More = Settings / public site / Sign out; phones open on Home, desktop keeps the sidebar and opens on Calendar).

Owner still to do (as of 2026-11-13):
- Run `supabase/migrations/20261115010000_portfolio.sql` in the Supabase SQL Editor (portfolio tab shows a reminder until then).
- Turn on two-factor auth for Supabase, GitHub, Gmail, IONOS, Resend; check Supabase Auth settings (sign-ups off, password rules); give the wife her own portal login.
- Have an attorney review the contract wording and e-signing process; delete the old Resend API key / `mail.sabrplanco.com` domain.

Next requested work, in order:
1. **Portal security**: TOTP two-factor sign-in enforced by the database (make `is_portal_admin()`/RLS require `aal2`), auto-lock after inactivity, Content Security Policy + Subresource Integrity on CDN scripts; optional sign-in alert emails.
2. Backups / "Export everything" button; payment tracking (deposit/balance paid + due dates); "Request feedback" link that feeds the portfolio; vendor list per client; reminders.
3. Public website content (services and pricing, About story and photo, real portfolio couples) — needs content from the owner.
