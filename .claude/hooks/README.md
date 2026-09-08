# Hooks — Enforcement Deterministik

CLAUDE.md itu *advisory* (aturan diikuti sebagian besar waktu, bukan 100%
terjamin). Untuk hal yang WAJIB tanpa pengecualian, pakai hook — jalan
otomatis lewat event, hasilnya lewat exit code, jadi selalu konsisten
terlepas apakah instruksinya "diingat" atau tidak di sesi itu.

Diadaptasi 2026-09-08 dari standar `~/sites/master-typescript` — checklist
keamanan lengkap ada di `docs/arsitektur-keamanan.md` (bukan di sini, README
ini cuma jelaskan MEKANISME hook-nya).

## Secret Scanning — Dua Lapis, Dua Cakupan Berbeda

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

## Hook: ADR Immutability Guard (adr-guard.sh)
`PreToolUse` untuk Edit/Write — **hard block** (exit 2) kalau ada yang coba
edit file `docs/decisions/adr-*.md` yang statusnya sudah `Accepted`. Aturan
biner (bukan butuh judgment seperti security-review), sesuai
`docs/decisions/adr-template.md`: "ADR TIDAK diedit setelah Accepted, buat
ADR baru + tandai Supersedes kalau keputusan berubah". ADR baru (file belum
ada) dan `adr-template.md` sendiri tidak kena block.

## Hook: Dependency Audit (dependency-audit.sh)
`PostToolUse` untuk Bash — jalan otomatis tiap `bun add <package>`, cek
known vulnerability lewat `bun audit`. **Warning** (exit 1), bukan hard
block, karena hasil audit bisa noisy/false-positive dan butuh judgment
manusia untuk keputusan lanjut/tidak.

## Hook: Security Review Reminder (security-review-reminder.sh)
`PostToolUse` untuk Edit/Write — jalan tiap file `.ts`/`.tsx` yang polanya
security-sensitive KHUSUS project ini: `*/actions.ts` (Server Actions, tempat
hampir semua logic mutasi — project ini tidak punya folder `routes/` terpisah
seperti API framework lain), `app/api/*/route.ts`, `*auth*`, `*upload*`,
`*media*`, `*webhook*`, `*payment*`, `*qris*`, `*billing*`. **Warning** (exit
1), bukan hard block — mengingatkan supaya skill `jalakarta-security-review`
tidak kelupaan dipanggil sebelum task dianggap selesai.

**Catatan trade-off jujur**: `*/actions.ts` itu pola yang cukup luas di
codebase ini (hampir semua modul punya file itu) — hook ini bisa jadi cukup
sering muncul dibanding kalau scope-nya lebih sempit. Sengaja dibiarkan luas
karena memang di situ tempat logic sensitif (auth guard, permission check)
biasanya hidup — kalau ternyata kelewat berisik di praktik sehari-hari,
persempit pola di file hook ini (bukan dihapus total).

## Skill: jalakarta-security-review
`.claude/skills/jalakarta-security-review/SKILL.md` — dipanggil setelah
selesai bikin Server Action/endpoint baru, cek kode yang baru ditulis
terhadap checklist di `docs/arsitektur-keamanan.md`, per file, cepat. Diberi
nama `jalakarta-security-review` (bukan `security-review` polos) supaya
tidak bentrok dengan skill generik bawaan yang mungkin ada di lingkungan
Claude Code — skill ini isinya checklist KHUSUS stack project ini (Next.js
App Router + Server Actions + Better Auth + Drizzle + isolasi
schema-per-tenant), bukan checklist generik.

## Subagent: security-auditor
`.claude/agents/security-auditor.md` — untuk audit menyeluruh (banyak file/
seluruh modul), read-only, jalan di context terisolasi supaya tidak
menghabiskan context sesi utama. Cocok dipanggil sebelum deploy fitur besar
ke VPS atau audit berkala, bukan tiap kali edit kecil.

## Yang SENGAJA TIDAK dipasang di project ini

- **Hook block-commit-ke-main** — sebagian project referensi (mis.
  `master-typescript`) punya hook yang mem-block `git commit` langsung ke
  branch `main`, karena alur kerja mereka feature-branch → PR → `develop`.
  Project jalajogja alurnya BEDA: kerja + commit + push langsung ke `main`
  (lihat riwayat commit repo ini) — hook seperti itu justru akan mem-block
  alur kerja normal project ini, bukan melindungi apa pun. Jangan dipasang
  kecuali alur kerja project ini benar-benar berubah ke feature-branch.
- **CI GitHub Actions untuk security scan** — repo ini belum ada
  `.github/workflows` sama sekali dan bukan alur PR-based, jadi CI on-PR
  generik tidak akan pernah jalan. Dua lapis secret-scan di atas (Claude
  hook + git hook lokal) sudah jadi lapis enforcement yang aktif tanpa CI.
  Bisa dipertimbangkan lagi kalau project ini suatu saat pindah ke alur
  PR-based atau butuh audit gitleaks/trufflehog scan seluruh history.

## Registrasi

`.claude/settings.json` (di-commit, dipakai bersama semua yang kerja lewat
Claude Code di repo ini) — bukan `.claude/settings.local.json` (personal,
gitignored).
