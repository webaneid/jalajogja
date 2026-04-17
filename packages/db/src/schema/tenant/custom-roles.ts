import { pgSchema, uuid, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export function createCustomRolesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("custom_roles", {
    id:          uuid("id").primaryKey().defaultRandom(),
    name:        text("name").notNull(),
    description: text("description"),
    // Flat map semua 10 modul → level akses
    // Contoh: { "website": "full", "surat": "own", "keuangan": "none", ... }
    permissions: jsonb("permissions").notNull().default({}),
    isSystem:    boolean("is_system").notNull().default(false),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type CustomRolesTable = ReturnType<typeof createCustomRolesTable>;
