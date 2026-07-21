import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Konfigurasi platform-wide (bukan per-tenant) — dikelola dari /platform/settings.
// Singleton: selalu satu baris dengan id="default" (di-seed via migration).
export const platformSettings = pgTable("platform_settings", {
  id:             text("id").primaryKey(),
  defaultLogoUrl: text("default_logo_url"),
  defaultOrgName: text("default_org_name").notNull().default("IKPM Gontor"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformSettings    = typeof platformSettings.$inferSelect;
export type NewPlatformSettings = typeof platformSettings.$inferInsert;
