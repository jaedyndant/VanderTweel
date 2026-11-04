CREATE TABLE "asset_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" varchar(180) NOT NULL,
	"content_type" varchar(80) NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_version_size_check" CHECK ("asset_version"."byte_size" > 0 and "asset_version"."byte_size" <= 20971520)
);

--> statement-breakpoint
CREATE TABLE "managed_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"villa_id" uuid,
	"kind" varchar(12) NOT NULL,
	"label" varchar(200) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"visibility" varchar(12) DEFAULT 'internal' NOT NULL,
	"active_version" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_asset_kind_check" CHECK ("managed_asset"."kind" in ('photo','doc')),
	CONSTRAINT "managed_asset_visibility_check" CHECK ("managed_asset"."visibility" in ('internal','shared')),
	CONSTRAINT "managed_asset_revision_check" CHECK ("managed_asset"."revision" > 0 and "managed_asset"."active_version" >= 0)
);

--> statement-breakpoint
CREATE TABLE "upload_intent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" varchar(180) NOT NULL,
	"content_type" varchar(80) NOT NULL,
	"byte_size" integer NOT NULL,
	"expected_revision" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "billing_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"villa_id" uuid NOT NULL,
	"payment_id" uuid,
	"kind" varchar(20) NOT NULL,
	"number" varchar(100) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_document_kind_check" CHECK (("billing_document"."kind" = 'invoice' and "billing_document"."payment_id" is null) or ("billing_document"."kind" = 'receipt' and "billing_document"."payment_id" is not null))
);

--> statement-breakpoint
CREATE TABLE "billing_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"villa_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"number" varchar(80) NOT NULL,
	"amount_cents" integer NOT NULL,
	"issued_by" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "billing_invoice_positive" CHECK ("billing_invoice"."amount_cents" > 0)
);

--> statement-breakpoint
CREATE TABLE "billing_issuer" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"registration_number" varchar(120),
	"tax_number" varchar(120),
	"bank_instructions" text NOT NULL,
	"invoice_prefix" varchar(20) DEFAULT 'INV' NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "billing_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" varchar(200) NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversal_reason" text,
	CONSTRAINT "billing_payment_positive" CHECK ("billing_payment"."amount_cents" > 0)
);

--> statement-breakpoint
CREATE TABLE "billing_recipient" (
	"villa_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "billing_schedule_template" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"steps" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "account_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"delivery_count" integer DEFAULT 0 NOT NULL,
	"last_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_invitation_account_id_unique" UNIQUE("account_id")
);

--> statement-breakpoint
CREATE TABLE "management_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"request_digest" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "event_recipient" (
	"event_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"read_at" timestamp with time zone
);

--> statement-breakpoint
CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"recipient_account_id" uuid,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" uuid NOT NULL,
	"idempotency_key" varchar(240) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lease_id" uuid,
	"sent_at" timestamp with time zone,
	"last_error" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_outbox_status_check" CHECK ("mail_outbox"."status" in ('pending','processing','sent','failed','cancelled'))
);

--> statement-breakpoint
CREATE TABLE "message_asset" (
	"message_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL
);

--> statement-breakpoint
CREATE TABLE "platform_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_label" varchar(200) NOT NULL,
	"project_id" uuid NOT NULL,
	"villa_id" uuid,
	"action" varchar(60) NOT NULL,
	"target_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"pm_safe" boolean DEFAULT false NOT NULL,
	"dedupe_key" varchar(240),
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "team_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"villa_id" uuid,
	"author_id" uuid NOT NULL,
	"author_label" varchar(200) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "display_name" varchar(200);
--> statement-breakpoint
ALTER TABLE "asset_version" ADD CONSTRAINT "asset_version_asset_id_managed_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."managed_asset"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_version" ADD CONSTRAINT "asset_version_uploaded_by_account_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "managed_asset" ADD CONSTRAINT "managed_asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "managed_asset" ADD CONSTRAINT "managed_asset_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "managed_asset" ADD CONSTRAINT "managed_asset_created_by_account_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_intent" ADD CONSTRAINT "upload_intent_asset_id_managed_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."managed_asset"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_intent" ADD CONSTRAINT "upload_intent_actor_id_account_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_document" ADD CONSTRAINT "billing_document_invoice_id_billing_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoice"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_document" ADD CONSTRAINT "billing_document_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_document" ADD CONSTRAINT "billing_document_payment_id_billing_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."billing_payment"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_milestone_id_payment_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."payment_milestone"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_issued_by_account_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_issuer" ADD CONSTRAINT "billing_issuer_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_invoice_id_billing_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoice"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_recorded_by_account_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_reversed_by_account_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_recipient" ADD CONSTRAINT "billing_recipient_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_schedule_template" ADD CONSTRAINT "billing_schedule_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_invitation" ADD CONSTRAINT "account_invitation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_invitation" ADD CONSTRAINT "account_invitation_invited_by_account_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "management_request" ADD CONSTRAINT "management_request_actor_id_account_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_recipient" ADD CONSTRAINT "event_recipient_event_id_platform_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."platform_event"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_recipient" ADD CONSTRAINT "event_recipient_buyer_id_buyer_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyer"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_event_id_platform_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."platform_event"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_recipient_account_id_account_id_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_asset" ADD CONSTRAINT "message_asset_message_id_team_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."team_message"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_asset" ADD CONSTRAINT "message_asset_asset_id_managed_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."managed_asset"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_event" ADD CONSTRAINT "platform_event_actor_id_account_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_event" ADD CONSTRAINT "platform_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_event" ADD CONSTRAINT "platform_event_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_message" ADD CONSTRAINT "team_message_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_message" ADD CONSTRAINT "team_message_villa_id_villa_id_fk" FOREIGN KEY ("villa_id") REFERENCES "public"."villa"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_message" ADD CONSTRAINT "team_message_author_id_account_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_version_asset_sequence_unique" ON "asset_version" USING btree ("asset_id","sequence");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_version_storage_path_unique" ON "asset_version" USING btree ("storage_path");
--> statement-breakpoint
CREATE INDEX "managed_asset_scope_idx" ON "managed_asset" USING btree ("project_id","villa_id");
--> statement-breakpoint
CREATE INDEX "upload_intent_actor_idx" ON "upload_intent" USING btree ("actor_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "upload_intent_path_unique" ON "upload_intent" USING btree ("storage_path");
--> statement-breakpoint
CREATE INDEX "billing_document_villa_idx" ON "billing_document" USING btree ("villa_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_document_invoice_unique" ON "billing_document" USING btree ("invoice_id") WHERE "billing_document"."kind" = 'invoice';
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_document_payment_unique" ON "billing_document" USING btree ("payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_invoice_milestone_unique" ON "billing_invoice" USING btree ("milestone_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_invoice_number_unique" ON "billing_invoice" USING btree ("project_id","number");
--> statement-breakpoint
CREATE INDEX "billing_invoice_villa_idx" ON "billing_invoice" USING btree ("villa_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payment_active_unique" ON "billing_payment" USING btree ("invoice_id") WHERE "billing_payment"."reversed_at" is null;
--> statement-breakpoint
CREATE INDEX "management_request_actor_idx" ON "management_request" USING btree ("actor_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_recipient_unique" ON "event_recipient" USING btree ("event_id","buyer_id");
--> statement-breakpoint
CREATE INDEX "event_recipient_buyer_idx" ON "event_recipient" USING btree ("buyer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_outbox_idempotency_unique" ON "mail_outbox" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "mail_outbox_due_idx" ON "mail_outbox" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX "mail_outbox_source_idx" ON "mail_outbox" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "message_asset_unique" ON "message_asset" USING btree ("message_id","asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_event_dedupe_unique" ON "platform_event" USING btree ("dedupe_key");
--> statement-breakpoint
CREATE INDEX "platform_event_scope_created_idx" ON "platform_event" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX "team_message_scope_created_idx" ON "team_message" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "villa_code_unique" ON "villa" USING btree ("code");
