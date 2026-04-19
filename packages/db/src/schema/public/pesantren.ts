import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { members }    from "./members";
import { addresses }  from "./addresses";
import { contacts }   from "./contacts";
import { socialMedias } from "./social-medias";

// ─── Direktori pesantren milik/dikelola alumni Gontor (anggota IKPM) ──────────
// Community-driven: anggota IKPM bisa submit (submitted_by), status draft sampai
// diverifikasi super admin jalajogja (is_verified = true, status = 'aktif').
// Bukan direktori pesantren umum Indonesia — fokus pada pesantren yang ada
// keterlibatan alumni Gontor sebagai pengasuh, pendiri, atau pengajar.
export const pesantren = pgTable("pesantren", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Identitas ──────────────────────────────────────────────────────────────
  name:        text("name").notNull(),
  popularName: text("popular_name"),       // nama populer / sebutan santri
  slug:        text("slug").notNull().unique(),
  fotoUrls:    text("foto_urls").array().notNull().default(sql`'{}'::text[]`),

  // ── Pendidikan ─────────────────────────────────────────────────────────────
  // jenjang: CHECK constraint di DDL (array enum tidak bisa di Drizzle)
  // nilai yang diizinkan: tsanawiyah | aliyah | perguruan_tinggi
  jenjang:         text("jenjang").array().notNull().default(sql`'{}'::text[]`),
  sistem:          text("sistem", { enum: ["salafi","modern","semi_modern","tahfidz"] }),
  // kurikulum: kmi | diknas | kemenag | lainnya
  kurikulum:       text("kurikulum").array().notNull().default(sql`'{}'::text[]`),
  // bahasa_pengantar: bebas — 'Arab', 'Indonesia', 'Inggris', dll
  bahasaPengantar: text("bahasa_pengantar").array().notNull().default(sql`'{}'::text[]`),

  // ── Demografi ──────────────────────────────────────────────────────────────
  jenisKelamin: text("jenis_kelamin", { enum: ["putra","putri","keduanya"] }),
  jumlahSantri: integer("jumlah_santri"),
  tahunBerdiri: integer("tahun_berdiri"),
  luasArea:     text("luas_area"),
  jenisPondok:  text("jenis_pondok", {
                  enum: ["wakaf","keluarga","yayasan","pemerintah"],
                }),

  // ── Pendiri (historis — bisa bukan anggota IKPM) ──────────────────────────
  pendiriNama:     text("pendiri_nama"),
  pendiriMemberId: uuid("pendiri_member_id")
                     .references(() => members.id, { onDelete: "set null" }),

  // ── Pengasuh aktif saat ini ────────────────────────────────────────────────
  pengasuhNama:     text("pengasuh_nama"),
  pengasuhMemberId: uuid("pengasuh_member_id")
                      .references(() => members.id, { onDelete: "set null" }),

  // ── Helper tables (reuse pola member_businesses) ──────────────────────────
  addressId:    uuid("address_id")
                  .references(() => addresses.id, { onDelete: "set null" }),
  contactId:    uuid("contact_id")
                  .references(() => contacts.id, { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id")
                   .references(() => socialMedias.id, { onDelete: "set null" }),

  // ── Verifikasi & workflow ──────────────────────────────────────────────────
  // draft → diverifikasi admin platform → aktif
  // nonaktif = ditolak atau dinonaktifkan (tidak di-hard-delete)
  status:      text("status", { enum: ["draft","aktif","nonaktif"] })
                 .notNull().default("draft"),
  isVerified:  boolean("is_verified").notNull().default(false),
  verifiedAt:  timestamp("verified_at", { withTimezone: true }),
  submittedBy: uuid("submitted_by")
                 .references(() => members.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx:      index("idx_pesantren_status").on(t.status),
  sistemIdx:      index("idx_pesantren_sistem").on(t.sistem),
  pengasuhIdx:    index("idx_pesantren_pengasuh").on(t.pengasuhMemberId),
  pendiriIdx:     index("idx_pesantren_pendiri").on(t.pendiriMemberId),
  submittedByIdx: index("idx_pesantren_submitted_by").on(t.submittedBy),
  isVerifiedIdx:  index("idx_pesantren_is_verified").on(t.isVerified),
  // idx_pesantren_name_trgm dibuat via raw DDL (GIN trgm tidak bisa di Drizzle schema)
}));

export type Pesantren    = typeof pesantren.$inferSelect;
export type NewPesantren = typeof pesantren.$inferInsert;
