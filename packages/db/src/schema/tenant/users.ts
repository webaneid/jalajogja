import { pgSchema, text, uuid, timestamp } from "drizzle-orm/pg-core";

// Role yang tersedia di setiap tenant (dashboard access)
// Catatan: "anggota" TIDAK ada di sini — anggota biasa tidak punya akses dashboard
// "custom" = role berbasis divisi yang dikonfigurasi admin
export const TENANT_ROLES = [
  "owner",      // 1 per tenant, full access + user management
  "ketua",      // full access dashboard (Ketua Umum, Wakil, dll)
  "sekretaris", // surat (all), dokumen, anggota, event, media, pengurus
  "bendahara",  // keuangan + konfirmasi bayar, surat own
  "custom",     // role divisi — permissions dari custom_roles.permissions JSONB
] as const;
export type TenantRole = typeof TENANT_ROLES[number];

export function createUsersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    // Merujuk ke public.user.id — FK ada di DB via SQL DDL, bukan di Drizzle
    betterAuthUserId: text("better_auth_user_id").notNull().unique(),
    role: text("role", { enum: TENANT_ROLES }).notNull().default("ketua"),
    // Diisi jika role = "custom" — FK ke custom_roles via DDL
    customRoleId: uuid("custom_role_id"),
    // Link ke identitas anggota — nullable (owner awal bisa bukan anggota)
    // Semua pengurus yang ditambah via alur normal wajib punya memberId
    memberId: uuid("member_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type TenantUsersTable = ReturnType<typeof createUsersTable>;
