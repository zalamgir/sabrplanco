# Sabr Plan Co.

A responsive static website for wedding coordination and planning in New Jersey, New York, and beyond.

## Pages

- `index.html` — Home
- `about.html` — About
- `services.html` — Day-of coordination and wedding planning
- `portfolio.html` — Couple stories, photo, and review placeholders
- `faqs.html` — Frequently asked questions
- `inquiry.html` — Web3Forms inquiry form and direct contact details
- `portal.html` — Unlisted coordinator portal prototype; use sample data only

The shared visual styles live in `styles.css`, `script.js` provides public-site interactions, and `portal.js` runs the separate portal demo. This site uses plain HTML, CSS, and JavaScript; no build step or package installation is needed.

## Preview locally

Open `index.html` in a browser, then use the navigation to move between pages.

## Before publishing

- The website palette is inspired by the supplied Sabr Plan Co. logo: espresso brown, ivory, and warm champagne. The original is preserved in `assets/sabr-plan-co-logo.png`, and the exact script lettering is isolated for use on the site in `assets/sabr-script.png`.
- The portfolio page includes sample couple tabs and clearly marked photo/review placeholders. Replace them with real names, photos, and client-approved testimonials before presenting them as past work.
- Review the starter copy and FAQ answers, and replace or expand them with approved business details.
- The inquiry form submits to Web3Forms. Its public client-side access key is in the form markup; verify `sabrplanco@gmail.com` in Web3Forms and send a test submission before relying on delivery.
- The coordinator portal is only an interactive prototype. Its demo login is not authentication, and client entries, draft documents, and uploaded PDFs stay in browser memory only. Do not enter real client details or upload real contracts or itineraries. A production portal needs server-side authentication and private database/file storage before it handles client information.
