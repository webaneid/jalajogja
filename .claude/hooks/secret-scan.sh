#!/bin/bash
# .claude/hooks/secret-scan.sh
#
# Jalan lewat PostToolUse (setelah Claude Code menulis/edit file) — mendeteksi
# secret yang ter-hardcode dan memberi tahu Claude untuk membenarkan SEBELUM
# lanjut ke langkah berikutnya (termasuk sebelum sempat di-commit).
#
# CATATAN JUJUR (lihat README.md di folder ini untuk detail):
# - Ini cuma jalan kalau CLAUDE yang menulis file lewat Claude Code. Edit manual
#   + commit langsung oleh manusia, atau tool lain (mis. AI coding tool lain yang
#   kadang jalan di worktree terpisah di project ini), TIDAK ke-trigger hook ini.
# - Untuk proteksi yang independen dari siapa/apa yang menulis file, lihat
#   `.githooks/pre-commit` — itu jalan di level git, bukan Claude Code.

FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

# Scope: kode aplikasi + config/deploy — TIDAK termasuk file .env asli (itu
# MEMANG tempat secret hidup dan sudah di-gitignore, bukan tempat yang salah).
case "$FILE_PATH" in
  *.ts|*.tsx|*.json|*.yml|*.yaml|*.sql|*docker-compose*|*ecosystem.config*) ;;
  *) exit 0 ;;
esac

# Jangan scan file example/template (memang boleh berisi placeholder)
case "$FILE_PATH" in
  *.example|*schema.json) exit 0 ;;
esac

if [ -f "$FILE_PATH" ]; then
  # Pola generik (AWS key, private key block, Stripe-style live key, dan
  # assignment literal ke kata kunci password/secret/token/apikey)
  GENERIC='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[0-9a-zA-Z]{20,}|(password|secret|token|apikey|api_key)\s*[:=]\s*["\047][^"\047]{6,}["\047])'

  # Connection string Postgres dengan password tertanam langsung (bukan lewat env)
  DB_URL='postgres(ql)?:\/\/[^:@\/\s]+:[^@\/\s]{4,}@'

  # Nama variabel spesifik project ini — cocok kalau di-assign ke LITERAL,
  # bukan `process.env.X` (yang justru cara yang benar)
  NAMED='(BETTER_AUTH_SECRET|PLATFORM_JWT_SECRET|MINIO_SECRET_KEY|MINIO_ACCESS_KEY|RAJAONGKIR_PLATFORM_KEY|CRON_SECRET|WHATSAPP_API_PASS|SMTP_PASS|META_APP_SECRET|MEMBER_PII_ENCRYPTION_KEY)\s*[:=]\s*["\047]?[A-Za-z0-9+/_.\-]{6,}["\047]?'

  MATCH=$(grep -EinH "$GENERIC|$DB_URL|$NAMED" "$FILE_PATH" | grep -v "process\.env\.")

  if [ -n "$MATCH" ]; then
    echo "⚠️  Terdeteksi kemungkinan secret ter-hardcode di $FILE_PATH" >&2
    echo "$MATCH" >&2
    echo "Pindahkan ke .env.local dan akses via process.env, bukan hardcode." >&2
    exit 2   # exit code 2 = Claude diberi tahu ada masalah, harus benerin dulu
  fi
fi

exit 0
