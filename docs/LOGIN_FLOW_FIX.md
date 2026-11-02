# Login flow regression fix

## Reproduced blocker

The previous login form posted directly to `/api/auth/signin/resend` without
Auth.js's CSRF token. A local request returned `MissingCSRF`, but the form still
displayed the unconditional instruction to check email. The default callback
also led to `/`, the public starter page, instead of the authenticated app.

## Changes

- Use the installed `next-auth/react` `signIn` helper with `redirect: false`.
  This obtains the CSRF token and uses Auth.js's redirect-response protocol.
- Show request acceptance only when the response is successful **and** has no
  Auth.js error. Acceptance is not a claim of inbox delivery.
- Keep the email available after an error; prevent duplicate pending submits.
- Preserve only local `/office` or `/koper` callback paths. Default to `/login`,
  where the existing authenticated server role chooses the app destination.
- Read session data below Suspense and `connection()` so Auth.js randomness and
  session cookies are evaluated at request time with Cache Components enabled.
- Existing authentication, account allowlist, authorization, schema, and email
  provider implementation are unchanged. No login bypass or role selector.

## Verification and limits

- 35 new regression tests cover callback validation, role landing, and the
  installed Auth.js client transport. HTTP is intercepted in these tests; the
  Auth.js helper itself is not mocked.
- Browser checks exercise real local provider/CSRF endpoints while intercepting
  only the final sign-in request. They cover an Auth.js error inside HTTP 200,
  an accepted request, a network failure, returned auth errors, and 320px layout.
- These checks **do not** prove real email delivery, magic-link consumption,
  database persistence, or the full MS3/MS4/MS5 chain. Those require the isolated
  staging database, configured mail provider, and controlled recipient inboxes.
- No database rows were created/deleted and no real emails were sent for this fix.

This is a separate fix branch targeting `integration/ms3-ms4-ms5`. Neither this
PR nor the backoffice PR should be interpreted as a completed live E2E test.
