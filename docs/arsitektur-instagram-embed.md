# Arsitektur — Koneksi Instagram Otomatis (Instagram Graph API)

> Menggantikan pendekatan lama section `instagram_post` (upload manual / paste link per-post /
> auto-fallback ke post blog sendiri) — SEMUA itu bukan yang diminta. Yang diminta: admin
> hubungkan (connect) akun Instagram ASLI mereka SEKALI, lalu situs otomatis menampilkan
> postingan/repost SUNGGUHAN dari akun itu, selamanya, tanpa upload manual apa pun.

## 1. Prasyarat (di luar kendali kode, WAJIB dipastikan user)

1. **Akun Instagram tenant harus Professional (Business atau Creator)** — akun personal biasa
   TIDAK BISA diakses API sama sekali (dikonfirmasi dari dokumentasi resmi Meta — nol akses API
   untuk personal account). Dikonfirmasi user: akun Forcreator belum, tapi bisa diubah (Instagram
   app → Setelan → Akun → Beralih ke akun profesional).
2. **Meta Developer App** (developers.facebook.com) — dikonfirmasi user SUDAH ADA tapi belum
   dicek detailnya. Perlu dipastikan:
   - App type "Business"
   - Produk **"Instagram API with Instagram Login"** (a.k.a. "Business Login for Instagram")
     ditambahkan ke app — ini path YANG DIPILIH untuk arsitektur ini (lihat § 2, tidak perlu
     Facebook Page terpisah, lebih sederhana untuk tenant)
   - App ID + App Secret tersedia
   - Redirect URI terdaftar PERSIS (termasuk trailing slash) — lihat § 3
   - Untuk testing awal (sebelum App Review): akun Instagram Forcreator ditambahkan sebagai
     **Instagram Tester** di App Dashboard (Meta izinkan ini di Development Mode tanpa App
     Review — cukup untuk 1-2 tenant pertama, App Review baru wajib untuk skala semua tenant)

## 2. Kenapa "Instagram API with Instagram Login", bukan "Facebook Login"

Meta punya 2 jalur OAuth untuk Instagram Graph API:
- **Instagram Login** (dipilih) — OAuth langsung ke akun Instagram Professional, TIDAK perlu
  akun itu juga punya Facebook Page tertaut. Lebih sederhana untuk tenant (organisasi kecil
  sering tidak punya FB Page terkelola).
- **Facebook Login** (tidak dipilih) — akun Instagram harus tertaut ke Facebook Page, OAuth
  lewat `graph.facebook.com`. Field `caption` di media DIKONFIRMASI tersedia via jalur ini.

**Catatan ketidakpastian (BUKAN diasumsikan pasti, WAJIB verifikasi saat implementasi)**:
riset dokumentasi resmi Meta menemukan dua klaim yang SALING BERTENTANGAN soal apakah field
`caption` tersedia di jalur Instagram Login: satu halaman bilang "caption hanya tersedia via
Facebook Login", riset lain menunjukkan contoh query `graph.instagram.com/me/media?fields=...
caption...` yang justru menyertakan `caption`. **Verifikasi ini WAJIB dilakukan empiris begitu
App ID/Secret asli tersedia** (panggil endpoint sungguhan, lihat response) — JANGAN percaya
salah satu klaim sebagai pasti sebelum dicoba nyata. Kalau ternyata caption TIDAK tersedia via
Instagram Login, fallback: tampilkan section tanpa caption (cukup foto+link), atau pindah ke
jalur Facebook Login (assessment ulang biaya/manfaat saat itu terjadi).

## 3. Alur OAuth "Connect Instagram"

```
Admin isi "Nama Akun (Linimasa)" (opsional) di InstagramEditor, lalu klik "Hubungkan Instagram"
  → GET /api/instagram/oauth/authorize?slug={slug}&expected={accountName}
    → redirect ke https://api.instagram.com/oauth/authorize
         ?client_id={META_APP_ID}
         &redirect_uri={NEXT_PUBLIC_APP_URL}/api/instagram/oauth/callback
         &response_type=code
         &scope=instagram_business_basic
         &state={signed(slug, expectedAccount)}  ← cegah CSRF + bawa tenant slug + akun
                                                     yang diharapkan lintas redirect
  → Admin login/consent ke Instagram (akun APA PUN yang sedang login di Instagram.com —
    Meta TIDAK punya cara "paksa login sebagai akun X" di URL authorize)
  → Meta redirect balik ke /api/instagram/oauth/callback?code=...&state=...
    1. Verifikasi signature `state` → dapatkan slug tenant + expectedAccount
    2. Tukar `code` → short-lived access token (exchange endpoint EKSAK perlu diverifikasi
       saat implementasi — dua sumber riset tidak sepakat persis endpoint/domain-nya, cek
       response dari Meta App Dashboard "API setup with Instagram login" — biasanya
       ditampilkan contoh curl lengkap di situ untuk App yang sudah dikonfigurasi)
    3. Tukar short-lived → long-lived token:
       GET https://graph.instagram.com/access_token
         ?grant_type=ig_exchange_token&client_secret={META_APP_SECRET}&access_token={short}
       → { access_token, expires_in }  (expires_in ≈ 60 hari)
    4. GET https://graph.instagram.com/me?fields=user_id,username&access_token={long}
       → { user_id, username }
    5. **VALIDASI AKUN** (kalau expectedAccount tidak kosong): bandingkan `username` hasil
       login dengan `expectedAccount` (case-insensitive, "@" diabaikan). TIDAK COCOK →
       token/koneksi TIDAK disimpan sama sekali, redirect dengan pesan error jelas
       ("Anda login sebagai @X, section ini disetel untuk akun @Y"). Kosong → skip validasi,
       terima akun apa pun.
    6. Simpan ke tenant.settings (group="website", key="instagram_config"):
       { igUserId, username, accessToken, tokenExpiresAt, connectedAt }
    7. Redirect balik ke /app/{slug}/settings/website?instagram=connected
```

**Kenapa `tenant.settings` group `"website"`, bukan group baru**: `SETTING_GROUPS` sudah
punya `"website"` (dipakai homepage layout, dst) — reuse ini berarti NOL migration DB baru
diperlukan (beda dari `contact.socials.instagram`, yang cuma teks handle manual untuk
footer/kontak — TIDAK disentuh, tetap ada terpisah, dua hal berbeda).

### 3a. Validasi Akun — Kenapa Ditambahkan (2026-08-01)

**Bug yang ditemukan**: rilis pertama fitur ini (2026-07-30) SUDAH punya field "Nama Akun
(Linimasa)" (`accountName`) + "URL Akun Instagram" (`accountUrl`) di `InstagramEditor`, TAPI
keduanya HANYA dipakai sebagai label kosmetik di `resolveInstagramFeed()`
(`const accountName = data.accountName || config.username`) — foto yang ditarik SELALU dari
`config.igUserId` (akun OAuth yang terhubung terakhir kali), TIDAK PERNAH divalidasi terhadap
apa yang diketik admin di "Nama Akun". Admin bisa mengetik nama akun A, tapi kalau OAuth
sebelumnya (atau berikutnya) kebetulan login sebagai akun B, foto yang tampil ya dari akun B —
tanpa peringatan apa pun soal ketidakcocokan ini.

**Fix**: `signState()`/`verifyState()` (`lib/instagram-oauth.server.ts`) sekarang membawa
`expectedAccount` (nilai `accountName` saat tombol "Hubungkan Instagram" diklik) lintas redirect
Meta, ditandatangani HMAC bareng `slug` (tidak bisa dipalsukan). Callback (langkah 5 di atas)
membandingkan `username` hasil OAuth terhadap `expectedAccount` — tidak cocok → token TIDAK
disimpan, admin dapat pesan error eksplisit menyebut kedua akun (yang login vs yang diharapkan).
`accountName` kosong (admin tidak spesifik) → validasi di-skip, terima akun apa pun — mengikuti
niat asli placeholder "kosongkan untuk terima akun apa pun yang login".

**Batasan yang tetap berlaku** (tidak bisa dihindari, keterbatasan protokol OAuth Instagram):
tidak ada cara memaksa Meta menampilkan HANYA akun tertentu di layar consent — admin tetap harus
tahu SENDIRI sedang login sebagai akun mana di Instagram.com saat klik "Hubungkan Instagram".
Validasi ini murni **safety net setelah fakta** (menolak simpan kalau salah), bukan mencegah
salah login SEBELUM terjadi.

## 4. Kredensial Platform vs Data Tenant (dijawab eksplisit ke user)

| Level | Isi | Storage |
|---|---|---|
| **Platform** (1 untuk semua tenant) | `META_APP_ID`, `META_APP_SECRET` | Env var (`.env.local`), pola sama `WHATSAPP_API_USER`/`PASS`, `RAJAONGKIR_PLATFORM_KEY` |
| **Tenant** (beda per tenant) | `igUserId`, `username`, `accessToken`, `tokenExpiresAt` | `tenant_{slug}.settings` (group="website", key="instagram_config") — pola sama persis `whatsapp_config` (group="notif") |

## 5. Refresh Token (wajib, token cuma hidup 60 hari)

`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}`
— hanya bisa dipanggil kalau token sudah berumur ≥24 jam dan belum expired, hasilnya token baru
valid 60 hari lagi dari saat refresh (bukan dari expiry lama — WAJIB refresh SEBELUM expired,
bukan sesudah).

Cron baru `app/api/cron/refresh-instagram-tokens/route.ts` (pola sama `cleanup-images`/
`invoice-reminder` — daily, header `x-cron-secret`) — loop semua tenant aktif, cek
`instagram_config.tokenExpiresAt`, refresh yang tersisa < 10 hari lagi. **Belum dijadwalkan di
crontab VPS** — perlu ditambahkan manual setelah fitur ini live, sama seperti cron lain.

## 6. Fetch Media Otomatis (mengganti TOTAL logic lama)

`lib/instagram-feed.server.ts` di-tulis ulang:
- **ADA koneksi** (`instagram_config` terisi) → `GET https://graph.instagram.com/{igUserId}/media
  ?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&access_token=...`
  (video pakai `thumbnail_url` bukan `media_url` untuk gambar preview) → map ke `InstagramItem[]`
  langsung dari data ASLI Instagram — **TIDAK ADA fallback ke post blog sendiri lagi** (itu yang
  bikin user marah, section ini seharusnya Instagram sungguhan atau tidak sama sekali).
- **BELUM ada koneksi** → tampilkan pesan jelas di section ("Belum terhubung ke Instagram —
  admin perlu klik 'Hubungkan Instagram' di Pengaturan") — bukan mengarang data pengganti apa
  pun.
- Cache hasil fetch di memori proses selama TTL pendek (mis. dibungkus fungsi biasa, mengikuti
  ISR halaman publik yang sudah revalidate ~60-120 detik) — tidak perlu tabel cache baru,
  cukup andalkan Next.js data cache/ISR yang sudah ada di halaman publik.

**`mode` (post/repost) TIDAK LAGI menentukan sumber data** — keduanya sekarang fetch dari SATU
akun IG yang sama (tenant sendiri). "Repost" IG native (repost dengan kredit ke pembuat asli)
tetap muncul di `/media` akun sendiri karena secara teknis dipublikasikan ke timeline akun itu
sendiri — Graph API tidak membedakan "post asli" vs "repost" sebagai field terpisah yang
terdokumentasi. `mode` jadi murni LABEL yang admin pilih untuk teks header section ("Post dari"
vs "Reposted dari") — bukan pemicu logic data berbeda.

**`postUrls` (embed manual per-post) DIPERTAHANKAN** sebagai opsi sekunder — untuk kasus admin
belum sempat connect OAuth tapi ingin tempel 1-2 post spesifik secara manual sementara. Field
`items` custom manual (MediaPicker) DIHAPUS — itu yang paling menyesatkan (foto acak yang
dikira Instagram).

## 7. File yang Terlibat

| File | Perubahan |
|---|---|
| `.env.example` | Tambah `META_APP_ID`, `META_APP_SECRET` |
| `lib/instagram-oauth.server.ts` (baru) | Semua fungsi OAuth (authorize URL, token exchange, refresh, fetch profile+media) |
| `app/api/instagram/oauth/authorize/route.ts` (baru) | Mulai alur OAuth |
| `app/api/instagram/oauth/callback/route.ts` (baru) | Terima callback, simpan token |
| `app/api/instagram/oauth/disconnect/route.ts` (baru) | Hapus `instagram_config` (pola `deleteSetting`, bukan set null — lihat lesson lama JSONB NOT NULL) |
| `app/api/instagram/oauth/status/route.ts` (baru) | Status koneksi untuk `InstagramEditor` (client-side fetch), tidak pernah expose `accessToken` ke browser |
| `app/api/cron/refresh-instagram-tokens/route.ts` (baru) | Cron refresh token harian — **belum dijadwalkan di crontab VPS** |
| `lib/instagram-feed.server.ts` | Tulis ulang total — fetch API asli, hapus fallback blog-post |
| `lib/instagram-section-designs.ts` | Hapus field `items` (custom manual) + `DEFAULT_INSTAGRAM_MOCK_ITEMS`, simplifikasi `mode` jadi label saja |
| `components/website/section-editors.tsx` (`InstagramEditor`) | Hapus MediaPicker manual total, tampilkan status koneksi ("✓ Terhubung sebagai @username" + tombol Putuskan, atau "Belum terhubung" + tombol "Hubungkan Instagram") |
| `components/website/public/sections/instagram/instagram-section.tsx` | Hapus fallback mock, `return null` kalau belum ada embed manual maupun item feed (bukan tampilkan placeholder rusak ke pengunjung publik) |
| `app/(dashboard)/app/[tenant]/settings/website/page.tsx` | Banner status "Instagram berhasil terhubung/gagal" setelah redirect OAuth (query param `?instagram=connected\|error`) — bukan tempat tombol connect, itu ada di `InstagramEditor` |

**Keputusan lokasi tombol "Hubungkan Instagram" (berbeda dari rencana awal § 7 draf pertama)**:
tombol connect/disconnect ditaruh LANGSUNG di dalam `InstagramEditor` (section builder dialog),
BUKAN di halaman Settings terpisah — karena satu-satunya konsumen fitur ini adalah section
`instagram_post` itu sendiri (beda dengan WhatsApp Gateway yang dipakai banyak fitur lintas
modul, sehingga butuh halaman Settings tersendiri). Admin yang menambah/edit section Instagram
di section builder langsung melihat status koneksi + tombol di tempat yang sama — tidak perlu
berpindah halaman. Redirect callback OAuth tetap mengarah ke `/settings/website` (halaman
generik terdekat) supaya ada tempat mendarat yang stabil setelah consent Meta, dengan banner
singkat mengarahkan admin kembali ke editor section.

## 8. Status

✅ **KODE SELESAI DIEKSEKUSI (2026-07-30)** — seluruh file di § 7 sudah dibuat/diubah. `tsc
--noEmit` 0 error di `apps/web`, `bun run build --filter=@jalajogja/web` sukses genuine 2×
(48-50 detik, bukan cache-hit), 5 route API baru terkonfirmasi muncul di build output. Dev
server direstart untuk testing.

**BELUM bisa diverifikasi end-to-end** — butuh 3 hal dari user yang di luar kendali kode:
1. `META_APP_ID`/`META_APP_SECRET` asli diisi ke `.env.local` (baru ada di `.env.example` sebagai
   placeholder) — App Meta yang disebut user "sudah ada, tapi belum saya cek detailnya" perlu
   dipastikan sudah menambahkan product **"Instagram API with Instagram Login"**, dengan redirect
   URI **persis** `{NEXT_PUBLIC_APP_URL}/api/instagram/oauth/callback` terdaftar di App Meta.
2. Akun Instagram tenant uji coba dikonversi ke akun Professional (Business/Creator) — user
   konfirmasi "belum, tapi bisa diubah".
3. Selama App masih Development Mode (belum lolos App Review Meta), akun IG yang dipakai testing
   harus ditambahkan sebagai **Instagram Tester** di App Meta dan menerima undangan tester itu
   dari akun IG-nya sendiri.

**Ambiguitas yang BELUM terverifikasi** (dicatat eksplisit di § 2, bukan diasumsikan): apakah
field `caption` benar-benar terisi lewat jalur "Instagram Login" sederhana ini — baru bisa
dipastikan setelah OAuth pertama berhasil dan `fetchInstagramMedia()` dipanggil dengan token
nyata.

**Belum dijadwalkan**: cron `refresh-instagram-tokens` di crontab VPS (pola sama cron lain yang
juga belum dijadwalkan — `installment-reminder`, dll — perlu ditambahkan manual oleh user).

### Update 2026-08-01 — Validasi Akun (§ 3a)

User laporkan kebingungan "kok tiba2 masuk akun forcreator" saat mencoba Instagram section —
investigasi menemukan bug NYATA (bukan cuma masalah pemahaman): field "Nama Akun (Linimasa)"
yang admin ketik TIDAK PERNAH memengaruhi akun mana yang benar-benar terhubung/ditarik fotonya —
cuma jadi label kosmetik. Fix: `expectedAccount` dibawa lintas OAuth via signed state, callback
menolak menyimpan koneksi kalau username hasil login TIDAK cocok dengan yang diketik admin.
Lihat § 3a untuk detail lengkap. **File diubah**: `lib/instagram-oauth.server.ts` (`signState`/
`verifyState`/`buildInstagramAuthorizeUrl` tambah parameter `expectedAccount`, fungsi baru
`normalizeIgUsername`), `app/api/instagram/oauth/authorize/route.ts` (baca query `expected`),
`app/api/instagram/oauth/callback/route.ts` (validasi + tolak kalau mismatch),
`components/website/section-editors.tsx` (`InstagramEditor` — link kirim `expected`, keterangan
field diperjelas). `tsc --noEmit` 0 error + `bun run build` genuine sukses. Nol migrasi DB.
**Belum di-commit/push, belum diverifikasi end-to-end** (masih menunggu prasyarat § 1 dari user).
