-- MS2 account backfill, promoted from a one-off prod hotfix script to a real
-- migration. These 3 accounts (max/pm/buyer@cemagiatelier.test) were
-- originally seeded ad hoc during the MS2 session directly against
-- STAGING_DATABASE_URL -- a Neon branch the deployed app's own DATABASE_URL
-- never pointed at. The real DATABASE_URL had zero rows until this was
-- caught and backfilled by hand on 2026-10-28. This migration makes that
-- backfill reproducible for any fresh database (new env, DB reset, CI).
--
-- Idempotent on account.email (unique) and on the buyer_villa link (no-op if
-- buyer@ already linked to Villa 3). update/file inserts guarded by
-- NOT EXISTS since they have no natural unique key.

INSERT INTO "account" ("email", "role")
VALUES
  ('max@cemagiatelier.test', 'developer'),
  ('pm@cemagiatelier.test', 'pm'),
  ('buyer@cemagiatelier.test', 'buyer')
ON CONFLICT ("email") DO NOTHING;
--> statement-breakpoint
WITH buyer_a AS (
  INSERT INTO "buyer" ("account_id", "name", "country")
  SELECT "id", 'Emma Larsen', 'United Kingdom' FROM "account" WHERE "email" = 'buyer@cemagiatelier.test'
  ON CONFLICT DO NOTHING
  RETURNING "id"
), villa_a AS (SELECT "id" FROM "villa" WHERE "code" = 'Villa 3')
INSERT INTO "buyer_villa" ("buyer_id", "villa_id")
SELECT buyer_a."id", villa_a."id" FROM buyer_a, villa_a
WHERE NOT EXISTS (
  SELECT 1 FROM "buyer_villa" bv
  JOIN "buyer" b ON b."id" = bv."buyer_id"
  JOIN "account" a ON a."id" = b."account_id"
  WHERE a."email" = 'buyer@cemagiatelier.test' AND bv."villa_id" = villa_a."id"
);
--> statement-breakpoint
INSERT INTO "update" ("villa_id", "author_id", "body", "created_at", "title", "category", "author_role_label")
SELECT v."id", pm."id", x.body, x.created_at, x.title, x.category, x.role_label
FROM (SELECT "id" FROM "villa" WHERE "code" = 'Villa 3') v,
     (SELECT "id" FROM "account" WHERE "email" = 'pm@cemagiatelier.test') pm,
(VALUES
  ('2026-10-17'::timestamptz,'Construction','Roof slab formwork is up, pour planned for Tuesday','The upper floor slab has cured and the formwork for the roof slab is complete. Rebar is tied and inspected. We pour on Tuesday morning if the weather holds, about 28 m3 of concrete. After ten days of curing we strip the formwork and the engineer verifies the structure, which releases the month 7 payment.','Site manager'),
  ('2026-10-10'::timestamptz,'Payment','Month 7 payment comes after the roof check','The month 7 payment, 10% or $15,500, is invoiced once the engineer has signed off the roof slab. You will see the invoice here and by email, with 14 days to pay.','Finance'),
  ('2026-10-02'::timestamptz,'Construction','Stair set, pool pump room moved 40 cm','The stair to the bedroom level is in. One small change: the pool pump room moved 40 cm towards the garden so the pipe run to the filter is shorter. No cost, no change to the terrace. The revised drawing is in your documents.','Site manager'),
  ('2026-09-22'::timestamptz,'Paperwork','Building permit uploaded','The building permit (PBG) for the row is in your documents. The certificate of fitness (SLF) follows after completion. Nothing you need to do.','Project coordinator'),
  ('2026-09-14'::timestamptz,'Construction','Rebar on site, no lost days','Steel for the roof slab was delivered on Saturday. Dry week, the team worked every day.','Site manager')
) AS x(created_at, category, title, body, role_label)
WHERE NOT EXISTS (SELECT 1 FROM "update" WHERE "title" = x.title);
--> statement-breakpoint
INSERT INTO "update" ("villa_id", "author_id", "body", "created_at", "title", "category", "author_role_label")
SELECT v."id", pm."id", x.body, x.created_at, x.title, x.category, x.role_label
FROM (SELECT "id" FROM "villa" WHERE "code" = 'Villa 1') v,
     (SELECT "id" FROM "account" WHERE "email" = 'pm@cemagiatelier.test') pm,
(VALUES
  ('2026-10-20'::timestamptz,'Paperwork','Land transfer complete','The lease deed is signed and registered. Construction start payment will follow once the building permit is issued.','Project coordinator')
) AS x(created_at, category, title, body, role_label)
WHERE NOT EXISTS (SELECT 1 FROM "update" WHERE "title" = x.title);
--> statement-breakpoint
INSERT INTO "file" ("villa_id", "uploaded_by", "kind", "url", "label", "note")
SELECT v."id", dev."id", 'doc', x.url, x.label, x.note
FROM (SELECT "id" FROM "villa" WHERE "code" = 'Villa 3') v,
     (SELECT "id" FROM "account" WHERE "email" = 'max@cemagiatelier.test') dev,
(VALUES
  ('https://docs.cemagiatelier.example/villa-3/reservation-escrow-agreement.pdf','Reservation and escrow agreement','Signed 12 Jan 2026'),
  ('https://docs.cemagiatelier.example/villa-3/lease-agreement-id-en.pdf','Lease agreement, Indonesian and English','Notarial deed, 3 Mar 2026'),
  ('https://docs.cemagiatelier.example/villa-3/building-permit-pbg.pdf','Building permit (PBG)','22 Sep 2026'),
  ('https://docs.cemagiatelier.example/villa-3/drawings-spec-rev-c.pdf','Drawings and specification, rev. C','2 Oct 2026'),
  ('https://docs.cemagiatelier.example/villa-3/payment-schedule.pdf','Payment schedule','Part of the lease agreement')
) AS x(url, label, note)
WHERE NOT EXISTS (SELECT 1 FROM "file" WHERE "url" = x.url);
--> statement-breakpoint
INSERT INTO "file" ("villa_id", "uploaded_by", "kind", "url", "label", "note")
SELECT v."id", dev."id", 'doc', x.url, x.label, x.note
FROM (SELECT "id" FROM "villa" WHERE "code" = 'Villa 1') v,
     (SELECT "id" FROM "account" WHERE "email" = 'max@cemagiatelier.test') dev,
(VALUES
  ('https://docs.cemagiatelier.example/villa-1/reservation-escrow-agreement.pdf','Reservation and escrow agreement','Signed 1 Jul 2026'),
  ('https://docs.cemagiatelier.example/villa-1/lease-agreement-id-en.pdf','Lease agreement, Indonesian and English','Notarial deed, 15 Aug 2026')
) AS x(url, label, note)
WHERE NOT EXISTS (SELECT 1 FROM "file" WHERE "url" = x.url);
