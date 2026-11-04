import { pgTable, uuid, text, varchar, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { account, project, villa } from "./schema";

/** New managed uploads are deliberately separate from historical external links. */
export const managedAsset = pgTable("managed_asset", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => project.id),
  villaId: uuid("villa_id").references(() => villa.id),
  kind: varchar("kind", { length: 12 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  note: text("note").notNull().default(""),
  visibility: varchar("visibility", { length: 12 }).notNull().default("internal"),
  activeVersion: integer("active_version").notNull().default(0),
  revision: integer("revision").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => account.id),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("managed_asset_scope_idx").on(t.projectId, t.villaId),
  check("managed_asset_kind_check", sql`${t.kind} in ('photo','doc')`),
  check("managed_asset_visibility_check", sql`${t.visibility} in ('internal','shared')`),
  check("managed_asset_revision_check", sql`${t.revision} > 0 and ${t.activeVersion} >= 0`),
]);

export const assetVersion = pgTable("asset_version", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => managedAsset.id),
  sequence: integer("sequence").notNull(),
  storagePath: text("storage_path").notNull(),
  fileName: varchar("file_name", { length: 180 }).notNull(),
  contentType: varchar("content_type", { length: 80 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("asset_version_asset_sequence_unique").on(t.assetId, t.sequence),
  uniqueIndex("asset_version_storage_path_unique").on(t.storagePath),
  check("asset_version_size_check", sql`${t.byteSize} > 0 and ${t.byteSize} <= 20971520`),
]);

export const uploadIntent = pgTable("upload_intent", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => managedAsset.id),
  actorId: uuid("actor_id").notNull().references(() => account.id),
  storagePath: text("storage_path").notNull(),
  fileName: varchar("file_name", { length: 180 }).notNull(),
  contentType: varchar("content_type", { length: 80 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("upload_intent_actor_idx").on(t.actorId, t.createdAt), uniqueIndex("upload_intent_path_unique").on(t.storagePath)]);
