# Arsitektur Notifikasi Email — Paritas dengan WhatsApp, Fallback Platform, Pilihan Penyedia

> **Status: RENCANA (2026-10-30) — belum dieksekusi.** Menunggu jawaban § 7. Dokumen ini ditulis
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

## 7. Pertanyaan terbuka (butuh jawaban sebelum eksekusi)

1. Matriks § 3.4 menggantikan tiga toggle lama dan sisi admin diserahkan ke PJ — setuju?
2. Kanal default `auto` (kirim ke semua kanal tersedia) — setuju, atau email-only dulu?
3. Daftar event inti Fase 2 (§ 3.4) — ada yang mau ditambah/dikurangi?
4. Alamat From fallback platform: pakai `SMTP_FROM` yang sudah ada, atau alamat khusus
   (mis. `no-reply@jalakarta.com`)? Perlu dicek SPF/DKIM-nya.
5. Enkripsi at-rest kredensial SMTP tenant: sekarang atau ditunda?
