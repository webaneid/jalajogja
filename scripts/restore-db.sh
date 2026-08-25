#!/bin/bash
# Restore database PostgreSQL jalajogja dari backup — OPERASI DESTRUKTIF.
# Tidak pernah dijalankan otomatis/cron — selalu manual, dengan konfirmasi.
# Pasangan dari scripts/backup-db.sh — lihat file itu untuk konteks kenapa
# format dump-nya custom (-Fc) dan kenapa selalu whole-database.
#
# Pemakaian:
#   ./scripts/restore-db.sh                        # pakai backup lokal TERBARU
#   ./scripts/restore-db.sh jalakarta_2026-08-25_0200.dump   # pilih file spesifik
#   ./scripts/restore-db.sh --from-remote           # download dulu dari gdrive, lalu restore terbaru
#
# Restore SATU tenant saja (tanpa menimpa tenant lain) — karena format dump
# custom (-Fc), ini bisa dilakukan TANPA restore penuh:
#   docker compose exec -T postgres pg_restore -U jalakarta -d jalakarta \
#     --schema=tenant_visikita --clean --if-exists < backup.dump
# (pastikan public schema di database tujuan sudah konsisten — kalau restore
# tenant tunggal ke database yang BEDA dari sumber dump, public.members dkk
# yang direferensikan tenant itu tidak ikut, jadi FK bisa longgar. Untuk
# investigasi/copy data satu tenant, restore ke database scratch terpisah
# dulu, baru extract apa yang dibutuhkan.)

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-jalakarta}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jalajogja}"
REMOTE="${RCLONE_REMOTE:-gdrive:backup-app/${PROJECT_NAME}}"

DB_NAME="${DB_NAME:-jalakarta}"
DB_USER="${DB_USER:-jalakarta}"
COMPOSE_DIR="${COMPOSE_DIR:-/var/www/jalajogja}"

if [[ "${1:-}" == "--from-remote" ]]; then
  echo "Mengambil backup Postgres terbaru dari ${REMOTE}/postgres/..."
  mkdir -p "$BACKUP_DIR"
  LATEST_REMOTE=$(rclone lsf "${REMOTE}/postgres/" --files-only | sort | tail -1)
  if [[ -z "$LATEST_REMOTE" ]]; then
    echo "Tidak ada backup di remote." >&2
    exit 1
  fi
  rclone copy "${REMOTE}/postgres/${LATEST_REMOTE}" "$BACKUP_DIR/"
  TARGET_FILE="${BACKUP_DIR}/${LATEST_REMOTE}"
elif [[ -n "${1:-}" ]]; then
  TARGET_FILE="${BACKUP_DIR}/${1}"
else
  TARGET_FILE=$(ls -t "${BACKUP_DIR}/${DB_NAME}"_*.dump 2>/dev/null | head -1)
fi

if [[ -z "${TARGET_FILE:-}" || ! -f "$TARGET_FILE" ]]; then
  echo "File backup tidak ditemukan: ${TARGET_FILE:-<kosong>}" >&2
  echo "Cek isi ${BACKUP_DIR} atau jalankan dengan --from-remote" >&2
  exit 1
fi

if [[ -z "${POSTGRES_PASSWORD:-}" && -f "${COMPOSE_DIR}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; source "${COMPOSE_DIR}/.env"; set +a
fi
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD tidak diset dan tidak ditemukan di ${COMPOSE_DIR}/.env}"

echo "=========================================="
echo "  PERINGATAN: Ini akan MENIMPA SELURUH database"
echo "  \"${DB_NAME}\" (semua tenant + public schema)"
echo "  dengan isi dari: ${TARGET_FILE}"
echo "=========================================="
echo "  Kalau cuma butuh SATU tenant, JANGAN lanjut di sini —"
echo "  lihat komentar di kepala file ini untuk restore per-schema."
echo "=========================================="
read -r -p "Ketik ulang nama database (\"${DB_NAME}\") untuk konfirmasi: " CONFIRM
if [[ "$CONFIRM" != "$DB_NAME" ]]; then
  echo "Konfirmasi tidak cocok. Restore dibatalkan."
  exit 1
fi

echo "[$(date)] Restore dari ${TARGET_FILE}..."
(
  cd "$COMPOSE_DIR"
  docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists
) < "$TARGET_FILE"
echo "[$(date)] Restore selesai."
