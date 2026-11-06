# Developer Help and residence navigation

Verified on 6 November 2026 using local synthetic accounts and PostgreSQL fixtures. No customer data, production configuration or real email delivery was used.

## Delivered

- Developer-only Help tab and `/office/help` route with 13 questions across schedules, invoices/payments, residences/access and files/updates.
- Answers follow actual interface labels and backend restrictions. Saving a template is distinct from applying it; issued invoices/paid history lock schedule replacement; recording a full received transfer creates the receipt and paid status.
- Help is server-rendered after current database identity and project scope checks. Its loader reads permitted navigation only, not billing/customer/file records.
- Residences now offers **Open residence**, preserving the selected project and encoding villa codes. Project names open the office project overview. **Edit details** remains available.
- Removed the **View as buyer** entry point. The existing protected preview route is unchanged.

## Verification

- 287 unit tests pass, including 40 focused Help route, data authorization, scoped URL and desktop/mobile navigation tests.
- TypeScript, production build and `git diff --check` pass. Build uses the same non-delivery placeholders as CI; the first local attempt correctly rejected the development-only mail-capture setting, which was removed from the build environment.
- Authenticated developer can open Help; authenticated PM cannot see Help and receives the unavailable page for its direct URL; authenticated buyer cannot see Help and is redirected to the buyer platform.
- Unit coverage additionally checks deleted users, a stale developer session whose current role changed, malformed/unauthorized project selectors, and developers without projects.
- The local villa code `Help QA 01` opens `/office/villas/Help%20QA%2001` with its correct project context. Project links and Edit details were checked without saving changes.
- Help fits 320, 390, 768 and 1440 pixel viewports without horizontal overflow; the residence action row also fits at 320 and 390 pixels with 44px-high controls.
- Native FAQ expand/collapse works with keyboard; guide links retain project context, including the verified Open Payments navigation. Numbered instructions remain visible despite the global list reset; mobile topic headings clear the sticky navigation.
- Targeted axe audit of Help reports zero violations. This is not an exhaustive site-wide accessibility audit.
- Next.js runtime error and compilation-issue checks are clear.
- Independent read-only review found no blocking authorization, data-loading or FAQ accuracy issues.

## Screenshots

- [Help, desktop](help-1440.png)
- [Help, mobile](help-390.png)
- [Help in the mobile menu](help-menu-390.png)
- [Payment workflow answer, mobile](help-payment-answer-390.png)
- [Residence actions, mobile](residences-390.png)
- [Opened residence, desktop](residence-open-1440.png)
- [Authenticated role checks](role-checks.json)

No database migration is needed. No payment records, invoices or access assignments were changed by this feature.
