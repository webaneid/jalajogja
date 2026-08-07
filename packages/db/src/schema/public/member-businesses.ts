import { pgTable, uuid, text, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { members } from "./members";
import { addresses } from "./addresses";
import { contacts } from "./contacts";
import { socialMedias } from "./social-medias";

export const memberBusinesses = pgTable("member_businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
    .references(() => members.id, { onDelete: "cascade" }),

  // ── Identitas usaha ──────────────────────────────────────────────────────────
  name: text("name").notNull(),
  brand: text("brand"),        // Nama merek jika berbeda dari nama legal usaha
  description: text("description"),

  // ── Klasifikasi ──────────────────────────────────────────────────────────────
  // Nullable di DB (2026-07-25, migration 0048) — SEBELUMNYA NOT NULL, dilonggarkan supaya
  // bulk import bisa simpan data usaha yang belum lengkap tanpa membuang seluruh baris.
  // Wajib diisi tetap ditegakkan di FORM (self-service `/akun/usaha` + admin wizard), pola
  // sama persis dengan members.gender/members.birthDate/contacts.phone — required di
  // front-end, bukan di kolom. Lihat docs/arsitektur-usaha.md.
  //
  // "Praktisi" + "Akademisi" ditambah 2026-08-07. Nilai HARUS identik dengan
  // BUSINESS_CATEGORY_ENUM di apps/web/lib/business-form-options.ts — packages/db tidak
  // import dari apps/web, jadi dijaga manual konsisten (pola sama persis Sektor di bawah).
  category: text("category", {
    enum: ["Jasa", "Produsen", "Distributor", "Trading", "Profesional", "Praktisi", "Akademisi"],
  }),

  // Upgrade 2026-07-30 dari 7 sektor lama ke 10 sektor BPS KBLI hybrid + "Kreatif" mandiri.
  // Nilai HARUS identik dengan BUSINESS_SECTOR_ENUM di apps/web/lib/business-sectors.ts —
  // packages/db tidak import dari apps/web, jadi dijaga manual konsisten. Lihat
  // docs/arsitektur-usaha.md § 9 untuk rasionalisasi + mapping backward-compat.
  sector: text("sector", {
    enum: [
      "Pertanian, Peternakan & Perikanan",
      "Manufaktur & Pengolahan",
      "Perdagangan, Ritel & F&B",
      "Teknologi & Informasi",
      "Kreatif",
      "Logistik, Transportasi & Konstruksi",
      "Jasa Usaha & Keuangan",
      "Pendidikan & Pelatihan",
      "Kesehatan, Farmasi & Herbal",
      "Sumber Daya Alam & Energi",
    ],
  }),

  // Bidang usaha spesifik — facet INDEPENDEN dari sector (bukan sub-sector/hierarki, lihat
  // docs/arsitektur-usaha.md § 2-3), multi-select tag bebas + kurasi (lib/business-fields.ts).
  businessFields: jsonb("business_fields").$type<string[]>().notNull().default([]),

  // ── Ekosistem — apa yang ditawarkan/dibutuhkan (docs/arsitektur-ekosistem.md § 6 Fase 1) ────
  // Facet BARU, terpisah dari businessFields (klasifikasi industri) — vocabulary suggestion
  // dipusatkan di lib/ecosystem-tags.ts, dipakai bersama Usaha/Profesional/Pesantren.
  offeredTags: jsonb("offered_tags").$type<string[]>().notNull().default([]),
  neededTags:  jsonb("needed_tags").$type<string[]>().notNull().default([]),

  // ── Legalitas & struktur ─────────────────────────────────────────────────────
  legality: text("legality", {
    enum: [
      "PT Perseorangan",
      "PT",
      "CV",
      "Yayasan",
      "Perkumpulan",
      "Koperasi",
      "Belum Memiliki Legalitas",
    ],
  }),

  position: text("position", {
    enum: ["Komisaris", "Direktur", "Pengelola", "Manajer"],
  }),

  // ── Skala usaha ───────────────────────────────────────────────────────────────
  employees: text("employees", {
    enum: ["1-4", "5-10", "11-20", "Lebih dari 20"],
  }),

  branches: text("branches", {
    enum: ["Tidak Ada", "1-3", "Diatas 3"],
  }),

  revenue: text("revenue", {
    enum: ["Dibawah 500jt", "500jt-1M", "1M-2M", "Diatas 2M"],
  }),

  // ── Foto usaha ─────────────────────────────────────────────────────────────────
  coverUrl: text("cover_url"),   // URL foto cover/banner 16:9, dari member media library (bukan FK)
  logoUrl:  text("logo_url"),    // URL logo persegi (brand mark), terpisah dari cover

  // ── Relasi ke helper tables ───────────────────────────────────────────────────
  addressId: uuid("address_id").references(() => addresses.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id").references(() => socialMedias.id, { onDelete: "set null" }),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdIdx: index("idx_member_businesses_member_id").on(t.memberId),
  sectorIdx:   index("idx_member_businesses_sector").on(t.sector),    // Analitik: usaha per sektor
  categoryIdx: index("idx_member_businesses_category").on(t.category),
}));

export type MemberBusiness = typeof memberBusinesses.$inferSelect;
export type NewMemberBusiness = typeof memberBusinesses.$inferInsert;
