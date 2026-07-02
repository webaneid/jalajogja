import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const otpTokens = pgTable("otp_tokens", {
  id:        uuid("id").primaryKey().defaultRandom(),
  phone:     text("phone").notNull(),
  code:      text("code").notNull(),
  type:      text("type", { enum: ["register", "reset_password", "login"] }).notNull(),
  slug:      text("slug").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt:    timestamp("used_at",    { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  phoneTypeIdx: index("idx_otp_tokens_phone_type").on(t.phone, t.type, t.expiresAt),
}));

export type OtpToken    = typeof otpTokens.$inferSelect;
export type NewOtpToken = typeof otpTokens.$inferInsert;
