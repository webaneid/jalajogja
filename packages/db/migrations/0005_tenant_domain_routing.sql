-- ── Tenant Domain & Routing — 3 Fase ──────────────────────────────────────────
-- Fase 1: app.jalajogja.com/{slug}           → pakai slug (sudah ada, tidak berubah)
-- Fase 2: {subdomain}.jalajogja.com          → wildcard DNS *.jalajogja.com
-- Fase 3: ikpm.or.id                         → A record → VPS IP, SSL via Caddy
--
-- Rename kolom domain → custom_domain (lebih eksplisit, beda dari subdomain)
-- Tambah subdomain, custom_domain_status, custom_domain_verified_at

ALTER TABLE "tenants" RENAME COLUMN "domain" TO "custom_domain";
--> statement-breakpoint

-- Fase 2: subdomain jalajogja (ikpm.jalajogja.com)
-- null = fallback ke slug di middleware
ALTER TABLE "tenants" ADD COLUMN "subdomain" text;
--> statement-breakpoint

-- Status verifikasi custom domain
-- none     → belum set custom domain
-- pending  → sudah isi domain, menunggu DNS propagate
-- active   → DNS OK + SSL provisioned via Caddy
-- failed   → verifikasi gagal (DNS salah / timeout)
ALTER TABLE "tenants" ADD COLUMN "custom_domain_status" text NOT NULL DEFAULT 'none';
--> statement-breakpoint

-- Timestamp saat custom domain berhasil diverifikasi
ALTER TABLE "tenants" ADD COLUMN "custom_domain_verified_at" timestamp with time zone;
--> statement-breakpoint

-- Unique constraints
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain");
--> statement-breakpoint

-- Constraint name lama: tenants_domain_unique → update ke tenants_custom_domain_unique
-- (PostgreSQL rename constraint tidak bisa langsung, drop + add)
ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_domain_unique";
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_custom_domain_unique" UNIQUE("custom_domain");
