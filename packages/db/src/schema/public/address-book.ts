import { pgTable, uuid, text, boolean, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { members } from "./members";
import { profiles } from "./profiles";
import { roDestinations } from "./ro-destinations";

// Buku alamat PER ORANG (anggota ATAU akun publik) — ikut orangnya ke semua tenant. Alamat kirim berbasis tujuan RajaOngkir
// (ro_destinations). Pemilik ditentukan SERVER dari sesi, bukan input. Doc: docs/arsitektur-alamat.md § 16.
export const addressBook = pgTable("address_book", {
  id:            uuid("id").primaryKey().defaultRandom(),
  memberId:      uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
  profileId:     uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  label:         text("label").notNull(),           // "Rumah", "Indah Permata"
  recipientName: text("recipient_name").notNull(),
  phone:         text("phone").notNull(),           // E.164
  destinationId: integer("destination_id").notNull().references(() => roDestinations.id),
  detail:        text("detail").notNull(),          // jalan / RT / RW / patokan
  isDefault:     boolean("is_default").notNull().default(false),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdx:  index("address_book_member_idx").on(t.memberId),
  profileIdx: index("address_book_profile_idx").on(t.profileId),
  memberDefaultUniq:  uniqueIndex("address_book_member_default_uniq").on(t.memberId).where(sql`${t.isDefault} AND ${t.memberId} IS NOT NULL`),
  profileDefaultUniq: uniqueIndex("address_book_profile_default_uniq").on(t.profileId).where(sql`${t.isDefault} AND ${t.profileId} IS NOT NULL`),
  ownerXor: check("address_book_owner_xor", sql`(${t.memberId} IS NULL) <> (${t.profileId} IS NULL)`),
}));

export type AddressBookRow = typeof addressBook.$inferSelect;
