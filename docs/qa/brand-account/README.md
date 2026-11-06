# Shared brand and account navigation

Date: 6 November 2026. Base: `b0445a1` (latest main at start).

## Changes

- Shared, decorative double-arch SVG matching the login identity, with a consistent 27:33 aspect ratio. Used by public navigation/footer, login/check-email, buyer and office sidebars, mobile headers and mobile drawer headings. The browser icon uses the same paths; the generic Next.js favicon is removed.
- Removed the avatar/name/role block from buyer and office sidebars and the mobile menu footers. Personal identity and sign-out live on Account.
- Added `/office/account` and an Account navigation entry for developer and PM, using current database identity and existing sign-out behavior. Buyer Account retains its existing notification preference behavior and now displays the buyer name and role alongside email.
- Office Account validates access without loading customer, payment, file or update details. A PM with no assignments can still access their account. Project/villa navigation context and read-only buyer preview boundaries are preserved.
- Corrected public navigation gutters where padding shorthand had overridden the shared horizontal spacing. Corrected the heading hierarchy inside buyer Account while retaining its appearance.
- No database schema/migration, authentication mechanism, email-delivery or billing behavior changes.

## Verification

- 270 unit tests across 29 files pass; includes account identity, buyer denial, unauthorized project selection, unassigned PM, query minimization and existing sign-out coverage.
- Typecheck and production build pass. Independent read-only review found no blocking account-access or preview-session issue.
- Real local magic-link sign-in for developer, PM and buyer, using the existing Auth.js flow with local-only mail capture and synthetic PostgreSQL fixtures. No hosted database was changed and no external mail sent.
- Account pages and navigation inspected at 390 px and desktop 1440 px. Buyer and PM checked at 320 px: no horizontal overflow. Website navigation/footer checked at 390/1440 px; mobile website menu opens, closes and navigates.
- Buyer and office mobile drawers show Account; the removed identity/avatar elements are absent. PM navigation remains restricted to Overview, Residences, Your updates and Account.
- Direct PM navigation to `/office/betalingen` renders the existing unavailable-page boundary, not financial content. Buyer requests to `/office/account` redirect to the owner platform.
- Sign-out from Account tested for all three roles: returns to login, `/api/auth/session` has no user.
- Targeted axe checks: office account content, buyer account sections and public navigation have zero violations. This is not an exhaustive accessibility audit.

Screenshots below are local development renders, not evidence of a hosted rollout. Any development indicator and all account identities are test-only.

## Screenshots

- [Public mobile](website-390.png), [desktop](website-1440.png), [mobile menu](website-menu-390.png).
- [Public footer mobile](website-footer-390.png), [desktop](website-footer-1440.png).
- [Login mobile](login-390.png).
- [Buyer Account mobile](owner-account-390.png), [desktop](owner-account-1440.png), [mobile menu](owner-menu-390.png).
- [Developer Account mobile](developer-account-390.png), [desktop](developer-account-1440.png), [mobile menu](developer-menu-390.png).
- [PM Account mobile](pm-account-390.png), [desktop](pm-account-1440.png), [mobile menu](pm-menu-390.png).

## Existing findings outside this patch

Public footer muted-copy contrast and a lower-homepage CTA label contrast issue were observed on the existing design. They are not introduced or repaired by this logo/account change. Existing owner notification preference behavior is intentionally unchanged.
