-- MS3 koper gap fix: add the missing 8th buyer screen ("account" per TO),
-- backed by a real preference column rather than a static page.

ALTER TABLE "account" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;
