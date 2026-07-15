# Panduan Setup Custom Domain Tenant

> Dokumen ini adalah panduan operasional step-by-step untuk menghubungkan domain milik tenant
> (misal `ikpmjogja.com`) ke jalakarta.com. Arsitektur lengkap di `docs/arsitektur-domain.md`.

---

## Prasyarat

Sebelum mulai, pastikan:
- DNS domain sudah bisa diubah (akses ke panel registrar/Cloudflare tenant)
- Akses SSH ke VPS (`ssh webane@72.61.215.7`)
- Domain sudah didaftarkan di pengaturan tenant: `/app/{slug}/settings/domain`

---

## Langkah 1 — Tenant: Arahkan DNS ke VPS

Di panel DNS domain tenant, tambahkan dua record:

```
Type  Name   Value           TTL
A     @      72.61.215.7     Auto/3600
A     www    72.61.215.7     Auto/3600
```

> `@` = apex domain (ikpmjogja.com)
> `www` = subdomain www (www.ikpmjogja.com)
>
> **Jangan** aktifkan Cloudflare proxy (orange cloud) — SSL dihandle langsung di VPS.
> Gunakan DNS only (grey cloud) jika pakai Cloudflare sebagai DNS manager.

Tunggu propagasi DNS (biasanya 5–30 menit). Cek dengan:
```bash
dig ikpmjogja.com +short
dig www.ikpmjogja.com +short
# Harus return: 72.61.215.7
```

---

## Langkah 2 — Admin Jalakarta: Simpan Domain di Database

Di dashboard admin jalakarta, buka `/app/{slug}/settings/domain`.
Isi field "Custom Domain" dengan domain tanpa `https://` dan tanpa `www`:

```
ikpmjogja.com      ← BENAR
www.ikpmjogja.com  ← SALAH
https://ikpmjogja.com  ← SALAH
```

Klik "Simpan". Status akan berubah ke `pending`.

---

## Langkah 3 — VPS: Issue SSL Certificate via Certbot

SSH ke VPS, lalu jalankan:

```bash
sudo certbot --nginx -d ikpmjogja.com -d www.ikpmjogja.com
```

> Certbot akan validasi DNS via HTTP challenge — pastikan propagasi DNS sudah selesai (Langkah 1)
> sebelum jalankan perintah ini, atau validasi akan gagal.

Certbot akan menanyakan email (jika belum setup) dan persetujuan ToS. Setelah berhasil, cert tersimpan di:
```
/etc/letsencrypt/live/ikpmjogja.com/fullchain.pem
/etc/letsencrypt/live/ikpmjogja.com/privkey.pem
```

Cert berlaku 90 hari dan **auto-renew via cron certbot** yang sudah terpasang di sistem.

---

## Langkah 4 — VPS: Buat Nginx Config untuk Domain

Salin template di bawah ke file baru. Ganti semua `DOMAIN` dengan domain tenant (tanpa www):

```bash
sudo nano /etc/nginx/sites-available/ikpmjogja.com
```

Isi dengan (ganti `ikpmjogja.com` sesuai domain):

```nginx
# HTTP: semua → redirect ke apex HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN www.DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://DOMAIN$request_uri;
    }
}

# HTTPS www → redirect ke apex (satu langkah, tidak perlu lewat Next.js)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://DOMAIN$request_uri;
}

# HTTPS apex → proxy ke Next.js
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

---

## Langkah 5 — VPS: Aktifkan Config dan Reload Nginx

```bash
# Aktifkan config (buat symlink ke sites-enabled)
sudo ln -s /etc/nginx/sites-available/ikpmjogja.com /etc/nginx/sites-enabled/

# Test config — pastikan tidak ada error
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Langkah 6 — Status Domain ke Active (Otomatis)

**Tidak perlu langkah manual** — status di DB naik dari `pending` ke `active` otomatis begitu DNS
sudah mengarah ke VPS. Dipicu dua cara: (1) langsung saat tenant menyimpan domain di
`/app/{slug}/settings/domain` (fire-and-forget, cek instan), dan (2) cron terjadwal
(`app/api/cron/verify-domains/route.ts`) sebagai fallback kalau pengecekan instan gagal/timeout.
**Tidak ada tombol "Verifikasi DNS" di UI** — tidak dibutuhkan karena sudah otomatis.

Kalau setelah DNS propagasi (Langkah 1) status masih `pending` lebih dari beberapa menit, cek via
psql untuk debug (bukan langkah wajib):

```bash
docker compose exec postgres psql -U jalakarta -d jalakarta -c \
  "SELECT custom_domain, custom_domain_status, domain_last_check_error FROM public.tenants WHERE custom_domain = 'ikpmjogja.com';"
```

`domain_last_check_error` akan berisi pesan error DNS terakhir (mis. "A record: X (expected
72.61.215.7)") kalau memang belum resolve dengan benar. Force-update manual via `UPDATE ... SET
custom_domain_status = 'active'` hanya untuk situasi darurat/debug — bukan alur normal.

**Penting**: status `active` di DB hanya berarti DNS sudah benar — **tidak berarti HTTPS sudah
live**. Langkah 3–5 di atas (Certbot + Nginx) tetap wajib dilakukan manual terpisah, independen
dari status DB ini.

---

## Langkah 7 — Verifikasi

Test semua variasi URL (dari terminal VPS atau browser incognito):

```bash
# Semua harus return 301 atau 200
curl -I http://DOMAIN 2>/dev/null | grep -E "HTTP|Location"
curl -I http://www.DOMAIN 2>/dev/null | grep -E "HTTP|Location"
curl -I https://www.DOMAIN 2>/dev/null | grep -E "HTTP|Location"
curl -I https://DOMAIN 2>/dev/null | grep -E "HTTP|Location"
```

Hasil yang benar:

| URL | HTTP Status | Location |
|-----|-------------|----------|
| `http://DOMAIN` | 301 | `https://DOMAIN/` |
| `http://www.DOMAIN` | 301 | `https://DOMAIN/` |
| `https://www.DOMAIN` | 301 | `https://DOMAIN/` |
| `https://DOMAIN` | 200 | — |

---

## Troubleshooting

### Certbot gagal: "DNS problem: NXDOMAIN"
DNS belum propagasi. Tunggu 10–30 menit, ulangi Langkah 3.

### Certbot gagal: "Timeout during connect"
DNS sudah resolve tapi port 80 diblokir. Cek UFW:
```bash
sudo ufw status
# Pastikan port 80 dan 443 terbuka
sudo ufw allow 80
sudo ufw allow 443
```

### `nginx -t` error: "cannot load certificate"
Cert belum ada — jalankan Langkah 3 terlebih dahulu sebelum Langkah 4.

### Site tampil tapi resolvenya salah (dapat halaman tenant lain)
Pastikan `custom_domain_status = 'active'` di database (Langkah 6).
Cek via:
```bash
docker compose exec postgres psql -U jalakarta -d jalakarta -c \
  "SELECT slug, custom_domain, custom_domain_status FROM public.tenants WHERE custom_domain IS NOT NULL;"
```

### ERR_CONNECTION_TIMED_OUT dari browser tertentu
- Cek DNS sudah propagasi global: https://dnschecker.org → ketik domain
- Cek UFW tidak memblokir IP: `sudo ufw status verbose`
- Pastikan record DNS untuk `www` juga sudah dibuat (bukan hanya apex)

### URL `/slug/path` muncul di custom domain (seharusnya `/path` saja)
Middleware akan auto-redirect 301. Tapi cek `custom_domain_status = 'active'` di DB —
jika status masih `pending`, middleware tidak strip slug dari URL.

---

## Catatan Scalability

Saat ini setiap custom domain butuh:
1. Satu cert Certbot (manual)
2. Satu file nginx config (manual)

Untuk skala banyak tenant (>10 custom domain), pertimbangkan migrasi ke **Caddy** dengan
on-demand TLS — Caddy bisa auto-issue cert Let's Encrypt untuk domain baru tanpa perlu
SSH ke VPS. Detail di `docs/arsitektur-domain.md` § Fase D.
