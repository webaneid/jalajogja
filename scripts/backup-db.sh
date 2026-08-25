#!/bin/bash
# Backup harian PostgreSQL (via Docker) + MinIO ke Google Drive (via rclone).
#
# Diadaptasi dari template yang sudah terbukti jalan di production (Webane
# Admin, lihat master-typescript/docs/SOP-backup-template.md) — TAPI dua hal
# disesuaikan khusus untuk arsitektur jalajogja:
#
#   1. Postgres jalan DI DALAM Docker (bukan native di VPS host) — dump lewat
#      `docker compose exec`, bukan `pg_dump` host-level. Ini konsisten
#      dengan cara migrasi DB di project ini selama ini (lihat
#      docs/panduan-deploy-vps.md dan CLAUDE.md: "Migrasi DB di VPS wajib
#      pakai docker compose exec -T postgres psql, bukan psql langsung —
#      tidak terinstall di host").
#   2. Format dump `-Fc` (custom, terkompresi native) — BUKAN plain SQL +
#      gzip. Alasan: schema-per-tenant (satu database `jalakarta` berisi
#      schema `public` + satu `tenant_{slug}` per tenant) — backup HARUS
#      whole-database dalam SATU pg_dump supaya snapshot-nya konsisten
#      lintas schema (FK cross-schema: tenant.users.member_id ->
#      public.members, dst — dump terpisah per tenant + per public schema
#      punya titik waktu snapshot berbeda-beda, berisiko inkonsisten saat
#      direstore). Format -Fc TETAP mengizinkan restore SATU tenant saja
#      dari file yang sama nanti kalau perlu:
#        pg_restore --schema=tenant_visikita -d db_scratch backup.dump
#      — jadi "backup per tenant vs whole database" bukan trade-off yang
#      harus dipilih di muka; whole-DB dump + -Fc memberi keduanya.
#
# MinIO di-backup terpisah lewat `mc mirror` (object-level, bukan raw copy
# volume Docker — raw copy berisiko korup kalau ada write bersamaan saat
# backup jalan). jalajogja menyimpan banyak data penting di MinIO (foto
# anggota, cover usaha/pesantren, lampiran surat, sertifikat event, dst) —
# ini BUKAN opsional untuk project ini.
#
# Dijadwalkan lewat crontab OS-level (BUKAN cron aplikasi) — supaya backup
# tetap jalan walau aplikasi crash. Semua nilai boleh dioverride via env var
# (lihat DEFAULT di bawah) — default di sini SUDAH nilai production
# jalajogja sebenarnya (DB `jalakarta`/`jalakarta`, bukan generic template),
# jadi bisa langsung dipakai tanpa override kalau dijalankan dari VPS.
#
# Setup SEKALI sebelum dipakai (detail lengkap ->
# master-typescript/docs/SOP-backup-template.md, langkah rclone/mc identik):
#   1. rclone remote "gdrive" sudah dikonfigurasi + config di-copy ke VPS
#      (~/.config/rclone/rclone.conf) — kalau VPS ini sudah pernah dipakai
#      backup project lain, config mungkin sudah ada, skip.
#   2. mc (MinIO client) terinstall di VPS + alias "jalajogja-minio" diset:
#        mc alias set jalajogja-minio http://localhost:9000 \
#          "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
#   3. Password Postgres tersedia lewat env POSTGRES_PASSWORD (script ini
#      auto-source .env repo kalau env var belum diset manual).
#   4. Jadwalkan cron (contoh, jam 2 pagi tiap hari):
#        0 2 * * * /var/www/jalajogja/scripts/backup-db.sh >> /var/log/jalajogja-backup.log 2>&1

set -euo pipefail

# ── Konfigurasi (override via env var, JANGAN edit default di sini) ────────
PROJECT_NAME="${PROJECT_NAME:-jalakarta}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jalajogja}"
REMOTE="${RCLONE_REMOTE:-gdrive:backup-app/${PROJECT_NAME}}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

DB_NAME="${DB_NAME:-jalakarta}"
DB_USER="${DB_USER:-jalakarta}"
COMPOSE_DIR="${COMPOSE_DIR:-/var/www/jalajogja}"

MC_ALIAS="${MC_ALIAS:-jalajogja-minio}"
MINIO_BUCKETS="${MINIO_BUCKETS:-}"   # kosong = auto-discover semua bucket via `mc ls`

TIMESTAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

# ── Password Postgres: pakai POSTGRES_PASSWORD dari env kalau sudah ada,
#    kalau belum, coba source dari .env di COMPOSE_DIR (symlink ke
#    .env.local, sesuai konvensi project ini). ──────────────────────────────
if [[ -z "${POSTGRES_PASSWORD:-}" && -f "${COMPOSE_DIR}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; source "${COMPOSE_DIR}/.env"; set +a
fi
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD tidak diset dan tidak ditemukan di ${COMPOSE_DIR}/.env}"

# ── 1. Backup PostgreSQL — whole database, custom format ───────────────────
DB_FILENAME="${DB_NAME}_${TIMESTAMP}.dump"
echo "[$(date)] Mulai backup database ${DB_NAME} (whole-DB, format custom) -> ${BACKUP_DIR}/${DB_FILENAME}"

(
  cd "$COMPOSE_DIR"
  docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc
) > "${BACKUP_DIR}/${DB_FILENAME}"

echo "[$(date)] Dump Postgres selesai ($(du -h "${BACKUP_DIR}/${DB_FILENAME}" | cut -f1))"

echo "[$(date)] Upload dump Postgres ke ${REMOTE}/postgres/"
rclone copy "${BACKUP_DIR}/${DB_FILENAME}" "${REMOTE}/postgres/"

# ── 2. Backup MinIO — mirror object-level (bukan raw copy volume) ──────────
if command -v mc >/dev/null 2>&1; then
  MC_STAGE_DIR="${BACKUP_DIR}/minio_${TIMESTAMP}"
  mkdir -p "$MC_STAGE_DIR"

  if [[ -z "$MINIO_BUCKETS" ]]; then
    MINIO_BUCKETS=$(mc ls "${MC_ALIAS}" --json 2>/dev/null | grep -o '"key":"[^"]*/"' | sed 's/"key":"//;s#/"$##' || true)
  fi

  if [[ -z "$MINIO_BUCKETS" ]]; then
    echo "[$(date)] PERINGATAN: tidak ada bucket MinIO terdeteksi via alias '${MC_ALIAS}' — dilewati." >&2
  else
    for bucket in $MINIO_BUCKETS; do
      echo "[$(date)] Mirror bucket MinIO: ${bucket}"
      mc mirror --quiet "${MC_ALIAS}/${bucket}" "${MC_STAGE_DIR}/${bucket}"
    done

    MINIO_ARCHIVE="minio_${TIMESTAMP}.tar.gz"
    tar czf "${BACKUP_DIR}/${MINIO_ARCHIVE}" -C "$MC_STAGE_DIR" .
    rm -rf "$MC_STAGE_DIR"
    echo "[$(date)] Arsip MinIO selesai ($(du -h "${BACKUP_DIR}/${MINIO_ARCHIVE}" | cut -f1))"

    echo "[$(date)] Upload arsip MinIO ke ${REMOTE}/minio/"
    rclone copy "${BACKUP_DIR}/${MINIO_ARCHIVE}" "${REMOTE}/minio/"
  fi
else
  echo "[$(date)] PERINGATAN: 'mc' (MinIO client) tidak terinstall — backup MinIO dilewati." >&2
  echo "[$(date)] Install: https://min.io/docs/minio/linux/reference/minio-mc.html" >&2
fi

# ── 3. Retensi — hapus backup lokal & remote yang lebih tua dari N hari ────
echo "[$(date)] Bersihkan backup lokal & remote yang lebih tua dari ${RETENTION_DAYS} hari"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${DB_NAME}_*.dump" -o -name "minio_*.tar.gz" \) -mtime +"$RETENTION_DAYS" -delete
rclone delete --min-age "${RETENTION_DAYS}d" "${REMOTE}/postgres/" || true
rclone delete --min-age "${RETENTION_DAYS}d" "${REMOTE}/minio/" || true

echo "[$(date)] Backup selesai: ${DB_FILENAME}"
