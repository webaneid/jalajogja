import {
  pgTable,
  text,
  uuid,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ─── Tabel pusat identitas anggota — lintas semua tenant ───────────────────
// Satu record = satu orang nyata. Tidak duplikat antar cabang.
// Hanya jalajogja super admin yang bisa akses semua baris.
// Tenant hanya bisa akses baris yang terhubung via tenant_memberships.

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Nomor anggota global — auto-generated, format: {tahun}{DDMMYYYY}{00001}
  // Contoh: 2025261019810001 (lahir 26-10-1981, daftar 2025, urutan ke-1)
  memberNumber: text("member_number").unique(),

  // Nomor stambuk — nomor santri dari Pondok Gontor (atau institusi asal lain)
  // Data identitas personal, bukan ID organisasi
  stambukNumber: text("stambuk_number"),

  // Nomor Induk Kependudukan — opsional tapi unik jika diisi
  nik: text("nik"),

  // Data identitas
  name: text("name").notNull(),
  gender: text("gender", { enum: ["male", "female"] }),
  birthPlace: text("birth_place"),
  birthDate: date("birth_date"),

  // Kontak
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  photoUrl: text("photo_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // NIK unik per baris yang diisi (nullable unique via partial index di SQL)
  nikUnique: unique("members_nik_unique").on(t.nik),
}));

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
