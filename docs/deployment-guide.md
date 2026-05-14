# Panduan Deploy jalakarta ke VPS Hostinger

> **Naming convention penting:**  
> Repo GitHub dan folder server bernama **`jalajogja`** — ini nama internal yang tidak diubah.  
> Brand dan domain publik adalah **`jalakarta`** (`jalakarta.com`).  
> Jangan bingung: `/var/www/jalajogja` adalah folder server untuk website `jalakarta.com`.

**Spesifikasi:** Ubuntu 24.04 LTS, VPS Hostinger, domain via Cloudflare  
**Stack:** Nginx (reverse proxy) + Docker Compose (PostgreSQL + MinIO + Next.js) + Certbot (SSL)

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
# Database
DATABASE_URL=postgresql://jalajogja:PASSWORD_DB_KUAT@postgres:5432/jalajogja

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

# Docker Compose vars
POSTGRES_USER=jalajogja
POSTGRES_PASSWORD=PASSWORD_DB_KUAT_SAMA_DENGAN_DATABASE_URL
POSTGRES_DB=jalajogja
EOF
```

### 4.3 Build dan jalankan container

```bash
cd /var/www/jalajogja

# Build image dan jalankan semua service
docker compose up -d --build

# Pantau progress build (tekan Ctrl+C untuk keluar dari log, container tetap jalan)
docker compose logs -f
```

Build pertama akan lama (5-15 menit) karena download image dan install Chromium.

### 4.4 Jalankan migrasi database

Tunggu PostgreSQL sehat dulu (cek dengan `docker compose ps`), lalu:

```bash
# Install bun di VPS untuk jalankan migrasi
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install dependencies
cd /var/www/jalajogja
bun install

# Jalankan migrasi public schema
bun run db:migrate --filter=@jalajogja/db
```

> **Catatan**: Migrasi public schema (drizzle-kit) hanya perlu dijalankan SEKALI saat pertama deploy. Tenant schema dibuat otomatis oleh aplikasi saat tenant baru dibuat.

### 4.5 Verifikasi container berjalan

```bash
docker compose ps

# Output yang diharapkan:
# NAME        STATUS    PORTS
# postgres    Up        0.0.0.0:5432->5432/tcp
# minio       Up        0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
# app         Up        0.0.0.0:3000->3000/tcp
```

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

```bash
cd /var/www/jalajogja
git pull

# Rebuild dan restart app (PostgreSQL + MinIO tidak perlu restart)
docker compose up -d --build app
```

### Lihat logs

```bash
# Semua service
docker compose logs -f

# Hanya app
docker compose logs -f app

# Hanya postgres
docker compose logs -f postgres
```

### Restart service tertentu

```bash
docker compose restart app
docker compose restart postgres
docker compose restart minio
```

### Backup database

```bash
# Dump database
docker compose exec postgres pg_dump -U jalajogja jalajogja > backup_$(date +%Y%m%d).sql

# Restore (jika perlu)
docker compose exec -T postgres psql -U jalajogja jalajogja < backup_20260515.sql
```

### Backup MinIO data

```bash
# Data MinIO ada di Docker volume
# Untuk backup, copy dari volume ke host
docker run --rm -v jalajogja_minio_data:/data -v $(pwd):/backup ubuntu \
  tar czf /backup/minio_backup_$(date +%Y%m%d).tar.gz /data
```

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
- [ ] Semua container running (`docker compose ps` semua "Up")
- [ ] Migrasi DB sudah jalan (`drizzle-kit migrate` 0 errors)
- [ ] MinIO bucket sudah dibuat
- [ ] Test register tenant pertama berhasil
- [ ] Test upload gambar berhasil (muncul di browser)
- [ ] Test generate PDF berhasil (Playwright + Chromium)
- [ ] `.env.local` tidak ada di git (`git status` tidak tampilkan file ini)
