ALTER TABLE "file" ADD COLUMN "label" varchar(200);--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "payment_milestone" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_milestone" ADD COLUMN "amount_usd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_milestone" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "payment_milestone" ADD COLUMN "expected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "progress_task" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_task" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "progress_task" ADD COLUMN "period" varchar(60);--> statement-breakpoint
ALTER TABLE "update" ADD COLUMN "title" varchar(200);--> statement-breakpoint
ALTER TABLE "update" ADD COLUMN "category" varchar(40);--> statement-breakpoint
ALTER TABLE "update" ADD COLUMN "author_role_label" varchar(60);--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "type_label" varchar(80);--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "outdoor_m2" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "lease_years" integer;--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "price_package" varchar(60);--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "price_total_usd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "build_started" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "villa" ADD COLUMN "handover_expected" timestamp with time zone;