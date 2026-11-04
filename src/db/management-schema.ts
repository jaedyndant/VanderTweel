import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { account } from "./schema";

/** Invitation delivery is tracked separately from authentication. Receiving an
 * invitation never authenticates anyone: Auth.js still verifies mailbox access. */
export const accountInvitation = pgTable("account_invitation", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().unique().references(() => account.id),
  invitedBy: uuid("invited_by").notNull().references(() => account.id),
  deliveryCount: integer("delivery_count").notNull().default(0),
  lastRequestedAt: timestamp("last_requested_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Persist successful request receipts in the same transaction as the writes.
 * A network retry cannot create a second villa or queue another invitation. */
export const managementRequest = pgTable("management_request", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => account.id),
  kind: varchar("kind", { length: 40 }).notNull(),
  requestDigest: text("request_digest").notNull(),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("management_request_actor_idx").on(table.actorId)]);
