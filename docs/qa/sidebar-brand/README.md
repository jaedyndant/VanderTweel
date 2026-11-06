# Sidebar brand containment

Date: 6 November 2026. Base: `83886d6` (PR #30 merged).

## Fix

Both buyer and office desktop sidebars use the same compact grid lockup:
the unchanged double-arch mark and brand name occupy the first row, with
the full tagline on a separate row spanning the available width. Tracking
is reduced and the tagline remains readable at 10px, including the narrow
sidebar. There is no clipping, ellipsis or hidden text. Phrase boundaries
allow the tagline to wrap if needed. Public website, login and shared
mobile navigation are unchanged.

## Verification

- Browser QA used real local sign-in and synthetic buyer/developer accounts
  against isolated local PostgreSQL. No hosted database or external mail.
- Buyer and office Account pages checked at 1440, 1024, 1000, 768, 701, 390
  and 320 CSS pixels. Text bounds stay inside both 225px and 185px desktop
  sidebars, with no document overflow. See `measurements.json`.
- Mobile menus still open and close normally; mobile screenshots cover both roles.
- Typecheck, production build and `git diff --check` pass. Next.js runtime errors and
  compilation issues are empty.
- No new unit tests for this CSS/markup-only change. Existing CI remains
  the full automated regression gate. This repository has no lint script.

Screenshots are local development evidence, not evidence of hosted rollout.

## Screenshots

- [Buyer desktop](owner-1440.png), [office desktop](office-1440.png).
- [Buyer narrow sidebar](owner-768.png), [office narrow sidebar](office-768.png).
- [Buyer mobile](owner-390.png), [office mobile](office-390.png).
- [Buyer lockup](owner-lockup.png), [office lockup](office-lockup.png).
