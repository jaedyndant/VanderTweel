# MS4 backoffice frontend

## Scope and integration

This feature targets `integration/ms3-ms4-ms5`, not `main`. It uses the approved
Van der Tweel demo office as the visual reference: Newsreader and DM Sans,
warm paper, forest-green accents, the sidebar, editorial headings and tables.
The public website, buyer frontend, schema, original data/actions, auth and
notification implementation are unchanged.

Six primary views: Overview, Villas, Clients, Payments, Site updates and
Documents. Existing project, villa and nested progress/payment/update/file
URLs remain available. New aggregate URLs retain the existing Dutch routes.
All pages use the shared server route and authenticated presentation adapter.
No fixture data or unauthenticated preview route is included in this feature.

## Backend connection

`src/lib/office-platform-data.ts` uses the existing scoped `office-data.ts`
helpers and explicitly projects serializable presentation fields. Request-only
React caching uses primitive arguments; it is not a shared cross-user cache.
Explicit invalid selections and ambiguous/mismatched villa codes fail closed.
Money remains unknown when neither a stored amount nor agreement amount exists.
A calculated milestone amount is labelled as derived in details and CSV.

`src/lib/office-platform-actions.ts` reauthorizes each write, verifies the exact
project/villa/record association, validates input and delegates to the existing
four actions:

- Complete or reopen a recorded construction task.
- Mark a payment milestone paid or reopen its record (developer only).
- Publish a site update for a selected villa.
- Share an existing document/photo URL (developer only, not a file upload).

Expected-state checks reject already-stale toggle forms. These checks are not
an atomic compare-and-set backend operation: simultaneous racing writes remain
an inherited limitation. The office route group is invalidated after success;
the UI refreshes, prevents duplicate submissions and preserves form text on
failure. Existing buyer notifications and buyer refresh logic are retained.
A successful save is never presented as proof of email delivery.

## Role boundaries

- Developer: complete office navigation and permitted data/actions.
- PM: assigned projects/villas, construction tasks and their own authored
  Construction updates. No payment values, price package, buyer directory or
  contract/document arrays are serialized for this role.
- PM finance/document/directory URLs are rejected server-side. Hiding controls
  is an additional presentation rule, not the authorization boundary.
- The older shared update feed lacks trusted classification. The new PM UI
  deliberately shows only their own construction text, labelled “Your updates”.
  Broader safe team-feed visibility requires a separate backend contract.

## Deliberate differences from the browser-local demo

- No fake enquiries, invitations, accounts, receipt references, email delivery
  confirmations or generated pretend document downloads.
- Demo inspection approval is represented by real backend construction-task
  completion. It does not invent persisted inspection fields.
- Project/villa/buyer creation, task authoring and percentage editing are not
  offered because the existing backend has no such action contracts.
- File sharing accepts an existing usable HTTP(S) URL, not a new upload.
  Reserved placeholder domains and credential-bearing URLs are rejected.
- Unknown values and absent records are displayed honestly; no demo amounts,
  progress or documents fill gaps in server data.
- Mobile payment cards stack cleanly. Tables scroll within their own labelled
  regions; the page itself stays within the viewport.

## Verification

- TypeScript check and production build pass with placeholder configuration; no
  temporary QA route appears in the final route output.
- 91 Vitest tests pass: the existing 60 plus 24 adapter/action boundary tests
  and seven presentation tests. These use mocks, not live DB/email credentials.
- 27 browser view/viewport/state checks: all six main screens at 1440 and390;
  overview/payments/progress at768 and320; four PM views at390; empty, missing
  financial values and long content at320. No page-level horizontal overflow.
- Synthetic browser interactions: selected-villa update publishing, payment
  confirmation/status refresh, PM task completion, selected-villa file-link
  sharing, original-link details, filtered CSV export and failed-save retention.
- All 12 actual office paths return307 to login without a session.
- Next dev MCP compilation and runtime-error probes were checked.
- See [QA evidence](qa/office-platform/README.md) for screenshots and results.

These checks prove frontend behavior and mocked contract boundaries, not the
full authenticated MS3/MS4/MS5 chain. Before the final release PR can leave
draft, follow [the integration workflow](INTEGRATION_MS3_MS4_MS5.md): isolated
staging database, developer/PM/two buyer accounts, working login/storage/mail
configuration, and real team action → DB → only intended buyer → refresh and
email-delivery verification. No production data was changed by this build.
