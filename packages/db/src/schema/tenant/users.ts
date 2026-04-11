import { pgSchema, text, uuid, timestamp } from "drizzle-orm/pg-core";

// Role yang tersedia di setiap tenant
export const TENANT_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type TenantRole = typeof TENANT_ROLES[number];

export function createUsersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    // Merujuk ke public.user.id — FK ada di DB via SQL migration, bukan di sini
    betterAuthUserId: text("better_auth_user_id").notNull().unique(),
    role: text("role", { enum: TENANT_ROLES }).notNull().default("viewer"),
    // Nullable — admin eksternal tidak harus jadi anggota
    memberId: uuid("member_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type TenantUsersTable = ReturnType<typeof createUsersTable>;
// Type row diakses via: TenantUsersTable["$inferSelect"]
// Atau di app layer: typeof schema.users.$inferSelect
