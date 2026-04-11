CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- ── Seed: Katalog Modul ───────────────────────────────────────────────────────
INSERT INTO "modules" (slug, name, description, status) VALUES
  ('settings', 'Pengaturan',    'Konfigurasi tenant: profil organisasi, pembayaran, notifikasi, tampilan.', 'active'),
  ('anggota',  'Anggota',       'Manajemen anggota, wizard pendaftaran, riwayat pendidikan & usaha.',        'active'),
  ('website',  'Website',       'Halaman statis, blog/posts, media library, block editor.',                  'coming_soon'),
  ('surat',    'Surat Menyurat','Surat masuk, keluar, internal dengan penomoran otomatis.',                  'coming_soon'),
  ('keuangan', 'Keuangan',      'Jurnal double-entry, anggaran, laporan keuangan.',                          'coming_soon'),
  ('toko',     'Toko',          'Katalog produk, keranjang, checkout, manajemen order.',                     'coming_soon'),
  ('donasi',   'Donasi / Infaq','Campaign donasi, penerimaan infaq, laporan per campaign.',                  'coming_soon')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
-- ── Seed: Package Awal ───────────────────────────────────────────────────────
-- features JSONB: { "modules": [...slug], "addons": [...slug] }
-- Package dirancang di front-end jalajogja, dijual ke organisasi.
-- tenant_plans yang sudah ada dipakai sebagai "package".
INSERT INTO "tenant_plans" (name, max_members, features, price_monthly) VALUES
  (
    'Starter',
    50,
    '{"modules": ["settings", "anggota"], "addons": []}'::jsonb,
    0
  ),
  (
    'Standar',
    200,
    '{"modules": ["settings", "anggota", "website", "surat"], "addons": ["google-analytics"]}'::jsonb,
    199000
  ),
  (
    'Pro',
    1000,
    '{"modules": ["settings", "anggota", "website", "surat", "keuangan", "toko", "donasi"], "addons": ["google-analytics", "meta-pixel", "midtrans", "xendit", "ipaymu", "whatsapp-starter", "qris-dynamic"]}'::jsonb,
    499000
  )
ON CONFLICT DO NOTHING;
