import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Helper table reusable — dipakai oleh members dan member_businesses
// phone vs whatsapp dipisah: nomor telepon rumah/kantor bisa beda dari nomor HP
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
