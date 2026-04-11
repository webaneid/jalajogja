import {
  pgTable,
  uuid,
  smallint,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { addons } from "./addons";

// ─── Usage Tracking per Tenant per Add-on per Bulan ──────────────────────────
// Dipakai untuk enforce quota. Contoh:
//   tenant IKPM, addon WhatsApp, Maret 2025, count = 187
//
// Sebelum kirim notifikasi WA:
//   1. Cek addon_usage.count < installation.quota_monthly (atau addon.quota_monthly)
//   2. Jika over quota → tolak, minta upgrade
//   3. Jika OK → kirim → UPDATE addon_usage SET count = count + 1
//
// Reset otomatis tiap bulan — cukup insert row baru (year+month beda = row baru)

export const addonUsage = pgTable("addon_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  addonId: uuid("addon_id")
    .notNull()
    .references(() => addons.id, { onDelete: "cascade" }),

  year:  smallint("year").notNull(),
  month: smallint("month").notNull(), // 1–12

  count: integer("count").notNull().default(0),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Satu row per tenant + addon + bulan
  uniq: unique().on(t.tenantId, t.addonId, t.year, t.month),
  tenantIdx: index("addon_usage_tenant_idx").on(t.tenantId),
}));

export type AddonUsage = typeof addonUsage.$inferSelect;
