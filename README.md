# Sabr Plan Co.

A responsive static website for wedding coordination and planning in New Jersey, New York, and beyond.

## Pages

- `index.html` — Home
- `about.html` — About
- `services.html` — Day-of coordination and wedding planning
- `portfolio.html` — Couple stories, photo, and review placeholders
- `faqs.html` — Frequently asked questions
- `inquiry.html` — Web3Forms inquiry form and direct contact details
- `portal.html` — Unlisted, admin-only coordinator portal

The shared visual styles live in `styles.css`, `script.js` provides public-site interactions, and `portal.js` runs the coordinator portal. This site uses plain HTML, CSS, and JavaScript; no build step or package installation is needed.

## Coordinator portal security setup

The portal database schema and Row Level Security policies are in `supabase/migrations/20261107010000_portal_schema.sql`. Apply this migration in the Supabase SQL Editor before connecting the portal. It creates a private PDF bucket and restricts client records, document drafts, and files to users explicitly listed in `public.portal_admins`.

After applying the migration, add the approved admin account to `public.portal_admins` from the Supabase SQL Editor. Do not grant portal access by adding broad authenticated-user policies; only allowlisted admin accounts should access client data. Never put a Supabase service-role/secret key in browser code.

The portal's browser-safe Supabase connection settings belong in `portal-config.js`: the Project URL and Publishable key are intended for client-side use. Never put a Secret/service-role key there. The portal loads client workspaces from Supabase, saves contract/itinerary drafts in `document_drafts`, and stores uploaded PDFs in the private `portal-documents` bucket with metadata in `client_documents`. Drafts and PDFs are restricted to allowlisted admins by RLS and storage policies. The contract template uses the supplied sample's service and cancellation terms, accepts client and event details, calculates the deposit (30% by default) and balance, and can be downloaded as a PDF; have the draft reviewed and approved before client use. Template drafts can be deleted from their view screens; itinerary times are entered in 12-hour format with separate AM/PM selectors and stored as 24-hour times. PDFs are rendered in-page with a custom preview and page controls, and saved PDFs can be downloaded from their view screens; saved itineraries open directly in view mode.

Password recovery redirects back to `portal.html` on the current host. In Supabase Authentication URL Configuration, allow both `http://localhost:8000/portal.html` and `https://portal.sabrplanco.com/portal.html` as redirect URLs. Keep the production Site URL set to `https://portal.sabrplanco.com`. The production portal URL must be deployed before production password resets can be tested.

## Preview locally

Open `index.html` in a browser, then use the navigation to move between pages.

## Before publishing

- The website palette is inspired by the supplied Sabr Plan Co. logo: espresso brown, ivory, and warm champagne. The original is preserved in `assets/sabr-plan-co-logo.png`, and the exact script lettering is isolated for use on the site in `assets/sabr-script.png`.
- The portfolio page includes sample couple tabs and clearly marked photo/review placeholders. Replace them with real names, photos, and client-approved testimonials before presenting them as past work.
- `assets/sample-wedding-itinerary.pdf` is a fictional sample file for testing the coordinator portal's PDF upload and preview.
- `assets/sample-wedding-coordination-contract.pdf` is a fictional sample file for testing contract PDF upload and preview; it is not legal language or a usable contract.
- Review the starter copy and FAQ answers, and replace or expand them with approved business details.
- The inquiry form submits to Web3Forms. Its public client-side access key is in the form markup; verify `sabrplanco@gmail.com` in Web3Forms and send a test submission before relying on delivery.
- The coordinator portal uses Supabase email/password authentication and checks the `portal_admins` allowlist before showing its dashboard. Its database integration still needs an end-to-end test with disposable records and a PDF, plus verification from a non-admin account, before you use it for real client information or documents. The sign-in screen must be served from a deployed HTTPS host before the portal can be used at `portal.sabrplanco.com`. The contract editor remains a structure placeholder—not a usable contract—until your approved template is provided.
