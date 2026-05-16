# Arsitektur Domain & Custom Domain Routing

> Dokumen ini mencakup tiga fase routing domain jalajogja, analisa masalah yang ditemukan,
> dan roadmap perbaikan. Konteks singkat domain routing ada di `docs/arsitektur-website.md` § 2.

---

## Tiga Fase Routing

| Fase | Contoh URL | Status |
|------|-----------|--------|
| 1 — Path | `app.jalakarta.com/pc-ikpm-jogjakarta/post` | ✅ Aktif |
| 2 — Subdomain | `ikpm.jalakarta.com/post` | ⬜ Belum |
| 3 — Custom Domain | `ikpmjogja.com/post` | ⚠️ Parsial — lihat analisa di bawah |

Ketiga fase tidak saling menggantikan — tenant bisa punya ketiganya aktif sekaligus.

---

## Cara Kerja Saat Ini (Fase 3)

```
Browser buka ikpmjogja.com
  → Cloudflare terima, SSL termination di Cloudflare
  → Forward HTTP ke VPS (port 80)
  → Nginx: ikpmjogja.com tidak match server_name manapun
  → Nginx pakai first server block (jalakarta.com) sebagai default
  → Proxy ke localhost:3000 dengan Host: ikpmjogja.com
  → Next.js middleware baca Host header
  → Fetch /api/internal/resolve-domain?domain=ikpmjogja.com
  → DB lookup: WHERE custom_domain = 'ikpmjogja.com' AND status = 'active'
  → Jika found → rewrite ke /{slug}{pathname}
  → Jika not found → middleware pass-through → kena platform root
```

**Status sekarang: bekerja secara kebetulan**, bukan by design.

---

## File yang Terlibat

```
apps/web/middleware.ts
  → isOwnHost(): jalakarta.com, *.jalakarta.com, localhost — skip custom domain routing
  → resolve custom domain via fetch ke /api/internal/resolve-domain
  → rewrite internal ke /{slug}{pathname}

apps/web/app/api/internal/resolve-domain/route.ts
  → DB query: tenants WHERE custom_domain = ? AND customDomainStatus = 'active' AND isActive = true
  → Return { slug } atau { slug: null }

apps/web/app/api/cron/verify-domains/route.ts
  → DNS lookup A record per tenant (status pending/failed)
  → Jika A record → VPS_IP (72.61.215.7): set status = 'active'
  → Jika tidak: set status = 'failed'
  → Dipanggil via GET /api/cron/verify-domains dengan Authorization: Bearer {CRON_SECRET}

nginx.conf
  → server_name jalakarta.com *.jalakarta.com (port 80 + 443)
  → server_name minio.jalakarta.com (port 443)
  → Tidak ada catch-all / default_server untuk custom domain

packages/db/src/schema/public/tenants.ts
  → custom_domain TEXT UNIQUE
  → custom_domain_status TEXT: none | pending | active | failed
  → custom_domain_verified_at TIMESTAMPTZ
```

---

## Masalah yang Ditemukan

### 🔴 Masalah 1 — Nginx Tidak Punya Catch-all Custom Domain

`nginx.conf` hanya punya `server_name jalakarta.com *.jalakarta.com`. Request `ikpmjogja.com`
tidak cocok dengan server block manapun → Nginx pakai first server block sebagai default →
secara kebetulan diproxy ke `localhost:3000`.

**Risiko**: Perilaku ini tidak terdokumentasi dan bisa berubah sewaktu-waktu (misal saat kita
tambah server block baru yang menjadi first block). Harus diganti dengan catch-all eksplisit.

### 🔴 Masalah 2 — "Kadang Masuk ke Platform" (Bug Utama)

**Penyebab**: `customDomainStatus` berubah antara `active` dan `failed` karena cron
`verify-domains` menjalankan DNS lookup ulang setiap jalan. Kalau saat cron jalan ada
DNS timeout atau blip → status diset ke `failed` → middleware tidak resolve domain →
slug = null → middleware pass-through → path `/` tidak cocok route tenant manapun →
**kena platform root page** (jalakarta.com homepage).

**Kenapa "kadang"**: DNS lookup dari VPS tidak selalu konsisten karena:
- DNS propagation belum selesai
- Upstream DNS server timeout
- Network blip di VPS saat cron jalan

**Solusi**: Setelah domain pertama kali verified (`active`), jangan reset ke `failed` karena
DNS blip. Pisahkan "monitoring" dari "status routing". Status routing hanya berubah via
aksi eksplisit admin.

### 🟡 Masalah 3 — SSL Custom Domain Bergantung Cloudflare

Nginx tidak punya SSL cert untuk `ikpmjogja.com`. HTTPS bekerja karena Cloudflare sebagai
SSL proxy (Cloudflare punya cert untuk semua domain yang lewat mereka). Jika tenant tidak
pakai Cloudflare → HTTPS gagal → browser error.

**Konsekuensi**: Semua tenant yang mau pakai custom domain **HARUS** lewat Cloudflare.
Ini perlu didokumentasikan sebagai persyaratan, bukan optional.

Alternatif jangka panjang: Caddy dengan on-demand TLS (auto-provision Let's Encrypt per domain).

### 🟡 Masalah 4 — Slug Bocor ke URL Custom Domain

Middleware punya guard:
```typescript
if (pathname.startsWith(`/${slug}`)) {
  return NextResponse.next(); // pass-through tanpa strip slug
}
```

Jika user dari `ikpmjogja.com` klik link internal yang generate `/pc-ikpm-jogjakarta/post/artikel`,
middleware melihat path sudah include slug → pass-through. Browser tetap di:
```
ikpmjogja.com/pc-ikpm-jogjakarta/post/artikel   ← slug bocor
```

Idealnya:
```
ikpmjogja.com/post/artikel   ← white-label bersih
```

**Dampak SEO**: Google bisa index dua URL untuk konten yang sama — canonical issue.

### 🟡 Masalah 5 — Link Internal Tidak Custom-Domain Aware

Header, footer, nav menu generate link dengan slug prefix:
```typescript
// classic-header.tsx
<a href={`/${tenantSlug}`}>Logo</a>

// nav-menu.ts
href = `/${slug}/post`
href = `/${slug}/campaign`
```

Di custom domain, link ini tampil sebagai:
```
ikpmjogja.com/pc-ikpm-jogjakarta/post   ← tidak white-label
```

Idealnya:
```
ikpmjogja.com/post   ← white-label bersih
```

---

## Status Domain `ikpmjogja.com` Saat Ini

Berdasarkan analisa (perlu dicek via psql untuk konfirmasi):

```sql
SELECT slug, custom_domain, custom_domain_status, custom_domain_verified_at
FROM public.tenants
WHERE custom_domain = 'ikpmjogja.com';
```

Jika `customDomainStatus` bukan `active` → penyebab langsung "kadang masuk ke platform".

---

## Roadmap Perbaikan

### Fase A — Stabilisasi (Prioritas Tinggi, Hari Ini)

**A1. Tambah catch-all server block di Nginx**

```nginx
# Catch-all untuk custom domain yang lewat Cloudflare (HTTP)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        # Cloudflare sets X-Forwarded-Proto — teruskan ke Next.js
        proxy_set_header   X-Forwarded-Proto $http_x_forwarded_proto;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }
}
```

Taruh SEBELUM server block `jalakarta.com` agar `default_server` flag tidak conflict.

**A2. Fix cron verify-domains — jangan reset `active` ke `failed`**

Ubah logika cron: setelah status `active`, cron hanya mencatat `last_check_at` dan
`last_check_error` tanpa mengubah status routing. Status hanya berubah via admin action.

```typescript
// SEKARANG (salah):
if (!pointsToVps) {
  await db.update(tenants).set({ customDomainStatus: "failed" }) // ← ini yang bikin "kadang"
}

// YANG BENAR:
if (pointsToVps && current.customDomainStatus !== "active") {
  // Pertama kali verified → set active
  await db.update(tenants).set({
    customDomainStatus: "active",
    customDomainVerifiedAt: new Date(),
  });
} else if (!pointsToVps && current.customDomainStatus === "pending") {
  // Hanya set failed kalau masih pending (belum pernah active)
  await db.update(tenants).set({ customDomainStatus: "failed" });
}
// Status "active" tidak pernah di-downgrade oleh cron
```

**Kolom tambahan yang perlu di tenants table:**
```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_last_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_last_check_error TEXT;
```

### Fase B — Persyaratan Cloudflare (Dokumentasi, Segera)

Dokumentasikan ke admin/tenant bahwa custom domain **wajib** konfigurasi:
1. A record domain → IP VPS (72.61.215.7)
2. Cloudflare proxy aktif (orange cloud) — untuk SSL

Tanpa Cloudflare: tidak ada HTTPS → browser blokir → tidak bisa dipakai.

Instruksi di `/settings/domain` perlu diperjelas:
```
Langkah 1: Masuk ke panel DNS domain kamu (Cloudflare/Niagahoster/GoDaddy)
Langkah 2: Tambah A record:
           Nama: @  |  IP: 72.61.215.7  |  TTL: Auto
Langkah 3: Aktifkan Cloudflare Proxy (ikon awan harus oranye)
Langkah 4: Klik "Verifikasi DNS" di halaman ini
```

### Fase C — White-label Clean URLs (Medium Term)

Ini perubahan paling besar — menyentuh middleware, layout, dan link generation.

**C1. Middleware: strip slug dari URL saat di custom domain**

```typescript
// Saat ini: ikpmjogja.com/pc-ikpm-jogjakarta/post → pass-through (slug bocor)
// Yang benar: ikpmjogja.com/pc-ikpm-jogjakarta/post → redirect 301 ke ikpmjogja.com/post

if (slug && pathname.startsWith(`/${slug}`)) {
  // Strip slug → redirect ke clean URL
  const cleanPath = pathname.slice(`/${slug}`.length) || "/";
  const cleanUrl = request.nextUrl.clone();
  cleanUrl.pathname = cleanPath;
  return NextResponse.redirect(cleanUrl, 301);
}
```

**C2. PublicLayout: deteksi custom domain → skip slug prefix di link**

```typescript
// app/(public)/[tenant]/layout.tsx
// Tambah: deteksi apakah request dari custom domain

const host = headers().get("host") ?? "";
const isCustomDomain = !isOwnHost(host); // gunakan fungsi yang sama dengan middleware

// Pass ke semua komponen sebagai context atau prop
<PublicHeader tenantSlug={slug} baseUrl={isCustomDomain ? "" : `/${slug}`} />
```

**C3. Nav menu, header, footer: gunakan `baseUrl` prop**

```typescript
// Sebelum:
href={`/${tenantSlug}/post`}

// Sesudah:
href={`${baseUrl}/post`}  // baseUrl = "" jika custom domain, "/{slug}" jika path mode
```

**C4. Canonical tag**

```typescript
// Di setiap page server component
const canonicalUrl = isCustomDomain
  ? `https://${host}${cleanPath}`
  : `${APP_URL}/${slug}${cleanPath}`;

// Di generateMetadata:
alternates: { canonical: canonicalUrl }
```

### Fase D — Caddy untuk On-demand TLS (Jangka Panjang)

Untuk skala banyak tenant custom domain tanpa Cloudflare dependency:

```
Browser → Caddy (listen :443, on-demand TLS)
       → Caddy tanya: /api/internal/domain-allowed?domain=ikpmjogja.com
       → Endpoint cek DB: custom_domain = ? AND status = 'active'
       → Jika allowed: Caddy issue cert via Let's Encrypt → proxy ke localhost:3000
       → Jika tidak allowed: Caddy reject
```

Ini memerlukan:
- Migrasi dari Nginx ke Caddy (atau Nginx + Caddy hybrid)
- Endpoint baru `/api/internal/domain-allowed`
- Caddy config `on_demand_tls` dengan `ask` URL

**Tidak urgent** selama Cloudflare mandatory untuk custom domain.

---

## Schema yang Perlu Diupdate

### Saat ini (kolom di `public.tenants`)
```
custom_domain              TEXT UNIQUE
custom_domain_status       TEXT: none | pending | active | failed
custom_domain_verified_at  TIMESTAMPTZ
```

### Yang perlu ditambah (Fase A)
```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_last_check_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_last_check_error TEXT;
```

### Jangka panjang (jika banyak domain per tenant)
Tabel terpisah `public.tenant_domains`:
```sql
CREATE TABLE public.tenant_domains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hostname    TEXT NOT NULL UNIQUE,  -- lowercase, tanpa http://, tanpa trailing slash
  type        TEXT NOT NULL DEFAULT 'custom',  -- apex | www | subdomain | custom
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | active | failed
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_check_at   TIMESTAMPTZ,
  last_check_error TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Tidak urgent sampai ada tenant yang butuh lebih dari satu custom domain.

---

## Aturan Normalisasi Domain

Domain yang disimpan ke DB harus selalu:
- Lowercase
- Tanpa `http://` atau `https://`
- Tanpa path (hanya hostname)
- Tanpa trailing slash
- Tanpa port (kecuali non-standard)
- `www.ikpmjogja.com` dan `ikpmjogja.com` = dua record berbeda (pilih salah satu sebagai primary)

Implementasi saat save di `settings/domain/actions.ts`:
```typescript
function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")        // hapus path
    .replace(/:.*$/, "")         // hapus port
    .replace(/\.$/, "");         // hapus trailing dot
}
```

---

## Checklist Eksekusi

### Fase A (Hari ini / minggu ini)
- [ ] Cek `customDomainStatus` ikpmjogja.com via psql — pastikan `active`
- [ ] Tambah catch-all server block di `/etc/nginx/sites-available/jalakarta.com` di VPS
- [ ] Test `nginx -t` + reload Nginx
- [ ] Fix logika cron `verify-domains`: `active` tidak pernah di-downgrade
- [ ] Deploy + pastikan "kadang masuk ke platform" tidak terjadi lagi

### Fase B (Dokumentasi untuk admin/tenant)
- [ ] Update teks instruksi di `/settings/domain` — wajib Cloudflare proxy
- [ ] Tambah screenshot/diagram alur setup custom domain

### Fase C (Setelah Fase A stabil)
- [ ] Middleware: 301 redirect strip slug saat custom domain
- [ ] `PublicLayout`: deteksi custom domain → `baseUrl` prop
- [ ] Header/footer/nav: gunakan `baseUrl` bukan hardcode `/${slug}`
- [ ] Canonical tag di semua page server component
- [ ] Test: ikpmjogja.com/post tampil benar (bukan 404)
- [ ] Test: ikpmjogja.com/pc-ikpm-jogjakarta/post redirect 301 ke ikpmjogja.com/post
- [ ] Test: Google Search Console tidak ada duplicate canonical

### Fase D (Jangka panjang, saat Cloudflare tidak cukup)
- [ ] Evaluasi Caddy vs Nginx + manual Certbot per domain
- [ ] Implementasi on-demand TLS jika putuskan pakai Caddy
- [ ] Migrasi `custom_domain` dari kolom ke tabel `tenant_domains` jika butuh multi-domain per tenant
