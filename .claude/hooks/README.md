# Hooks — Enforcement Deterministik untuk Secret

CLAUDE.md itu *advisory* (aturan diikuti sebagian besar waktu, bukan 100%
terjamin). Untuk hal yang WAJIB tanpa pengecualian, pakai hook — jalan
otomatis lewat event, hasilnya lewat exit code, jadi selalu konsisten
terlepas apakah instruksinya "diingat" atau tidak di sesi itu.

## Dua lapis, dua cakupan berbeda

**Lapis 1 — `secret-scan.sh` (di folder ini)**
Jalan lewat `PostToolUse` (`.claude/settings.json`) setiap kali Claude Code
menulis/edit file `.ts/.tsx/.json/.yml/.yaml/.sql` atau file deploy
(`docker-compose.yml`, `ecosystem.config.cjs`). Kalau ketemu pola secret
ter-hardcode → exit 2 → Claude diberi tahu, harus dibenarkan dulu sebelum
lanjut (termasuk sebelum sempat commit).

**CATATAN JUJUR**: ini cuma jalan kalau **Claude Code sendiri** yang menulis
filenya di sesi ini. Edit manual + `git commit` langsung oleh manusia, atau
tool AI lain yang kerja di worktree terpisah (pernah terjadi di project ini —
lihat riwayat git-history-rewrite di lesson CLAUDE.md), **tidak** ke-trigger
hook ini sama sekali.

**Lapis 2 — `.githooks/pre-commit`** (folder terpisah di root repo, bukan di
sini — karena `.git/hooks/` sendiri tidak pernah ikut ter-commit, jadi
hook git asli harus ditaruh di folder yang di-track lewat `core.hooksPath`)
Jalan di level **git**, independen dari Claude Code — tetap aktif meski
commit-nya dari editor lain, tool lain, atau langsung dari terminal. Scan
`git diff --cached` (isi yang benar-benar akan masuk commit), block via
`exit 1` kalau ketemu pola secret.

Aktivasi (**wajib dijalankan sekali per clone/mesin**, tidak otomatis
ter-propagate cuma dengan `git clone`):
```bash
git config core.hooksPath .githooks
```

## Kenapa dua lapis, bukan satu saja

Lapis 1 lebih cepat kasih feedback (langsung pas Claude nulis file, sebelum
sempat mikir commit). Lapis 2 adalah jaring pengaman terakhir yang tidak
bisa "diakali" dengan kerja di luar Claude Code — project ini pernah
kedapatan ada tool lain (bukan Claude Code) yang jalan paralel di worktree
terpisah, jadi mengandalkan Lapis 1 saja tidak cukup.

## Yang TIDAK dicakup (batasan jujur)

- Ini scan file/diff yang **baru** ditulis/di-stage — bukan seluruh riwayat
  git yang sudah ada. Kalau suatu saat perlu scan history lengkap (mis. sebelum
  open-source repo ini, atau audit berkala), pakai tool khusus seperti
  `gitleaks`/`trufflehog` — belum dipasang di project ini, pertimbangkan
  kalau kebutuhannya muncul.
- Pola yang dicek berbasis regex generik + nama variabel spesifik project
  ini (`BETTER_AUTH_SECRET`, `MINIO_SECRET_KEY`, dst — lihat isi script).
  Kalau ada secret jenis baru (API key vendor baru, dsb), WAJIB tambah
  polanya di KEDUA file (`secret-scan.sh` dan `.githooks/pre-commit`) —
  keduanya sengaja isinya mirip tapi independen, bukan saling import.
- False positive mungkin terjadi (mis. string panjang yang kebetulan cocok
  pola tapi bukan secret asli). Kalau yakin false positive, commit ulang
  dengan `--no-verify` — tapi jangan jadi kebiasaan, itu melewati proteksi
  Lapis 2 sepenuhnya untuk commit itu.

## Registrasi

`.claude/settings.json` (di-commit, dipakai bersama semua yang kerja lewat
Claude Code di repo ini) — bukan `.claude/settings.local.json` (personal,
gitignored).
