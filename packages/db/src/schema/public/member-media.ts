import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { members } from "./members";

// Media library global anggota IKPM — satu koleksi per member, lintas semua tenant.
// File FISIK tetap di bucket MinIO tenant tempat upload dilakukan (`sourceTenantSlug`
// menunjukkan bucket mana). Tabel ini hanya metadata, tidak pernah memindahkan file.
// Detail arsitektur: docs/arsitektur-medialibrary.md § 3.
export const memberMedia = pgTable("member_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
    .references(() => members.id, { onDelete: "cascade" }),

  // Bucket MinIO tempat file fisik berada: `tenant-{sourceTenantSlug}`
  sourceTenantSlug: text("source_tenant_slug").notNull(),

  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),

  variants: jsonb("variants").$type<Record<string, string> | null>(),
  processingStatus: text("processing_status").notNull().default("done"),
  originalMime: text("original_mime"),
  originalExpiresAt: timestamp("original_expires_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdIdx: index("idx_member_media_member_id").on(t.memberId),
}));

export type MemberMedia = typeof memberMedia.$inferSelect;
export type NewMemberMedia = typeof memberMedia.$inferInsert;
