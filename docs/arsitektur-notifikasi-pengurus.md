# Arsitektur Notifikasi Pengurus (PJ Modul) — Digest Harian + Verifikasi Bendahara via Tautan

> **Status: EKSEKUSI DIMULAI (2026-10-10) — lihat § 8 (keputusan implementasi + status).** Rencana asli: Hasil diskusi dengan user; semua keputusan
> di § 2 sudah dijawab user. Eksekusi menunggu sinyal "mulai" eksplisit dan sebaiknya setelah
> rencana forum (`docs/arsitektur-gabung-forum.md` § "RENCANA — Pendaftaran Forum Bertahap")
> selesai, karena notifikasi "pendaftar baru" untuk sekretariat jadi bagian alur itu.

## 1. Masalah & tujuan

Hari ini notifikasi WA/email hampir semuanya ke **pelanggan/anggota** (`lib/wa-notify.ts`,
`lib/notify-customer.ts`). **Pengurus yang berkepentingan tidak diberi tahu** saat sesuatu terjadi
(uang masuk, pendaftar baru, pesanan, donasi, event), sehingga harus rajin membuka dashboard.

Karena belum ada payment gateway (semua pembayaran manual: rekening + QRIS), **bendahara harus
memverifikasi satu per satu**. Tujuan: bendahara bisa memverifikasi **tanpa login**, dan tiap modul
punya PJ yang otomatis menerima kabar.

Berlaku untuk **semua tipe tenant** (cabang, marhalah, forum), bukan khusus keanggotaan.

## 2. Keputusan yang SUDAH dikunci user (2026-10-10)

1. **Satu PJ per modul** (bukan banyak). Super admin tenant memilih sendiri; sediakan opsi yang
   memudahkan: **pilih orang (pengurus/officer)**, **pilih divisi**, atau **nomor HP/email bebas**.
2. **Mulai dari bendahara** (uang masuk) — "gerbangnya". Modul lain menyusul memakai mesin yang sama.
3. **Verifikasi lewat TAUTAN, bukan balasan angka 1/2** — angka rancu bila ada banyak transaksi
   bersamaan. Dua tautan per transaksi: "Benar, sudah diterima" dan "Tidak ada".
4. **Kanal**: WhatsApp bila WA tenant aktif; kalau tidak, **email** (SMTP tenant; fallback SMTP
   platform bila tenant belum punya).
5. **Bukan satu-satu: RINGKASAN (digest) sekali per 24 jam**, bukan pesan tiap kejadian.
6. **Kuota/biaya WA dikosongkan dulu** (fitur masih gratis) — tidak ada enforcement volume sekarang.

## 3. Yang sudah ada (diverifikasi kode)

| Komponen | Lokasi | Catatan |
|---|---|---|
| Kirim WA | `lib/whatsapp.ts` `sendWaNotification`, `lib/wa-notify.ts` `notifyWa` | fire-and-forget, template editable per tenant |
| Kirim email | `lib/mail.ts` `sendTenantMail` / `sendPlatformMail` | pola WA-lalu-email sudah ada di `lib/notify-customer.ts` |
| Divisi & pengurus | `divisions`, `officers` (tenant schema) | punya `divisionId`, `position`, `memberId`, `isActive` |
| Konfirmasi pembayaran | `confirmInvoicePaymentAction` (`finance/billing/actions.ts`) | WAJIB login (`getTenantAccess`) — jalur tautan perlu otorisasi sendiri |
| Pola tautan publik bertoken | `/(public)/[tenant]/sign/[token]` | acuan desain token |
| Cron | `app/api/cron/*` | tempat job digest |
| **Pesan masuk dari WA** | — | **TIDAK ADA** (tidak ada webhook GOWA) — itulah alasan memilih tautan |

## 4. Rancangan

### 4.1 Pemetaan PJ per modul

Disimpan di `tenant.settings` (group `"notif"`, key `officer_notification_config`, JSONB — **tanpa
migration tabel**):

```json
{
  "keuangan":    { "target": { "type": "officer|division|contact", "officerId": "...", "divisionId": "...", "phone": "+62…", "email": "…" }, "enabled": true },
  "keanggotaan": { ... },
  "toko":        { ... },
  "donasi":      { ... },
  "event":       { ... },
  "digestHour":  8
}
```

- `officer` → ambil kontak dari `public.members` via `officers.memberId` (ikut otomatis bila
  pengurus berganti jabatan). `division` → pejabat aktif divisi itu (satu orang: yang utama/urutan
  pertama). **Diputuskan 2026-10-10: deterministik** — pejabat aktif dengan `sortOrder` terkecil
  (yang "utama"); TIDAK bergilir/acak (bergilir membuat item menunggu muncul di orang berbeda tiap
  hari sehingga tidak ada yang merasa bertanggung jawab). Admin yang ingin orang tertentu cukup
  memilih tipe `officer`.

  **Pengecualian KEUANGAN (keputusan user 2026-10-10): boleh 2–3 bendahara, bergantian.**
  Daftar penerima keuangan bisa berisi sampai 3 orang; tiap slot pengiriman (13.00/16.00/18.00)
  dikirim ke satu orang secara bergilir (urutan stateless dari tanggal + indeks slot, tanpa antrean
  tersimpan). Karena setiap pengiriman memuat SEMUA transaksi yang belum diverifikasi, siapa pun
  yang menerima dapat menuntaskannya — tidak ada transaksi yang "milik" satu orang saja. Semua
  aksi tetap diaudit atas nama PJ penerima tautan. `contact` → nomor/email yang diketik admin.
- UI: bagian baru di `/app/{slug}/settings/notifications` ("Penanggung Jawab"), satu baris per modul
  dengan combobox (standar UI project) + toggle aktif. Akses: hanya super admin/owner tenant.

### 4.2 Jadwal pengiriman (diperbarui 2026-10-10 setelah jawaban user)

- **Waktu tetap, bukan pengaturan rumit**: default **16.00 (zona waktu tenant)** untuk ringkasan
  modul non-keuangan. Alasan user: transaksi terjadi pagi, sore sudah bisa dicek.
- **Keuangan: 3x sehari — 13.00, 16.00, 18.00** (keputusan user 2026-10-10; pagi dibiarkan untuk
  transaksi masuk dulu). Hanya mengirim bila ada transaksi menunggu.
- **Yang dikirim = SEMUA yang masih belum diverifikasi**, bukan hanya yang baru. Transaksi yang
  sudah terkirim siang tapi lupa diverifikasi muncul lagi di 16.00 dan 18.00, dan terus muncul
  di hari berikutnya sampai bendahara memverifikasi. Berhenti otomatis begitu statusnya berubah.
- Cron per tenant; **tanpa antrean kejadian**: isi dihitung dari kondisi saat job jalan
  (keuangan = pembayaran masuk belum terverifikasi; keanggotaan = anggota baru sejak
  `lastDigestAt`). `lastDigestAt` per modul di settings (group `"notif"`).
- **Tidak mengirim pesan kosong.** Item yang belum diverifikasi muncul lagi di pengiriman
  berikutnya (otomatis jadi pengingat).

### 4.3 Verifikasi bendahara via tautan — TIGA pilihan, bukan dua

Temuan user: pembayar sering mengirim konfirmasi tetapi **nominalnya tidak sesuai karena kode
unik diabaikan**. Maka tiap transaksi punya tiga aksi:

1. **Benar, diterima** (nominal sesuai) → konfirmasi penuh.
2. **Diterima, nominal berbeda** → bendahara mengetik nominal yang benar-benar masuk; sistem
   mencatat pembayaran sebesar itu (invoice `partial` bila kurang — mekanisme bayar sebagian sudah
   ada; **kasus kelebihan bayar harus dicek ulang saat eksekusi**).
3. **Tidak ada** → hanya **menandai** "tidak ditemukan/perlu ditindaklanjuti" (tidak membatalkan).

- Pesan menampilkan **total tagihan, kode unik, dan nominal dasar secara terpisah** supaya bendahara
  langsung paham selisihnya (mis. "Rp 100.000 + kode unik 123 = Rp 100.123").
- **Setiap baris transaksi memuat info cek lengkap** (permintaan user 2026-10-10): **waktu**
  pembayaran dikirim/dicatat, **pengirim** (nama pembayar; nomor HP bila ada), **nominal** (dasar +
  kode unik = total), plus nomor invoice, sumber (toko/donasi/event/dll), dan metode/rekening tujuan
  bila tercatat — supaya bendahara bisa mencocokkan dengan mutasi bank/QRIS tanpa membuka dashboard.
- **Siapa pun dari bendahara boleh memverifikasi (keputusan user).** Bila transaksi sudah
  diverifikasi PJ lain: baris itu tidak lagi menampilkan tombol, melainkan **"Sudah diverifikasi
  oleh {nama} pada {waktu}"** (hasil: Benar / nominal berbeda / tidak ada). Berlaku dua lapis:
  (1) saat halaman dimuat, status dibaca dari DB (bukan dari isi pesan lama); (2) saat tombol
  ditekan, server menjalankan update **kondisional atomik** (hanya jika masih belum diverifikasi,
  pola lock yang sama dengan `confirmInvoicePaymentAction`); kalau ternyata keduluan, aksi TIDAK
  dijalankan ulang (tidak ada pembayaran ganda) dan pengguna melihat pesan "sudah diverifikasi
  oleh …". Dua bendahara menekan hampir bersamaan → hanya satu yang berhasil, yang lain diberi tahu.

- Satu tautan ke halaman publik "Verifikasi Pembayaran" yang memuat semua transaksi menunggu,
  tombol per baris (lebih rapi daripada puluhan tautan di WA).
- Token acak panjang, hash disimpan, berumur terbatas, terikat PJ + tenant.
- Aksi "Benar"/"nominal berbeda" memanggil inti logika yang SAMA dengan
  `confirmInvoicePaymentAction` (jurnal, stok, aktivasi forum, notifikasi pelanggan) lewat fungsi
  bersama — tidak boleh menduplikasi. Semua aksi diaudit (PJ, waktu, IP, via tautan).

**Pengaman halaman (KEPUTUSAN FINAL user 2026-10-10): kata sandi = 4 digit terakhir nomor HP
bendahara/PJ penerima tautan**, tanpa OTP (tanpa biaya WA). Bukan PIN buatan sendiri. Nomor tidak
dipublikasikan di mana pun. Konsekuensi: PJ yang dituju lewat WA/email harus punya nomor HP
tercatat (PJ yang hanya diisi email tanpa nomor tidak bisa memakai tautan verifikasi — admin diminta
mengisi nomor saat memilih PJ keuangan).

### 4.4 Modul lain (tahap berikutnya, mesin sama)

| Modul | Isi digest untuk PJ |
|---|---|
| Keanggotaan (sekretariat) | pendaftar baru / forum disetujui: nama, HP, ID forum, "silakan follow up (mis. masukkan ke grup WA)" |
| Toko | pesanan baru perlu diproses |
| Donasi | donasi masuk |
| Event | pendaftar baru |

### 4.5 Kegagalan & fallback

- WA tenant tidak aktif → email. Keduanya tidak tersedia → tidak mengirim, tampilkan peringatan di
  dashboard (PJ belum bisa dihubungi).
- PJ belum diatur → modul itu tidak mengirim; dashboard menandai "PJ belum diatur".
- Kegagalan kirim tidak boleh memengaruhi transaksi (fire-and-forget, `try/catch` sendiri).

## 5. Keamanan (wajib `jalakarta-security-review`)

Tautan verifikasi adalah **aksi uang tanpa login** — risiko tertinggi paket ini:

- Tautan di WA/email bisa diteruskan; siapa pun yang memegangnya bisa mengonfirmasi. Mitigasi:
  token acak ≥128 bit, hash disimpan (bukan token mentah), kadaluarsa pendek, sekali pakai,
  terikat transaksi + PJ, rate limit, audit lengkap, halaman menampilkan rincian sebelum aksi,
  aksi lewat POST (bukan GET — hindari terpicu oleh pratinjau tautan WA/email).
- **OTP WA ditolak user (biaya gateway); PIN buatan sendiri juga ditolak.** Keputusan final:
  kata sandi halaman = 4 digit terakhir nomor HP PJ penerima. Dikombinasikan dengan token acak
  yang tidak bisa ditebak, kadaluarsa pendek, dan penguncian tautan setelah 5x salah (bagian dari
  pengaman dasar, bukan fitur tambahan).
- Isolasi tenant: token menyimpan `tenantId`/`slug` hasil validasi server, bukan dari query.
- Konten pesan memuat nama & HP — hanya dikirim ke PJ yang ditetapkan super admin.

## 6. Yang masih terbuka

1. Kelebihan bayar (nominal lebih besar dari tagihan) — perilaku sistem saat ini perlu dicek
   sebelum aksi "nominal berbeda" dibangun.
2. Cadangan bila seluruh bendahara berhalangan (tahap berikutnya).
3. Modul non-keuangan (keanggotaan, toko, donasi, event): sekali sehari 16.00, satu PJ — belum ada
   pertanyaan terbuka.

**Sudah dijawab user (2026-10-10):** "Tidak ada" hanya menandai; kata sandi = 4 digit terakhir HP
PJ; keuangan 13.00/16.00/18.00 dan terus dikirim sampai diverifikasi; bendahara boleh 2–3 orang
bergantian; modul lain 16.00; tanpa OTP, tanpa PIN, kuota WA dikosongkan.

## 7. Urutan eksekusi (setelah sinyal "mulai")

1. Settings PJ + UI di `/settings/notifications` (tanpa pengiriman).
2. Fungsi bersama inti konfirmasi pembayaran (ekstrak dari `confirmInvoicePaymentAction`).
3. Token verifikasi + halaman publik + aksi POST + audit.
4. Cron digest keuangan (WA→email), template digest di `wa-templates` + email.
5. Review keamanan, `tsc`, build, uji manual end-to-end.
6. Digest modul lain (keanggotaan dulu — tersambung rencana forum), lalu toko/donasi/event.

## 8. Keputusan implementasi & status (2026-10-10, mulai eksekusi)

Cakupan putaran ini: **keuangan (penuh)** + **keanggotaan (digest sekretariat)**. Toko/donasi/event
menyusul memakai mesin yang sama (UI PJ hanya menampilkan modul yang sudah punya digest).

**Temuan yang menjawab "terbuka" § 6.1 (kelebihan bayar):** `verifySubmittedPaymentAction` sudah
menerima `verifiedAmount` bebas; kelebihan bayar tetap dijurnal (`journalAmount = newPaid − uniqueCode`)
dan invoice jadi `paid`. Jadi aksi "Diterima, nominal berbeda" cukup memanggil inti yang sama.
"Antrean belum diverifikasi" = `payments.status = 'submitted'` (customer sudah klik "Saya Sudah Bayar").

**Keputusan teknis:**
1. **Konfigurasi PJ** di `settings` (group `notif`, key `officer_notification_config`). Bentuk:
   `{ keuangan: { enabled, targets[≤3] }, keanggotaan: { enabled, targets[≤1] } }`; target =
   `officer` | `division` | `contact` (nama + HP/email). `digestHour` TIDAK dijadikan setelan (waktu tetap).
2. **Inti verifikasi bersama** dipindah ke `lib/payment-verification.server.ts` (`"server-only"`,
   BUKAN file `"use server"` — fungsi yang diekspor dari file `"use server"` otomatis menjadi
   endpoint publik). `verifySubmittedPaymentAction` menjadi pembungkus tipis (auth dashboard → inti).
   Logika lock/jurnal/stok/aktivasi forum TIDAK ditulis ulang.
3. **Atribusi aktor:** `transactions.created_by`/`payments.confirmed_by` NOT NULL → tenant user. Jalur
   tautan memakai tenant user milik PJ bila ada (officers.userId atau users.memberId = officer.memberId);
   bila PJ bukan user dashboard, dipakai user `owner` sebagai pemegang jurnal, dan deskripsi jurnal
   diberi catatan "diverifikasi via tautan oleh {nama PJ}". Identitas PJ yang sebenarnya selalu tercatat
   di tabel audit.
4. **Tabel baru (public, migration `0073`)**: `pj_verification_links` (token ter-hash, tenant, modul,
   penerima + HP, snapshot id pembayaran, kedaluwarsa, hitungan salah, terkunci) dan
   `pj_verification_events` (audit: aksi, nominal, nama PJ, IP, waktu). Public (bukan per-tenant) agar
   cukup satu migration dan lookup token tanpa tahu skema tenant.
5. **Halaman publik** `/{slug}/verifikasi/{token}`: kata sandi = 4 digit terakhir HP penerima; 5x salah →
   tautan terkunci. Setelah benar, cookie httpOnly bertanda tangan HMAC (berlaku singkat, terikat id
   tautan). Aksi lewat Server Action POST. Daftar = snapshot digest ∪ semua `submitted` saat ini; baris
   yang sudah diproses menampilkan "Sudah diverifikasi oleh {nama}".
6. **Kedaluwarsa tautan:** 36 jam (digest berikutnya membuat tautan baru).
7. **Cron** `/api/cron/pj-digest` dijalankan tiap jam (header `x-cron-secret`); di dalamnya per tenant
   dicek jam lokal (13/16/18 keuangan, 16 lainnya) dan penanda `pj_digest_state` (settings) mencegah
   kirim ganda dalam jam yang sama. Rotasi bendahara: indeks = (hari-ke-tahun×3 + indeks slot) mod n.
8. **Kanal:** WA lewat `sendWaNotification` (opsi baru `skipEventToggle` — kunci event PJ tidak ada di
   `whatsapp_config.notifications` tenant lama), gagal apa pun → email (SMTP tenant → SMTP platform).

### 8.1 STATUS EKSEKUSI (2026-10-10) — SELESAI KODE putaran 1 (keuangan + keanggotaan), type-check bersih

Selesai: pengaturan PJ (`/settings/notifications` → "Penanggung Jawab", hanya yang boleh kelola pengguna,
id pengurus/divisi divalidasi ulang di server), inti verifikasi bersama (`lib/payment-verification.server.ts`),
tabel + halaman `/{slug}/verifikasi/{token}`, cron `/api/cron/pj-digest`, digest keuangan (13/16/18, semua yang
masih `submitted`, rotasi bergantian) dan digest keanggotaan (16.00: anggota baru 24 jam, menunggu persetujuan,
belum masuk grup WA). Diuji lokal (browser, DB dev): kata sandi salah → hitung percobaan; kata sandi benar →
daftar; "Benar, sudah diterima" → payment `paid`, invoice `paid`, jurnal bernada "(diverifikasi via tautan oleh X)",
audit tercatat. **Bug yang ditemukan saat uji dan sudah diperbaiki:** pembanding kata sandi memakai padding berbeda
sehingga kata sandi benar pun ditolak.

**Belum diuji:** pengiriman WA/email sungguhan (butuh gateway tenant), tombol "nominal berbeda"/"Tidak ada" di
browser, dua PJ menekan bersamaan, jam cron pada VPS.
**Deploy:** jalankan migration `0073_pj_verification.sql`; tambahkan cron TIAP JAM (pola sama cron lain, header
`x-cron-secret`): `0 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://jalakarta.com/api/cron/pj-digest`
(sesuaikan dengan baris cron `invoice-reminder` yang sudah ada). Lalu super admin tenant mengisi PJ di pengaturan.
**Catatan:** pesan digest berupa teks di kode (belum editable per tenant seperti template WA lain).
**Menyusul:** digest toko/donasi/event; cadangan bila semua bendahara berhalangan; tampilan penanda "tidak ada"
di dashboard admin.

### 8.2 Hasil review keamanan (subagent `security-auditor`, 2026-10-10) — temuan sudah diperbaiki

0 Critical, 0 High. Diperbaiki: (Medium) nominal "diterima, nominal berbeda" via tautan dibatasi ≤ 2× max(sisa tagihan,
nominal diklaim) — selisih lebih besar diarahkan ke dashboard; (Low) hitungan salah kata sandi kini dinaikkan atomik SEBELUM
membandingkan (tebakan paralel tak bisa melewati batas); `recipient_user_id` disimpan di tautan sebagai pemegang jurnal
(menggantikan pencarian nomor HP global), fallback owner tertua; teks pelanggan di pesan digest dinetralkan (tautan, format
WA, baris baru, panjang); tautan kedaluwarsa >30 hari dihapus oleh cron; halaman verifikasi `referrer: no-referrer`.
Tidak diubah (pola lama): jurnal ditulis di luar transaksi (sama dengan `confirmInvoicePaymentAction`);
perbandingan `x-cron-secret` non-konstan (sama dengan cron lain). Perlu dicek di VPS: PM2 satu instance (rate limit in-memory),
`CRON_SECRET` + `BETTER_AUTH_SECRET` terisi, `x-real-ip` dari Nginx. Keputusan bisnis yang dikonfirmasi lewat desain:
satu tautan membuka SEMUA pembayaran menunggu milik tenant (bukan hanya isi digest).
