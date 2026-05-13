import {
  pgTable, uuid, text, integer, timestamp, index,
} from "drizzle-orm/pg-core";
import { members }     from "./members";
import { addresses }   from "./addresses";
import { contacts }    from "./contacts";
import { socialMedias } from "./social-medias";

// ─── Pesantren yang dimiliki / dikelola anggota IKPM ─────────────────────────
// Self-reported, tidak butuh verifikasi admin.
// Pola identik dengan member_businesses — satu row per pesantren, helper FK opsional.
export const memberOwnedPesantren = pgTable("member_owned_pesantren", {
  id:       uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
              .references(() => members.id, { onDelete: "cascade" }),

  // ── Identitas ──────────────────────────────────────────────────────────────
  name:         text("name").notNull(),
  tahunBerdiri: integer("tahun_berdiri"),
  luasArea:     text("luas_area"),        // free text, misal "2 hektar"
  namaPimpinan: text("nama_pimpinan"),
  hpPimpinan:   text("hp_pimpinan"),      // E.164, normalizePhone() saat insert

  // ── Klasifikasi ────────────────────────────────────────────────────────────
  kurikulum: text("kurikulum", {
    enum: ["KMI Gontor", "DIKNAS", "KEMENAG", "Salafiah", "Lainnya"],
  }),
  jenisPondok: text("jenis_pondok", {
    enum: ["Wakaf", "Milik Keluarga"],
  }),
  modelPendidikan: text("model_pendidikan", {
    enum: [
      "Murni KMI Gontor",
      "KMI dan Tahfidz",
      "KMI dan Kewirausahaan",
      "Pesantren Salafiah",
      "Pesantren Tahfidz",
      "Sekolah Umum",
      "DIKNAS dan Tahfidz",
      "KEMENAG dan Tahfidz",
      "Sekolah Kejuruan",
    ],
  }),
  kategoriSantri: text("kategori_santri", {
    enum: ["Putra", "Putra dan Putri", "Putri"],
  }),

  // ── Statistik (total dikalkulasi di client, tidak disimpan) ───────────────
  santriPutra: integer("santri_putra"),
  santriPutri: integer("santri_putri"),
  asatidz:     integer("asatidz"),     // pengajar putra
  asatidzah:   integer("asatidzah"),   // pengajar putri

  // ── Helper FKs (kondisional, null jika kosong) ────────────────────────────
  contactId:     uuid("contact_id")
                   .references(() => contacts.id,     { onDelete: "set null" }),
  addressId:     uuid("address_id")
                   .references(() => addresses.id,    { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id")
                   .references(() => socialMedias.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdx: index("idx_member_owned_pesantren_member_id").on(t.memberId),
}));

export type MemberOwnedPesantren    = typeof memberOwnedPesantren.$inferSelect;
export type NewMemberOwnedPesantren = typeof memberOwnedPesantren.$inferInsert;
