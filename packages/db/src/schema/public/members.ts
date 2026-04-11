import {
  pgTable,
  uuid,
  text,
  date,
  smallint,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { refProfessions } from "./ref-professions";
import { refRegencies } from "./ref-regencies";
import { addresses } from "./addresses";
import { contacts } from "./contacts";
import { socialMedias } from "./social-medias";

// ─── Tabel pusat identitas anggota — lintas semua tenant ─────────────────────
// Satu record = satu orang nyata. Tidak duplikat antar cabang.
// Hanya jalajogja super admin yang bisa akses semua baris.
// Tenant hanya bisa akses baris yang terhubung via tenant_memberships.
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Identitas organisasi ────────────────────────────────────────────────────
  // Auto-generated via PostgreSQL SEQUENCE, format: {tahun}{DDMMYYYY}{00001}
  // Contoh: 20252610198100001 (lahir 26-10-1981, daftar 2025, urutan ke-1)
  memberNumber: text("member_number").unique(),
  stambukNumber: text("stambuk_number"), // Nomor santri PM Gontor — bukan nomor anggota

  // ── Data pribadi ────────────────────────────────────────────────────────────
  // NIK: partial unique index via raw SQL di migration (WHERE nik IS NOT NULL)
  // Tidak menggunakan .unique() Drizzle karena tidak support partial index
  nik: text("nik"),
  name: text("name").notNull(),
  gender: text("gender", { enum: ["male", "female"] }),

  // Tempat lahir: FK ke kabupaten/kota (terstruktur) + fallback teks bebas
  // birthRegencyId untuk lahir di Indonesia, birthPlaceText untuk LN atau data lama
  birthRegencyId: integer("birth_regency_id").references(() => refRegencies.id),
  birthPlaceText: text("birth_place_text"),
  birthDate: date("birth_date"),
  photoUrl: text("photo_url"),

  // ── Alumni Gontor ────────────────────────────────────────────────────────────
  graduationYear: smallint("graduation_year"), // Tahun lulus/keluar dari PM Gontor

  // ── Pekerjaan ────────────────────────────────────────────────────────────────
  professionId: smallint("profession_id").references(() => refProfessions.id),

  // ── Domisili ─────────────────────────────────────────────────────────────────
  // domicileTenantId = cabang AKTIF saat ini
  // Diupdate setelah member_domicile_requests disetujui
  domicileStatus: text("domicile_status", { enum: ["permanent", "temporary"] }),
  domicileTenantId: uuid("domicile_tenant_id")
    .references(() => tenants.id, { onDelete: "set null" }),

  // ── Relasi ke helper tables ───────────────────────────────────────────────────
  homeAddressId: uuid("home_address_id").references(() => addresses.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id").references(() => socialMedias.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  birthRegencyIdx:   index("idx_members_birth_regency_id").on(t.birthRegencyId),
  professionIdx:     index("idx_members_profession_id").on(t.professionId),
  domicileTenantIdx: index("idx_members_domicile_tenant_id").on(t.domicileTenantId),
}));

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
