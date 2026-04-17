import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Divisions ────────────────────────────────────────────────────────────────

export function createDivisionsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("divisions", {
    id:          uuid("id").primaryKey().defaultRandom(),
    name:        text("name").notNull(),
    code:        text("code"),                   // singkatan: SEKR, BEND, IT, dll
    description: text("description"),
    parentId:    uuid("parent_id"),              // self-referential, FK via DDL
    sortOrder:   integer("sort_order").notNull().default(0),
    isActive:    boolean("is_active").notNull().default(true),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── Officers ─────────────────────────────────────────────────────────────────

export function createOfficersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("officers", {
    id:          uuid("id").primaryKey().defaultRandom(),
    memberId:    uuid("member_id").notNull(),    // FK → public.members via DDL (cross-schema)
    divisionId:  uuid("division_id"),            // FK → divisions via DDL, nullable
    position:    text("position").notNull(),      // Ketua Umum, Sekretaris, Bendahara, dll
    periodStart: date("period_start").notNull(),
    periodEnd:   date("period_end"),             // null = masih aktif
    isActive:    boolean("is_active").notNull().default(true),
    // canSign: bisa jadi penandatangan surat resmi
    // QR Code yang di-generate berisi: nama + jabatan + divisi + hash — posisi di template bebas
    canSign:     boolean("can_sign").notNull().default(false),
    sortOrder:   integer("sort_order").notNull().default(0),
    userId:      uuid("user_id"),                // FK → tenant.users via DDL, nullable
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── Letter Signatures ────────────────────────────────────────────────────────
// Slot-based: slot bisa di-assign sebelum officer TTD.
// signed_at + verification_hash nullable → null = sudah di-assign, belum TTD.
// signing_token = UUID untuk URL publik /sign/{token} — null jika TTD langsung dari dashboard.

export const SIGNATURE_ROLES = ["signer", "approver", "witness"] as const;
export type SignatureRole = typeof SIGNATURE_ROLES[number];

export const SIGNATURE_SLOT_SECTIONS = ["main", "witnesses"] as const;
export type SignatureSlotSection = typeof SIGNATURE_SLOT_SECTIONS[number];

export function createLetterSignaturesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_signatures", {
    id:               uuid("id").primaryKey().defaultRandom(),
    letterId:         uuid("letter_id").notNull(),      // FK → letters via DDL
    officerId:        uuid("officer_id").notNull(),     // FK → officers via DDL
    role:             text("role", { enum: SIGNATURE_ROLES }).notNull().default("signer"),
    // Posisi slot dalam layout TTD
    slotOrder:        integer("slot_order").notNull().default(1),
    slotSection:      text("slot_section", { enum: SIGNATURE_SLOT_SECTIONS }).notNull().default("main"),
    // Token URL publik /sign/{token} — null jika TTD langsung dari dashboard
    signingToken:            text("signing_token").unique(),
    signingTokenExpiresAt:   timestamp("signing_token_expires_at", { withTimezone: true }),
    // Null = slot sudah di-assign tapi officer belum TTD
    signedAt:         timestamp("signed_at", { withTimezone: true }),
    verificationHash: text("verification_hash").unique(),
    ipAddress:        text("ip_address"),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type DivisionsTable        = ReturnType<typeof createDivisionsTable>;
export type OfficersTable         = ReturnType<typeof createOfficersTable>;
export type LetterSignaturesTable = ReturnType<typeof createLetterSignaturesTable>;
