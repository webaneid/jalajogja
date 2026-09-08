#!/bin/bash
# .claude/hooks/security-review-reminder.sh
# Jalan lewat PostToolUse (Edit/Write) — mengingatkan (BUKAN block) supaya
# skill `jalakarta-security-review` tidak "lupa" dipanggil saat edit terjadi
# di luar konteks yang sedang sadar soal keamanan (mis. fix kecil ad-hoc).
#
# CATATAN JUJUR: sebelum hook ini ada, "jalankan security review" cuma
# tertulis di docs/arsitektur-keamanan.md/CLAUDE.md (advisory — lihat
# .claude/hooks/README.md soal kenapa hook dipakai untuk yang WAJIB). Hook
# ini WARNING (exit 1) bukan hard-block (exit 2) — supaya tidak mem-block
# tiap edit kecil ke file ini. Keputusan "cukup atau tidak" tetap di tangan
# sesi yang jalan, hook cuma memastikan tidak lupa begitu saja.

FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

# Cuma relevan untuk kode TypeScript, bukan config/doc
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]] && exit 0
# Skip test/type-declaration file — bukan target security-review
case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*.d.ts) exit 0 ;;
esac

# Pola file security-sensitive khusus project ini:
# - */actions.ts  → Server Actions, tempat hampir semua logic mutasi (BUKAN routes/*
#                   seperti template Elysia — project ini tidak punya folder routes/ terpisah)
# - app/api/*/route.ts → route handler API
# - *auth*, *upload*, *media*, *webhook*, *payment*, *qris*, *billing* → area sensitif
case "$FILE_PATH" in
  */actions.ts|*/route.ts|*[Aa]uth*|*[Uu]pload*|*[Mm]edia*|*[Ww]ebhook*|*[Pp]ayment*|*[Qq]ris*|*[Bb]illing*) ;;
  *) exit 0 ;;
esac

echo "🔒 File security-sensitive diedit: $FILE_PATH" >&2
echo "Sebelum task ini dianggap selesai, jalankan skill 'jalakarta-security-review'" >&2
echo "(.claude/skills/jalakarta-security-review/SKILL.md) — checklist lengkap ada di" >&2
echo "docs/arsitektur-keamanan.md. Kalau file yang diubah banyak/lintas modul," >&2
echo "delegasikan ke subagent 'security-auditor'." >&2
exit 1
