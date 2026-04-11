import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Helper table reusable — dipakai oleh members dan member_businesses
// Semua platform nullable: isi hanya yang dimiliki
export const socialMedias = pgTable("social_medias", {
  id: uuid("id").primaryKey().defaultRandom(),
  instagram: text("instagram"), // Username tanpa @
  facebook: text("facebook"),   // URL atau username
  linkedin: text("linkedin"),   // URL profil lengkap
  twitter: text("twitter"),     // Username X/Twitter tanpa @
  youtube: text("youtube"),     // URL channel
  tiktok: text("tiktok"),       // Username tanpa @
  website: text("website"),     // URL lengkap dengan https://
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SocialMedia = typeof socialMedias.$inferSelect;
export type NewSocialMedia = typeof socialMedias.$inferInsert;
