# Backoffice QA evidence

All screenshots show **synthetic fixture data**, not production records.
Captured in Chromium with the same OfficePlatform components and local fonts.
The temporary local-only fixture route was removed before the feature commit.

- Six main views: [overview](overview-1440.png), [villas](villas-1440.png),
  [clients](buyers-1440.png), [payments](payments-1440.png),
  [updates](updates-1440.png), [documents](documents-1440.png).
- Matching 390px files show the mobile layout; table/navigation regions scroll
  horizontally within the viewport. No page-level overflow remains.
- PM: [construction tasks](pm-progress-390.png) and [own updates](pm-updates-390.png).
- [Failed save](save-failure-390.png): form remains open with entered text.
- [27 viewport/state measurements](browser-qa-results.json).
- [12 unauthenticated route redirects](unauthenticated-routes.json).

## Interaction checks

1. Filter updates to Villa02, open publish, verify Villa02 selected, submit:
   new local fixture record and success notice appear for only that selection.
2. Failed publish: entered text retained, error shown, controls enabled again.
3. Filter payments to Villa02, open first unpaid record, confirm payment:
   record changes to Paid; reopening details shows current status/date.
4. Export filtered payment CSV: nine Villa02 records only, correct amounts and
   newly recorded paid state; no other residence leaked into that export.
5. PM progress: confirm completion, task changes to Completed with reopen action.
6. Filter documents to Villa03, share existing URL: form defaults to Villa03;
   details link to original URL with noopener/noreferrer. No URL was fetched.
7. PM update category offers Construction only; private navigation is absent.
8. Keyboard Escape restores focus to the dialog opener. Nested payment
   detail→confirmation keeps the original trigger for focus restoration.

Server adapter/action tests cover unauthorized users, wrong role, mismatched
records/scopes, ambiguous selectors, stale toggles, unsafe URLs, delegated
writes and route-group invalidation. Browser callbacks above used fixture
state only; **actual DB persistence, mail delivery and cross-account MS5 E2E
remain staging acceptance work**, not established by these screenshots.
