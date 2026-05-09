import { pgSchema, uuid, text, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";

export const MITRA_APPLICATION_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type MitraApplicationStatus = typeof MITRA_APPLICATION_STATUSES[number];

export const MITRA_STATUSES = ["active", "suspended"] as const;
export type MitraStatus = typeof MITRA_STATUSES[number];

export function createMitraApplicationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("mitra_applications", {
    id:              uuid("id").primaryKey().defaultRandom(),
    memberId:        uuid("member_id").notNull(),       // FK → public.members via DDL
    businessId:      uuid("business_id").notNull(),     // FK → public.member_businesses via DDL
    motivation:      text("motivation"),
    status:          text("status", { enum: MITRA_APPLICATION_STATUSES }).notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    appliedAt:       timestamp("applied_at",  { withTimezone: true }).notNull().defaultNow(),
    reviewedAt:      timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy:      uuid("reviewed_by"),               // FK → officers.id via DDL (nullable)
    createdAt:       timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    memberIdx: index("mitra_applications_member_idx").on(t.memberId),
    statusIdx: index("mitra_applications_status_idx").on(t.status),
  }));
}

export function createMitrasTable(s: ReturnType<typeof pgSchema>) {
  return s.table("mitras", {
    id:               uuid("id").primaryKey().defaultRandom(),
    memberId:         uuid("member_id").notNull(),   // FK → public.members via DDL
    businessId:       uuid("business_id").notNull(), // FK → public.member_businesses via DDL
    applicationId:    uuid("application_id"),        // FK → mitra_applications.id via DDL
    status:           text("status", { enum: MITRA_STATUSES }).notNull().default("active"),
    suspensionReason: text("suspension_reason"),
    approvedAt:       timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    approvedBy:       uuid("approved_by"),           // FK → officers.id via DDL (nullable)
    createdAt:        timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    memberUniq: unique("mitras_member_unique").on(t.memberId),
    statusIdx:  index("mitras_status_idx").on(t.status),
  }));
}

export type MitraApplicationsTable = ReturnType<typeof createMitraApplicationsTable>;
export type MitrasTable            = ReturnType<typeof createMitrasTable>;
