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
  jsonb,
} from "drizzle-orm/pg-core";
import type { GalleryItem } from "./website";

export const CAMPAIGN_TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const CAMPAIGN_ROBOTS_VALUES = ["index,follow", "noindex", "noindex,nofollow"] as const;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const CAMPAIGN_TYPES    = ["donasi", "zakat", "wakaf", "qurban"] as const;
export type CampaignType       = typeof CAMPAIGN_TYPES[number];

export const DONATION_TYPES    = ["donasi", "zakat", "wakaf", "qurban"] as const;
export type DonationType       = typeof DONATION_TYPES[number];

export const CAMPAIGN_STATUSES = ["draft", "active", "closed", "archived"] as const;
export type CampaignStatus     = typeof CAMPAIGN_STATUSES[number];

// ─── campaign_categories ──────────────────────────────────────────────────────
// Kategori campaign (Sosial, Kesehatan, Pendidikan, dll) — CRUD oleh admin.

export function createCampaignCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("campaign_categories", {
    id:        uuid("id").primaryKey().defaultRandom(),
    name:      text("name").notNull(),
    slug:      text("slug").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // SEO ringan (Fase 2, docs/arsitektur-seo.md § 3.2) — override arsip campaign terfilter (?category=)
    metaTitle: text("meta_title"),
    metaDesc:  text("meta_desc"),
  });
}

// ─── campaigns ────────────────────────────────────────────────────────────────
// Program penggalangan dana. Donations terkait ke campaign via campaign_id.
// Donations tanpa campaign (campaign_id = null) = "Donasi Umum".

export function createCampaignsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("campaigns", {
    id:    uuid("id").primaryKey().defaultRandom(),
    slug:  text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),  // HTML dari Tiptap, nullable

    // Kategori campaign — FK ke campaign_categories.id via SQL
    categoryId: uuid("category_id"),

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

    // Nominal tetap — jika diisi, donatur tidak bisa memilih nominal lain
    // null = pakai rekomendasi tenant + custom input (perilaku default)
    defaultAmount: numeric("default_amount", { precision: 15, scale: 2 }),

    // SEO — untuk halaman publik campaign
    metaTitle:      text("meta_title"),
    metaDesc:       text("meta_desc"),
    ogTitle:        text("og_title"),
    ogDescription:  text("og_description"),
    ogImageId:      uuid("og_image_id"),   // FK → media.id via SQL
    twitterCard:    text("twitter_card",   { enum: CAMPAIGN_TWITTER_CARDS }).default("summary_large_image"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",         { enum: CAMPAIGN_ROBOTS_VALUES }).notNull().default("index,follow"),
    schemaType:     text("schema_type").notNull().default("WebPage"),
    structuredData: jsonb("structured_data"),

    // Gallery foto campaign — GalleryItem[] JSONB
    gallery: jsonb("gallery").$type<GalleryItem[]>(),

    // Audit — FK ke officers.id via SQL (nullable)
    createdBy: uuid("created_by"),
    viewCount: integer("view_count").notNull().default(0),
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
    profileId:    uuid("profile_id"),    // FK → public.profiles.id via SQL (nullable)
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

// ─── Qurban ───────────────────────────────────────────────────────────────────

export const QURBAN_ANIMAL_TYPES = ["domba", "kambing", "sapi"] as const;
export type QurbanAnimalType = typeof QURBAN_ANIMAL_TYPES[number];

// Jenis hewan per campaign qurban — harga, stok, dan split patungan
export function createQurbanAnimalsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("qurban_animals", {
    id:         uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),           // FK → campaigns.id via DDL
    animalType: text("animal_type", { enum: QURBAN_ANIMAL_TYPES }).notNull(),
    price:      numeric("price",    { precision: 15, scale: 2 }).notNull(),
    stock:      integer("stock").notNull().default(0),   // jumlah ekor tersedia
    booked:     integer("booked").notNull().default(0),  // sudah dipesan (pending+confirmed)
    split:      integer("split"),                        // hanya sapi: 5 atau 7
    isActive:   boolean("is_active").notNull().default(true),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Grup patungan sapi — satu grup = 1 ekor sapi, dibagi split orang
export function createQurbanSapiGroupsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("qurban_sapi_groups", {
    id:          uuid("id").primaryKey().defaultRandom(),
    animalId:    uuid("animal_id").notNull(),             // FK → qurban_animals.id via DDL
    groupNumber: integer("group_number").notNull(),       // urutan grup ke-N
    totalSlots:  integer("total_slots").notNull(),        // = animal.split
    filledSlots: integer("filled_slots").notNull().default(0),
    isComplete:  boolean("is_complete").notNull().default(false),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Satu slot per pesanan qurban — atas nama + relasi ke hewan/grup
export function createQurbanParticipantsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("qurban_participants", {
    id:           uuid("id").primaryKey().defaultRandom(),
    donationId:   uuid("donation_id").notNull(),          // FK → donations.id via DDL
    animalId:     uuid("animal_id").notNull(),            // FK → qurban_animals.id via DDL
    sapiGroupId:  uuid("sapi_group_id"),                  // FK → qurban_sapi_groups.id (null utk individu)
    slotNumber:   integer("slot_number"),                 // posisi di grup sapi; null utk domba/kambing
    atasNama:     text("atas_nama").notNull(),            // nama shohibul qurban
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignCategoriesTable  = ReturnType<typeof createCampaignCategoriesTable>;
export type CampaignsTable           = ReturnType<typeof createCampaignsTable>;
export type DonationsTable           = ReturnType<typeof createDonationsTable>;
export type DonationSeqsTable        = ReturnType<typeof createDonationSequencesTable>;
export type QurbanAnimalsTable       = ReturnType<typeof createQurbanAnimalsTable>;
export type QurbanSapiGroupsTable    = ReturnType<typeof createQurbanSapiGroupsTable>;
export type QurbanParticipantsTable  = ReturnType<typeof createQurbanParticipantsTable>;
