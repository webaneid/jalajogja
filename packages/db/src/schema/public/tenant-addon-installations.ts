import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { addons } from "./addons";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const INSTALLATION_STATUSES = [
  "trial",    // masa percobaan (belum bayar)
  "active",   // berlangganan aktif
  "inactive", // dinonaktifkan oleh tenant
  "expired",  // masa berlangganan habis
] as const;
export type InstallationStatus = typeof INSTALLATION_STATUSES[number];

// ─── Instalasi Add-on per Tenant ──────────────────────────────────────────────
// Satu tenant bisa install banyak add-on.
// Satu add-on hanya bisa diinstall sekali per tenant (unique constraint).
//
// Field `config` menyimpan konfigurasi spesifik per add-on, contoh:
//
// WhatsApp Gateway:
// {
//   "device_id": "tenant-ikpm-001",        ← ID device di go-whatsapp sumopod
//   "phone_number": "6281234567890",        ← Nomor WA yang di-scan
//   "verified": true,                       ← Sudah scan QR dan terkoneksi
//   "notifications": {
//     "payment_submitted": true,            ← Customer upload bukti bayar
//     "payment_confirmed": true,            ← Admin konfirmasi pembayaran
//     "payment_rejected": true,             ← Admin tolak bukti bayar
//     "order_shipped": true,                ← Order dikirim
//     "member_welcome": false               ← Sambutan anggota baru
//   }
// }
//
// Midtrans:
// { "server_key": "...", "client_key": "...", "is_production": false }
//
// Xendit:
// { "api_key": "...", "webhook_token": "..." }
//
// iPaymu:
// { "va": "...", "api_key": "..." }
//
// Google Analytics:
// { "measurement_id": "G-XXXXXXXXXX" }

export const tenantAddonInstallations = pgTable("tenant_addon_installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  addonId: uuid("addon_id")
    .notNull()
    .references(() => addons.id, { onDelete: "cascade" }),

  status: text("status", { enum: INSTALLATION_STATUSES }).notNull().default("trial"),

  // Quota override — berdasarkan tier yang dibeli tenant
  // null = ikut default dari addons.quota_monthly
  // Untuk WhatsApp Starter: 200, Pro: 1000, Unlimited: null
  quotaMonthly: integer("quota_monthly"),

  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = aktif selamanya (add-on free)

  // Konfigurasi spesifik add-on — lihat contoh di komentar di atas
  config: jsonb("config").notNull().default({}),

  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Satu addon hanya bisa diinstall sekali per tenant
  uniq: unique().on(t.tenantId, t.addonId),
}));

export type TenantAddonInstallation = typeof tenantAddonInstallations.$inferSelect;
export type NewTenantAddonInstallation = typeof tenantAddonInstallations.$inferInsert;
