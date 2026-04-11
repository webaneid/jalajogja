import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  integer,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const LETTER_TYPES = ["incoming", "outgoing", "internal"] as const;
export type LetterType = typeof LETTER_TYPES[number];

export const LETTER_STATUSES = ["draft", "sent", "received", "archived"] as const;
export type LetterStatus = typeof LETTER_STATUSES[number];

export function createLettersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letters", {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nomor surat — nullable untuk surat masuk (nomor dari pengirim)
    letterNumber: text("letter_number").unique(),
    type: text("type", { enum: LETTER_TYPES }).notNull(),
    subject: text("subject").notNull(),
    body: text("body"),
    // Lampiran — array path MinIO, presigned URL di-generate di app layer
    attachmentUrls: jsonb("attachment_urls").default([]),
    // Pengirim & penerima — teks bebas untuk fleksibilitas (bisa nama orang/instansi)
    sender: text("sender").notNull(),
    recipient: text("recipient").notNull(),
    letterDate: date("letter_date").notNull(),
    status: text("status", { enum: LETTER_STATUSES }).notNull().default("draft"),
    // FK → users.id via SQL migration
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Counter nomor surat — atomic increment untuk hindari race condition
// Format nomor: {counter}/{kategori}/{bulan-romawi}/{tahun}
// Contoh: 001/IKPM/IV/2025
export function createLetterNumberSequencesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_number_sequences", {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    type: text("type", { enum: LETTER_TYPES }).notNull(),
    category: text("category").notNull().default("UMUM"), // bisa IKPM, SEKRETARIAT, dll
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    uniq: unique().on(t.year, t.type, t.category),
  }));
}

export type LettersTable = ReturnType<typeof createLettersTable>;
export type LetterNumberSequencesTable = ReturnType<typeof createLetterNumberSequencesTable>;
