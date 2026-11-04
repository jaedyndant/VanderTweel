# Platform functional completion

Branch: `feat/platform-functional-completion`, based on `12b0543` (PR #28).

## Implemented

1. **Private files:** project/villa scope, internal-by-default PNG/JPEG/WebP/PDF, explicit sharing, PM photos only, immutable versions, replace/archive/restore, metadata and pagination. Every download repeats live authorization and returns no-store. Existing external-link records are retained in a developer-only migration inventory, never automatically fetched or exposed as private uploads.
2. **Billing:** project payment templates totalling exactly 100%, exact integer-cent allocation, pre-invoice schedule replacement, real issuer and recipient configuration, immutable invoice/receipt snapshots and private PDFs, invoice numbering, explicit received-transfer registration and reasoned reversals. Draft/planned/next/invoiced/paid/overdue presentation. Historical paid rows remain historical; no invented receipts. Contract totals cannot change underneath an existing schedule or financial history.
3. **Management:** developer-only buyer/PM provisioning and invitations, fixed roles, explicit assignments/co-owner confirmation, villa creation and revision-protected editing, invitation delivery status and last actual sign-in. Read-only buyer preview never changes the developer session and hides account writes.
4. **Communication:** project- or villa-scoped updates with published photographs, actor attribution, paginated activity and buyer messages, persistent notification/read state. Business write + audit + recipients + email outbox commit in the same PostgreSQL transaction. Row/advisory locks, stable request IDs and uniqueness constraints prevent duplicate writes. Outbox work is leased and retried; provider acceptance is not represented as verified inbox delivery.
5. **Acceptance/handoff:** actual PostgreSQL concurrency, rollback and authorization tests; real local Auth.js magic-link browser sessions; local mail capture; responsive screenshots and PDF inspection; CI migration/integration checks and deployment runbook.

Not added: 3D viewer, website request/intake forms, changed project facts, or email-preference enforcement. Existing preference behavior is intentionally unchanged.

## Production prerequisites: do not skip

This branch requires migration `0008_platform_functional_completion.sql` **before serving its new code**. No production migration, actual customer mail or production-data change was performed during implementation.

- Take a database backup/restore point and rehearse on an isolated staging database first. Run the existing numbered migration command; never `drizzle-kit push` against production.
- Migration 0008 is additive. It adds tables, account display name and a unique villa-code index. Preflight duplicate codes with `SELECT code, count(*) FROM villa GROUP BY code HAVING count(*) > 1;`. Resolve any duplicates deliberately before migration. Do not delete ownership/payment records to satisfy the constraint.
- Historical migration SQL remains unchanged. Duplicate IDs/parent links in snapshots 0003–0005 were repaired and missing snapshots 0006/0007 reconstructed. The new snapshot covers the actual schema. The new journal timestamp is greater than every historical timestamp, including their future-dated values.
- `DATABASE_URL` must be the authorized PostgreSQL connection URL. The app now uses `pg` with a small pool and interactive transactions; Edge middleware imports only the database-free auth configuration. Verify this TCP connection against the deployment's actual Neon environment.
- Connect a **PRIVATE** Vercel Blob store and configure its `BLOB_READ_WRITE_TOKEN` on staging/production. Public Blob stores are rejected. Direct browser uploads use scoped tokens; long-lived read/write credentials never reach the browser. Actual hosted Blob token/callback/CORS behavior still needs a staging run with the real private store.
- Set canonical `APP_URL`, existing `AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, and a strong `CRON_SECRET` through the host's secret/environment settings. Never commit credentials.
- Invoke `GET /api/jobs/mail` every minute with `Authorization: Bearer <CRON_SECRET>` using the hosting scheduler. Writes also schedule immediate post-response delivery. A failed post-response invocation does not lose mail; the scheduler processes the stored queue. No paid scheduler or infrastructure was created automatically.
- Monitor failed/unconfirmed queue entries. The provider's idempotency retention is finite: this is not a guarantee of exactly-once inbox delivery after an indefinite outage. Check provider records before manually replaying ambiguous deliveries. The under-one-minute acceptance target still needs measurement against the actual hosted scheduler and approved mailboxes.
- Enter the real legal issuer, address, bank instructions and buyer billing address in Billing. No legal/tax/bank values were fabricated. Issuance is blocked until required settings exist. Confirm the correct invoice-prefix and accounting process before issuing real invoices.
- Re-upload any legacy external documents that should remain visible to owners. No automatic external download/import, no claim that an old public link became protected.
- Verify a real staging invitation/magic link, private upload/download, invoice/receipt and controlled mailbox delivery before enabling real customer operations. Screenshots/local mail prove application behavior, not the external provider configuration.

## Deployment order / rollback

1. Apply all numbered migrations on staging; run them again to prove idempotent migration bookkeeping.
2. Set private storage, canonical origin, mail and scheduler configuration; enter approved billing settings.
3. Run the acceptance matrix below using non-customer accounts and approved test mailboxes.
4. Back up production, apply additive migration, deploy the exact reviewed commit, verify the promoted alias/commit and the role boundaries.
5. If code rollback is needed, roll back the application release; retain the additive tables and immutable financial/file records. Do not reverse/drop this migration after real use. Review queue state before re-enabling writes to avoid delayed notifications from a discarded workflow.

## Repeatable local checks

`npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

For real database tests start `npm run test:db` in a separate terminal. This starts a dedicated embedded PostgreSQL cluster only on `127.0.0.1:55439`, directory `/tmp/vdt-platform-postgres`. It creates `vdt_completion_test` using a documented **fixture-only** password, not any hosting credential.

```sh
export DATABASE_URL='postgresql://postgres:vdt-local-fixture-only@127.0.0.1:55439/vdt_completion_test'
export VDT_LOCAL_TEST=1
export APP_URL='http://localhost:3029'
npm run db:migrate
npm run db:migrate
npm run test:integration
npm run test:seed
```

Integration suites refuse non-local/non-test databases and use uniquely scoped synthetic records. Management tests clean up their fixtures; other fixtures remain available for inspection until the disposable local database is retired. Never reuse this database for real data.

For local browser acceptance use a non-production dev server, `AUTH_TRUST_HOST=true`, a local-only `AUTH_SECRET`, dummy `AUTH_RESEND_KEY`/`AUTH_EMAIL_FROM`, `MAIL_TRANSPORT=local-capture`, `LOCAL_MAIL_DIR=/tmp/vdt-acceptance-mail`, `FILE_STORAGE_DRIVER=local`, `FILE_LOCAL_TEST=true`, `FILE_LOCAL_DIRECTORY=/tmp/vdt-acceptance-files`. Both adapters are disabled in production. Mail capture additionally requires explicit local test mode and loopback DB/origin. This captures transport only: real Auth.js CSRF, hashed one-time tokens, callbacks and session cookies still execute. Captured magic links/session-state files are credentials: keep them outside git and remove them when testing ends.

Fixture accounts: `developer@acceptance.invalid`, `pm@acceptance.invalid`, `owner@acceptance.invalid`, `otherowner@acceptance.invalid`. Root acceptance villas are `ACPT-ROOT-01` and `ACPT-ROOT-02`.

## Acceptance matrix

- Duplicate/concurrent finalize => one file version; stale share/archive/replace fails safely.
- PM can upload construction photos only; cannot enumerate or download private contractual documents or billing records.
- Internal, archived and other-owner/project files are denied, including direct URL requests; revoked assignments are checked again.
- Invoice concurrency => one numbered invoice/PDF/event; payment concurrency => one settlement/receipt. Late retries cannot reinstate a reversed settlement. Counter/database failure rolls back document/event writes.
- Schedule allocations preserve every cent; financial history prevents silent schedule/contract edits; immutable PDFs retain original issuer/recipient values and show reversals without overwriting original records.
- Invitation retries => one provision/access/outbox write; role escalation and accidental co-ownership are rejected. Stale villa edits and duplicate codes fail without partial writes.
- Messages scope recipients by current project/villa; project updates do not create duplicate notifications for a buyer with multiple villas. PMs cannot publish financial updates or read financial activity.
- Outbox overlapping workers, retries, expired lease, final-attempt crash, stale-worker completion and revoked-recipient checks are exercised against real PostgreSQL with only mail transport mocked.
- Concurrent Auth.js token consumers receive at most one token.
- Browser: real local sign-in, invitation, upload/share, update+photo visible to owner, billing issue/settle/PDF, preview without account mutations; mobile320/390 and desktop.

## Evidence

Screenshots and verification boundaries in [qa/platform-completion](qa/platform-completion/README.md). Local verification: 254 unit tests, 52 PostgreSQL integration tests, typecheck, repeated migrations and a clean schema comparison. Final build/CI result is recorded in the PR. All screenshot identities, amounts and documents are synthetic acceptance data.
