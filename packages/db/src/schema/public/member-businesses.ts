import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
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
  category: text("category", {
    enum: ["Jasa", "Produsen", "Distributor", "Trading", "Profesional"],
  }).notNull(),

  sector: text("sector", {
    enum: [
      "Teknologi",
      "Jasa Profesional",
      "Kreatif",
      "Manufaktur",
      "Kesehatan & Pendidikan",
      "Konsumsi & Ritel",
      "Sumber Daya Alam",
    ],
  }).notNull(),

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
