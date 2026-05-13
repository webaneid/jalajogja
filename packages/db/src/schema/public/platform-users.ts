import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const PLATFORM_USER_ROLES = ["owner", "admin", "staff"] as const;
export type PlatformUserRole = (typeof PLATFORM_USER_ROLES)[number];

export const platformUsers = pgTable("platform_users", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         text("role", { enum: PLATFORM_USER_ROLES }).notNull().default("staff"),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt:  timestamp("last_login_at", { withTimezone: true }),
});

export type PlatformUser         = typeof platformUsers.$inferSelect;
export type PlatformUserInsert   = typeof platformUsers.$inferInsert;
