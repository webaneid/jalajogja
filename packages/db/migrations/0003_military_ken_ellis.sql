CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"icon_url" text,
	"is_free" boolean DEFAULT true NOT NULL,
	"price_monthly" integer,
	"price_yearly" integer,
	"quota_monthly" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tenant_addon_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"quota_monthly" integer,
	"trial_ends_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_addon_installations_tenant_id_addon_id_unique" UNIQUE("tenant_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "addon_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_usage_tenant_id_addon_id_year_month_unique" UNIQUE("tenant_id","addon_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "tenant_addon_installations" ADD CONSTRAINT "tenant_addon_installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_addon_installations" ADD CONSTRAINT "tenant_addon_installations_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_usage" ADD CONSTRAINT "addon_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_usage" ADD CONSTRAINT "addon_usage_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addon_usage_tenant_idx" ON "addon_usage" USING btree ("tenant_id");
--> statement-breakpoint
-- ── Seed: Katalog Add-on Awal ─────────────────────────────────────────────────
-- Harga dalam IDR. quota_monthly null = unlimited.
-- WhatsApp: hosting di sumopod (go-whatsapp-web-multidevice), self-service QR scan.
-- Gateway payment: gratis diinstall, konfigurasi API key via add-on settings.
INSERT INTO "addons" (slug, name, description, category, is_free, price_monthly, price_yearly, quota_monthly, status) VALUES
  (
    'whatsapp-starter',
    'WhatsApp Notifikasi — Starter',
    'Notifikasi WhatsApp otomatis untuk konfirmasi pembayaran, status order, dan lainnya. 200 pesan/bulan.',
    'communication', false, 49000, 470000, 200, 'active'
  ),
  (
    'whatsapp-pro',
    'WhatsApp Notifikasi — Pro',
    'Notifikasi WhatsApp otomatis. 1.000 pesan/bulan.',
    'communication', false, 129000, 1240000, 1000, 'active'
  ),
  (
    'whatsapp-unlimited',
    'WhatsApp Notifikasi — Unlimited',
    'Notifikasi WhatsApp otomatis tanpa batas pesan.',
    'communication', false, 299000, 2870000, NULL, 'active'
  ),
  (
    'midtrans',
    'Midtrans Payment Gateway',
    'Terima pembayaran via Midtrans: kartu kredit, transfer bank, e-wallet, QRIS.',
    'payment', true, NULL, NULL, NULL, 'active'
  ),
  (
    'xendit',
    'Xendit Payment Gateway',
    'Terima pembayaran via Xendit: VA, e-wallet, kartu kredit, QRIS.',
    'payment', true, NULL, NULL, NULL, 'active'
  ),
  (
    'ipaymu',
    'iPaymu Payment Gateway',
    'Terima pembayaran via iPaymu: transfer bank, e-wallet, QRIS.',
    'payment', true, NULL, NULL, NULL, 'active'
  ),
  (
    'qris-dynamic',
    'QRIS Dynamic Nominal',
    'Generate QR per transaksi dengan nominal terkunci otomatis. Tidak perlu payment gateway.',
    'payment', false, 29000, 280000, NULL, 'active'
  ),
  (
    'google-analytics',
    'Google Analytics',
    'Pantau trafik website organisasi via Google Analytics 4.',
    'analytics', true, NULL, NULL, NULL, 'active'
  ),
  (
    'meta-pixel',
    'Meta Pixel',
    'Tracking pengunjung website untuk keperluan iklan Facebook/Instagram.',
    'analytics', true, NULL, NULL, NULL, 'active'
  ),
  (
    'webhook-out',
    'Webhook Out',
    'Kirim event jalajogja ke sistem eksternal (n8n, Zapier, custom endpoint).',
    'integration', true, NULL, NULL, NULL, 'coming_soon'
  )
ON CONFLICT (slug) DO NOTHING;