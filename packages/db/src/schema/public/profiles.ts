import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

// ─── Identitas universal publik — orang umum yang bertransaksi di ekosistem ──
// Khusus untuk NON-anggota IKPM. Pembeli umum, donatur luar, peserta event.
// Anggota IKPM punya login via public.members.better_auth_user_id — bukan di sini.
//
// Aturan akses:
// - Akun publik TIDAK bisa login ke dashboard tenant (hanya front-end)
// - Tenant hanya bisa lihat transaksi profile_id yang ada di tenant mereka sendiri
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Identitas ──────────────────────────────────────────────────────────────────
  name:     text("name").notNull(),
  email:    text("email").notNull().unique(),
  phone:    text("phone").notNull().unique(),
  whatsapp: text("whatsapp").unique(),

  // ── Alamat (semua opsional) ────────────────────────────────────────────────────
  // Wajib minimal sampai regency_id saat checkout barang fisik (enforced di app)
  addressDetail: text("address_detail"),
  provinceId:    text("province_id"),
  regencyId:     text("regency_id"),
  districtId:    text("district_id"),
  villageId:     text("village_id"),
  country:       text("country").default("Indonesia"),

  // ── Link ke ekosistem ──────────────────────────────────────────────────────────
  betterAuthUserId: text("better_auth_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),

  // ── Metadata ───────────────────────────────────────────────────────────────────
  registeredAtTenant: uuid("registered_at_tenant")
    .references(() => tenants.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  emailIdx:    index("idx_profiles_email").on(t.email),
  phoneIdx:    index("idx_profiles_phone").on(t.phone),
  authUserIdx: index("idx_profiles_better_auth_user_id").on(t.betterAuthUserId),
}));

export type Profile    = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
