import { pgTable, uuid, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

// Counter atomic untuk nomor keanggotaan lokal forum (tenant_memberships.membership_number).
// Satu baris per tenant forum yang mengaktifkan fitur ini. TIDAK reset per tahun — angka urut
// jalan terus selama umur tenant (keputusan dikunci 2026-07-24, lihat
// docs/arsitektur-backbone-ikpm.md § "Nomor Keanggotaan Lokal Forum"). Pola locking sama persis
// dengan letter_number_sequences (tenant schema) — di sini di PUBLIC schema karena
// tenant_memberships juga di public schema.
export const forumMembershipSequences = pgTable("forum_membership_sequences", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueTenant: unique("forum_membership_sequences_tenant_unique").on(t.tenantId),
}));

export type ForumMembershipSequence    = typeof forumMembershipSequences.$inferSelect;
export type NewForumMembershipSequence = typeof forumMembershipSequences.$inferInsert;
