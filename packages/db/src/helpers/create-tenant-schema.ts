import { sql } from "drizzle-orm";
import type { PublicDb } from "../client";

function validateSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 20) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  return true;
}

// Buat seluruh schema + tabel untuk tenant baru — atomik dalam satu transaksi
// Catatan: tabel members TIDAK ada di sini — data anggota terpusat di public.members
export async function createTenantSchemaInDb(
  db: PublicDb,
  slug: string,
  orgName?: string  // nama organisasi dari form registrasi → seed ke settings.site_name
): Promise<void> {
  if (!validateSlug(slug)) {
    throw new Error(`Slug tidak valid: "${slug}".`);
  }

  const s = `tenant_${slug}`;

  await db.transaction(async (tx) => {

    // ── 1. Schema ──────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${s}"`));

    // ── 2. Custom Roles (harus sebelum users — users FK ke custom_roles) ─────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".custom_roles (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT        NOT NULL,
        description TEXT,
        permissions JSONB       NOT NULL DEFAULT '{}',
        is_system   BOOLEAN     NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 3. Users (akses dashboard — bukan semua anggota, hanya pengurus) ────
    // member_id → public.members: link ke identitas anggota (nullable — owner awal boleh null)
    // custom_role_id → custom_roles: diisi jika role = 'custom'
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".users (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        better_auth_user_id TEXT        NOT NULL UNIQUE,
        role                TEXT        NOT NULL DEFAULT 'ketua'
                                        CHECK (role IN ('owner','ketua','sekretaris','bendahara','custom')),
        custom_role_id      UUID        REFERENCES "${s}".custom_roles(id) ON DELETE SET NULL,
        member_id           UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_users_auth_user
          FOREIGN KEY (better_auth_user_id)
          REFERENCES public."user"(id) ON DELETE CASCADE,
        CONSTRAINT users_custom_role_check CHECK (
          (role IN ('owner','ketua','sekretaris','bendahara') AND custom_role_id IS NULL)
          OR (role = 'custom' AND custom_role_id IS NOT NULL)
        )
      )
    `));

    // ── 3. Post Categories ─────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".post_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        parent_id  UUID        REFERENCES "${s}".post_categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 4. Post Tags ───────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".post_tags (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 5. Media ───────────────────────────────────────────────────────────
    // Dipindah ke sini (sebelum pages/posts) agar cover_id + og_image_id bisa FK ke media
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".media (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        filename      TEXT        NOT NULL,
        original_name TEXT        NOT NULL,
        mime_type     TEXT        NOT NULL,
        size          INTEGER     NOT NULL,
        -- Path di MinIO: /{module}/{year}/{month}/{filename}
        -- Bucket per tenant: tenant-{slug}
        path          TEXT        NOT NULL,
        alt_text      TEXT,
        title         TEXT,
        caption       TEXT,
        description   TEXT,
        -- Modul asal upload: website/members/letters/shop/general
        module        TEXT        NOT NULL DEFAULT 'general'
                                  CHECK (module IN ('website','members','letters','shop','general')),
        -- false = file ter-upload tapi belum dipakai di konten (orphan candidate)
        is_used       BOOLEAN     NOT NULL DEFAULT false,
        uploaded_by   UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 6. Pages ───────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".pages (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug         TEXT        NOT NULL UNIQUE,
        title        TEXT        NOT NULL,
        content      TEXT,
        -- Cover gambar
        cover_id         UUID        REFERENCES "${s}".media(id) ON DELETE SET NULL,
        -- SEO dasar
        meta_title       TEXT,
        meta_desc        TEXT,
        -- Open Graph
        og_title         TEXT,
        og_description   TEXT,
        og_image_id      UUID        REFERENCES "${s}".media(id) ON DELETE SET NULL,
        -- Social / Advanced
        twitter_card     TEXT        DEFAULT 'summary'
                                     CHECK (twitter_card IN ('summary','summary_large_image')),
        focus_keyword    TEXT,
        canonical_url    TEXT,
        robots           TEXT        NOT NULL DEFAULT 'index,follow'
                                     CHECK (robots IN ('index,follow','noindex','noindex,nofollow')),
        schema_type      TEXT        NOT NULL DEFAULT 'WebPage'
                                     CHECK (schema_type IN ('WebPage','AboutPage','ContactPage','FAQPage')),
        structured_data  JSONB,
        template     TEXT        NOT NULL DEFAULT 'default'
                                 CHECK (template IN ('default','landing','contact','about','linktree')),
        status       TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','published','archived')),
        "order"      INTEGER     NOT NULL DEFAULT 0,
        author_id    UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 7b. Contact Submissions ────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".contact_submissions (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id    UUID        NOT NULL REFERENCES "${s}".pages(id) ON DELETE CASCADE,
        name       TEXT        NOT NULL,
        email      TEXT,
        phone      TEXT,
        message    TEXT        NOT NULL,
        is_read    BOOLEAN     NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 7. Posts ───────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".posts (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug         TEXT        NOT NULL UNIQUE,
        title        TEXT        NOT NULL,
        excerpt      TEXT,
        content      TEXT,
        -- Cover gambar (gantikan cover_url TEXT)
        cover_id         UUID        REFERENCES "${s}".media(id) ON DELETE SET NULL,
        -- SEO dasar
        meta_title       TEXT,
        meta_desc        TEXT,
        -- Open Graph
        og_title         TEXT,
        og_description   TEXT,
        og_image_id      UUID        REFERENCES "${s}".media(id) ON DELETE SET NULL,
        -- Social / Advanced
        twitter_card     TEXT        DEFAULT 'summary_large_image'
                                     CHECK (twitter_card IN ('summary','summary_large_image')),
        focus_keyword    TEXT,
        canonical_url    TEXT,
        robots           TEXT        NOT NULL DEFAULT 'index,follow'
                                     CHECK (robots IN ('index,follow','noindex','noindex,nofollow')),
        schema_type      TEXT        NOT NULL DEFAULT 'Article'
                                     CHECK (schema_type IN ('Article','NewsArticle','BlogPosting')),
        structured_data  JSONB,
        is_featured  BOOLEAN     NOT NULL DEFAULT false,
        status       TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','published','archived')),
        author_id    UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        category_id  UUID        REFERENCES "${s}".post_categories(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 8. Post Tag Pivot ──────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".post_tag_pivot (
        post_id UUID NOT NULL REFERENCES "${s}".posts(id) ON DELETE CASCADE,
        tag_id  UUID NOT NULL REFERENCES "${s}".post_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, tag_id)
      )
    `));

    // ── 9a. Letter Types ───────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letter_types (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name             TEXT        NOT NULL,
        code             TEXT,
        default_category TEXT        NOT NULL DEFAULT 'UMUM',
        is_active        BOOLEAN     NOT NULL DEFAULT true,
        sort_order       INTEGER     NOT NULL DEFAULT 0,
        -- Identitas surat
        identitas_layout TEXT        NOT NULL DEFAULT 'layout1'
                                     CHECK (identitas_layout IN ('layout1','layout2','layout3')),
        show_lampiran    BOOLEAN     NOT NULL DEFAULT true,
        -- NULL = ikut global default dari settings.letter_date_format
        date_format      TEXT        CHECK (date_format IN ('masehi','masehi_hijri')),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 9b. Letter Contacts ────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letter_contacts (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name           TEXT        NOT NULL,
        title          TEXT,
        organization   TEXT,
        address_detail TEXT,
        province_id    INTEGER,
        regency_id     INTEGER,
        district_id    INTEGER,
        village_id     INTEGER,
        email          TEXT,
        phone          TEXT,
        member_id      UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 9c. Letter Templates ───────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letter_templates (
        id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name      TEXT        NOT NULL,
        type      TEXT        NOT NULL DEFAULT 'outgoing'
                              CHECK (type IN ('incoming','outgoing','internal')),
        subject   TEXT,
        body      TEXT,
        is_active BOOLEAN     NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 9. Letters ─────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letters (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_number       TEXT        UNIQUE,
        type                TEXT        NOT NULL
                                        CHECK (type IN ('incoming','outgoing','internal')),
        type_id             UUID        REFERENCES "${s}".letter_types(id) ON DELETE SET NULL,
        template_id         UUID        REFERENCES "${s}".letter_templates(id) ON DELETE SET NULL,
        subject             TEXT        NOT NULL,
        body                TEXT,
        merge_fields        JSONB       NOT NULL DEFAULT '{}',
        attachment_urls     JSONB       NOT NULL DEFAULT '[]',
        attachment_label    TEXT,
        sender              TEXT        NOT NULL,
        recipient           TEXT        NOT NULL,
        letter_date         DATE        NOT NULL,
        status              TEXT        NOT NULL DEFAULT 'draft'
                                        CHECK (status IN ('draft','sent','received','archived')),
        paper_size          TEXT        NOT NULL DEFAULT 'A4'
                                        CHECK (paper_size IN ('A4','F4','Letter')),
        pdf_url             TEXT,
        pdf_generated_at    TIMESTAMPTZ,
        is_bulk             BOOLEAN     NOT NULL DEFAULT false,
        bulk_parent_id      UUID        REFERENCES "${s}".letters(id) ON DELETE CASCADE,
        issuer_officer_id   UUID        REFERENCES "${s}".officers(id) ON DELETE SET NULL,
        inter_tenant_to     TEXT,
        inter_tenant_status TEXT        CHECK (inter_tenant_status IN ('pending','delivered')),
        signature_layout    TEXT        NOT NULL DEFAULT 'double'
                                        CHECK (signature_layout IN (
                                          'single-center','single-left','single-right',
                                          'double','triple-row','triple-pyramid','double-with-witnesses'
                                        )),
        signature_show_date BOOLEAN     NOT NULL DEFAULT true,
        created_by          UUID        NOT NULL REFERENCES "${s}".users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `))

    // ── 10. Letter Number Sequences ────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letter_number_sequences (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        year        INTEGER     NOT NULL,
        type        TEXT        NOT NULL
                                CHECK (type IN ('incoming','outgoing','internal')),
        category    TEXT        NOT NULL DEFAULT 'UMUM',
        last_number INTEGER     NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (year, type, category)
      )
    `));

    // ── 11. Divisions ──────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".divisions (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT        NOT NULL,
        code        TEXT,
        description TEXT,
        parent_id   UUID        REFERENCES "${s}".divisions(id) ON DELETE SET NULL,
        sort_order  INTEGER     NOT NULL DEFAULT 0,
        is_active   BOOLEAN     NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 12. Officers ───────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".officers (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id    UUID        NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
        division_id  UUID        REFERENCES "${s}".divisions(id) ON DELETE SET NULL,
        position     TEXT        NOT NULL,
        period_start DATE        NOT NULL,
        period_end   DATE,
        is_active    BOOLEAN     NOT NULL DEFAULT true,
        can_sign     BOOLEAN     NOT NULL DEFAULT false,
        sort_order   INTEGER     NOT NULL DEFAULT 0,
        user_id      UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 13. Letter Signatures ──────────────────────────────────────────────────
    // Slot-based: slot bisa di-assign sebelum officer TTD.
    // signed_at + verification_hash nullable → null = sudah di-assign, belum TTD.
    // signing_token = UUID untuk URL publik /sign/{token}.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letter_signatures (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_id         UUID        NOT NULL REFERENCES "${s}".letters(id) ON DELETE CASCADE,
        officer_id        UUID        NOT NULL REFERENCES "${s}".officers(id) ON DELETE RESTRICT,
        role              TEXT        NOT NULL DEFAULT 'signer'
                                      CHECK (role IN ('signer','approver','witness')),
        slot_order        INTEGER     NOT NULL DEFAULT 1,
        slot_section      TEXT        NOT NULL DEFAULT 'main'
                                      CHECK (slot_section IN ('main','witnesses')),
        signing_token              TEXT        UNIQUE,
        signing_token_expires_at   TIMESTAMPTZ,
        signed_at                  TIMESTAMPTZ,
        verification_hash TEXT        UNIQUE,
        ip_address        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 14. Accounts (Chart of Accounts) ───────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".accounts (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        code       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        type       TEXT        NOT NULL
                               CHECK (type IN ('asset','liability','equity','income','expense')),
        parent_id  UUID        REFERENCES "${s}".accounts(id) ON DELETE SET NULL,
        is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 12. Transactions ───────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".transactions (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        date             DATE        NOT NULL,
        description      TEXT        NOT NULL,
        reference_number TEXT        UNIQUE,
        created_by       UUID        NOT NULL REFERENCES "${s}".users(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 13. Transaction Entries (double-entry ledger) ──────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".transaction_entries (
        id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID           NOT NULL REFERENCES "${s}".transactions(id) ON DELETE CASCADE,
        account_id     UUID           NOT NULL REFERENCES "${s}".accounts(id),
        type           TEXT           NOT NULL CHECK (type IN ('debit','credit')),
        amount         NUMERIC(15,2)  NOT NULL,
        note           TEXT
      )
    `));

    // ── 14. Budgets ────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".budgets (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT        NOT NULL,
        period_start DATE        NOT NULL,
        period_end   DATE        NOT NULL,
        is_active    BOOLEAN     NOT NULL DEFAULT FALSE,
        created_by   UUID        NOT NULL REFERENCES "${s}".users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 15. Budget Items ───────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".budget_items (
        id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id  UUID           NOT NULL REFERENCES "${s}".budgets(id) ON DELETE CASCADE,
        account_id UUID           NOT NULL REFERENCES "${s}".accounts(id),
        amount     NUMERIC(15,2)  NOT NULL,
        note       TEXT,
        UNIQUE (budget_id, account_id)
      )
    `));

    // ── 16. Universal Payments (Uang Masuk) ───────────────────────────────
    // Menggantikan payment_confirmations + order_payments
    // Nomor format: 620-PAY-YYYYMM-NNNNN
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".payments (
        id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        number            TEXT           NOT NULL UNIQUE,
        source_type       TEXT           NOT NULL
                                         CHECK (source_type IN ('order','donation','invoice','event_registration','manual')),
        source_id         UUID,          -- nullable untuk source_type='manual'
        amount            NUMERIC(15,2)  NOT NULL,
        unique_code       SMALLINT       NOT NULL DEFAULT 0,
        method            TEXT           NOT NULL
                                         CHECK (method IN ('cash','transfer','qris','midtrans','xendit','ipaymu')),
        bank_account_ref  TEXT,
        qris_account_ref  TEXT,
        status            TEXT           NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','submitted','paid','rejected','failed','cancelled','refunded')),
        gateway_ref       TEXT,
        -- Customer confirmation (submit bukti bayar)
        transfer_date     DATE,
        proof_url         TEXT,
        submitted_at      TIMESTAMPTZ,
        member_id         UUID           REFERENCES public.members(id) ON DELETE SET NULL,
        payer_name        TEXT,
        payer_bank        TEXT,
        payer_note        TEXT,
        -- Admin verification
        confirmed_by      UUID           REFERENCES "${s}".users(id) ON DELETE SET NULL,
        confirmed_at      TIMESTAMPTZ,
        rejected_by       UUID           REFERENCES "${s}".users(id) ON DELETE SET NULL,
        rejected_at       TIMESTAMPTZ,
        rejection_note    TEXT,
        -- Jurnal (diisi setelah paid)
        transaction_id    UUID           REFERENCES "${s}".transactions(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 17. Universal Disbursements (Uang Keluar) ──────────────────────────
    // 2-level approval: pengaju → bendahara (approver) → eksekusi
    // Nomor format: 620-DIS-YYYYMM-NNNNN
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".disbursements (
        id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        number            TEXT           NOT NULL UNIQUE,
        purpose_type      TEXT           NOT NULL
                                         CHECK (purpose_type IN ('refund','expense','grant','transfer','donation_payout','manual')),
        purpose_id        UUID,
        amount            NUMERIC(15,2)  NOT NULL,
        method            TEXT           NOT NULL DEFAULT 'transfer'
                                         CHECK (method IN ('cash','transfer')),
        recipient_name    TEXT           NOT NULL,
        recipient_bank    TEXT,
        recipient_account TEXT,
        note              TEXT,
        proof_url         TEXT,
        status            TEXT           NOT NULL DEFAULT 'draft'
                                         CHECK (status IN ('draft','approved','paid','cancelled')),
        requested_by      UUID           NOT NULL REFERENCES "${s}".users(id),
        approved_by       UUID           REFERENCES "${s}".users(id) ON DELETE SET NULL,
        approved_at       TIMESTAMPTZ,
        paid_at           TIMESTAMPTZ,
        transaction_id    UUID           REFERENCES "${s}".transactions(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 18. Financial Sequences ────────────────────────────────────────────
    // Generate nomor 620-PAY/DIS/JNL/INV-YYYYMM-NNNNN secara atomic
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".financial_sequences (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        year        SMALLINT    NOT NULL,
        month       SMALLINT    NOT NULL,
        type        TEXT        NOT NULL
                                CHECK (type IN ('payment','disbursement','journal','invoice')),
        last_number INTEGER     NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (year, month, type)
      )
    `));

    // ── 19. Campaign Categories ────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".campaign_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT        NOT NULL,
        slug       TEXT        NOT NULL UNIQUE,
        sort_order INTEGER     NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 20. Campaigns ─────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".campaigns (
        id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        slug             TEXT          NOT NULL UNIQUE,
        title            TEXT          NOT NULL,
        description      TEXT,
        category_id      UUID          REFERENCES "${s}".campaign_categories(id) ON DELETE SET NULL,
        campaign_type    TEXT          NOT NULL DEFAULT 'donasi'
                                       CHECK (campaign_type IN ('donasi','zakat','wakaf','qurban')),
        target_amount    NUMERIC(15,2),
        collected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        cover_id         UUID          REFERENCES "${s}".media(id) ON DELETE SET NULL,
        status           TEXT          NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft','active','closed','archived')),
        starts_at        TIMESTAMPTZ,
        ends_at          TIMESTAMPTZ,
        show_donor_list  BOOLEAN       NOT NULL DEFAULT true,
        show_amount      BOOLEAN       NOT NULL DEFAULT true,
        meta_title       TEXT,
        meta_desc        TEXT,
        og_title         TEXT,
        og_description   TEXT,
        og_image_id      UUID          REFERENCES "${s}".media(id) ON DELETE SET NULL,
        twitter_card     TEXT          DEFAULT 'summary_large_image'
                                       CHECK (twitter_card IN ('summary','summary_large_image')),
        focus_keyword    TEXT,
        canonical_url    TEXT,
        robots           TEXT          NOT NULL DEFAULT 'index,follow'
                                       CHECK (robots IN ('index,follow','noindex','noindex,nofollow')),
        schema_type      TEXT          NOT NULL DEFAULT 'WebPage',
        structured_data  JSONB,
        created_by       UUID          REFERENCES "${s}".officers(id) ON DELETE SET NULL,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `));

    // ── 21. Donations ──────────────────────────────────────────────────────
    // Amount + status + bukti bayar ada di payments (source_type='donation')
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".donations (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        donation_number     TEXT        NOT NULL UNIQUE,
        campaign_id         UUID        REFERENCES "${s}".campaigns(id) ON DELETE SET NULL,
        donation_type       TEXT        NOT NULL DEFAULT 'donasi'
                                        CHECK (donation_type IN ('donasi','zakat','wakaf','qurban')),
        member_id           UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        profile_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
        donor_name          TEXT        NOT NULL,
        donor_phone         TEXT,
        donor_email         TEXT,
        donor_message       TEXT,
        is_anonymous        BOOLEAN     NOT NULL DEFAULT false,
        certificate_url     TEXT,
        certificate_sent_at TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 22. Donation Sequences ─────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".donation_sequences (
        id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        year    INTEGER NOT NULL,
        month   INTEGER NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        UNIQUE (year, month)
      )
    `));

    // ── 23. Event Categories ──────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".event_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT        NOT NULL,
        slug       TEXT        NOT NULL UNIQUE,
        sort_order INTEGER     NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 24. Events ────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".events (
        id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        slug                    TEXT          NOT NULL UNIQUE,
        title                   TEXT          NOT NULL,
        description             TEXT,
        category_id             UUID          REFERENCES "${s}".event_categories(id) ON DELETE SET NULL,
        event_type              TEXT          NOT NULL DEFAULT 'offline'
                                              CHECK (event_type IN ('offline','online','hybrid')),
        status                  TEXT          NOT NULL DEFAULT 'draft'
                                              CHECK (status IN ('draft','published','cancelled','completed')),
        starts_at               TIMESTAMPTZ,
        ends_at                 TIMESTAMPTZ,
        location                TEXT,
        location_detail         TEXT,
        maps_url                TEXT,
        online_link             TEXT,
        organizer_name          TEXT,
        max_capacity            INTEGER,
        show_attendee_list      BOOLEAN       NOT NULL DEFAULT false,
        show_ticket_count       BOOLEAN       NOT NULL DEFAULT true,
        require_approval        BOOLEAN       NOT NULL DEFAULT false,
        cover_id                UUID          REFERENCES "${s}".media(id) ON DELETE SET NULL,
        certificate_template_id UUID,
        meta_title              TEXT,
        meta_desc               TEXT,
        og_title                TEXT,
        og_description          TEXT,
        og_image_id             UUID          REFERENCES "${s}".media(id) ON DELETE SET NULL,
        twitter_card            TEXT          DEFAULT 'summary_large_image'
                                              CHECK (twitter_card IN ('summary','summary_large_image')),
        focus_keyword           TEXT,
        canonical_url           TEXT,
        robots                  TEXT          NOT NULL DEFAULT 'index,follow'
                                              CHECK (robots IN ('index,follow','noindex','noindex,nofollow')),
        schema_type             TEXT          NOT NULL DEFAULT 'Event',
        structured_data         JSONB,
        created_by              UUID          REFERENCES "${s}".officers(id) ON DELETE SET NULL,
        created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `));

    // ── 25. Event Tickets ─────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".event_tickets (
        id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id       UUID          NOT NULL REFERENCES "${s}".events(id) ON DELETE CASCADE,
        name           TEXT          NOT NULL,
        description    TEXT,
        price          NUMERIC(15,2) NOT NULL DEFAULT 0,
        quota          INTEGER,
        sort_order     INTEGER       NOT NULL DEFAULT 0,
        is_active      BOOLEAN       NOT NULL DEFAULT true,
        sale_starts_at TIMESTAMPTZ,
        sale_ends_at   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `));

    // ── 26. Event Registrations ───────────────────────────────────────────
    // Uang masuk via payments (source_type='event_registration', source_id=id)
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".event_registrations (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        registration_number TEXT        NOT NULL UNIQUE,
        event_id            UUID        NOT NULL REFERENCES "${s}".events(id) ON DELETE CASCADE,
        ticket_id           UUID        NOT NULL REFERENCES "${s}".event_tickets(id),
        member_id           UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        profile_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
        attendee_name       TEXT        NOT NULL,
        attendee_phone      TEXT,
        attendee_email      TEXT,
        custom_fields       JSONB,
        status              TEXT        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','confirmed','cancelled','attended')),
        checked_in_at       TIMESTAMPTZ,
        checked_in_by       UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        certificate_url     TEXT,
        certificate_sent_at TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 27. Event Registration Sequences ─────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".event_registration_sequences (
        id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        year    INTEGER NOT NULL,
        month   INTEGER NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        UNIQUE (year, month)
      )
    `));

    // ── 28. Document Categories ───────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".document_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT        NOT NULL,
        slug       TEXT        NOT NULL UNIQUE,
        parent_id  UUID        REFERENCES "${s}".document_categories(id) ON DELETE SET NULL,
        sort_order INTEGER     NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 29. Documents ─────────────────────────────────────────────────────
    // current_version_id: plain UUID tanpa FK constraint (circular ref dengan document_versions)
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".documents (
        id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        title              TEXT        NOT NULL,
        description        TEXT,
        category_id        UUID        REFERENCES "${s}".document_categories(id) ON DELETE SET NULL,
        current_version_id UUID,
        visibility         TEXT        NOT NULL DEFAULT 'internal'
                                       CHECK (visibility IN ('internal','public')),
        tags               TEXT[]      NOT NULL DEFAULT '{}',
        created_by         UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 30. Document Versions ─────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".document_versions (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id    UUID        NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
        version_number INTEGER     NOT NULL DEFAULT 1,
        file_id        UUID        REFERENCES "${s}".media(id) ON DELETE SET NULL,
        file_name      TEXT        NOT NULL,
        file_size      INTEGER,
        mime_type      TEXT,
        notes          TEXT,
        uploaded_by    UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(document_id, version_number)
      )
    `));

    // ── 31. Product Categories ─────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".product_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        parent_id  UUID        REFERENCES "${s}".product_categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 29. Products ───────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".products (
        id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        sku         TEXT           UNIQUE,
        slug        TEXT           NOT NULL UNIQUE,
        name        TEXT           NOT NULL,
        description TEXT,
        price       NUMERIC(15,2)  NOT NULL,
        stock       INTEGER        NOT NULL DEFAULT 0,
        images      JSONB          NOT NULL DEFAULT '[]',
        -- SEO dasar (tidak ada di schema awal)
        meta_title      TEXT,
        meta_desc       TEXT,
        -- Open Graph
        og_title        TEXT,
        og_description  TEXT,
        og_image_id     UUID           REFERENCES "${s}".media(id) ON DELETE SET NULL,
        -- Social / Advanced
        twitter_card    TEXT           DEFAULT 'summary_large_image'
                                       CHECK (twitter_card IN ('summary','summary_large_image')),
        focus_keyword   TEXT,
        canonical_url   TEXT,
        robots          TEXT           NOT NULL DEFAULT 'index,follow'
                                       CHECK (robots IN ('index,follow','noindex','noindex,nofollow')),
        schema_type     TEXT           NOT NULL DEFAULT 'Product',
        structured_data JSONB,
        status      TEXT           NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('active','draft','archived')),
        category_id UUID           REFERENCES "${s}".product_categories(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 30. Orders ─────────────────────────────────────────────────────────
    // customer_id → public.members.id (bukan tenant member)
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".orders (
        id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number     TEXT           NOT NULL UNIQUE,
        customer_id      UUID           REFERENCES public.members(id) ON DELETE SET NULL,
        profile_id       UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
        customer_name    TEXT           NOT NULL,
        customer_email   TEXT,
        customer_phone   TEXT,
        shipping_address TEXT,
        status           TEXT           NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','paid','processing','shipped','done','cancelled')),
        subtotal         NUMERIC(15,2)  NOT NULL,
        discount         NUMERIC(15,2)  NOT NULL DEFAULT 0,
        total            NUMERIC(15,2)  NOT NULL,
        notes            TEXT,
        created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 31. Order Items ────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".order_items (
        id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id       UUID           NOT NULL REFERENCES "${s}".orders(id) ON DELETE CASCADE,
        product_id     UUID           NOT NULL REFERENCES "${s}".products(id),
        product_name   TEXT           NOT NULL,
        sku_at_order   TEXT,
        qty            INTEGER        NOT NULL,
        price_at_order NUMERIC(15,2)  NOT NULL,
        subtotal       NUMERIC(15,2)  NOT NULL
      )
    `));

    // ── 23. Settings ───────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".settings (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        key        TEXT        NOT NULL,
        "group"    TEXT        NOT NULL DEFAULT 'general'
                               CHECK ("group" IN ('general','contact','payment','display','mail','notif','website','keuangan')),
        value      JSONB       NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (key, "group")
      )
    `));

    // ── 24. Menus ──────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".menus (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT        NOT NULL,
        location   TEXT        NOT NULL UNIQUE
                               CHECK (location IN ('header','footer','sidebar')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 25. Menu Items ─────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".menu_items (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        menu_id    UUID        NOT NULL REFERENCES "${s}".menus(id) ON DELETE CASCADE,
        parent_id  UUID        REFERENCES "${s}".menu_items(id) ON DELETE SET NULL,
        label      TEXT        NOT NULL,
        url        TEXT        NOT NULL,
        target     TEXT        NOT NULL DEFAULT '_self',
        is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
        "order"    INTEGER     NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── Tenant Invites (setelah users — FK ke users) ──────────────────────
    // Audit trail undangan pengurus — tidak dihapus saat expired/accepted
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".tenant_invites (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        email           TEXT,
        member_id       UUID        REFERENCES public.members(id) ON DELETE CASCADE,
        role            TEXT        NOT NULL
                                    CHECK (role IN ('ketua','sekretaris','bendahara','custom')),
        custom_role_id  UUID        REFERENCES "${s}".custom_roles(id) ON DELETE SET NULL,
        token           TEXT        NOT NULL UNIQUE,
        delivery_method TEXT        NOT NULL DEFAULT 'manual'
                                    CHECK (delivery_method IN ('email','manual')),
        expires_at      TIMESTAMPTZ NOT NULL,
        accepted_at     TIMESTAMPTZ,
        created_by      UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT invites_custom_role_check CHECK (
          (role IN ('ketua','sekretaris','bendahara') AND custom_role_id IS NULL)
          OR (role = 'custom' AND custom_role_id IS NOT NULL)
        )
      )
    `));

    // ── 32. Installment Plans ─────────────────────────────────────────────
    // Program cicilan (mis. Nabung Qurban). Default hidden — admin aktifkan manual.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".installment_plans (
        id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        name              TEXT           NOT NULL,
        description       TEXT,
        source_type       TEXT,
        source_id         UUID,
        total_amount      NUMERIC(15,2),
        installment_count INTEGER        NOT NULL,
        interval_days     INTEGER        NOT NULL,
        is_active         BOOLEAN        NOT NULL DEFAULT FALSE,
        is_published      BOOLEAN        NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 33. Carts (Billing) ───────────────────────────────────────────────
    // Keranjang guest (httpOnly cookie TTL 24 jam). member_id diisi jika user login.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".carts (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token  TEXT        NOT NULL UNIQUE,
        member_id      UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        expires_at     TIMESTAMPTZ NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 33. Cart Items ─────────────────────────────────────────────────────
    // Snapshot harga saat item ditambahkan — tidak live dari produk.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".cart_items (
        id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id    UUID           NOT NULL REFERENCES "${s}".carts(id) ON DELETE CASCADE,
        item_type  TEXT           NOT NULL
                                  CHECK (item_type IN ('product','ticket','donation','custom')),
        item_id    UUID,
        name       TEXT           NOT NULL,
        unit_price NUMERIC(15,2)  NOT NULL,
        quantity   INTEGER        NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        notes      TEXT,
        sort_order INTEGER        NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 34. Invoices ───────────────────────────────────────────────────────
    // Header universal tagihan. Source polymorphic: cart/order/donation/event_registration/manual.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".invoices (
        id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number  TEXT           NOT NULL UNIQUE,
        source_type     TEXT           NOT NULL
                                       CHECK (source_type IN ('cart','order','donation','event_registration','manual')),
        source_id       UUID,
        customer_name   TEXT           NOT NULL,
        customer_phone  TEXT,
        customer_email  TEXT,
        member_id       UUID           REFERENCES public.members(id) ON DELETE SET NULL,
        profile_id      UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
        subtotal        NUMERIC(15,2)  NOT NULL,
        discount        NUMERIC(15,2)  NOT NULL DEFAULT 0,
        total           NUMERIC(15,2)  NOT NULL,
        paid_amount     NUMERIC(15,2)  NOT NULL DEFAULT 0,
        status          TEXT           NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('draft','pending','waiting_verification','partial','paid','cancelled','overdue')),
        due_date        DATE,
        notes           TEXT,
        pdf_url         TEXT,
        installment_plan_id UUID       REFERENCES "${s}".installment_plans(id) ON DELETE SET NULL,
        created_by      UUID           REFERENCES "${s}".users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `));

    // ── 35. Invoice Items ──────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".invoice_items (
        id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id  UUID           NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        item_type   TEXT           NOT NULL
                                   CHECK (item_type IN ('product','ticket','donation','custom')),
        item_id     UUID,
        name        TEXT           NOT NULL,
        description TEXT,
        unit_price  NUMERIC(15,2)  NOT NULL,
        quantity    INTEGER        NOT NULL DEFAULT 1,
        total       NUMERIC(15,2)  NOT NULL,
        sort_order  INTEGER        NOT NULL DEFAULT 0
      )
    `));

    // ── 36. Invoice Payments (junction) ───────────────────────────────────
    // Satu invoice bisa dilunasi dengan banyak payment (partial/cicilan).
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".invoice_payments (
        id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID           NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        payment_id UUID           NOT NULL REFERENCES "${s}".payments(id) ON DELETE CASCADE,
        amount     NUMERIC(15,2)  NOT NULL,
        created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        UNIQUE (invoice_id, payment_id)
      )
    `));

    // ── 37. Installment Schedules ──────────────────────────────────────────
    // Jadwal termin cicilan per invoice. Dibuat otomatis saat invoice ikut program cicilan.
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".installment_schedules (
        id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id          UUID           NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        installment_plan_id UUID           NOT NULL REFERENCES "${s}".installment_plans(id) ON DELETE RESTRICT,
        term_number         INTEGER        NOT NULL,
        due_date            DATE           NOT NULL,
        amount              NUMERIC(15,2)  NOT NULL,
        payment_id          UUID           REFERENCES "${s}".payments(id) ON DELETE SET NULL,
        paid_at             TIMESTAMPTZ,
        status              TEXT           NOT NULL DEFAULT 'pending'
                                           CHECK (status IN ('pending','paid','overdue')),
        UNIQUE (invoice_id, term_number)
      )
    `));

    // ── Indexes ────────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_letters_type             ON "${s}".letters(type)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_letters_status           ON "${s}".letters(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_letters_bulk_parent      ON "${s}".letters(bulk_parent_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_letter_contacts_member   ON "${s}".letter_contacts(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_officers_member_id         ON "${s}".officers(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_officers_division_id       ON "${s}".officers(division_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_officers_is_active         ON "${s}".officers(is_active)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_letter_sigs_letter_id      ON "${s}".letter_signatures(letter_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id        ON "${s}".order_items(order_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id          ON "${s}".menu_items(menu_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_posts_status               ON "${s}".posts(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_orders_status              ON "${s}".orders(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_transactions_date          ON "${s}".transactions(date)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_payments_source            ON "${s}".payments(source_type, source_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_payments_status            ON "${s}".payments(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_payments_member_id         ON "${s}".payments(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_disbursements_status       ON "${s}".disbursements(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_disbursements_requested_by ON "${s}".disbursements(requested_by)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_donations_campaign_id        ON "${s}".donations(campaign_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_donations_member_id          ON "${s}".donations(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_campaigns_status             ON "${s}".campaigns(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON "${s}".document_versions(document_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_documents_category_id        ON "${s}".documents(category_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_documents_visibility         ON "${s}".documents(visibility)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_invites_token         ON "${s}".tenant_invites(token)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_invites_email         ON "${s}".tenant_invites(email)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_invites_member        ON "${s}".tenant_invites(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_carts_session_token          ON "${s}".carts(session_token)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_carts_member_id             ON "${s}".carts(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id          ON "${s}".cart_items(cart_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_status             ON "${s}".invoices(status)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_member_id          ON "${s}".invoices(member_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_source             ON "${s}".invoices(source_type, source_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id    ON "${s}".invoice_items(invoice_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON "${s}".invoice_payments(invoice_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_installment_schedules_invoice ON "${s}".installment_schedules(invoice_id)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_installment_schedules_due   ON "${s}".installment_schedules(due_date, status)`));

    // ── Default Data ───────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      INSERT INTO "${s}".accounts (code, name, type) VALUES
        ('1000', 'Aset',               'asset'),
        ('1100', 'Kas dan Bank',       'asset'),
        ('1101', 'Kas Tunai',          'asset'),
        ('1102', 'Bank',               'asset'),
        ('2000', 'Kewajiban',          'liability'),
        ('2100', 'Hutang',             'liability'),
        ('2200', 'Dana Titipan',       'liability'),
        ('2201', 'Dana Titipan Donasi','liability'),
        ('3000', 'Ekuitas',            'equity'),
        ('3100', 'Modal Organisasi',   'equity'),
        ('4000', 'Pendapatan',         'income'),
        ('4100', 'Pendapatan Iuran',   'income'),
        ('4200', 'Pendapatan Donasi',  'income'),
        ('4300', 'Pendapatan Usaha',   'income'),
        ('4400', 'Pendapatan Event',   'income'),
        ('5000', 'Beban',              'expense'),
        ('5100', 'Beban Operasional',  'expense'),
        ('5200', 'Beban Administrasi', 'expense'),
        ('5300', 'Beban Kegiatan',     'expense')
      ON CONFLICT (code) DO NOTHING
    `));

    await tx.execute(sql.raw(`
      INSERT INTO "${s}".menus (name, location) VALUES
        ('Menu Utama', 'header'),
        ('Footer',     'footer')
      ON CONFLICT (location) DO NOTHING
    `));

    // Escape tanda kutip dalam nama org agar aman dimasukkan ke SQL string JSON
    const safeName = (orgName ?? "Organisasi Saya").replace(/'/g, "''").replace(/"/g, '\\"');
    await tx.execute(sql.raw(`
      INSERT INTO "${s}".settings (key, "group", value) VALUES
        ('site_name', 'general', '"${safeName}"'),
        ('site_desc', 'general', '""'),
        ('timezone',  'general', '"Asia/Jakarta"'),
        ('language',  'general', '"id"'),
        ('currency',  'general', '"IDR"')
      ON CONFLICT (key, "group") DO NOTHING
    `));
  });
}
