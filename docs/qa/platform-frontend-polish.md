# Platform frontend polish: review branch

Date: 4 November 2026

Branch: `feat/platform-frontend-polish`, based on `5a3571381e1bc36d220f6e8b94580fa5498a7630`.

**Do not merge or promote to production until Jayden explicitly approves.**

## Included

1. Shared mobile header/drawer for owner and office platforms. Desktop sidebars retained. The menu uses a native modal dialog, keyboard focus containment, Escape/backdrop closing, focus return, scroll lock and desktop-resize cleanup. Existing role-filtered links and villa-preserving URLs are reused.
2. Mobile payment summaries and readable record cards for buyers; labelled mobile rows for office residences, buyers and payments. Existing record details, filters, exports and confirmation flows are retained.
3. Consistent stroke icons, account spacing, readable labels/contrast and branded sign-in/check-email screens using the existing local fonts and palette.
4. Contact email action with a sanitized project/villa subject, without personal or financial fields. Latest usable already-authorized project photograph takes priority; no-photo states are explicit and illustrative references are separately labelled/collapsed.
5. Retryable owner sign-out feedback, preserving real Auth.js invalidation and Next redirect behavior.

## Review decision

The contact action currently uses `hello@vandertweel.com`, matching the existing public contact page. Confirm that this is also the owner-support destination before merging. No telephone number, response-time promise or new messaging service was invented. No email was sent to validate the mailbox.

## Checks

- 192 tests across 21 files passed. New targeted coverage includes usable photo selection, safe contact subjects and failed/retried sign-out.
- TypeScript and diff checks passed. The production build starts successfully; its login page hydrates, enables the form and renders without browser errors or overflow at 390px. No QA fixture route is present in the built application.
- Local browser checks at 320, 390, 768 and 1440px: no page-level horizontal overflow in checked overview/payment/login screens; mobile menu and desktop sidebar visibility correct.
- Native mobile menu: keyboard focus, Escape, scroll unlock, link navigation and desktop-resize cleanup checked. Owner menu remains open across the normal 20-second polling refresh.
- PM menu contains only Overview, Villas and Your updates. Developer retains all permitted links.
- Owner residence change keeps the payment page and updates the selected villa URL.
- Actual local Auth.js sign-out tested using a synthetic JWT: simulated network failure exposes retry; successful retry clears the session and protected routes redirect to login.
- English login success/error responses simulated without sending mail. Check-email return link and narrow viewport checked.
- Project photograph precedence, absent-photo state, contact href and office payment filtering checked.
- Axe WCAG 2 A/AA scans on checked buyer payments, office overview and check-email screens: zero automatic violations after contrast fixes. Incomplete checks still require human review; the closed-dialog aria-controls target was manually confirmed to exist. This is not a claim of complete accessibility certification.
- Next dev compilation/runtime diagnostics clear at final check.

## Evidence limits / scope

Browser account/data fixtures were local and synthetic. Their route, temporary rewrites, cookies and dev caches are not part of this branch. No authentication bypass, database migration, production write or live email delivery test is included.

Backend contracts, authorization, automatic refresh, email-preference behavior, public-site code and magic-link request/routing logic are unchanged. File upload/PM-photo authoring and other previously deferred features are not implemented by this UI-only round.

Production build and remote CI results are recorded in the pull request.

## Review screenshots

The buyer/office screenshots use synthetic local QA data, not customer records. Login is captured from the production build.

- [Buyer mobile menu](platform-polish/buyer-menu-mobile.png)
- [Buyer mobile payments](platform-polish/buyer-payments-mobile.png)
- [Office mobile payments](platform-polish/office-payments-mobile.png)
- [Branded mobile login](platform-polish/login-production-mobile.png)
