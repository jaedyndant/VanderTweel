import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { account, project, villa, paymentMilestone } from "./schema";
import type { BillingSnapshot, ScheduleStep } from "@/lib/billing/domain";

export const billingIssuer = pgTable("billing_issuer", {
  projectId: uuid("project_id").primaryKey().references(() => project.id),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  address: text("address").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  registrationNumber: varchar("registration_number", { length: 120 }),
  taxNumber: varchar("tax_number", { length: 120 }),
  bankInstructions: text("bank_instructions").notNull(),
  invoicePrefix: varchar("invoice_prefix", { length: 20 }).notNull().default("INV"),
  nextNumber: integer("next_number").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingScheduleTemplate = pgTable("billing_schedule_template", {
  projectId: uuid("project_id").primaryKey().references(() => project.id),
  name: varchar("name", { length: 120 }).notNull(),
  steps: jsonb("steps").$type<ScheduleStep[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingRecipient = pgTable("billing_recipient", {
  villaId: uuid("villa_id").primaryKey().references(() => villa.id),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingInvoice = pgTable("billing_invoice", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => project.id),
  villaId: uuid("villa_id").notNull().references(() => villa.id),
  milestoneId: uuid("milestone_id").notNull().references(() => paymentMilestone.id),
  number: varchar("number", { length: 80 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  issuedBy: uuid("issued_by").notNull().references(() => account.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  snapshot: jsonb("snapshot").$type<BillingSnapshot>().notNull(),
}, (t) => [uniqueIndex("billing_invoice_milestone_unique").on(t.milestoneId), uniqueIndex("billing_invoice_number_unique").on(t.projectId, t.number), index("billing_invoice_villa_idx").on(t.villaId), check("billing_invoice_positive", sql`${t.amountCents} > 0`)]);

// Payments are append-only. A reversal retains the record, invoice and receipt.
// One current settlement per invoice; a corrected replacement is a new record.
export const billingPayment = pgTable("billing_payment", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => billingInvoice.id),
  amountCents: integer("amount_cents").notNull(),
  reference: varchar("reference", { length: 200 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  recordedBy: uuid("recorded_by").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by").references(() => account.id),
  reversalReason: text("reversal_reason"),
}, (t) => [uniqueIndex("billing_payment_active_unique").on(t.invoiceId).where(sql`${t.reversedAt} is null`), check("billing_payment_positive", sql`${t.amountCents} > 0`)]);

export const billingDocument = pgTable("billing_document", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => billingInvoice.id),
  villaId: uuid("villa_id").notNull().references(() => villa.id),
  paymentId: uuid("payment_id").references(() => billingPayment.id),
  kind: varchar("kind", { length: 20 }).notNull(),
  number: varchar("number", { length: 100 }).notNull(),
  snapshot: jsonb("snapshot").$type<BillingSnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("billing_document_villa_idx").on(t.villaId), uniqueIndex("billing_document_invoice_unique").on(t.invoiceId).where(sql`${t.kind} = 'invoice'`), uniqueIndex("billing_document_payment_unique").on(t.paymentId), check("billing_document_kind_check", sql`(${t.kind} = 'invoice' and ${t.paymentId} is null) or (${t.kind} = 'receipt' and ${t.paymentId} is not null)`)]);
