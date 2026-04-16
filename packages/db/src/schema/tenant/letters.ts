import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  integer,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const LETTER_TYPES = ["incoming", "outgoing", "internal"] as const;
export type LetterType = typeof LETTER_TYPES[number];

export const LETTER_STATUSES = ["draft", "sent", "received", "archived"] as const;
export type LetterStatus = typeof LETTER_STATUSES[number];

export const PAPER_SIZES = ["A4", "F4", "Letter"] as const;
export type PaperSize = typeof PAPER_SIZES[number];

export const INTER_TENANT_STATUSES = ["pending", "delivered"] as const;
export type InterTenantStatus = typeof INTER_TENANT_STATUSES[number];

// Jenis surat yang dikonfigurasi tenant — misal: "Surat Keputusan", "Undangan", "Keterangan"
export function createLetterTypesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_types", {
    id:              uuid("id").primaryKey().defaultRandom(),
    name:            text("name").notNull(),
    code:            text("code"),
    defaultCategory: text("default_category").notNull().default("UMUM"),
    isActive:        boolean("is_active").notNull().default(true),
    sortOrder:       integer("sort_order").notNull().default(0),
    // Identitas surat — layout per jenis surat
    identitasLayout: text("identitas_layout", {
      enum: ["layout1", "layout2", "layout3"],
    }).notNull().default("layout1"),
    // Apakah baris Lampiran ditampilkan — Layout 3 default false
    showLampiran:    boolean("show_lampiran").notNull().default(true),
    // Format tanggal — NULL = ikut global default dari settings.letter_date_format
    dateFormat:      text("date_format", {
      enum: ["masehi", "masehi_hijri"],
    }),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Kontak luar (instansi/perorangan) untuk kepala surat masuk / tujuan surat keluar
// member_id opsional — kalau pengirim/penerima adalah anggota IKPM
export function createLetterContactsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_contacts", {
    id:           uuid("id").primaryKey().defaultRandom(),
    name:         text("name").notNull(),
    title:        text("title"),           // jabatan
    organization: text("organization"),
    // Alamat terstruktur — konsisten dengan public.addresses
    addressDetail: text("address_detail"), // jalan, nomor, RT/RW, dll
    provinceId:    integer("province_id"), // ref ke public.ref_provinces.id
    regencyId:     integer("regency_id"),  // ref ke public.ref_regencies.id
    districtId:    integer("district_id"), // ref ke public.ref_districts.id
    villageId:     integer("village_id"),  // ref ke public.ref_villages.id
    email:        text("email"),
    phone:        text("phone"),
    // FK ke public.members — via raw SQL FK di create-tenant-schema.ts
    memberId:     uuid("member_id"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Template isi surat siap pakai — subject + body (Tiptap JSON) untuk di-apply saat buat surat baru
export function createLetterTemplatesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_templates", {
    id:       uuid("id").primaryKey().defaultRandom(),
    name:     text("name").notNull(),
    type:     text("type", { enum: LETTER_TYPES }).notNull().default("outgoing"),
    subject:  text("subject"),
    body:     text("body"),           // Tiptap JSON atau plain text
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export function createLettersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letters", {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nomor surat — nullable untuk draft atau surat masuk (nomor dari pengirim)
    letterNumber:   text("letter_number").unique(),
    type:           text("type", { enum: LETTER_TYPES }).notNull(),
    // FK ke letter_types.id via SQL DDL
    typeId:         uuid("type_id"),
    // FK ke letter_templates.id via SQL DDL
    templateId:     uuid("template_id"),
    subject:        text("subject").notNull(),
    body:           text("body"),
    // Merge fields — nilai runtime yang diinjeksi ke template saat preview/PDF
    // Contoh: { "recipient.name": "Budi", "signer.position": "Ketua Umum" }
    mergeFields:    jsonb("merge_fields").default({}),
    // Lampiran — array path MinIO
    attachmentUrls: jsonb("attachment_urls").default([]),
    // Pengirim & penerima — teks bebas
    sender:         text("sender").notNull(),
    recipient:      text("recipient").notNull(),
    letterDate:     date("letter_date").notNull(),
    status:         text("status", { enum: LETTER_STATUSES }).notNull().default("draft"),
    // PDF — di-generate oleh Playwright saat surat diterbitkan
    paperSize:      text("paper_size", { enum: PAPER_SIZES }).notNull().default("A4"),
    pdfUrl:         text("pdf_url"),
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
    // Lampiran — teks bebas untuk ditampilkan di identitas surat ("1 berkas", "—", "2 lembar")
    // Berbeda dari attachmentUrls (path file MinIO)
    attachmentLabel: text("attachment_label"),
    // Mail merge — satu surat massal, banyak penerima
    isBulk:         boolean("is_bulk").notNull().default(false),
    // bulkParentId → self-reference ke letters.id via SQL DDL (tidak bisa di Drizzle factory)
    bulkParentId:   uuid("bulk_parent_id"),
    // Officer yang mengeluarkan surat — untuk resolusi {issuer_code} di format nomor
    // FK → officers.id via SQL DDL
    issuerOfficerId: uuid("issuer_officer_id"),
    // Inter-tenant — surat antar cabang IKPM
    interTenantTo:     text("inter_tenant_to"),
    interTenantStatus: text("inter_tenant_status", { enum: INTER_TENANT_STATUSES }),
    // FK → users.id via SQL migration
    createdBy:      uuid("created_by").notNull(),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Counter nomor surat — atomic increment untuk hindari race condition
// Format nomor: {counter}/{kategori}/{bulan-romawi}/{tahun}
// Contoh: 001/IKPM/IV/2025
export function createLetterNumberSequencesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("letter_number_sequences", {
    id:         uuid("id").primaryKey().defaultRandom(),
    year:       integer("year").notNull(),
    type:       text("type", { enum: LETTER_TYPES }).notNull(),
    category:   text("category").notNull().default("UMUM"),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    uniq: unique().on(t.year, t.type, t.category),
  }));
}

export type LetterTypesTable              = ReturnType<typeof createLetterTypesTable>;
export type LetterContactsTable           = ReturnType<typeof createLetterContactsTable>;
export type LetterTemplatesTable          = ReturnType<typeof createLetterTemplatesTable>;
export type LettersTable                  = ReturnType<typeof createLettersTable>;
export type LetterNumberSequencesTable    = ReturnType<typeof createLetterNumberSequencesTable>;
