import {
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { members }   from "./members";
import { pesantren } from "./pesantren";

// ─── Pivot: relasi anggota ↔ pesantren (alumni, pengasuh, pendiri, dll) ─────────
export const memberPesantren = pgTable("member_pesantren", {
  id:          uuid("id").primaryKey().defaultRandom(),
  memberId:    uuid("member_id").notNull()
                 .references(() => members.id, { onDelete: "cascade" }),
  pesantrenId: uuid("pesantren_id").notNull()
                 .references(() => pesantren.id, { onDelete: "cascade" }),
  peran:       text("peran", {
                 enum: ["alumni","pengasuh","pendiri","pengajar","pengurus","lainnya"],
               }).notNull(),
  posisi:      text("posisi"),       // jabatan spesifik: "Direktur KMI", "Musyrif"
  tahunMulai:  smallint("tahun_mulai"),
  tahunSelesai: smallint("tahun_selesai"), // NULL = masih aktif
  isActive:    boolean("is_active").notNull().default(true),
  catatan:     text("catatan"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdIdx:    index("idx_member_pesantren_member_id").on(t.memberId),
  pesantrenIdIdx: index("idx_member_pesantren_pesantren_id").on(t.pesantrenId),
  peranIdx:       index("idx_member_pesantren_peran").on(t.peran),
  uniqRelasi:     unique("uq_member_pesantren").on(t.memberId, t.pesantrenId, t.peran, t.tahunMulai),
}));

export type MemberPesantren    = typeof memberPesantren.$inferSelect;
export type NewMemberPesantren = typeof memberPesantren.$inferInsert;
