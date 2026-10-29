// Datamodel volgens Technisch Ontwerp hoofdstuk 7 (Van der Tweel / Cemagi Atelier).
// Kernregel: elke tabel die "van een villa" is, heeft een villa_id fk en een index erop
// (meest voorkomende query: "alles van deze villa" — TO 7.3).

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// -- account -----------------------------------------------------------
// role bepaalt welk oppervlak opent (geen rolkeuze op het inlogscherm, zie TO 9.1)
export const account = pgTable(
  "account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // 'buyer' | 'pm' | 'developer'
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("account_email_unique").on(t.email)] // TO 7.3: unieke index voor magic-link lookup
);

// -- project -------------------------------------------------------------
export const project = pgTable("project", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  brandLocked: boolean("brand_locked").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// -- villa -----------------------------------------------------------------
export const villa = pgTable(
  "villa",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => project.id),
    code: varchar("code", { length: 20 }).notNull(), // bv. "Villa 03"
    plotM2: numeric("plot_m2", { precision: 8, scale: 2 }),
    builtM2: numeric("built_m2", { precision: 8, scale: 2 }),
    status: varchar("status", { length: 30 }).notNull().default("planned"),
    model3dUrl: text("model_3d_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // MS3: additieve brochure/koper-attributen (TO hfst. 7 tekende de relaties af,
    // deze velden waren nodig om de echte Cemagi-cijfers te tonen zonder de
    // tabel-structuur/relaties te wijzigen — zie migratie 0001).
    typeLabel: varchar("type_label", { length: 80 }), // bv. "One-bedroom loft"
    outdoorM2: numeric("outdoor_m2", { precision: 8, scale: 2 }),
    leaseYears: integer("lease_years"),
    pricePackage: varchar("price_package", { length: 60 }),
    priceTotalUsd: numeric("price_total_usd", { precision: 12, scale: 2 }),
    buildStarted: timestamp("build_started", { withTimezone: true }),
    handoverExpected: timestamp("handover_expected", { withTimezone: true }),
  },
  (t) => [index("villa_project_id_idx").on(t.projectId)]
);

// -- buyer (koper) ------------------------------------------------------
export const buyer = pgTable("buyer", {
  id: uuid("id").defaultRandom().primaryKey(),
  // One buyer profile per account -- multiple villas go through buyer_villa
  // (n:m), not through multiple buyer rows. Unique constraint added
  // 2026-10-28 after a real duplicate-row bug (see drizzle/0005).
  accountId: uuid("account_id").notNull().unique().references(() => account.id),
  name: varchar("name", { length: 200 }).notNull(),
  country: varchar("country", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// -- buyer_villa (koppeltabel, n:m) --------------------------------------
// TO 7.3: samengestelde index — dit is de autorisatiecheck die bij elke koper-request draait
export const buyerVilla = pgTable(
  "buyer_villa",
  {
    buyerId: uuid("buyer_id").notNull().references(() => buyer.id),
    villaId: uuid("villa_id").notNull().references(() => villa.id),
  },
  (t) => [uniqueIndex("buyer_villa_pk").on(t.buyerId, t.villaId)]
);

// -- project_manager ------------------------------------------------------
export const projectManager = pgTable("project_manager", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// -- pm_project (koppeltabel, n:m) ---------------------------------------
export const pmProject = pgTable(
  "pm_project",
  {
    pmId: uuid("pm_id").notNull().references(() => projectManager.id),
    projectId: uuid("project_id").notNull().references(() => project.id),
  },
  (t) => [uniqueIndex("pm_project_pk").on(t.pmId, t.projectId)]
);

// -- payment_milestone ------------------------------------------------------
export const paymentMilestone = pgTable(
  "payment_milestone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    villaId: uuid("villa_id").notNull().references(() => villa.id),
    percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
    dueLabel: varchar("due_label", { length: 120 }).notNull(), // bv. "Maand 4"
    status: varchar("status", { length: 20 }).notNull().default("open"), // 'open' | 'paid'
    paidAt: timestamp("paid_at", { withTimezone: true }),
    sequence: integer("sequence").notNull().default(0), // MS3: volgorde in het schema
    amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }), // MS3: echte Cemagi-cijfers
    note: text("note"), // MS3: toelichting bij de termijn
    expectedAt: timestamp("expected_at", { withTimezone: true }), // MS3: verwachte datum, nog niet betaald
  },
  (t) => [index("payment_milestone_villa_id_idx").on(t.villaId)]
);

// -- progress_task ------------------------------------------------------
export const progressTask = pgTable(
  "progress_task",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    villaId: uuid("villa_id").notNull().references(() => villa.id),
    phase: varchar("phase", { length: 120 }).notNull(),
    percentWeight: numeric("percent_weight", { precision: 5, scale: 2 }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: uuid("done_by").references(() => account.id),
    sequence: integer("sequence").notNull().default(0), // MS3: bouwvolgorde van de fases
    detail: text("detail"), // MS3: korte omschrijving van de fase
    period: varchar("period", { length: 60 }), // MS3: verwachte periode, bv. "Jun - Jul 2026"
  },
  (t) => [index("progress_task_villa_id_idx").on(t.villaId)]
);

// -- update (teamberichten aan koper) ------------------------------------
export const update = pgTable(
  "update",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    villaId: uuid("villa_id").notNull().references(() => villa.id),
    authorId: uuid("author_id").notNull().references(() => account.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    title: varchar("title", { length: 200 }), // MS3: koptekst van het teamberichten
    category: varchar("category", { length: 40 }), // MS3: bv. "Construction" | "Payment" | "Paperwork"
    authorRoleLabel: varchar("author_role_label", { length: 60 }), // MS3: weergavenaam van de afzender
  },
  (t) => [index("update_villa_id_idx").on(t.villaId)]
);

// -- file (foto's/documenten, alleen url, niet de bytes) -----------------
export const file = pgTable(
  "file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    villaId: uuid("villa_id").notNull().references(() => villa.id),
    uploadedBy: uuid("uploaded_by").notNull().references(() => account.id),
    kind: varchar("kind", { length: 20 }).notNull(), // 'photo' | 'doc'
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    label: varchar("label", { length: 200 }), // MS3: documentnaam, bv. "Building permit (PBG)"
    note: text("note"), // MS3: toelichting, bv. ondertekeningsdatum
  },
  (t) => [index("file_villa_id_idx").on(t.villaId)]
);

// -- notification ------------------------------------------------------
export const notification = pgTable("notification", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerId: uuid("buyer_id").notNull().references(() => buyer.id),
  sourceType: varchar("source_type", { length: 30 }).notNull(), // 'payment' | 'progress' | 'update' | 'file'
  sourceId: uuid("source_id").notNull(),
  channel: varchar("channel", { length: 10 }).notNull(), // 'app' | 'email'
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

// -- Auth.js technical storage (MS2) -------------------------------------
// NOT part of the TO ch.7 business datamodel — these two tables are Auth.js's
// own required storage for the magic-link flow (TO 9.1/9.2: one-time,
// short-lived tokens; session lookup). The "user" Auth.js normally wants is
// mapped onto the existing `account` table by a custom adapter
// (src/lib/auth-adapter.ts) instead of introducing a second, redundant users
// table the TO never specified.
export const verificationToken = pgTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 320 }).notNull(), // email
    token: varchar("token", { length: 255 }).notNull(), // hashed token
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("verification_token_identifier_token_idx").on(t.identifier, t.token)]
);

export const session = pgTable("session", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});
