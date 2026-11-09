# Public CTA and portal-link polish

Verified 9 November 2026 against `7be1a79` with local synthetic fixtures.

## Changes

- Lower the general anchor reset specificity so button text colors work on both dark and light backgrounds. Remove obsolete button color overrides.
- The lower homepage viewing CTA now uses the same ink-on-paper colors as the navbar CTA.
- Remove public login/portal entry points from the footer, Ownership, Contact and villa detail. Remove the villa detail section whose sole action was portal access; existing viewing/contact actions remain.
- Private login, buyer and office routes are unchanged. No database or release configuration changes.

## Verification

- Typecheck, production build and all 287 existing unit tests pass. No lint script is configured. The local build uses the same non-delivery placeholder environment as CI.
- Browser inspection at 1440, 390 and 320 pixels: readable CTA text, no horizontal overflow on checked pages, clean footer links and working mobile menu.
- Homepage CTA click reaches `/contact`; the contact mail link is preserved without sending email.
- Checked rendered homepage, Ownership, Contact and a fixture villa detail: no links to login, buyer or office routes.
- The corrected CTA and navbar CTA both compute to `rgb(40, 61, 50)` text on `rgb(245, 242, 236)` background. Hover retains readable text; keyboard focus has a visible outline. Targeted axe scan of the paper CTA: zero violations.
- Next.js compilation issues are empty; final Contact runtime check has no errors. The dev server still emits existing uncached-data/instant-navigation diagnostics for database-backed public routes; no data-fetching logic was changed.
- The broader CTA-band scan flags existing secondary eyebrow/note contrast. Those colors are outside this button/link correction and are unchanged.

Screenshots show the corrected homepage CTA and footer at desktop and mobile widths. The development indicator and local fixture content are not production UI.
