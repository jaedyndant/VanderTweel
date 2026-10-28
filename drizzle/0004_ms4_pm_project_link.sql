-- Link the MS2 seed pm@cemagiatelier.test account to a project_manager row
-- and the existing project, via pm_project. Without this, MS4's pm role
-- had no demonstrable path -- every pm screen correctly showed "no
-- projects linked" because project_manager/pm_project were never seeded
-- (only the account + role was, back in MS2). Idempotent: safe to re-run.

INSERT INTO "project_manager" ("account_id")
SELECT "id" FROM "account" WHERE "email" = 'pm@cemagiatelier.test'
AND NOT EXISTS (
  SELECT 1 FROM "project_manager" pm
  JOIN "account" a ON pm."account_id" = a."id"
  WHERE a."email" = 'pm@cemagiatelier.test'
);
--> statement-breakpoint
INSERT INTO "pm_project" ("pm_id", "project_id")
SELECT pm."id", p."id"
FROM "project_manager" pm
JOIN "account" a ON pm."account_id" = a."id"
CROSS JOIN "project" p
WHERE a."email" = 'pm@cemagiatelier.test'
AND NOT EXISTS (
  SELECT 1 FROM "pm_project" ex WHERE ex."pm_id" = pm."id" AND ex."project_id" = p."id"
);
