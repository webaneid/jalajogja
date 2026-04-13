import {
  pgSchema,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const SETTING_GROUPS = [
  "general",   // nama org, logo, tagline, timezone, bahasa, currency
  "contact",   // email, telepon, alamat, sosial media organisasi
  "payment",   // rekening bank, QRIS, gateway config (midtrans/xendit/ipaymu)
  "display",   // primary color, font, footer text
  "mail",      // konfigurasi SMTP untuk kirim email
  "notif",     // notifikasi email/WhatsApp
  "website",   // homepage layout, analitik (untuk modul Website nanti)
  "keuangan",  // account mappings untuk jurnal otomatis
] as const;
export type SettingGroup = typeof SETTING_GROUPS[number];

export const MENU_LOCATIONS = ["header", "footer", "sidebar"] as const;
export type MenuLocation = typeof MENU_LOCATIONS[number];

// Key-value store konfigurasi per tenant
// Contoh: { key: "bank_account", group: "payment", value: { bank: "BCA", number: "1234" } }
export function createSettingsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    group: text("group", { enum: SETTING_GROUPS }).notNull().default("general"),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    // Key unik per group — boleh ada key "logo" di group "general" dan "website"
    uniq: unique().on(t.key, t.group),
  }));
}

// Lokasi navigasi — header, footer, sidebar
export function createMenusTable(s: ReturnType<typeof pgSchema>) {
  return s.table("menus", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    location: text("location", { enum: MENU_LOCATIONS }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Item navigasi — hierarkis untuk dropdown, diurutkan via order
export function createMenuItemsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("menu_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    menuId: uuid("menu_id").notNull(),  // FK → menus.id via SQL migration
    parentId: uuid("parent_id"),        // self-referential untuk dropdown
    label: text("label").notNull(),
    url: text("url").notNull(),
    target: text("target").notNull().default("_self"), // _self | _blank
    isActive: boolean("is_active").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    menuIdx: index("menu_items_menu_id_idx").on(t.menuId),
  }));
}

export type SettingsTable = ReturnType<typeof createSettingsTable>;
export type MenusTable = ReturnType<typeof createMenusTable>;
export type MenuItemsTable = ReturnType<typeof createMenuItemsTable>;
