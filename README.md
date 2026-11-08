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

The portal's browser-safe Supabase connection settings belong in `portal-config.js`: the Project URL and Publishable key are intended for client-side use. Never put a Secret/service-role key there. The portal loads client workspaces from Supabase, saves contract/itinerary drafts in `document_drafts`, and stores uploaded PDFs in the private `portal-documents` bucket with metadata in `client_documents`. Drafts and PDFs are restricted to allowlisted admins by RLS and storage policies. Deleting a client workspace from its workspace screen removes its calendar entry, drafts, uploaded PDFs, and email history; this action requires confirmation and is permanent. The contract template uses the supplied sample's service and cancellation terms, accepts client and event details, calculates the deposit (30% by default) and balance, and can be downloaded as a PDF; have the draft reviewed and approved before client use. Template drafts can be deleted from their view screens; itinerary times are entered in 12-hour format with separate AM/PM selectors and stored as 24-hour times. PDFs are rendered in-page with a custom preview and page controls, and saved PDFs can be downloaded from their view screens; saved itineraries open directly in view mode. Generated itineraries and contracts use the existing Sabr script logo with selectable text and vector elements for crisp zooming; long content flows across pages with page numbers.

## Client document email setup

The portal sends a saved uploaded PDF or generated contract/itinerary PDF as an email attachment through Resend. Email forms let the admin add recipients one at a time (up to five) and remove them before sending. Itinerary emails can be sent to either the client or vendors, with the vendor message template automatically selected; contracts are sent to clients. The admin reviews the recipient list, subject, and message, confirms the send, and successful sends are recorded in `email_deliveries`. Messages are sent from the verified `RESEND_FROM_EMAIL` address, and replies are directed to `sabrplanco@gmail.com`. Sending requires the migration and Supabase Edge Function below; it will not work until a verified Resend sender and server-side secrets are configured.

1. Apply `supabase/migrations/20261108010000_email_deliveries.sql` in the Supabase SQL Editor.
2. Verify a sender domain/address in Resend. Use a sender on that verified domain for `RESEND_FROM_EMAIL`.
3. Install and log in to the Supabase CLI, link the local project with `supabase link`, then deploy the function:

   ```sh
   supabase functions deploy send-client-document
   ```

4. Configure the secrets in the linked Supabase project. Replace the example sender with an address on your verified domain; enter the actual API key directly in your terminal, and never add it to browser code or a committed file:

   ```sh
   supabase secrets set RESEND_API_KEY=re_your_secret_key RESEND_FROM_EMAIL='Sabr Plan Co. <documents@mail.sabrplanco.com>' PORTAL_ALLOWED_ORIGINS='http://localhost:8000,https://portal.sabrplanco.com'
   ```

5. Test with your own email address and a disposable client before sending client documents. The Edge Function checks the authenticated portal admin and client workspace before sending, and limits attachments to PDFs no larger than 15 MB.

Resend cannot send as a free `@gmail.com` address. Keep the verified-domain address as the sender and use the function's `reply_to` value to route client replies to the business Gmail inbox. Redeploy the function after changing its code.

## AI itinerary generation

The itinerary editor includes an optional Google Gemini-assisted draft generator. It sends the coordinator's itinerary notes, optional other notes, and the selected client's name, wedding date, and venue to Google Gemini. The notes are processed by Google; do not include sensitive information you do not want sent to that provider. Generation requires an explicit confirmation in the portal, and its response is only placed into the editable form—it is not saved or emailed automatically.

Generated and manually created itineraries use separate **Pre-Event** and **Event** sections. Each event includes a time, event description, vendor, and coordination notes. Optional **Other Notes** appear after both timeline sections. Review the timeline and all generated details before saving or sharing.

When an itinerary PDF is selected, the coordinator can separately choose **Convert PDF to formatted draft**. PDF text is extracted in the browser and only the extracted text, client name, wedding date, and venue are sent to Gemini after explicit consent; the source PDF is not changed. The converted content appears in the editable itinerary template and does not replace the original PDF. Save the original separately if it should also be retained in the workspace. The saved formatted itinerary can be downloaded or emailed as a styled PDF. Scanned/image-only PDFs without selectable text require OCR before conversion.

1. Create a Gemini API key in Google AI Studio.
2. Store it as a Supabase Edge Function secret. Never put it in `portal-config.js` or other browser code:

   ```sh
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   ```

3. Deploy the authenticated function:

   ```sh
   supabase functions deploy generate-itinerary
   ```

The function uses the same `PORTAL_ALLOWED_ORIGINS` setting as client email delivery and checks the signed-in user against the portal admin allowlist before accessing Gemini. Redeploy it after changing its code so structured event details, vendor assignments, and notes are available to AI-generated drafts.

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
- The coordinator portal uses Supabase email/password authentication and checks the `portal_admins` allowlist before showing its dashboard. Its database integration still needs an end-to-end test with disposable records and a PDF, plus verification from a non-admin account, before you use it for real client information or documents. The sign-in screen must be served from a deployed HTTPS host before the portal can be used at `portal.sabrplanco.com`. The sample-derived contract remains a draft and must be reviewed and approved before client use.
