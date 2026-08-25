# Panduan Deploy jalakarta ke VPS Hostinger

> **Naming convention penting:**  
> Repo GitHub dan folder server bernama **`jalajogja`** — ini nama internal yang tidak diubah.  
> Brand dan domain publik adalah **`jalakarta`** (`jalakarta.com`).  
> Jangan bingung: `/var/www/jalajogja` adalah folder server untuk website `jalakarta.com`.

> ⚠️ **KOREKSI PENTING (2026-08-25)**: dokumen ini ditulis di awal project saat rencananya
> aplikasi Next.js juga dijalankan via Docker Compose. **Keputusan itu berubah** — sekarang
> aplikasi (`app`) dijalankan via **PM2** (`next start` langsung di host VPS), BUKAN Docker.
> Docker Compose HANYA dipakai untuk **PostgreSQL dan MinIO** — bukan untuk `app`. Nama
> database/user PostgreSQL sungguhan juga **`jalakarta`** (bukan `jalajogja` seperti tertulis
> di beberapa contoh di bawah — sisa draft awal yang tidak pernah diupdate).
>
> **Bagian yang MASIH akurat** (dipakai apa adanya): Tahap 1 (hardening SSH/UFW), Tahap 2
> (Cloudflare DNS), Tahap 3.1-3.4 (install Docker/Nginx/Certbot), Tahap 5 (issue SSL Certbot),
> Tahap 6.1 (config Nginx) + 6.2 (setup bucket MinIO).
> **Bagian yang SALAH/USANG** (jangan diikuti — lihat koreksi inline di titik terkait di bawah):
> Tahap 4.3 ("Build dan jalankan container" untuk app), bagian "Update aplikasi" &
> "Restart service tertentu" di Maintenance, dan contoh nilai `jalajogja` di `.env.local`.
> Untuk alur deploy kode sehari-hari yang BENAR, lihat `CLAUDE.md` lesson
> `[2026-05] PM2 vs Docker — Pilih Satu, Jangan Keduanya`.

**Spesifikasi:** Ubuntu 24.04 LTS, VPS Hostinger, domain via Cloudflare  
**Stack:** Nginx (reverse proxy) + Docker Compose (PostgreSQL + MinIO saja) + PM2 (Next.js app) + Certbot (SSL)

---

## Daftar Isi

1. [Tahap 1 — Keamanan Awal VPS](#tahap-1--keamanan-awal-vps)
2. [Tahap 2 — Setup Cloudflare DNS](#tahap-2--setup-cloudflare-dns)
3. [Tahap 3 — Install Dependencies Server](#tahap-3--install-dependencies-server)
4. [Tahap 4 — Deploy Aplikasi](#tahap-4--deploy-aplikasi)
5. [Tahap 5 — SSL dengan Certbot](#tahap-5--ssl-dengan-certbot)
6. [Tahap 6 — Setup Nginx](#tahap-6--setup-nginx)
7. [Maintenance & Troubleshooting](#maintenance--troubleshooting)

---

## Tahap 1 — Keamanan Awal VPS

### 1.1 Login pertama sebagai root

Di terminal lokal kalian:

```bash
ssh root@IP_VPS_KALIAN
```

Saat pertama login, Hostinger biasanya kirim password root via email. Ganti dulu saat login pertama.

### 1.2 Buat user baru (jangan pakai root sehari-hari)

```bash
# Buat user baru — ganti "webane" dengan nama kalian
adduser webane

# Masukkan password untuk user ini
# Isi nama dll → Enter saja boleh

# Beri akses sudo
usermod -aG sudo webane

# Verifikasi
groups webane
# Output harus ada: webane : webane sudo
```

### 1.3 Setup SSH key (login tanpa password)

Di **terminal lokal** (bukan VPS), generate SSH key jika belum punya:

```bash
# Cek apakah sudah punya key
ls ~/.ssh/id_ed25519.pub

# Jika belum ada, buat baru
ssh-keygen -t ed25519 -C "webane@jalakarta.com"
# Enter terus untuk default

# Tampilkan public key — copy output ini
cat ~/.ssh/id_ed25519.pub
```

Kembali ke **terminal VPS** (masih sebagai root):

```bash
# Pindah ke user baru
su - webane

# Buat folder .ssh
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Paste public key dari langkah sebelumnya
nano ~/.ssh/authorized_keys
# Paste key, Ctrl+X → Y → Enter untuk save

chmod 600 ~/.ssh/authorized_keys
```

### 1.4 Test login dengan user baru

Buka **terminal baru** di lokal (jangan tutup terminal lama dulu!):

```bash
ssh webane@IP_VPS_KALIAN
# Harus bisa masuk tanpa password
```

Jika berhasil, lanjut ke langkah berikut.

### 1.5 Hardening SSH — nonaktifkan root login

Di terminal VPS sebagai **webane**:

```bash
sudo nano /etc/ssh/sshd_config
```

Cari dan ubah baris berikut (gunakan Ctrl+W untuk search di nano):

```
# Ubah ini:
PermitRootLogin yes
→ PermitRootLogin no

# Ubah ini:
#PasswordAuthentication yes
→ PasswordAuthentication no

# Pastikan ini ada dan yes:
PubkeyAuthentication yes
```

Simpan (Ctrl+X → Y → Enter), lalu restart SSH:

```bash
sudo systemctl restart sshd
```

> ⚠️ **PENTING**: Jangan tutup terminal yang sudah login sebelum memverifikasi bahwa kalian bisa login ulang dengan user baru!

### 1.6 Setup Firewall (UFW)

```bash
# Install UFW
sudo apt install -y ufw

# Default: tolak semua masuk, izinkan semua keluar
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Izinkan port yang dibutuhkan
sudo ufw allow ssh        # Port 22 — SSH
sudo ufw allow http       # Port 80 — HTTP
sudo ufw allow https      # Port 443 — HTTPS
sudo ufw allow 9001       # MinIO Console (opsional, bisa di-disable setelah setup)

# Aktifkan
sudo ufw enable
# Ketik y untuk konfirmasi

# Cek status
sudo ufw status verbose
```

---

## Tahap 2 — Setup Cloudflare DNS

### 2.1 Tambahkan domain ke Cloudflare

1. Buka [cloudflare.com](https://cloudflare.com) → Add a Site
2. Masukkan domain kalian (contoh: `jalakarta.com`)
3. Pilih plan Free
4. Cloudflare akan scan DNS existing — klik Continue
5. Ganti nameserver di registrar domain kalian ke nameserver Cloudflare
6. Tunggu propagasi (bisa 5 menit–48 jam)

### 2.2 Setup DNS Records di Cloudflare

Di Cloudflare dashboard → DNS → Records, tambahkan:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `@` | `IP_VPS_KALIAN` | ✅ Proxied | Auto |
| A | `*` | `IP_VPS_KALIAN` | ✅ Proxied | Auto |
| A | `minio` | `IP_VPS_KALIAN` | ❌ DNS only | Auto |

> **Kenapa `minio` tidak di-proxy?**  
> MinIO streaming file besar lebih baik langsung ke VPS — Cloudflare proxy bisa timeout untuk upload/download file besar.

### 2.3 SSL/TLS di Cloudflare

Cloudflare Dashboard → SSL/TLS → Overview:

- Set ke **"Full (Strict)"** → ini paling aman
- Jika belum punya SSL di VPS → set ke **"Full"** dulu, nanti ganti setelah Certbot jalan

### 2.4 Verifikasi DNS sudah mengarah ke VPS

```bash
# Di terminal lokal
nslookup jalakarta.com
# Harus menampilkan IP Cloudflare (bukan IP VPS langsung — karena proxied)

# Untuk minio (tidak proxied), harus langsung IP VPS
nslookup minio.jalakarta.com
```

---

## Tahap 3 — Install Dependencies Server

Login ke VPS sebagai **webane**:

### 3.1 Update sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nano unzip
```

### 3.2 Install Docker

```bash
# Install via script resmi Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Tambah user ke group docker (agar tidak perlu sudo tiap kali)
sudo usermod -aG docker $USER

# PENTING: logout dan login ulang agar group aktif
exit
# Login ulang via SSH
ssh webane@IP_VPS_KALIAN

# Verifikasi
docker --version
docker compose version
```

### 3.3 Install Nginx

```bash
sudo apt install -y nginx

# Jalankan dan enable auto-start
sudo systemctl enable nginx
sudo systemctl start nginx

# Verifikasi — buka http://IP_VPS_KALIAN di browser, harus muncul halaman default Nginx
sudo systemctl status nginx
```

### 3.4 Install Certbot (SSL Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Verifikasi
certbot --version
```

---

## Tahap 4 — Deploy Aplikasi

### 4.1 Clone repository

```bash
# Buat folder untuk app
sudo mkdir -p /var/www/jalajogja
sudo chown $USER:$USER /var/www/jalajogja

# Clone repo
cd /var/www/jalajogja
git clone https://github.com/USERNAME/jalajogja.git .
# Atau dari private repo:
# git clone git@github.com:USERNAME/jalajogja.git .
```

### 4.2 Setup environment variables

```bash
cd /var/www/jalajogja

# Buat .env.local dari template
cp .env.example .env.local
nano .env.local
```

Isi semua nilai di `.env.local`:

```env
# Database (nama DB/user PRODUCTION sungguhan: "jalakarta", bukan "jalajogja")
DATABASE_URL=postgresql://jalakarta:PASSWORD_DB_KUAT@localhost:5432/jalakarta

# Auth
BETTER_AUTH_SECRET=GENERATE_DENGAN_openssl_rand_-base64_32
BETTER_AUTH_URL=https://jalakarta.com
NEXT_PUBLIC_APP_URL=https://jalakarta.com

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minio_admin
MINIO_SECRET_KEY=PASSWORD_MINIO_KUAT
MINIO_PUBLIC_URL=https://minio.jalakarta.com

# Platform admin
PLATFORM_JWT_SECRET=GENERATE_DENGAN_openssl_rand_-base64_32

# RajaOngkir (opsional)
RAJAONGKIR_PLATFORM_KEY=API_KEY_RAJAONGKIR
RAJAONGKIR_PLATFORM_TIER=starter

# Playwright
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

Generate secret key:

```bash
# Jalankan ini dua kali — untuk BETTER_AUTH_SECRET dan PLATFORM_JWT_SECRET
openssl rand -base64 32
```

Juga buat `.env.local` di root untuk docker-compose (variabel postgres dan minio):

```bash
# Tambahkan ini ke .env.local (atau buat .env terpisah di root)
cat >> .env.local << 'EOF'

# Docker Compose vars — nama sungguhan "jalakarta", bukan "jalajogja"
POSTGRES_USER=jalakarta
POSTGRES_PASSWORD=PASSWORD_DB_KUAT_SAMA_DENGAN_DATABASE_URL
POSTGRES_DB=jalakarta
EOF
```

### 4.3 Jalankan PostgreSQL + MinIO via Docker (BUKAN app)

> ⚠️ **Koreksi (2026-08-25)**: `docker-compose.yml` di repo ini hanya mendefinisikan service
> `postgres` dan `minio` — **tidak ada service `app`**. Aplikasi Next.js dijalankan terpisah via
> PM2 langsung di host VPS (§ 4.6 di bawah), bukan sebagai container.

```bash
cd /var/www/jalajogja

# Jalankan PostgreSQL + MinIO
docker compose up -d

# Pantau progress (tekan Ctrl+C untuk keluar dari log, container tetap jalan)
docker compose logs -f
```

### 4.4 Jalankan migrasi database

Tunggu PostgreSQL sehat dulu (cek dengan `docker compose ps`), lalu:

```bash
# Install bun di VPS (kalau belum ada)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install dependencies
cd /var/www/jalajogja
bun install

# Jalankan migrasi public schema (drizzle-kit, sekali saat pertama deploy)
bun run db:migrate --filter=@jalajogja/db
```

> **Catatan**: Migrasi public schema (drizzle-kit) hanya perlu dijalankan SEKALI saat pertama
> deploy. Tenant schema dibuat otomatis oleh aplikasi saat tenant baru dibuat. Migrasi
> **berikutnya** (file bernomor di `packages/db/migrations/`) dijalankan manual via
> `docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/NNNN_*.sql`
> — **bukan** `drizzle-kit migrate` lagi (butuh input TTY interaktif, tidak jalan non-interaktif
> di VPS).

### 4.5 Verifikasi container Postgres + MinIO berjalan

```bash
docker compose ps

# Output yang diharapkan (HANYA 2 service, bukan 3):
# NAME        STATUS    PORTS
# postgres    Up        0.0.0.0:5432->5432/tcp
# minio       Up        0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
```

### 4.6 Build dan jalankan aplikasi Next.js via PM2 (bukan Docker)

```bash
cd /var/www/jalajogja

# Build production
bun run build --filter=@jalajogja/web

# Jalankan pertama kali via PM2 (ecosystem.config.cjs sudah ada di root repo)
pm2 start ecosystem.config.cjs
pm2 save   # persist agar auto-start setelah reboot VPS

# Verifikasi
pm2 status
pm2 logs jalajogja --lines 30
```

Untuk deploy KODE selanjutnya (bukan setup pertama kali), lihat "Update aplikasi" di
Maintenance & Troubleshooting di bawah — cukup `git pull` + build + `pm2 restart`, tidak perlu
ulangi langkah `pm2 start`.

---

## Tahap 5 — SSL dengan Certbot

### 5.1 Issue SSL untuk domain utama

```bash
# Pastikan nginx berjalan dan domain sudah mengarah ke VPS
sudo certbot --nginx -d jalakarta.com -d www.jalakarta.com

# Ikuti instruksi — masukkan email, setuju TOS
# Certbot otomatis update nginx config dengan SSL
```

### 5.2 Issue SSL untuk MinIO

```bash
sudo certbot --nginx -d minio.jalakarta.com
```

### 5.3 Test auto-renewal

```bash
sudo certbot renew --dry-run
# Harus output: Congratulations, all renewals succeeded
```

Certbot otomatis tambahkan cron job untuk renewal — tidak perlu setup manual.

---

## Tahap 6 — Setup Nginx

### 6.1 Buat config site

```bash
# Hapus default config
sudo rm /etc/nginx/sites-enabled/default

# Copy config dari repo
sudo cp /var/www/jalajogja/nginx.conf /etc/nginx/sites-available/jalakarta.com

# Update nama domain di config (ganti jalakarta.com dengan domain kalian jika berbeda)
sudo nano /etc/nginx/sites-available/jalakarta.com

# Aktifkan site
sudo ln -s /etc/nginx/sites-available/jalakarta.com /etc/nginx/sites-enabled/

# Test config — tidak boleh ada error
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 6.2 Setup MinIO bucket

Buka **MinIO Console** di browser: `http://IP_VPS_KALIAN:9001`

Login dengan `MINIO_ACCESS_KEY` dan `MINIO_SECRET_KEY` dari `.env.local`.

1. **Buat bucket**: Buckets → Create Bucket  
   - Nama: `tenant-pc-ikpm-jogjakarta` (sesuaikan slug tenant pertama)
   - Access Policy: Private (biarkan default)

2. **Buat bucket public** untuk akses gambar langsung (opsional — jika tidak pakai signed URL):
   - Pilih bucket → Access Policy → Set ke `public`
   
3. Setelah selesai setup, **close port 9001** di firewall jika tidak diperlukan terus:
   ```bash
   sudo ufw delete allow 9001
   ```

### 6.3 Verifikasi end-to-end

```bash
# Test app bisa diakses
curl -I https://jalakarta.com
# Harus return HTTP 200 atau 307/308

# Test MinIO
curl -I https://minio.jalakarta.com
# Harus return HTTP 200
```

---

## Maintenance & Troubleshooting

### Update aplikasi

> Aplikasi (Next.js) dijalankan via PM2, **bukan** Docker — lihat § 4.6. PostgreSQL + MinIO
> tetap Docker dan biasanya tidak perlu di-restart untuk update kode.

```bash
cd /var/www/jalajogja
git pull

# Jika ada migration baru:
docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/NNNN_nama.sql

bun install                                 # jika ada dependency baru
bun run build --filter=@jalajogja/web       # build production
pm2 restart jalajogja --update-env          # restart aplikasi
pm2 logs jalajogja --lines 30               # cek tidak ada error
```

### Lihat logs

```bash
# Aplikasi (PM2)
pm2 logs jalajogja
pm2 logs jalajogja --lines 100

# PostgreSQL + MinIO (Docker)
docker compose logs -f postgres
docker compose logs -f minio
```

### Restart service tertentu

```bash
pm2 restart jalajogja           # aplikasi
docker compose restart postgres # database
docker compose restart minio    # storage
```

### Backup — otomatis (Postgres + MinIO ke Google Drive)

> Sejak 2026-08, backup harian sudah berjalan otomatis via crontab OS-level —
> **tidak perlu dijalankan manual** kecuali untuk backup ad-hoc sebelum migrasi
> berisiko. Lihat `scripts/backup-db.sh` (kepala file berisi penjelasan lengkap
> kenapa whole-database dump format `-Fc`, bukan per-tenant, dan kenapa MinIO
> di-backup lewat `mc mirror` bukan raw copy volume Docker).

```bash
# Jalankan manual (mis. backup ad-hoc sebelum migrasi):
BACKUP_DIR=~/backups/jalajogja ./scripts/backup-db.sh

# Restore — DESTRUKTIF, selalu manual dengan konfirmasi ketik ulang nama DB.
# Lihat komentar di kepala scripts/restore-db.sh untuk cara restore SATU
# tenant saja (tanpa menimpa tenant lain) memakai format dump -Fc yang sama.
BACKUP_DIR=~/backups/jalajogja ./scripts/restore-db.sh
BACKUP_DIR=~/backups/jalajogja ./scripts/restore-db.sh --from-remote   # ambil dulu dari Drive

# Jadwal cron (sudah terpasang di VPS produksi, jam 2 pagi tiap hari):
0 2 * * * BACKUP_DIR=/home/webane/backups/jalajogja /var/www/jalajogja/scripts/backup-db.sh >> /var/log/jalajogja-backup.log 2>&1
```

Setup sekali sebelum dipakai (rclone remote `gdrive:` + `mc` alias `jalajogja-minio`
+ `POSTGRES_PASSWORD` dari `.env`) — lihat komentar kepala `scripts/backup-db.sh`.
Retensi default 30 hari, lokal maupun di Google Drive (`gdrive:backup-app/jalakarta/`).

> **Catatan default `BACKUP_DIR`**: script default-nya `/var/backups/jalajogja`,
> yang butuh akses root untuk dibuat. User VPS non-root (`webane`) WAJIB override
> ke path di home directory (`~/backups/jalajogja`) seperti contoh di atas —
> jangan andalkan default-nya begitu saja di VPS ini.

### Cek disk usage

```bash
df -h
docker system df  # Lihat berapa storage yang dipakai Docker
```

### Bersihkan Docker build cache (jika disk hampir penuh)

```bash
docker system prune -f
docker builder prune -f
```

### Firewall cheatsheet

```bash
sudo ufw status verbose    # Lihat semua aturan
sudo ufw allow PORT        # Buka port
sudo ufw delete allow PORT # Tutup port
```

---

## Checklist Pre-Launch

- [ ] VPS user non-root sudah dibuat dan SSH key sudah setup
- [ ] Root login via SSH sudah dinonaktifkan
- [ ] UFW aktif, hanya port 22/80/443 yang terbuka
- [ ] Cloudflare DNS mengarah ke VPS
- [ ] SSL Certbot aktif untuk jalakarta.com dan minio.jalakarta.com
- [ ] Container `postgres` + `minio` running (`docker compose ps` semua "Up" — HANYA 2 service)
- [ ] Aplikasi jalan via PM2 (`pm2 status` menampilkan `jalajogja` status "online")
- [ ] Migrasi public schema (drizzle-kit) sudah jalan 0 error
- [ ] MinIO bucket sudah dibuat
- [ ] Test register tenant pertama berhasil
- [ ] Test upload gambar berhasil (muncul di browser)
- [ ] Test generate PDF berhasil (Playwright + Chromium)
- [ ] `.env.local` tidak ada di git (`git status` tidak tampilkan file ini)
