import { pgTable, uuid, text, timestamp, integer, jsonb, numeric, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

// Tautan verifikasi pembayaran untuk PJ (bendahara) — token ter-hash, lihat
// docs/arsitektur-notifikasi-pengurus.md § 8. Tabel public (bukan per-tenant) supaya satu migration
// cukup dan lookup token tidak perlu menebak skema tenant.
export const pjVerificationLinks = pgTable("pj_verification_links", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash:      text("token_hash").notNull().unique(),
  module:         text("module", { enum: ["keuangan"] }).notNull(),
  recipientName:  text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientUserId: uuid("recipient_user_id"),
  paymentIds:     jsonb("payment_ids").$type<string[]>().notNull().default([]),
  expiresAt:      timestamp("expires_at", { withTimezone: true }).notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedAt:       timestamp("locked_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("idx_pj_links_tenant").on(t.tenantId, t.createdAt),
}));

export const pjVerificationEvents = pgTable("pj_verification_events", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  linkId:    uuid("link_id").references(() => pjVerificationLinks.id, { onDelete: "set null" }),
  paymentId: uuid("payment_id").notNull(),
  action:    text("action", { enum: ["confirm", "confirm_different", "not_found"] }).notNull(),
  amount:    numeric("amount", { precision: 15, scale: 2 }),
  actorName: text("actor_name").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  paymentIdx: index("idx_pj_events_payment").on(t.tenantId, t.paymentId, t.createdAt),
}));

export type PjVerificationLink = typeof pjVerificationLinks.$inferSelect;
