# Arsitektur Notifikasi Email — Paritas dengan WhatsApp, Fallback Platform, Pilihan Penyedia

> **Status: KEPUTUSAN DIKUNCI 2026-10-30 (§ 7) — eksekusi bertahap, lihat § 8 untuk status.** Dokumen ini ditulis
> sesuai SOP "docs sebelum kode". Terkait: `docs/arsitektur-whatsapp.md`,
> `docs/arsitektur-notifikasi-pengurus.md` (notifikasi PJ/admin), `lib/mail.ts`.

## 1. Latar belakang & temuan

Pemicu: banyak tenant/pengguna **belum siap memakai WhatsApp**, sehingga ketergantungan pada WA harus
dikurangi. Hasil cek kode + VPS (2026-10-30):

1. **Belum ada tenant yang mengisi SMTP sendiri** (query `smtp_config` di 5 schema → 0 baris).
   SMTP platform (`SMTP_HOST/USER/PASS` di `.env.local`) SUDAH terisi.
2. Dua jalur kirim ada di `lib/mail.ts`: `sendPlatformMail()` (env, semua tenant) dan
   `sendTenantMail()` (SMTP milik tenant). Logika "tenant dulu, fallback platform" **ditulis ulang
   4×** (`pj-notification`, `membership-activated`, `checkout-otp-channel`, `notify-customer`) —
   dan `notify-customer.ts` **tidak** punya fallback platform → notifikasi stok habis & pesanan
   auto-batal **tidak pernah terkirim** di tenant mana pun saat ini.
3. **~25 notifikasi WA ke pelanggan** lewat satu pintu `notifyWa()` (`lib/wa-notify.ts`) dengan
   template per event (`lib/wa-templates.ts`). **Hampir semuanya tidak punya padanan email.**
4. **Tiga toggle email di `/settings/notifications` (`emailNewMember`, `emailPaymentIn`,
   `emailPaymentConfirmed`) tidak dibaca kode manapun** — tersimpan di DB, tidak memicu apa pun.
5. Sisi **admin** dari "anggota baru" dan "pembayaran masuk" sudah ditangani sistem PJ
   (digest + tautan verifikasi bendahara, `arsitektur-notifikasi-pengurus.md`). Membangun email
   admin lagi = notifikasi dobel. Yang benar-benar hilang adalah email ke **pelanggan/anggota**.
6. Kredensial SMTP tenant disimpan **plaintext** di `settings` JSONB, dan halaman pengaturan
   mengirim password itu kembali ke komponen client sebagai `defaultValues` (lihat § 6).
7. `notify-customer.ts` menyisipkan `${name}` mentah ke HTML email (HTML injection dari nama yang
   diketik pelanggan) — pola `escapeHtml` sudah ada di `membership-activated`/`pj-notification`.

## 2. Tujuan

- Setiap tenant **otomatis punya email** tanpa setup (fallback SMTP platform), dan boleh membawa
  SMTP sendiri (Gmail, Resend, dst.) supaya pengirim bermerek tenant.
- Notifikasi pelanggan yang sudah ada di WA punya jalur email; kanal ditentukan **ketersediaan**
  (WA tenant aktif? ada alamat email?), bukan hardcode.
- Satu helper pengiriman, bukan 4 salinan.

## 3. Rancangan

### 3.1 Helper tunggal `sendMailForTenant()` — `lib/mail-dispatch.server.ts`
Urutan: SMTP tenant (jika lengkap) → gagal/tidak ada → SMTP platform → tidak ada → `{ok:false}`.
Fallback platform memakai **From = nama tenant + alamat platform** (`"PC IKPM Jogja" <no-reply@…>`)
dan **Reply-To = `contact_email` tenant** bila ada. (From alamat tenant TIDAK boleh dipakai lewat
SMTP platform: SPF/DKIM tidak selaras → masuk spam.) Semua `to`/`subject` dibersihkan dari CR/LF.
Empat salinan logika lama dimigrasikan ke helper ini; perilakunya tetap (tenant→platform).

### 3.2 Email paritas via `notifyWa()` → saluran ganda
`NotifyWaOptions` ditambah `email?: string | null`. Setelah/di samping WA, bila `email` ada dan toggle
email event itu aktif: render **template yang sama** (teks WA → HTML: hapus `*`, escape HTML, autolink —
pola `deliverToRecipient` di PJ), kirim via § 3.1. Pemanggil yang punya email pelanggan
(`invoice.customerEmail`, `member.email`) cukup menambah satu argumen. Teks custom tenant
(`wa_message_templates`) otomatis dipakai email juga. **Kegagalan email tidak boleh memengaruhi
transaksi** (fire-and-forget + try/catch, seperti WA).

### 3.3 Kanal per tenant
Pengaturan `notif` / `channel_mode`: `"auto"` (default — kirim ke semua kanal yang tersedia),
`"email_only"`, `"wa_only"`. `auto` = tenant tanpa WA langsung dapat email, tanpa konfigurasi.

### 3.4 Tiga toggle lama
Diganti **matriks event × kanal** (WA | Email) di `/settings/notifications`. Tiga toggle admin lama
dihapus; sisi admin diserahkan ke PJ (§ 1 poin 5). Default email: **aktif** untuk event inti
(bukti bayar diterima, pembayaran dikonfirmasi/ditolak, invoice dibuat/pengingat, pesanan
diproses/dikirim/diterima, pendaftaran event/pengingat, donasi diterima, anggota baru/aktif),
**mati** untuk sisanya.

### 3.5 Penyedia SMTP tenant — tanpa dependensi baru
`nodemailer` sudah mendukung semuanya lewat SMTP. Form `/settings/email` mendapat **preset** (mengisi
host/port/user, admin tinggal isi password/kunci):

| Penyedia | Host : port | User | Password | Catatan |
|---|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com`:587 | alamat Gmail | **App Password** (wajib 2FA) | Pengirim = akun Gmail itu; batas ±500/hari (Gmail biasa), ±2.000 (Workspace). Password biasa DITOLAK. |
| Resend | `smtp.resend.com`:465 | `resend` | API key `re_…` | Domain pengirim harus diverifikasi (DNS SPF/DKIM) agar bisa From custom; gratis ±100/hari. |
| Brevo | `smtp-relay.brevo.com`:587 | login Brevo | SMTP key | Gratis ±300/hari. |
| Lainnya (Custom) | manual | | | Mailgun, SES, Zoho, dll. |

Opsi lanjutan (bukan sekarang): API HTTP Resend native — hanya berguna kalau port SMTP VPS diblokir.

## 4. Fase eksekusi

1. **Fase 1 — fondasi**: helper § 3.1 + migrasi 4 pemanggil + perbaiki `notify-customer` (fallback +
   `escapeHtml`). Tanpa perubahan UI. Efek langsung: email stok habis/auto-batal mulai terkirim.
2. **Fase 2 — paritas email**: § 3.2 + § 3.3 + matriks § 3.4, event inti dulu (pembayaran,
   invoice, anggota, donasi, event), sisanya menyusul.
3. **Fase 3 — penyedia & keamanan**: preset § 3.5, password tidak lagi dikirim ke client (§ 6),
   opsional enkripsi at-rest.

## 5. Risiko

- **Kuota & reputasi pengirim bersama**: semua tenant tanpa SMTP sendiri memakai satu akun platform.
  Volume event inti kecil, tapi perlu dipantau; bila provider platform punya batas harian, tenant
  besar sebaiknya diarahkan membawa SMTP sendiri.
- **Spam/deliverability**: From platform wajib domain dengan SPF+DKIM selaras (cek DNS jalakarta.com).
- **Pengirim berganti diam-diam**: SMTP tenant gagal → fallback platform → pelanggan melihat pengirim
  berbeda. Dicatat di log; pertimbangkan peringatan di dashboard.
- **Email ganda** bila WA + email sama-sama aktif (`auto`) — disengaja; tenant bisa memilih `*_only`.
- Migrasi 4 pemanggil menyentuh kode yang sudah terverifikasi (OTP checkout, aktivasi anggota, PJ) —
  type-check + uji kirim manual wajib.

## 6. Keamanan (wajib `jalakarta-security-review` + review subagent bila Fase 3)

- HTML email: SEMUA variabel dari input pengguna (nama, catatan, nama produk) lewat `escapeHtml`.
- Header injection: `to`/`subject` dibersihkan CR/LF; `to` hanya dari data tercatat (invoice/member),
  tidak pernah dari body request mentah.
- `smtp_config.password` plaintext + dikirim ke client: Fase 3 — form menampilkan placeholder, kolom
  kosong = pertahankan nilai lama; `getTenantAccess` + `canManageUsers` tetap di action. Enkripsi
  at-rest (AES-256-GCM, kunci di env) = keputusan terpisah (§ 7 poin 5).
- Anti-penyalahgunaan: email hanya dipicu kejadian transaksi/aktivasi, bukan endpoint publik bebas;
  endpoint yang sudah publik (OTP) tetap mempertahankan rate limit-nya.

## 7. Keputusan user (2026-10-30)

1. **Email jadi kanal UTAMA untuk semua notifikasi** (alasan: WA user sempat diblokir; banyak pengguna belum siap WA).
   WhatsApp menjadi PELENGKAP: dikirim hanya bila WA tenant aktif DAN toggle WA event itu menyala. Penerima tanpa
   alamat email tetap dapat WA bila tersedia. Berlaku untuk seluruh event WA yang ada (~25), bertahap — event inti dulu.
2. **Default kanal = email** (`channel_mode`: `"email_first"` default; `"email_only"`, `"wa_only"` opsional).
3. Daftar event inti § 3.4 disetujui.
4. Fallback platform: From `"{Nama Tenant}" <no-reply@jalakarta.com>`, Reply-To email kontak tenant. **Override per domain tenant
   diinginkan** — dibuat sebagai fase terpisah dengan DAFTAR DOMAIN TERVERIFIKASI (env `SMTP_VERIFIED_DOMAINS`, domain
   sudah diverifikasi SPF/DKIM di penyedia platform) dan hanya platform admin yang boleh menetapkan; tenant TIDAK boleh
   mengisi bebas (celah pemalsuan pengirim lewat SMTP platform).
5. **Enkripsi at-rest kredensial SMTP tenant: dikerjakan sekarang** (AES-256-GCM, kunci env `SMTP_ENCRYPTION_KEY`).
   Karena belum ada tenant yang menyimpan SMTP, tidak ada data lama yang perlu dimigrasi; nilai tanpa awalan `enc:v1:`
   tetap dibaca apa adanya (kompatibilitas).
6. Penyedia yang direkomendasikan: Resend (SMTP, tanpa kode baru); Gmail hanya untuk volume kecil.

## 8. Status eksekusi

- [x] Fase 1 — SELESAI KODE 2026-10-30 (belum deploy): `lib/mail-dispatch.server.ts` (`sendMailForTenant`), `lib/secret-box.server.ts` (AES-256-GCM),
      4 pemanggil dimigrasi, `notify-customer` kini fallback platform + escapeHtml, header injection ditutup di `lib/mail.ts`.
      **Syarat deploy: set `SMTP_ENCRYPTION_KEY` di `.env.local` VPS SEBELUM build** (`openssl rand -base64 32`; jangan diganti sesudahnya).
      Tanpa kunci, tombol Simpan di `/settings/email` menolak (sengaja, tidak pernah menyimpan plaintext).
- [x] Fase 2 — SELESAI KODE 2026-10-30 (belum deploy): `notifyWa()` dua kanal (`lib/wa-notify.ts`) + definisi event/subjek/default
      (`lib/email-notify.ts`) + `email:` di 27 titik panggil (cart, billing, event, toko, cron pengingat, sertifikat, verifikasi
      pembayaran, sambutan anggota). Syarat "wajib punya HP" dilonggarkan jadi "HP atau email". UI: `/settings/notifications` →
      pilihan kanal (`email_first` default / `both` / `email_only` / `wa_only`) + sakelar email per event; tiga toggle admin lama
      DIHAPUS. `membership_activated` dan digest/verifikasi PJ ikut `channel_mode`.
      **Perubahan perilaku untuk tenant yang sudah jalan**: default `email_first` → bila penerima punya email dan email terkirim,
      WA TIDAK dikirim (sebelumnya WA saja). Event tanpa email di datanya tetap WA seperti dulu.
      Pengaman: nama pelanggan dinetralkan dari URL di jalur email (`cleanPersonName`); batas 10 email/jam per alamat penerima;
      transport SMTP di-pool (3 koneksi, 5 email/detik) agar cron tidak membanjiri penyedia.
      Belum tercakup: OTP daftar/reset/login via email (alur OTP checkout via email sudah ada), `product_stock_out` &
      `order_auto_cancelled` (punya jalur email sendiri di `notify-customer.ts`), `officer_invite`, `letter_sign_request`,
      `profile_incomplete_reminder` (tetap WA).
- [x] Fase 3 — SELESAI KODE 2026-10-30 (belum deploy): password tidak dikirim ke client + "kosong = pertahankan" (terikat host+user),
      dan preset penyedia (Gmail/Workspace, Resend, Brevo, Lainnya) lewat Combobox di `/settings/email` — mengisi host/port
      (+ user "resend" untuk Resend) dan menampilkan catatan khusus per penyedia (App Password, verifikasi domain, batas harian).
      Tanpa kode kirim baru — semua tetap SMTP lewat nodemailer.
- [x] Fase 4 — SELESAI KODE 2026-10-30 (belum deploy): alamat From khusus-tenant lewat SMTP platform.
      Env `SMTP_VERIFIED_DOMAINS` (domain yang sudah diverifikasi SPF/DKIM di penyedia SMTP platform) = daftar putih.
      HANYA platform admin yang menetapkan (`setTenantMailSenderAction`, halaman `/platform/tenants/[slug]`, role bukan staff);
      tersimpan di `tenant.settings` group `mail` key `platform_sender`. Domain divalidasi dua kali: saat simpan DAN saat kirim
      (`sendPlatformMail` di `lib/mail.ts`) — bila domain keluar dari daftar, otomatis kembali ke alamat bawaan platform.
      Tenant yang mengisi SMTP sendiri tidak terpengaruh. Satu-satunya tulisan tenant ke group `mail` adalah key `smtp_config`.
- [x] Tambahan 2026-10-30 (belum deploy): jalur email untuk `letter_sign_request` (TTD surat) dan `profile_incomplete_reminder`
      (lewat `notifyWa`), serta email otomatis tautan undangan pengurus di `createInviteAction` (sebelumnya hanya disalin manual;
      dikirim ke email kontak anggota yang sudah tercatat, berlaku 7 hari).
- Tidak dikerjakan (sengaja): OTP daftar/login via email — reset password SUDAH lewat email (Better Auth), OTP daftar/login
  memang dirancang untuk memverifikasi nomor HP. Dapat dibuka sebagai fitur terpisah bila diinginkan.

**Setup server untuk Fase 4 (opsional, hanya bila ingin From per domain):** verifikasi domain di penyedia SMTP platform (tambah DNS
SPF/DKIM), tambahkan domain ke `SMTP_VERIFIED_DOMAINS` di `.env.local`, restart PM2, lalu isi alamat per tenant di halaman platform.
