import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const TENANT_TYPES = ["cabang", "marhalah", "forum"] as const;
export type TenantType = typeof TENANT_TYPES[number];

export const MARHALAH_PERIODS = ["awal", "akhir"] as const;
export type MarhalahPeriod = typeof MARHALAH_PERIODS[number];

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "expired",
  "cancelled",
]);

// ── Status verifikasi custom domain ──────────────────────────────────────────
// none     → tenant belum set custom domain
// pending  → tenant sudah isi domain, instruksi DNS sudah ditampilkan, belum diverifikasi
// active   → DNS sudah propagate + SSL sudah provisioned via Caddy
// failed   → verifikasi gagal (DNS salah / timeout)
export const CUSTOM_DOMAIN_STATUSES = ["none", "pending", "active", "failed"] as const;
export type CustomDomainStatus = typeof CUSTOM_DOMAIN_STATUSES[number];

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Identitas ───────────────────────────────────────────────────────────────
  slug: text("slug").notNull().unique(), // → nama schema: tenant_{slug}, path Fase 1
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),

  // ── Domain & Routing (3 Fase) ───────────────────────────────────────────────
  // Fase 1: app.jalajogja.com/{slug}           → pakai slug di atas, selalu ada
  // Fase 2: {subdomain}.jalajogja.com          → wildcard DNS *.jalajogja.com
  // Fase 3: ikpm.or.id                         → A record → VPS IP, SSL via Caddy
  subdomain: text("subdomain").unique(),              // Fase 2 — null = fallback ke slug
  customDomain: text("custom_domain").unique(),       // Fase 3 — null = belum set
  customDomainStatus: text("custom_domain_status", { enum: CUSTOM_DOMAIN_STATUSES })
    .notNull()
    .default("none"),
  customDomainVerifiedAt:  timestamp("custom_domain_verified_at",  { withTimezone: true }),
  domainLastCheckAt:       timestamp("domain_last_check_at",       { withTimezone: true }),
  domainLastCheckError:    text("domain_last_check_error"),

  // ── Backbone IKPM ──────────────────────────────────────────────────────────
  // Tipe tenant menentukan perilaku keanggotaan dan auto-populate
  tenantType: text("tenant_type", { enum: TENANT_TYPES }).notNull().default("cabang"),

  // Marhalah: angkatan tahun berapa (wajib jika tenantType = 'marhalah')
  marhalahYear:   integer("marhalah_year"),
  marhalahPeriod: text("marhalah_period", { enum: MARHALAH_PERIODS }),

  // Forum & Marhalah: FK ke tenant cabang induknya (self-referential)
  parentTenantId: uuid("parent_tenant_id"),

  // Cabang: link ke data resmi PP IKPM (nullable — tenant bisa dibuat tanpa ref)
  refCabangId: uuid("ref_cabang_id"),  // FK ke ref_ikpm_cabang.id

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantPlans = pgTable("tenant_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // free, basic, pro
  maxMembers: integer("max_members").notNull().default(100),
  features: jsonb("features").notNull().default({}), // fitur aktif per plan
  priceMonthly: integer("price_monthly").notNull().default(0), // dalam rupiah
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => tenantPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("trial"),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = tidak ada batas waktu
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relasi untuk type-safe joins
export const tenantsRelations = relations(tenants, ({ many }) => ({
  subscriptions: many(tenantSubscriptions),
}));

export const tenantPlansRelations = relations(tenantPlans, ({ many }) => ({
  subscriptions: many(tenantSubscriptions),
}));

export const tenantSubscriptionsRelations = relations(tenantSubscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantSubscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(tenantPlans, {
    fields: [tenantSubscriptions.planId],
    references: [tenantPlans.id],
  }),
}));

// Type exports
export type Tenant    = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantPlan = typeof tenantPlans.$inferSelect;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
