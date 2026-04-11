import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { members } from "./members";
import { tenants } from "./tenants";

// ─── Relasi anggota ↔ cabang (tenant) ───────────────────────────────────────
// Satu anggota bisa terdaftar di banyak cabang.
// Tenant hanya bisa lihat/akses member_id yang punya baris di sini
// dengan tenant_id mereka.

export const tenantMemberships = pgTable("tenant_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relasi ke tenant (cabang)
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Relasi ke member global
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),

  // Status keanggotaan di cabang ini
  status: text("status", { enum: ["active", "inactive", "alumni"] })
    .notNull()
    .default("active"),

  // Tanggal bergabung di cabang ini (bisa berbeda antar cabang)
  joinedAt: date("joined_at"),

  // Dicatat cabang mana yang pertama kali mendaftarkan anggota ini
  registeredVia: text("registered_via"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Satu anggota hanya bisa punya satu record per tenant
  uniqueMembership: unique("tenant_memberships_unique").on(t.tenantId, t.memberId),
}));

export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
