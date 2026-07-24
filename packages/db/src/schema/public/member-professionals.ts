import {
  pgTable, uuid, text, integer, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { members }      from "./members";
import { addresses }    from "./addresses";
import { contacts }     from "./contacts";
import { socialMedias } from "./social-medias";

// ─── Data profesional anggota IKPM (dokter, pengacara, konsultan, dll) ───────
// Self-reported, tidak butuh verifikasi admin.
// Pola identik dengan member_businesses & member_owned_pesantren.
export const memberProfessionals = pgTable("member_professionals", {
  id:       uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
              .references(() => members.id, { onDelete: "cascade" }),

  // ── Identitas profesional ─────────────────────────────────────────────────
  title: text("title"), // gelar/sebutan, mis. "dr.", "Ir." — opsional

  professionCategory: text("profession_category", {
    enum: [
      "Sains, Teknik & Rekayasa", "Kesehatan", "Pendidikan & Akademik",
      "Bisnis, Keuangan & Manajemen", "Teknologi Informasi",
      "Hukum, Sosial & Budaya", "Kreatif", "Lainnya",
    ],
  }).notNull(),

  professionType: text("profession_type").notNull(), // mis. "Dokter", "Notaris", "Perawat" — combobox kurasi + custom
  specialization: text("specialization"),             // detail lanjut, mis. "Spesialis Anak (Sp.A)" — opsional
  description:    text("description"),               // bio singkat / layanan

  // ── Kredensial (opsional, publik by default) ─────────────────────────────
  licenseType:   text("license_type"),     // mis. "STR", "No. Advokat PERADI"
  licenseNumber: text("license_number"),

  // ── Konteks kerja ──────────────────────────────────────────────────────────
  employmentType: text("employment_type", {
    enum: ["Praktik Mandiri", "Karyawan/Pegawai", "Pemilik Firma/Klinik/Kantor", "Freelance/Konsultan Lepas"],
  }),
  institution: text("institution"),   // tempat praktik/bekerja
  startYear:   integer("start_year"), // tahun mulai berkarir (opsional)

  // ── Foto profil profesional ────────────────────────────────────────────────
  coverUrl: text("cover_url"),   // URL dari member media library (bukan FK — cross-schema)

  // ── Helper FKs (kondisional, null jika kosong) ────────────────────────────
  contactId:     uuid("contact_id")
                   .references(() => contacts.id,     { onDelete: "set null" }),
  addressId:     uuid("address_id")
                   .references(() => addresses.id,    { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id")
                   .references(() => socialMedias.id, { onDelete: "set null" }),

  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdx:   index("idx_member_professionals_member_id").on(t.memberId),
  categoryIdx: index("idx_member_professionals_category").on(t.professionCategory),
  typeIdx:     index("idx_member_professionals_type").on(t.professionType),
}));

export type MemberProfessional    = typeof memberProfessionals.$inferSelect;
export type NewMemberProfessional = typeof memberProfessionals.$inferInsert;
