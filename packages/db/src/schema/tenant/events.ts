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

// ─── Enums ────────────────────────────────────────────────────────────────────

export const EVENT_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export type EventStatus = typeof EVENT_STATUSES[number];

export const EVENT_TYPES = ["offline", "online", "hybrid"] as const;
export type EventType = typeof EVENT_TYPES[number];

export const REGISTRATION_STATUSES = ["pending", "confirmed", "cancelled", "attended"] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];

export const EVENT_TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const EVENT_ROBOTS_VALUES  = ["index,follow", "noindex", "noindex,nofollow"] as const;

// ─── event_categories ─────────────────────────────────────────────────────────
// Kategori event (Sosial, Keagamaan, Pendidikan, dll) — CRUD inline oleh admin.

export function createEventCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("event_categories", {
    id:        uuid("id").primaryKey().defaultRandom(),
    name:      text("name").notNull(),
    slug:      text("slug").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// ─── events ───────────────────────────────────────────────────────────────────
// Satu record = satu event. Tiket per event ada di event_tickets.
// Pendaftaran per peserta ada di event_registrations.

export function createEventsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("events", {
    id:          uuid("id").primaryKey().defaultRandom(),
    slug:        text("slug").notNull().unique(),
    title:       text("title").notNull(),
    description: text("description"),  // HTML dari Tiptap, nullable

    // Kategori — FK ke event_categories.id via SQL
    categoryId: uuid("category_id"),

    eventType: text("event_type", { enum: EVENT_TYPES }).notNull().default("offline"),
    status:    text("status", { enum: EVENT_STATUSES }).notNull().default("draft"),

    // Waktu pelaksanaan
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt:   timestamp("ends_at",   { withTimezone: true }),

    // Lokasi — untuk offline/hybrid
    location:       text("location"),         // nama tempat / link venue
    locationDetail: text("location_detail"),  // alamat lengkap
    mapsUrl:        text("maps_url"),         // link Google Maps (opsional)
    onlineLink:     text("online_link"),      // Zoom/Meet/dll — untuk online/hybrid

    // Penyelenggara (bisa beda dari nama tenant)
    organizerName: text("organizer_name"),

    // Kapasitas — null = tidak terbatas
    maxCapacity: integer("max_capacity"),

    // Kontrol tampilan di halaman publik
    showAttendeeList: boolean("show_attendee_list").notNull().default(false),
    showTicketCount:  boolean("show_ticket_count").notNull().default(true),
    requireApproval:  boolean("require_approval").notNull().default(false),

    // Cover image — FK ke media.id via SQL
    coverId: uuid("cover_id"),

    // Sertifikat kehadiran — FK ke letter_templates.id via SQL (roadmap, nullable)
    certificateTemplateId: uuid("certificate_template_id"),

    // SEO — untuk halaman publik event
    metaTitle:      text("meta_title"),
    metaDesc:       text("meta_desc"),
    ogTitle:        text("og_title"),
    ogDescription:  text("og_description"),
    ogImageId:      uuid("og_image_id"),    // FK → media.id via SQL
    twitterCard:    text("twitter_card",    { enum: EVENT_TWITTER_CARDS }).default("summary_large_image"),
    focusKeyword:   text("focus_keyword"),
    canonicalUrl:   text("canonical_url"),
    robots:         text("robots",          { enum: EVENT_ROBOTS_VALUES }).notNull().default("index,follow"),
    schemaType:     text("schema_type").notNull().default("Event"),
    structuredData: jsonb("structured_data"),

    // Audit
    createdBy: uuid("created_by"),  // FK → officers.id via SQL
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    categoryIdx: index("events_category_id_idx").on(t.categoryId),
    statusIdx:   index("events_status_idx").on(t.status),
  }));
}

// ─── event_tickets ────────────────────────────────────────────────────────────
// Satu event bisa punya banyak jenis tiket (Umum, VIP, Gratis, dll).
// Tiket gratis: price = 0, payment tidak dibuat.
// Tiket berbayar: payment dibuat saat registrasi (source_type='event_registration').

export function createEventTicketsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("event_tickets", {
    id:      uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id"),  // FK → events.id via SQL (ON DELETE CASCADE)

    name:        text("name").notNull(),        // "Tiket Umum", "VIP", "Early Bird"
    description: text("description"),
    price:       numeric("price", { precision: 15, scale: 2 }).notNull().default("0"),
    quota:       integer("quota"),              // null = tidak terbatas
    sortOrder:   integer("sort_order").notNull().default(0),
    isActive:    boolean("is_active").notNull().default(true),

    // Validitas penjualan
    saleStartsAt: timestamp("sale_starts_at", { withTimezone: true }),
    saleEndsAt:   timestamp("sale_ends_at",   { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    eventIdx: index("event_tickets_event_id_idx").on(t.eventId),
  }));
}

// ─── event_registrations ─────────────────────────────────────────────────────
// Satu record = satu peserta mendaftar ke satu tiket event.
// Uang masuk via payments (source_type='event_registration', source_id=id).
// Nomor format: EVT-YYYYMM-NNNNN

export function createEventRegistrationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("event_registrations", {
    id:                 uuid("id").primaryKey().defaultRandom(),
    registrationNumber: text("registration_number").notNull().unique(),  // EVT-YYYYMM-NNNNN

    eventId:  uuid("event_id"),   // FK → events.id via SQL (ON DELETE CASCADE)
    ticketId: uuid("ticket_id").notNull(),  // FK → event_tickets.id via SQL

    // Peserta — anggota login atau publik tanpa akun
    memberId:      uuid("member_id"),   // FK → public.members.id via SQL (nullable)
    attendeeName:  text("attendee_name").notNull(),
    attendeePhone: text("attendee_phone"),
    attendeeEmail: text("attendee_email"),

    // Form tambahan — roadmap, field custom per event
    customFields: jsonb("custom_fields"),  // { fieldKey: value }

    status: text("status", { enum: REGISTRATION_STATUSES }).notNull().default("pending"),

    // Kehadiran aktual (check-in saat hari-H)
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: uuid("checked_in_by"),   // FK → users.id via SQL

    // Sertifikat PDF — di-generate setelah event completed + attended
    certificateUrl:    text("certificate_url"),
    certificateSentAt: timestamp("certificate_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    eventIdx:  index("event_registrations_event_id_idx").on(t.eventId),
    memberIdx: index("event_registrations_member_id_idx").on(t.memberId),
    ticketIdx: index("event_registrations_ticket_id_idx").on(t.ticketId),
  }));
}

// ─── event_registration_sequences ────────────────────────────────────────────
// Counter nomor pendaftaran per bulan — atomic SELECT FOR UPDATE.
// Format: EVT-202604-00001

export function createEventRegistrationSequencesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("event_registration_sequences", {
    id:      uuid("id").primaryKey().defaultRandom(),
    year:    integer("year").notNull(),
    month:   integer("month").notNull(),
    counter: integer("counter").notNull().default(0),
  }, (t) => ({
    uniq: unique().on(t.year, t.month),
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventCategoriesTable       = ReturnType<typeof createEventCategoriesTable>;
export type EventsTable                = ReturnType<typeof createEventsTable>;
export type EventTicketsTable          = ReturnType<typeof createEventTicketsTable>;
export type EventRegistrationsTable    = ReturnType<typeof createEventRegistrationsTable>;
export type EventRegistrationSeqsTable = ReturnType<typeof createEventRegistrationSequencesTable>;
