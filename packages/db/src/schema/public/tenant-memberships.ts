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

export const MEMBERSHIP_TYPES  = ["cabang", "marhalah", "forum"] as const;
export const FORUM_STATUSES    = ["pending", "active", "suspended", "rejected"] as const;
export const REGISTERED_VIA    = ["admin", "self", "import", "invite", "auto_marhalah", "auto_cabang"] as const;
export type MembershipType     = typeof MEMBERSHIP_TYPES[number];
export type ForumStatus        = typeof FORUM_STATUSES[number];

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

  // Dicatat jalur apa yang mendaftarkan anggota ini
  registeredVia: text("registered_via", { enum: REGISTERED_VIA }),

  // ── Backbone IKPM ──────────────────────────────────────────────────────────
  // Tipe keanggotaan ini (cabang = otomatis, marhalah = otomatis, forum = aktif/opt-in)
  membershipType: text("membership_type", { enum: MEMBERSHIP_TYPES }).notNull().default("cabang"),

  // Kolom khusus forum (null untuk cabang + marhalah):
  forumStatus:    text("forum_status", { enum: FORUM_STATUSES }),
  forumInvoiceId: uuid("forum_invoice_id"),   // referensi ke invoice pembayaran forum
  approvedAt:     timestamp("approved_at",  { withTimezone: true }),
  expiresAt:      timestamp("expires_at",   { withTimezone: true }), // untuk iuran tahunan

  // Nomor keanggotaan lokal — KHUSUS forum (null untuk cabang/marhalah). Berbeda dari
  // members.member_number (global lintas IKPM) — ini penomoran sendiri per forum, opsional,
  // dikonfigurasi admin di /settings/keanggotaan. Disimpan sebagai STRING HASIL JADI
  // (mis. "2017.00001"), bukan direkonstruksi dari bagian mentah di titik baca — lihat
  // lib/forum-membership-number.ts + docs/arsitektur-backbone-ikpm.md § "Nomor Keanggotaan
  // Lokal Forum".
  membershipNumber: text("membership_number"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Satu anggota hanya bisa punya satu record per tenant
  uniqueMembership: unique("tenant_memberships_unique").on(t.tenantId, t.memberId),
}));

export type TenantMembership    = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
