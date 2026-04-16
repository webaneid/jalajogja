import {
  pgSchema,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const CAMPAIGN_TYPES    = ["donasi", "zakat", "wakaf", "qurban"] as const;
export type CampaignType       = typeof CAMPAIGN_TYPES[number];

export const DONATION_TYPES    = ["donasi", "zakat", "wakaf", "qurban"] as const;
export type DonationType       = typeof DONATION_TYPES[number];

export const CAMPAIGN_STATUSES = ["draft", "active", "closed", "archived"] as const;
export type CampaignStatus     = typeof CAMPAIGN_STATUSES[number];

// ─── campaigns ────────────────────────────────────────────────────────────────
// Program penggalangan dana. Donations terkait ke campaign via campaign_id.
// Donations tanpa campaign (campaign_id = null) = "Donasi Umum".

export function createCampaignsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("campaigns", {
    id:    uuid("id").primaryKey().defaultRandom(),
    slug:  text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),  // HTML dari Tiptap, nullable

    campaignType: text("campaign_type", { enum: CAMPAIGN_TYPES })
                    .notNull().default("donasi"),

    // Progress penggalangan dana
    targetAmount:    numeric("target_amount",    { precision: 15, scale: 2 }),  // null = tanpa target
    collectedAmount: numeric("collected_amount", { precision: 15, scale: 2 })
                       .notNull().default("0"),  // di-update atomic saat konfirmasi donasi

    // Cover image — FK ke media.id via SQL (tidak di Drizzle, hindari circular di factory)
    coverId: uuid("cover_id"),

    // Status & periode aktif
    status:   text("status", { enum: CAMPAIGN_STATUSES }).notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),  // null = langsung aktif
    endsAt:   timestamp("ends_at",   { withTimezone: true }),  // null = tanpa deadline

    // Kontrol tampilan di halaman publik
    showDonorList: boolean("show_donor_list").notNull().default(true),
    showAmount:    boolean("show_amount").notNull().default(true),

    // Audit — FK ke officers.id via SQL (nullable)
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── donations ────────────────────────────────────────────────────────────────
// Satu record = satu transaksi donasi dari satu donatur.
// Amount + status + bukti transfer ada di payments (source_type='donation', source_id=donations.id).
// Tabel ini hanya menyimpan identitas donatur + relasi campaign + sertifikat.

export function createDonationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("donations", {
    id:             uuid("id").primaryKey().defaultRandom(),
    donationNumber: text("donation_number").notNull().unique(),  // DON-YYYYMM-NNNNN

    // Relasi campaign — nullable = donasi umum tanpa campaign
    campaignId:   uuid("campaign_id"),   // FK → campaigns.id via SQL
    donationType: text("donation_type", { enum: DONATION_TYPES })
                    .notNull().default("donasi"),

    // Donatur — anggota login (member_id terisi) atau publik tanpa akun (null)
    memberId:     uuid("member_id"),     // FK → public.members.id via SQL (nullable)
    donorName:    text("donor_name").notNull(),
    donorPhone:   text("donor_phone"),
    donorEmail:   text("donor_email"),
    donorMessage: text("donor_message"),
    isAnonymous:  boolean("is_anonymous").notNull().default(false),

    // Sertifikat PDF — di-generate setelah payment confirmed
    certificateUrl:    text("certificate_url"),
    certificateSentAt: timestamp("certificate_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    campaignIdx: index("donations_campaign_id_idx").on(t.campaignId),
    memberIdx:   index("donations_member_id_idx").on(t.memberId),
  }));
}

// ─── donation_sequences ───────────────────────────────────────────────────────
// Counter nomor donasi per bulan — atomic SELECT FOR UPDATE.
// Format: DON-202604-00001

export function createDonationSequencesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("donation_sequences", {
    id:      uuid("id").primaryKey().defaultRandom(),
    year:    integer("year").notNull(),
    month:   integer("month").notNull(),
    counter: integer("counter").notNull().default(0),
  }, (t) => ({
    uniq: unique().on(t.year, t.month),
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignsTable    = ReturnType<typeof createCampaignsTable>;
export type DonationsTable    = ReturnType<typeof createDonationsTable>;
export type DonationSeqsTable = ReturnType<typeof createDonationSequencesTable>;
