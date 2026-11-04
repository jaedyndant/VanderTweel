import { pgTable, uuid, varchar, text, boolean, timestamp, integer, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { account, project, villa, buyer } from "./schema";
import { managedAsset } from "./files-schema";

export const platformEvent = pgTable("platform_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => account.id),
  actorLabel: varchar("actor_label", { length: 200 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => project.id),
  villaId: uuid("villa_id").references(() => villa.id),
  action: varchar("action", { length: 60 }).notNull(),
  targetId: uuid("target_id").notNull(),
  summary: text("summary").notNull(),
  pmSafe: boolean("pm_safe").notNull().default(false),
  dedupeKey: varchar("dedupe_key", { length: 240 }),
  link: text("link"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("platform_event_dedupe_unique").on(t.dedupeKey), index("platform_event_scope_created_idx").on(t.projectId, t.createdAt)]);
export const eventRecipient = pgTable("event_recipient", {
  eventId: uuid("event_id").notNull().references(() => platformEvent.id),
  buyerId: uuid("buyer_id").notNull().references(() => buyer.id),
  readAt: timestamp("read_at", { withTimezone: true }),
}, t => [uniqueIndex("event_recipient_unique").on(t.eventId, t.buyerId), index("event_recipient_buyer_idx").on(t.buyerId)]);
export const mailOutbox = pgTable("mail_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => platformEvent.id),
  recipientAccountId: uuid("recipient_account_id").references(() => account.id),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  sourceType: varchar("source_type", { length: 40 }).notNull(),
  sourceId: uuid("source_id").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  leaseId: uuid("lease_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: varchar("last_error", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("mail_outbox_idempotency_unique").on(t.idempotencyKey), index("mail_outbox_due_idx").on(t.status, t.nextAttemptAt), index("mail_outbox_source_idx").on(t.sourceType, t.sourceId), check("mail_outbox_status_check", sql`${t.status} in ('pending','processing','sent','failed','cancelled')`)]);
export const teamMessage = pgTable("team_message", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => project.id),
  villaId: uuid("villa_id").references(() => villa.id),
  authorId: uuid("author_id").notNull().references(() => account.id),
  authorLabel: varchar("author_label", { length: 200 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("team_message_scope_created_idx").on(t.projectId, t.createdAt)]);
export const messageAsset = pgTable("message_asset", {
  messageId: uuid("message_id").notNull().references(() => teamMessage.id),
  assetId: uuid("asset_id").notNull().references(() => managedAsset.id),
}, t => [uniqueIndex("message_asset_unique").on(t.messageId, t.assetId)]);
