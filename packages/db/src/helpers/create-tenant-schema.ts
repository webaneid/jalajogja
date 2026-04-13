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

    // ── 2. Users (akses dashboard) ─────────────────────────────────────────
    // member_id merujuk ke public.members.id — FK ke public schema
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".users (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        better_auth_user_id TEXT        NOT NULL UNIQUE,
        role                TEXT        NOT NULL DEFAULT 'viewer'
                                        CHECK (role IN ('owner','admin','editor','viewer')),
        member_id           UUID        REFERENCES public.members(id) ON DELETE SET NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_users_auth_user
          FOREIGN KEY (better_auth_user_id)
          REFERENCES public."user"(id) ON DELETE CASCADE
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
        status       TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','published','archived')),
        "order"      INTEGER     NOT NULL DEFAULT 0,
        author_id    UUID        REFERENCES "${s}".users(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    // ── 9. Letters ─────────────────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".letters (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_number   TEXT        UNIQUE,
        type            TEXT        NOT NULL
                                    CHECK (type IN ('incoming','outgoing','internal')),
        subject         TEXT        NOT NULL,
        body            TEXT,
        attachment_urls JSONB       NOT NULL DEFAULT '[]',
        sender          TEXT        NOT NULL,
        recipient       TEXT        NOT NULL,
        letter_date     DATE        NOT NULL,
        status          TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','sent','received','archived')),
        created_by      UUID        NOT NULL REFERENCES "${s}".users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

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

    // ── 11. Accounts (Chart of Accounts) ───────────────────────────────────
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
                                         CHECK (source_type IN ('order','donation','invoice','manual')),
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
                                         CHECK (purpose_type IN ('refund','expense','grant','transfer','manual')),
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
    // Generate nomor 620-PAY/DIS/JNL-YYYYMM-NNNNN secara atomic
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".financial_sequences (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        year        SMALLINT    NOT NULL,
        month       SMALLINT    NOT NULL,
        type        TEXT        NOT NULL
                                CHECK (type IN ('payment','disbursement','journal')),
        last_number INTEGER     NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (year, month, type)
      )
    `));

    // ── 19. Product Categories ─────────────────────────────────────────────
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".product_categories (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        parent_id  UUID        REFERENCES "${s}".product_categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── 20. Products ───────────────────────────────────────────────────────
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

    // ── 21. Orders ─────────────────────────────────────────────────────────
    // customer_id → public.members.id (bukan tenant member)
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${s}".orders (
        id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number     TEXT           NOT NULL UNIQUE,
        customer_id      UUID           REFERENCES public.members(id) ON DELETE SET NULL,
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

    // ── 22. Order Items ────────────────────────────────────────────────────
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
                               CHECK ("group" IN ('general','contact','payment','display','mail','notif','website')),
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

    // ── Indexes ────────────────────────────────────────────────────────────
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
