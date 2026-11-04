# Platform completion acceptance evidence

Date: 2026-11-04. Base: `12b0543`, feature branch `feat/platform-functional-completion`.
All accounts, amounts, legal identities and files used here are synthetic. No production database was modified and no external email was sent.

## Automated checks

- 254 unit tests in 29 files passed.
- 52 integration tests in 6 files passed against isolated PostgreSQL 18, not a mocked database.
- TypeScript passed; `git diff --check` clean.
- All migrations applied from scratch, migration bookkeeping rerun successfully, `drizzle-kit generate` reports no schema changes.
- Integration coverage: billing 9, private files 8, management 11, communication 12, outbox 11, atomic login-token consumption 1.
- Database tests exercise concurrent requests, transaction rollback, revoked assignments, stale revisions, duplicate requests, pagination and retry/lease recovery. Authentication is mocked at the service boundary in those tests; browser checks below use real Auth.js sessions.

## Browser and document checks

Actual local magic-link sign-in was completed for developer, PM and buyer using the real CSRF/token/callback/session flow. Only mail transport was captured locally.

- Developer: upload/share a photo and PDF, edit/replace/archive/restore files; invite an owner, assign a villa, create/edit a villa, reject duplicate codes and stale two-tab saves.
- Billing: configure synthetic issuer/recipient, apply a 50/50 schedule to USD 160,000.01, allocate USD 80,000.01 + 80,000.00, issue an invoice, record transfer, download invoice/receipt. PDFs rendered and visually inspected including Chinese recipient characters. Licensed fonts are bundled locally.
- Communication: publish a scoped construction update with a shared photo; the correct buyer sees text, author and decoded photo. New and legacy updates share pagination without duplicates.
- PM: three permitted navigation items, construction-photo access, no management/billing access. Buyer: no team management APIs and no data from an unrelated villa; direct shared-file download reauthorizes and sends private/no-store headers.
- Developer buyer-preview preserves the developer session and removes account mutations.
- Mobile: private files, management and billing checked at 320 and 390 px with no horizontal overflow; targeted axe checks reported no violations. Buyer update view checked at 390 px; desktop billing at 1440 px. These are targeted checks, not a claim of exhaustive accessibility conformance.
- Local production-mode smoke: login renders without browser errors; protected pages redirect to login; management, private-document, messages and mail-job endpoints reject unauthenticated requests. No new production-mode authenticated session was fabricated.

## Screenshots

These are development-browser screenshots (the Next.js development indicator may be visible), not proof of a hosted deployment.

- [Buyer update and photo, 390 px](owner-updates-390.png)
- [Private files and legacy-link inventory, 390 px](files-390.png)
- [Billing, 390 px](billing-390.png)
- [Billing, desktop](billing-desktop.png)
- [People and access, 390 px](management-390.png)

## Acceptance still requiring actual staging infrastructure

Private Vercel Blob token/callback/network behavior, the deployment's Neon TCP connection, scheduled outbox retry, approved mailbox delivery and the complete under-one-minute team-to-buyer/mailbox chain have **not** been proved against hosted providers. Local mail capture/storage do not prove them. Use the [handoff runbook](../../PLATFORM-COMPLETION-HANDOFF.md) before production rollout.
