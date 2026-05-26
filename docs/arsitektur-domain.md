# Arsitektur Domain & Custom Domain Routing

> Dokumen ini mencakup arsitektur teknis routing domain jalajogja.
> Panduan operasional step-by-step untuk setup tenant baru: `docs/panduan-custom-domain.md`

---

## Tiga Fase Routing

| Fase | Contoh URL | Status |
|------|-----------|--------|
| 1 — Path | `jalakarta.com/app/pc-ikpm-jogjakarta/dashboard` (admin) | ✅ Aktif |
| 2 — Subdomain | `ikpm.jalakarta.com/post` | ⬜ Belum diimplementasikan |
| 3 — Custom Domain | `ikpmjogja.com/post` | ✅ Aktif (2026-05-26) |

Ketiga fase tidak saling menggantikan — tenant bisa punya ketiganya aktif sekaligus.

---

## Cara Kerja Custom Domain (✅ Aktif)

```
Browser buka https://ikpmjogja.com
  → DNS A record → VPS IP (72.61.215.7) langsung (tanpa Cloudflare proxy)
  → VPS port 443 → Nginx server block ikpmjogja.com (cert Let's Encrypt)
  → Nginx proxy_pass → localhost:3000
  → Next.js middleware baca Host header: "ikpmjogja.com"
  → isOwnHost("ikpmjogja.com") = false → masuk custom domain routing
  → Strip www. jika ada: "www.ikpmjogja.com" → "ikpmjogja.com"
  → Fetch http://localhost:3000/api/internal/resolve-domain?domain=ikpmjogja.com
     (APP_INTERNAL_URL — loopback, tidak keluar ke internet)
  → Timeout 3 detik (AbortSignal) — tidak blokir terlalu lama
  → DB: WHERE custom_domain = 'ikpmjogja.com' AND status = 'active' AND isActive = true
  → Jika found → slug = 'pc-ikpm-jogjakarta'
  → Rewrite internal: /post → /pc-ikpm-jogjakarta/post
  → Next.js render halaman untuk tenant pc-ikpm-jogjakarta
```

### Penanganan semua variasi URL

| URL yang diketik | Nginx | Hasil |
|---|---|---|
| `http://ikpmjogja.com` | 301 | `https://ikpmjogja.com/` |
| `http://www.ikpmjogja.com` | 301 | `https://ikpmjogja.com/` |
| `https://www.ikpmjogja.com` | 301 (server block www) | `https://ikpmjogja.com/` |
| `https://ikpmjogja.com` | proxy → Next.js | ✅ Tampil |
| `https://ikpmjogja.com/pc-ikpm-jogjakarta/post` | proxy → middleware | 301 → `/post` (strip slug) |

---

## File yang Terlibat

```
apps/web/middleware.ts
  → isOwnHost(): jalakarta.com, *.jalakarta.com, localhost — skip custom domain routing
  → Strip www. dari host sebelum lookup (www.ikpmjogja.com → ikpmjogja.com)
  → Jika host punya www. dan slug ditemukan → redirect 301 ke apex
  → resolve custom domain via fetch ke /api/internal/resolve-domain
  → Jika slug ditemukan → rewrite internal ke /{slug}{pathname}
  → C1: jika pathname sudah include slug → redirect 301 ke clean URL

apps/web/lib/is-own-host.ts
  → Helper shared untuk middleware + PublicLayout
  → Return true untuk: jalakarta.com, *.jalakarta.com, localhost, 127.0.0.1

apps/web/app/api/internal/resolve-domain/route.ts
  → DB query: tenants WHERE custom_domain = ? AND customDomainStatus = 'active' AND isActive = true
  → Return { slug } atau { slug: null }

apps/web/app/(public)/[tenant]/layout.tsx
  → Deteksi custom domain via headers()
  → Compute baseUrl: "" jika custom domain, "/{slug}" jika path mode
  → Strip slug prefix dari navMenu hrefs saat custom domain
  → Pass baseUrl ke header + footer komponen

/etc/nginx/sites-available/ikpmjogja.com  (di VPS — bukan di repo)
  → Port 80: redirect HTTP → https://ikpmjogja.com (apex, tanpa www)
  → Port 443 www: redirect → https://ikpmjogja.com
  → Port 443 apex: proxy ke localhost:3000, timeout 120s, max body 50M

/etc/nginx/sites-available/custom-domains  (di VPS — bukan di repo)
  → Port 80 catch-all (server_name _): redirect HTTP → HTTPS
  → Fallback untuk domain yang belum punya server block sendiri

packages/db/src/schema/public/tenants.ts
  → custom_domain TEXT UNIQUE          — hostname saja, tanpa http://, tanpa www
  → custom_domain_status TEXT          — none | pending | active | failed
  → custom_domain_verified_at TIMESTAMPTZ
```

---

## Infrastruktur SSL

SSL untuk custom domain menggunakan **Let's Encrypt via Certbot langsung di VPS**.
Tidak melalui Cloudflare proxy.

```
/etc/letsencrypt/live/ikpmjogja.com/
  fullchain.pem  → sertifikat + chain (dipakai nginx)
  privkey.pem    → private key
  → Berlaku 90 hari, auto-renew via cron certbot
  → Cert mencakup: ikpmjogja.com DAN www.ikpmjogja.com (multi-SAN)
```

**Cara issue cert untuk domain baru:**
```bash
sudo certbot --nginx -d DOMAIN -d www.DOMAIN
```

> Certbot validasi via HTTP challenge di port 80. Pastikan DNS A record sudah propagasi
> dan catch-all nginx (custom-domains) tidak memblokir port 80 sebelum certbot jalan.

---

## Aturan Normalisasi Domain

Domain yang disimpan ke DB **harus selalu**:
- Lowercase
- Tanpa `http://` atau `https://`
- Tanpa path (hanya hostname)
- Tanpa trailing slash
- Tanpa port
- Tanpa `www.` — simpan apex saja (`ikpmjogja.com`, bukan `www.ikpmjogja.com`)

Implementasi di `settings/domain/actions.ts`:
```typescript
function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")   // hapus www
    .replace(/\/.*$/, "")    // hapus path
    .replace(/:.*$/, "")     // hapus port
    .replace(/\.$/, "");     // hapus trailing dot
}
```

---

## Proses Setup Tenant Custom Domain Baru

Lihat panduan lengkap: **`docs/panduan-custom-domain.md`**

Ringkasan:
1. Tenant: Tambah DNS A record `@` dan `www` → `72.61.215.7`
2. Admin: Simpan domain di `/app/{slug}/settings/domain`
3. VPS: `sudo certbot --nginx -d DOMAIN -d www.DOMAIN`
4. VPS: Buat `/etc/nginx/sites-available/DOMAIN` dari template
5. VPS: `sudo ln -s .../DOMAIN /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`
6. DB: `UPDATE tenants SET custom_domain_status = 'active' WHERE custom_domain = 'DOMAIN'`

---

## Masalah yang Sudah Difix

### ✅ www variant tidak resolve (2026-05-26)
**Gejala**: `www.ikpmjogja.com` → halaman salah atau error.
**Root cause**: DB punya `ikpmjogja.com`, middleware lookup `www.ikpmjogja.com` → tidak cocok.
**Fix**: Middleware strip `www.` sebelum lookup. Nginx redirect www → apex di level server block.

### ✅ HTTP tidak redirect ke HTTPS (2026-05-26)
**Gejala**: `http://ikpmjogja.com` browsed tanpa redirect ke HTTPS.
**Fix**: Nginx port 80 block untuk `ikpmjogja.com` sekarang return 301 ke `https://ikpmjogja.com`.

### ✅ `proxy_read_timeout` terlalu pendek (2026-05-26)
**Gejala**: Request yang butuh waktu lebih dari 60 detik gagal.
**Fix**: Ditambah `proxy_read_timeout 120s` di server block port 443.

### ✅ Slug bocor ke URL custom domain (2026-05-16, Fase C)
**Gejala**: `ikpmjogja.com/pc-ikpm-jogjakarta/post` — slug muncul di URL.
**Fix**: Middleware C1 redirect strip slug. Layout C2/C3 baseUrl-aware links.

---

## Yang Belum Diimplementasikan

### Fase 2 — Subdomain jalakarta.com
`ikpm.jalakarta.com/post` — subdomain routing belum aktif. Middleware hanya handle
path mode dan custom domain. Butuh: wildcard DNS `*.jalakarta.com` di Certbot +
middleware lookup subdomain → slug.

### Cron Verify-Domains yang Aman
`app/api/cron/verify-domains/route.ts` saat ini bisa reset status `active` → `failed`
jika DNS lookup gagal sesaat. Seharusnya: status `active` tidak pernah di-downgrade
oleh cron. Cron hanya boleh set `active` (dari `pending`) atau catat `last_check_error`.
**Belum difix — perlu dikerjakan sebelum ada lebih dari 3 custom domain.**

### Canonical Tag Custom Domain
`generateMetadata` di page server component masih pakai `NEXT_PUBLIC_APP_URL` sebagai base.
Untuk SEO yang benar di custom domain, canonical harus `https://DOMAIN/path` bukan
`https://jalakarta.com/{slug}/path`.

### Fase D — On-demand TLS (Jangka Panjang)
Saat ini setiap custom domain butuh manual: certbot + nginx config + reload.
Untuk skala >10 tenant dengan custom domain, evaluasi **Caddy** dengan on-demand TLS:
Caddy bisa auto-issue cert Let's Encrypt untuk domain baru tanpa SSH ke VPS.
Tidak urgent selama tenant masih sedikit.

---

## Schema DB (public.tenants)

```
custom_domain              TEXT UNIQUE  — apex domain, tanpa www, tanpa http
custom_domain_status       TEXT         — none | pending | active | failed
custom_domain_verified_at  TIMESTAMPTZ  — kapan pertama kali diverifikasi
```

Jika di masa depan butuh multi-domain per tenant, tambah tabel `public.tenant_domains`.
