-- MS3 seed: project + 2 villas + 2 buyers + payment/progress/update/file rows.
-- Real brochure/build figures for Villa 3 / Emma Larsen, scraped live from the
-- client's own reference demo (https://bali-villa-portal.vercel.app) per
-- docs/ms3-seed-data-real.json. villa_B / Marcus Oduya is a second,
-- deliberately different villa+buyer used to prove cross-buyer isolation
-- (TO hfst. 9, PvA MS3 klaar-criterium).
--
-- Idempotent on project.slug (unique) / account.email (unique); the rest is
-- only ever run once since migrations are tracked in __drizzle_migrations.

WITH proj AS (
  INSERT INTO "project" ("name", "slug", "brand_locked")
  VALUES ('Cemagi Atelier', 'cemagi-atelier', true)
  ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name"
  RETURNING "id"
),
villa_a AS (
  INSERT INTO "villa" (
    "project_id", "code", "plot_m2", "built_m2", "status", "type_label",
    "outdoor_m2", "lease_years", "price_package", "price_total_usd",
    "build_started", "handover_expected"
  )
  SELECT
    proj.id, 'Villa 3', 83.00, 80.46, 'on_schedule', 'One-bedroom loft',
    38.18, 29, 'Premium package', 155000.00,
    '2026-06-01'::timestamptz, '2027-07-31'::timestamptz
  FROM proj
  RETURNING "id"
),
villa_b AS (
  INSERT INTO "villa" (
    "project_id", "code", "plot_m2", "built_m2", "status", "type_label",
    "outdoor_m2", "lease_years", "price_package", "price_total_usd",
    "build_started", "handover_expected"
  )
  SELECT
    proj.id, 'Villa 1', 104.00, 112.30, 'on_schedule', 'Two-bedroom loft',
    52.00, 29, 'Signature package', 210000.00,
    '2026-09-01'::timestamptz, '2027-11-30'::timestamptz
  FROM proj
  RETURNING "id"
),
account_buyer2 AS (
  INSERT INTO "account" ("email", "role")
  VALUES ('buyer2@cemagiatelier.test', 'buyer')
  ON CONFLICT ("email") DO UPDATE SET "role" = EXCLUDED."role"
  RETURNING "id"
),
buyer_a AS (
  -- buyer@cemagiatelier.test already exists (MS2 seed) — link that account,
  -- as Emma Larsen, to villa_A.
  INSERT INTO "buyer" ("account_id", "name", "country")
  SELECT "id", 'Emma Larsen', 'United Kingdom'
  FROM "account"
  WHERE "email" = 'buyer@cemagiatelier.test'
  RETURNING "id"
),
buyer_b AS (
  INSERT INTO "buyer" ("account_id", "name", "country")
  SELECT "id", 'Marcus Oduya', 'Kenya'
  FROM account_buyer2
  RETURNING "id"
),
link_a AS (
  INSERT INTO "buyer_villa" ("buyer_id", "villa_id")
  SELECT buyer_a.id, villa_a.id FROM buyer_a, villa_a
  RETURNING "villa_id"
),
link_b AS (
  INSERT INTO "buyer_villa" ("buyer_id", "villa_id")
  SELECT buyer_b.id, villa_b.id FROM buyer_b, villa_b
  RETURNING "villa_id"
),
-- -- payment_milestone: villa_A (Emma Larsen) — real Cemagi payment schedule --
pay_a AS (
  INSERT INTO "payment_milestone" ("villa_id", "percent", "due_label", "status", "paid_at", "sequence", "amount_usd", "note", "expected_at")
  SELECT villa_a.id, v.percent, v.due_label, v.status, v.paid_at, v.sequence, v.amount_usd, v.note, v.expected_at
  FROM villa_a, (VALUES
    (1, 10.00, 'Reservation',                    'paid', '2026-01-12'::timestamptz, 15500.00, 'escrow at the notary', NULL::timestamptz),
    (2, 30.00, 'Land transfer',                   'paid', '2026-03-03'::timestamptz, 46500.00, 'lease deed signed', NULL::timestamptz),
    (3, 10.00, 'Construction start',               'paid', '2026-05-28'::timestamptz, 15500.00, 'building permit shown first', NULL::timestamptz),
    (4, 10.00, 'Month 1, foundation',               'paid', '2026-07-02'::timestamptz, 15500.00, 'verified 30 jun', NULL::timestamptz),
    (5, 10.00, 'Month 4, ground floor',             'paid', '2026-10-01'::timestamptz, 15500.00, 'verified 26 sep', NULL::timestamptz),
    (6, 10.00, 'Month 7, roof slab',                'open', NULL::timestamptz, 15500.00, 'after roof verification, 14 days to pay after the invoice', '2026-12-01'::timestamptz),
    (7, 10.00, 'Month 10, plaster and services',    'open', NULL::timestamptz, 15500.00, NULL, '2027-03-01'::timestamptz),
    (8, 5.00,  'Month 12, interior',                'open', NULL::timestamptz, 7750.00, NULL, '2027-05-01'::timestamptz),
    (9, 5.00,  'Month 14, handover',                'open', NULL::timestamptz, 7750.00, 'after the defects list is cleared', '2027-07-01'::timestamptz)
  ) AS v(sequence, percent, due_label, status, paid_at, amount_usd, note, expected_at)
),
-- -- payment_milestone: villa_B (Marcus Oduya) — isolation-test villa --
pay_b AS (
  INSERT INTO "payment_milestone" ("villa_id", "percent", "due_label", "status", "paid_at", "sequence", "amount_usd", "note", "expected_at")
  SELECT villa_b.id, v.percent, v.due_label, v.status, v.paid_at, v.sequence, v.amount_usd, v.note, v.expected_at
  FROM villa_b, (VALUES
    (1, 10.00, 'Reservation',                    'paid', '2026-07-01'::timestamptz, 21000.00, 'escrow at the notary', NULL::timestamptz),
    (2, 30.00, 'Land transfer',                   'paid', '2026-08-15'::timestamptz, 63000.00, 'lease deed signed', NULL::timestamptz),
    (3, 10.00, 'Construction start',               'open', NULL::timestamptz, 21000.00, NULL, '2026-11-15'::timestamptz),
    (4, 10.00, 'Month 1, foundation',               'open', NULL::timestamptz, 21000.00, NULL, '2026-12-01'::timestamptz),
    (5, 10.00, 'Month 4, ground floor',             'open', NULL::timestamptz, 21000.00, NULL, '2027-02-01'::timestamptz),
    (6, 10.00, 'Month 7, roof slab',                'open', NULL::timestamptz, 21000.00, NULL, '2027-05-01'::timestamptz),
    (7, 10.00, 'Month 10, plaster and services',    'open', NULL::timestamptz, 21000.00, NULL, '2027-08-01'::timestamptz),
    (8, 5.00,  'Month 12, interior',                'open', NULL::timestamptz, 10500.00, NULL, '2027-10-01'::timestamptz),
    (9, 5.00,  'Month 14, handover',                'open', NULL::timestamptz, 10500.00, NULL, '2027-11-01'::timestamptz)
  ) AS v(sequence, percent, due_label, status, paid_at, amount_usd, note, expected_at)
),
-- -- progress_task: villa_A --
prog_a AS (
  INSERT INTO "progress_task" ("villa_id", "phase", "percent_weight", "done_at", "sequence", "detail", "period")
  SELECT villa_a.id, v.phase, v.weight, v.done_at, v.sequence, v.detail, v.period
  FROM villa_a, (VALUES
    (1, 'Site works and foundation',              10.00, '2026-07-31'::timestamptz, 'Levelling, footings and ground beams', 'Jun - Jul 2026'),
    (2, 'Ground floor structure',                 15.00, '2026-09-30'::timestamptz, 'Columns, walls, first floor slab', 'Jul - Sep 2026'),
    (3, 'Upper floor and roof slab',               15.00, NULL::timestamptz,         'Bedroom level, stair, roof slab', 'Sep - Nov 2026'),
    (4, 'Curved shell, walls and plaster',         15.00, NULL::timestamptz,         'Arched facade formed and rendered', 'Nov 2026 - Jan 2027'),
    (5, 'Electrical, plumbing, pool system',       15.00, NULL::timestamptz,         'Wiring, water, drainage, pool pump', 'Dec 2026 - Feb 2027'),
    (6, 'Stone, teak and interior',                15.00, NULL::timestamptz,         'Andesite, sukabumi, river-stone bath, kitchen', 'Feb - May 2027'),
    (7, 'Pool, garden and snagging',               10.00, NULL::timestamptz,         'Pool test, planting, defects list', 'May - Jul 2027'),
    (8, 'Handover',                                5.00,  NULL::timestamptz,         'Joint inspection, keys, warranty documents', 'Jul 2027')
  ) AS v(sequence, phase, weight, done_at, detail, period)
),
-- -- progress_task: villa_B --
prog_b AS (
  INSERT INTO "progress_task" ("villa_id", "phase", "percent_weight", "done_at", "sequence", "detail", "period")
  SELECT villa_b.id, v.phase, v.weight, v.done_at, v.sequence, v.detail, v.period
  FROM villa_b, (VALUES
    (1, 'Site works and foundation',              10.00, NULL::timestamptz, 'Levelling, footings and ground beams', 'Sep - Nov 2026'),
    (2, 'Ground floor structure',                 15.00, NULL::timestamptz, 'Columns, walls, first floor slab', 'Nov 2026 - Jan 2027'),
    (3, 'Upper floor and roof slab',               15.00, NULL::timestamptz, 'Bedroom level, stair, roof slab', 'Jan - Mar 2027'),
    (4, 'Curved shell, walls and plaster',         15.00, NULL::timestamptz, 'Arched facade formed and rendered', 'Mar - May 2027'),
    (5, 'Electrical, plumbing, pool system',       15.00, NULL::timestamptz, 'Wiring, water, drainage, pool pump', 'Apr - Jun 2027'),
    (6, 'Stone, teak and interior',                15.00, NULL::timestamptz, 'Andesite, sukabumi, river-stone bath, kitchen', 'Jun - Sep 2027'),
    (7, 'Pool, garden and snagging',               10.00, NULL::timestamptz, 'Pool test, planting, defects list', 'Sep - Nov 2027'),
    (8, 'Handover',                                5.00,  NULL::timestamptz, 'Joint inspection, keys, warranty documents', 'Nov 2027')
  ) AS v(sequence, phase, weight, done_at, detail, period)
),
-- -- update: villa_A, authored by the pm test account --
upd_a AS (
  INSERT INTO "update" ("villa_id", "author_id", "body", "created_at", "title", "category", "author_role_label")
  SELECT villa_a.id, pm.id, v.body, v.created_at, v.title, v.category, v.role_label
  FROM villa_a, (SELECT "id" FROM "account" WHERE "email" = 'pm@cemagiatelier.test') AS pm, (VALUES
    ('2026-10-17'::timestamptz, 'Construction', 'Roof slab formwork is up, pour planned for Tuesday', 'The upper floor slab has cured and the formwork for the roof slab is complete. Rebar is tied and inspected. We pour on Tuesday morning if the weather holds, about 28 m3 of concrete. After ten days of curing we strip the formwork and the engineer verifies the structure, which releases the month 7 payment.', 'Site manager'),
    ('2026-10-10'::timestamptz, 'Payment', 'Month 7 payment comes after the roof check', 'The month 7 payment, 10% or $15,500, is invoiced once the engineer has signed off the roof slab. You will see the invoice here and by email, with 14 days to pay.', 'Finance'),
    ('2026-10-02'::timestamptz, 'Construction', 'Stair set, pool pump room moved 40 cm', 'The stair to the bedroom level is in. One small change: the pool pump room moved 40 cm towards the garden so the pipe run to the filter is shorter. No cost, no change to the terrace. The revised drawing is in your documents.', 'Site manager'),
    ('2026-09-22'::timestamptz, 'Paperwork', 'Building permit uploaded', 'The building permit (PBG) for the row is in your documents. The certificate of fitness (SLF) follows after completion. Nothing you need to do.', 'Project coordinator'),
    ('2026-09-14'::timestamptz, 'Construction', 'Rebar on site, no lost days', 'Steel for the roof slab was delivered on Saturday. Dry week, the team worked every day.', 'Site manager')
  ) AS v(created_at, category, title, body, role_label)
),
-- -- update: villa_B --
upd_b AS (
  INSERT INTO "update" ("villa_id", "author_id", "body", "created_at", "title", "category", "author_role_label")
  SELECT villa_b.id, pm.id, v.body, v.created_at, v.title, v.category, v.role_label
  FROM villa_b, (SELECT "id" FROM "account" WHERE "email" = 'pm@cemagiatelier.test') AS pm, (VALUES
    ('2026-10-20'::timestamptz, 'Paperwork', 'Land transfer complete', 'The lease deed is signed and registered. Construction start payment will follow once the building permit is issued.', 'Project coordinator')
  ) AS v(created_at, category, title, body, role_label)
),
-- -- file: villa_A documents, uploaded by the developer test account --
file_a AS (
  INSERT INTO "file" ("villa_id", "uploaded_by", "kind", "url", "label", "note")
  SELECT villa_a.id, dev.id, 'doc', v.url, v.label, v.note
  FROM villa_a, (SELECT "id" FROM "account" WHERE "email" = 'max@cemagiatelier.test') AS dev, (VALUES
    ('https://docs.cemagiatelier.example/villa-3/reservation-escrow-agreement.pdf', 'Reservation and escrow agreement', 'Signed 12 Jan 2026'),
    ('https://docs.cemagiatelier.example/villa-3/lease-agreement-id-en.pdf',        'Lease agreement, Indonesian and English', 'Notarial deed, 3 Mar 2026'),
    ('https://docs.cemagiatelier.example/villa-3/building-permit-pbg.pdf',          'Building permit (PBG)', '22 Sep 2026'),
    ('https://docs.cemagiatelier.example/villa-3/drawings-spec-rev-c.pdf',          'Drawings and specification, rev. C', '2 Oct 2026'),
    ('https://docs.cemagiatelier.example/villa-3/payment-schedule.pdf',             'Payment schedule', 'Part of the lease agreement')
  ) AS v(url, label, note)
),
-- -- file: villa_B documents --
file_b AS (
  INSERT INTO "file" ("villa_id", "uploaded_by", "kind", "url", "label", "note")
  SELECT villa_b.id, dev.id, 'doc', v.url, v.label, v.note
  FROM villa_b, (SELECT "id" FROM "account" WHERE "email" = 'max@cemagiatelier.test') AS dev, (VALUES
    ('https://docs.cemagiatelier.example/villa-1/reservation-escrow-agreement.pdf', 'Reservation and escrow agreement', 'Signed 1 Jul 2026'),
    ('https://docs.cemagiatelier.example/villa-1/lease-agreement-id-en.pdf',        'Lease agreement, Indonesian and English', 'Notarial deed, 15 Aug 2026')
  ) AS v(url, label, note)
)
SELECT 1;
--> statement-breakpoint
