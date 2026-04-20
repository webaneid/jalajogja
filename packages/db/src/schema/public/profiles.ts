import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { members } from "./members";
import { tenants } from "./tenants";
import { user } from "./auth";

// ─── Identitas universal publik — siapapun yang bertransaksi di ekosistem ────────
// Bukan hanya alumni IKPM. Pembeli umum, donatur luar, peserta event — semua bisa
// punya satu ID yang berlaku di seluruh tenant. Melengkapi public.members, bukan
// menggantikannya.
//
// Aturan akses:
// - Akun publik TIDAK bisa login ke dashboard tenant (hanya front-end)
// - Tenant hanya bisa lihat transaksi profile_id yang ada di tenant mereka sendiri
// - Super admin jalajogja bisa query semua profiles tanpa filter
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Identitas (ketiganya wajib) ────────────────────────────────────────────────
  name:  text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(), // nomor WhatsApp

  // ── Tipe akun ──────────────────────────────────────────────────────────────────
  // 'akun'   → publik umum, default saat daftar
  // 'member' → alumni IKPM yang sudah di-link ke public.members oleh admin
  // Disimpan eksplisit agar tidak perlu join ke members hanya untuk cek tipe
  accountType: text("account_type", { enum: ["akun", "member"] })
    .notNull()
    .default("akun"),

  // ── Alamat (semua opsional) ────────────────────────────────────────────────────
  // Pakai ref wilayah yang sama dengan modul anggota (tidak ada tabel baru)
  // Wajib minimal sampai regency_id saat checkout barang fisik (enforced di app)
  addressDetail: text("address_detail"),
  provinceId:    text("province_id"),
  regencyId:     text("regency_id"),
  districtId:    text("district_id"),
  villageId:     text("village_id"),
  country:       text("country").default("Indonesia"),

  // ── Link ke ekosistem (keduanya opsional) ─────────────────────────────────────
  // member_id: diisi admin saat link profile → member (identity merge)
  //   → saat diisi, account_type di-update ke 'member' secara otomatis
  memberId:          uuid("member_id")
    .unique()
    .references(() => members.id, { onDelete: "set null" }),

  // better_auth_user_id: diisi saat profile punya akun login
  //   → null = profile ada (dari checkout) tapi belum set password
  betterAuthUserId:  text("better_auth_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),

  // ── Metadata ───────────────────────────────────────────────────────────────────
  registeredAtTenant: uuid("registered_at_tenant")
    .references(() => tenants.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // Soft delete: null = aktif; diisi = akun dihapus user
  // FK dari tabel transaksi ke profile_id tetap valid setelah delete (data audit aman)
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  emailIdx:    index("idx_profiles_email").on(t.email),
  phoneIdx:    index("idx_profiles_phone").on(t.phone),
  memberIdx:   index("idx_profiles_member_id").on(t.memberId),
  authUserIdx: index("idx_profiles_better_auth_user_id").on(t.betterAuthUserId),
}));

export type Profile    = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
