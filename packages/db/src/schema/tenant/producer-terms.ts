import { pgSchema, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// ─── Syarat & Ketentuan Produsen + persetujuan tanda tangan digital ──────────────────────────────
// Doc: docs/arsitektur-portal-produsen.md § 28.
//
//  producer_terms             versi syarat (draf → terbit). Versi TERBIT tidak boleh diedit/dihapus (bukti);
//                             mengubah syarat = membuat draf baru. Versi aktif = terbit dengan version terbesar.
//  producer_term_acceptances  bukti: produsen X menandatangani versi Y. Terbit versi baru → semua produsen
//                             wajib tanda tangan ulang (keputusan user 2026-11-03).
//
// `body` = JSON Tiptap (string) dari <TiptapEditor>, dirender dengan renderBody() — standar editor project.

export const PRODUCER_TERM_STATUSES = ["draft", "published"] as const;
export type ProducerTermStatus = typeof PRODUCER_TERM_STATUSES[number];

export function createProducerTermsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_terms", {
    id:          uuid("id").primaryKey().defaultRandom(),
    // NULL selama draf; diberi nomor berikutnya saat diterbitkan
    version:     integer("version"),
    title:       text("title").notNull(),
    body:        text("body").notNull(),
    status:      text("status", { enum: PRODUCER_TERM_STATUSES }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by"),               // tenant.users.id — tanpa FK (audit ringan)
    createdBy:   uuid("created_by"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    versionUniq: uniqueIndex("producer_terms_version_uniq").on(t.version),
    statusIdx:   index("producer_terms_status_idx").on(t.status),
  }));
}

export function createProducerTermAcceptancesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("producer_term_acceptances", {
    id:               uuid("id").primaryKey().defaultRandom(),
    termId:           uuid("term_id").notNull(),      // FK → producer_terms.id RESTRICT via DDL
    producerId:       uuid("producer_id").notNull(),  // FK → producers.id CASCADE via DDL
    userId:           text("user_id").notNull(),      // akun Better Auth yang menekan TTD (public.user.id)
    signedAt:         timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    bodySha256:       text("body_sha256").notNull(),  // hash isi syarat saat TTD (bukti isi tak berubah)
    verificationHash: text("verification_hash").notNull(),
    ip:               text("ip"),
    userAgent:        text("user_agent"),
  }, (t) => ({
    // Satu produsen satu tanda tangan per versi; mencegah ganda dari dua klik bersamaan
    termProducerUniq: uniqueIndex("producer_term_acceptances_uniq").on(t.termId, t.producerId),
    hashUniq:         uniqueIndex("producer_term_acceptances_hash_uniq").on(t.verificationHash),
    producerIdx:      index("producer_term_acceptances_producer_idx").on(t.producerId),
  }));
}

export type ProducerTermsTable            = ReturnType<typeof createProducerTermsTable>;
export type ProducerTerm                  = ProducerTermsTable["$inferSelect"];
export type NewProducerTerm               = ProducerTermsTable["$inferInsert"];
export type ProducerTermAcceptancesTable  = ReturnType<typeof createProducerTermAcceptancesTable>;
export type ProducerTermAcceptance        = ProducerTermAcceptancesTable["$inferSelect"];
