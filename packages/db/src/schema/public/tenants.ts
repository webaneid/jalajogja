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

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "expired",
  "cancelled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // → nama schema: tenant_{slug}
  name: text("name").notNull(),
  domain: text("domain").unique(), // custom domain, nullable — routing diimplementasi belakangan
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
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
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantPlan = typeof tenantPlans.$inferSelect;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
