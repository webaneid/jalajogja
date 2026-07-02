# Arsitektur GOWA Self-Hosted — jalajogja

> Dokumen ini membahas **infrastruktur dan deployment** GOWA di VPS jalajogja.
> Untuk arsitektur notifikasi, template, OTP, dan integrasi modul → lihat `docs/arsitektur-whatsapp.md`.

---

## 1. Latar Belakang

GOWA ([go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice))
sebelumnya di-hosting di **Sumopod** (layanan pihak ketiga). Per 2026-06-30, Sumopod menutup layanan
untuk workload ini. Solusi: pindah ke **VPS jalajogja sendiri** (72.61.215.7).

**Kenapa tidak ganti ke SaaS lain (Fonnte, WAblas, dll)?**
- Kode sudah terikat ke GOWA API — ganti provider = ganti `lib/whatsapp.ts` + semua endpoint
- GOWA gratis dan open-source — tidak ada biaya per-pesan
- VPS sudah ada Docker — menambah satu service Docker sangat minim effort
- GOWA (Go binary, tanpa browser) hemat RAM: ~50–100MB vs Fonnte/WAblas yang berbasis Node + Chromium

---

## 2. Dua Level yang Berbeda

Penting dipahami: ada **dua level** yang berbeda dalam sistem ini.

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1 — PLATFORM (jalakarta team / Webane)               │
│                                                             │
│  Tanggung jawab:                                            │
│  • Jalankan & maintain service GOWA di Docker               │
│  • Set env vars: WHATSAPP_SERVICE_URL, _API_USER, _API_PASS │
│  • Monitor uptime GOWA                                      │
│  • GOWA adalah infrastruktur platform — bukan fitur tenant  │
│                                                             │
│  Lokasi config: .env.local VPS + docker-compose.yml         │
└─────────────────────────────────────────────────────────────┘
                          │ satu instance GOWA
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 2 — TENANT (admin organisasi masing-masing)          │
│                                                             │
│  Tanggung jawab:                                            │
│  • Scan QR untuk daftarkan nomor WA organisasi mereka       │
│  • Pilih toggle notifikasi mana yang aktif                  │
│  • Putus/sambung koneksi WA kapan saja                      │
│                                                             │
│  Lokasi config: tenant_{slug}.settings (group="notif")      │
│  UI: /app/{slug}/settings/notifications                     │
│                                                             │
│  Contoh:                                                    │
│  • IKPM Jogja  → device_id: "pc-ikpm-jogjakarta"            │
│  • IKPM Jakarta → device_id: "ikpm-jakarta"                 │
│  • IKPM Surabaya → device_id: "ikpm-surabaya"               │
└─────────────────────────────────────────────────────────────┘
```

**Isolasi antar tenant**: GOWA menyimpan session per `device_id`. Tenant A tidak bisa kirim
pesan via device tenant B — setiap request spesifikasi `X-Device-Id` header.

---

## 3. Topologi Lengkap

```
Internet
    │
    ▼
Nginx (port 443)
    ├── jalakarta.com/*          → PM2 Next.js (port 3000)
    ├── minio.jalakarta.com      → MinIO S3 API (port 9000)
    └── gowa.jalakarta.com       → GOWA Docker (port 3002)  ← BARU
         └── Basic Auth protected (WHATSAPP_API_USER:PASS)

Docker Compose (di VPS yang sama)
    ├── postgres  (port 5432)
    ├── minio     (port 9000, 9001)
    └── gowa      (port 3002:3000)  ← BARU

PM2
    └── jalajogja (Next.js, port 3000)
         └── lib/whatsapp.ts → fetch ke http://localhost:3002 (GOWA)
```

**Kenapa GOWA perlu subdomain?**
QR code yang ditampilkan di UI admin adalah `<img src="{gowaUrl}/path/to/qr.png">`.
Browser perlu akses langsung ke URL tersebut untuk render gambar QR. Karena itu GOWA perlu
bisa diakses dari internet (via subdomain + Basic Auth), bukan hanya dari server.

---

## 4. Docker Compose — Tambah Service GOWA

Update `docker-compose.yml` di root repo:

```yaml
services:
  # ── PostgreSQL ───────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    # ... (tidak berubah)

  # ── MinIO ────────────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    # ... (tidak berubah)

  # ── GOWA — WhatsApp Gateway ───────────────────────────────────────────────── ← BARU
  gowa:
    image: aldinokemal2104/go-whatsapp-web-multidevice:latest
    restart: unless-stopped
    ports:
      - "3002:3000"          # host:container — port 3002 di host agar tidak clash dengan Next.js (3000)
    volumes:
      - gowa_data:/app/storages   # session WA tersimpan permanen di sini
    environment:
      - BASIC_AUTH_CREDENTIAL=${WHATSAPP_API_USER}:${WHATSAPP_API_PASS}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  minio_data:
  gowa_data:    # ← BARU — jangan lupa tambah ini
```

**Catatan port:**
- GOWA listen di container port `3000`
- Di-map ke host port `3002` (agar tidak bentrok dengan Next.js yang juga port `3000`)
- PM2 Next.js → GOWA: `http://localhost:3002`
- Nginx → forward `gowa.jalakarta.com` → `localhost:3002`

---

## 5. Nginx Config — Subdomain GOWA

Tambah server block baru di Nginx (`/etc/nginx/sites-available/gowa.jalakarta.com`):

```nginx
server {
    server_name gowa.jalakarta.com;

    # Proxy ke Docker container GOWA
    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 300s;   # scanning QR butuh waktu

        # Rate limiting — hanya butuh dari browser admin, bukan traffic tinggi
        limit_req          zone=api burst=20 nodelay;
    }

    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/gowa.jalakarta.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gowa.jalakarta.com/privkey.pem;
}

server {
    listen 80;
    server_name gowa.jalakarta.com;
    return 301 https://$host$request_uri;
}
```

**Setup SSL:**
```bash
certbot --nginx -d gowa.jalakarta.com
```

**PENTING — Keamanan GOWA:**
GOWA sudah dilindungi Basic Auth (`BASIC_AUTH_CREDENTIAL`). Nginx menambah layer kedua via HTTPS.
Jangan pernah expose GOWA tanpa keduanya.

---

## 6. Environment Variables

### Di `.env.local` VPS (dibaca PM2 Next.js)

```env
# WhatsApp Gateway — GOWA Self-Hosted
WHATSAPP_SERVICE_URL=https://gowa.jalakarta.com
WHATSAPP_API_USER=jalajogja
WHATSAPP_API_PASS=GANTI_DENGAN_PASSWORD_KUAT_MINIMAL_32_CHAR
```

### Di `.env` (alias `.env.local`, dibaca Docker Compose untuk service GOWA)

```env
# Variabel yang sama — Docker Compose baca dari sini untuk inject ke container GOWA
WHATSAPP_API_USER=jalajogja
WHATSAPP_API_PASS=GANTI_DENGAN_PASSWORD_KUAT_MINIMAL_32_CHAR
```

**Mengapa `WHATSAPP_SERVICE_URL` pakai subdomain bukan `localhost:3002`?**
Karena QR image URL dikembalikan ke browser admin (bukan ke server). Browser tidak bisa
akses `localhost:3002` — harus pakai URL publik. Lihat penjelasan detail di § 8.

---

## 7. Multi-Device: Satu GOWA, Banyak Tenant

GOWA menyimpan sesi per `device_id`. Setiap tenant punya `device_id = slug` unik.

**Alur pendaftaran device baru (tenant):**

```
Admin buka /app/{slug}/settings/notifications
    │
    ▼
Klik "Hubungkan WhatsApp"
    │
    ▼  connectWhatsAppAction(slug)
    │  POST /devices { device_id: slug }  → GOWA
    │  (HTTP 409 jika sudah ada → ok, lanjut)
    │  Simpan config awal ke tenant.settings
    │
    ▼
Klik "Scan QR"
    │
    ▼  GET /api/wa/qr?slug=
    │  GET /devices/{slug}/login  → GOWA
    │  Return { qrLink }  → browser render <img src={qrLink}>
    │
    ▼  Admin scan QR dengan HP nomor WA organisasi
    │
    ▼  Frontend polling GET /api/wa/status?slug= tiap 3 detik
    │  GET /devices/{slug}/status  → GOWA
    │  is_logged_in: true?
    │
    ▼  confirmWaConnectionAction(slug, phoneNumber)
       UPDATE tenant.settings → whatsapp_config.verified = true
```

**Cara pengiriman pesan per-tenant:**

```typescript
// lib/whatsapp.ts — sendWaNotification()
// Setiap request ke GOWA sertakan X-Device-Id = slug tenant
headers: {
  "Authorization": `Basic ${base64(user:pass)}`,
  "X-Device-Id":   config.device_id,   // "pc-ikpm-jogjakarta"
}
// GOWA routing: device_id menentukan nomor WA pengirim
```

**Kapasitas RAM per tenant aktif:**
- Base GOWA process: ~50MB
- Per device/tenant (WhatsApp WebSocket connection): ~10–30MB
- 10 tenant: ~150–350MB total
- 50 tenant: ~550MB–1.5GB → perlu upgrade RAM VPS jika sampai skala ini

---

## 8. Catatan Teknis: QR Image dan Subdomain

**Masalah:**
GOWA mengembalikan QR image sebagai URL, misal `/app/login/pc-ikpm-jogjakarta.png`.
Route `/api/wa/qr` sudah handle URL relatif/localhost dengan menggantikan ke `baseUrl`:

```typescript
// apps/web/app/api/wa/qr/route.ts
if (qrLink.startsWith("/") || qrLink.includes("localhost")) {
  const path = qrLink.startsWith("/") ? qrLink : new URL(qrLink).pathname;
  qrLink = `${baseUrl}${path}`;   // baseUrl = WHATSAPP_SERVICE_URL
}
```

Hasilnya: `qrLink = "https://gowa.jalakarta.com/app/login/pc-ikpm-jogjakarta.png"`

Browser admin kemudian load gambar ini langsung. Itulah kenapa GOWA harus punya subdomain publik.

**Alternatif lebih aman (future improvement): backend QR proxy**
Jika tidak ingin GOWA exposed ke internet sama sekali, ubah `/api/wa/qr` agar:
1. Fetch QR image dari GOWA secara server-side (`http://localhost:3002/...`)
2. Return ke client sebagai base64 (`data:image/png;base64,...`)
3. GOWA tidak perlu exposed, `WHATSAPP_SERVICE_URL=http://localhost:3002`

Ini lebih secure tapi butuh perubahan kode. Untuk sekarang, subdomain + Basic Auth sudah cukup.

---

## 9. Langkah Setup Awal di VPS

```bash
# 1. Update docker-compose.yml (sudah dijelaskan di § 4)

# 2. Tambah env vars ke .env.local
echo "WHATSAPP_API_USER=jalajogja" >> /var/www/jalajogja/.env.local
echo "WHATSAPP_API_PASS=$(openssl rand -base64 32)" >> /var/www/jalajogja/.env.local
echo "WHATSAPP_SERVICE_URL=https://gowa.jalakarta.com" >> /var/www/jalajogja/.env.local

# 3. Start GOWA container
cd /var/www/jalajogja
docker compose up -d gowa

# 4. Verifikasi GOWA berjalan
docker compose ps gowa
curl -u jalajogja:PASSWORD http://localhost:3002/health

# 5. Setup Nginx + SSL untuk subdomain
# Buat file /etc/nginx/sites-available/gowa.jalakarta.com (lihat § 5)
ln -s /etc/nginx/sites-available/gowa.jalakarta.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d gowa.jalakarta.com

# 6. Restart Next.js agar baca env vars baru
pm2 restart jalajogja --update-env

# 7. Test dari browser: buka /app/{slug}/settings/notifications → Hubungkan WhatsApp
```

---

## 10. Monitoring & Maintenance

### Cek status GOWA

```bash
# Status container
docker compose ps gowa

# Log real-time
docker compose logs -f gowa

# Berapa device terdaftar
curl -u USER:PASS https://gowa.jalakarta.com/devices | jq '.results | length'

# Status per device
curl -u USER:PASS https://gowa.jalakarta.com/devices/pc-ikpm-jogjakarta/status
```

### Jika GOWA restart

Sesi WhatsApp **tersimpan di volume** `gowa_data` — tidak perlu scan QR ulang setelah restart.
GOWA akan reconnect otomatis ke WhatsApp saat container start ulang.

### Update GOWA versi baru

```bash
docker compose pull gowa
docker compose up -d gowa
# Sesi tidak hilang karena ada di volume
```

### Backup sesi

```bash
# Backup volume GOWA (penting! berisi sesi WA semua tenant)
docker run --rm \
  -v jalajogja_gowa_data:/source \
  -v /backup:/backup \
  alpine tar czf /backup/gowa-$(date +%Y%m%d).tar.gz -C /source .
```

---

## 11. Platform Admin — Apa yang Perlu Dipantau

Platform jalakarta tidak perlu UI khusus untuk manage GOWA — ini adalah infrastruktur level ops,
bukan fitur yang bisa dikonfigurasi via dashboard. Yang perlu Webane pantau:

| Hal | Cara cek | Frekuensi |
|-----|----------|-----------|
| GOWA container up | `docker compose ps` | Otomatis (restart: unless-stopped) |
| Disk usage `/var/lib/docker/volumes/jalajogja_gowa_data` | `df -h` | Mingguan |
| RAM total VPS | `free -h` | Jika ada keluhan performa |
| GOWA version | `docker compose images gowa` | Bulanan — update jika ada breaking change WA |
| SSL gowa.jalakarta.com | Certbot auto-renew | Otomatis |

**Indikator ada masalah:**
- Tenant lapor "tidak bisa scan QR" → GOWA down atau SSL expire
- Tenant lapor "notif tidak terkirim" → cek `docker compose logs gowa`, cek session masih aktif
- Nomor WA kena ban WhatsApp → GOWA tidak bisa dipakai lagi untuk device tersebut, tenant harus scan ulang dengan nomor lain

---

## 12. Keputusan Arsitektur yang Dikunci

1. **GOWA = infrastruktur platform** — bukan fitur tenant. Webane yang maintain, tenant tinggal pakai.
2. **Satu instance GOWA untuk semua tenant** — via `device_id = slug`. Tidak perlu instance terpisah per tenant.
3. **Port 3002 di host** — bukan 3000 (konflik Next.js). Internal Docker: 3000.
4. **Subdomain gowa.jalakarta.com** — karena browser admin perlu akses QR image langsung.
5. **Basic Auth di GOWA** — credential di ENV, tidak pernah hardcode di kode.
6. **Volume `gowa_data`** — sesi WA persisten, tidak hilang saat container restart.
7. **`device_id = slug`** — predictable, tidak perlu disimpan di DB terpisah, sudah unik per tenant.
8. **PM2 → GOWA via `http://localhost:3002`** — Next.js jalan di PM2, tidak di Docker, jadi pakai localhost + port yang di-expose.

---

## 13. Perbandingan: Sumopod vs Self-Hosted

| Aspek | Sumopod (lama) | Self-Hosted VPS (baru) |
|-------|----------------|------------------------|
| Biaya | Rp 15–85k/bln | Rp 0 (VPS sudah ada) |
| Latency | ~Jakarta DC | ~0ms (same machine) |
| Kontrol | Terbatas | Penuh |
| Uptime | Bergantung Sumopod | Bergantung VPS |
| Maintenance | Tidak ada | Minimal (restart: unless-stopped) |
| Multi-device | Ya (via device_id) | Ya (sama) |
| Setup | Lebih mudah | Perlu setup Nginx + SSL |

---

## 14. Koneksi ke File Lain

- `docker-compose.yml` — definisi service GOWA
- `docs/arsitektur-whatsapp.md` — notifikasi, template, OTP, peta event
- `lib/whatsapp.ts` — helper pengiriman + env var reader
- `apps/web/app/api/wa/qr/route.ts` — proxy QR dari GOWA ke admin
- `apps/web/app/api/wa/status/route.ts` — polling status device
- `apps/web/app/(dashboard)/app/[tenant]/settings/actions.ts` — `connectWhatsAppAction`, `confirmWaConnectionAction`, `disconnectWhatsAppAction`
- `apps/web/components/settings/whatsapp-setup-client.tsx` — UI tenant setup
