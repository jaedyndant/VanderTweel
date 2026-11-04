# Managed private files

Managed uploads are additive: historical `file` URL rows are not rewritten or imported. The buyer reader uses `getManagedFilesForBuyer(accountId, villaId)` and permits the exact `/api/files/<uuid>` form in document/photo presentation. Old external file links are retained in the developer-only migration inventory, not mixed into the private buyer feed. Re-upload approved legacy files before rollout.

## Access and lifecycle

- New uploads and replacements are internal. Sharing is an explicit, revision-checked action.
- Project scope (`villaId = null`) is available only to buyers with a villa in that project; villa scope requires the exact buyer-villa link.
- Developers manage documents and photos. PMs may manage/view photos only in their currently assigned projects, including on direct download routes. Buyers cannot use the team list or management routes.
- Upload intent includes actor, asset, exact random pathname, MIME type, byte count, expiry and expected asset revision. Blob tokens cannot overwrite paths. Finalization checks storage metadata and file signature before locking asset/intent and inserting an immutable version.
- Downloads resolve the current version after fresh authorization and are always same-origin, no-store. Private Blob locations and the store credential are never returned by the application list/download APIs. The direct-upload SDK necessarily uses a scoped short-lived upload token in the browser; that is not a storage read/write credential.
- Replacement makes the file internal and preserves previous versions. Archive is recoverable; restore remains internal. Historical versions have no public download endpoint.
- Sharing, event recipients, outbox messages and audit are committed together. Repeated finalization is idempotent. Concurrent edits with stale revisions fail instead of overwriting one another.
- Accepted uploads: JPEG/PNG/WebP photos (15 MB), PDF documents (20 MB). SVG, HTML, archives and executable formats are not accepted. PDF downloads are attachments with sandbox/nosniff headers.

## Deployment prerequisites

1. Apply additive migration containing `managed_asset`, `asset_version`, and `upload_intent`.
2. Connect a **private** Vercel Blob store with `BLOB_READ_WRITE_TOKEN`. A public store is not accepted at finalization.
3. CSP must allow the SDK upload endpoint, currently `https://vercel.com/api/blob` in installed `@vercel/blob` 2.8.2. Display/download URLs stay same-origin.
4. Keep mail-outbox dispatch configured; file sharing schedules dispatch after the DB commit.
5. Verify a real private-Blob upload in staging before production acceptance. Local filesystem tests do not prove remote credentials, Vercel callbacks, or CSP network behavior.

## Isolated local QA

Local storage requires all of:

```
NODE_ENV=development # or test; never production
FILE_STORAGE_DRIVER=local
FILE_LOCAL_TEST=true
FILE_LOCAL_DIRECTORY=/tmp/vdt-files-local
```

This substitutes storage only. Authentication, role checks, scope checks, byte validation, transaction/event logic and same-origin mutations remain active. The adapter is unavailable in production, even if its other environment variables are set. Local upload bytes are written with exclusive creation and private filesystem permissions.

`tests/integration/files.test.ts` runs actual PostgreSQL transactions with unique synthetic fixture UUIDs and a unique temporary local storage directory. It checks buyer isolation, project sharing, PM restrictions/revocation, concurrent finalization, revision races, replacement history, archive and restore. It mocks authentication only.
