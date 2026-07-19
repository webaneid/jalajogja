# Arsitektur Mobile Shell — Header Global, Sticky Bar, dan Aturan Spacer

> **Dokumen terkait:**
> - `docs/arsitektur-frontend-publik.md` § 2, § 12 — peta umum header/footer + aturan UI publik
> - `docs/arsitektur-header-footer-publik.md` — katalog desain header/footer
> - CLAUDE.md § Lessons Learned tanggal 2026-07-18 s/d 2026-07-20 — riwayat kronologis penemuan
>   bug yang mendasari dokumen ini (baca kalau butuh konteks historis, BUKAN untuk operasional —
>   dokumen ini adalah versi final/ringkas, ikuti § 5 dan § 8 di bawah untuk kerja sehari-hari)

**Status: ✅ SELESAI** (2026-07-20) — 5 halaman (`/keranjang`, `/checkout`, `/campaign/[slug]`,
`/produk/[productSlug]`, `/invoice/[id]`) + header global (`FlexHeader`) sudah diaudit dan
diperbaiki. Dokumen ini WAJIB dibaca ulang sebelum menambah elemen `fixed bottom-0` baru
manapun di front-end publik — pola bugnya SUDAH TERBUKTI BERULANG 4× dalam satu sesi kerja,
selalu dengan gejala yang sama ("ada jarak kosong aneh") tapi root cause yang mudah salah
didiagnosis kalau tidak paham aturan di § 5.

---

## 1. Konsep Dasar — `md:hidden` BUKAN "hidden di mobile"

Kesalahpahaman paling umum yang memicu seluruh rangkaian bug di dokumen ini: nama class
`md:hidden` terdengar seperti "sembunyikan di mobile", padahal artinya justru **kebalikannya**.

Tailwind breakpoint prefix (`md:`, `lg:`, dst) berarti **"berlaku MULAI breakpoint ini ke ATAS"**.
Jadi:
- `md:hidden` = `display: none` **mulai `md` (≥768px) ke atas** → di BAWAH `md` (mobile), class
  ini TIDAK BERLAKU SAMA SEKALI, elemen render NORMAL (biasanya `display: block`).
- `hidden md:block` = hidden di mobile, `block` mulai `md` ke atas — INI yang berarti "sembunyikan
  di mobile", pola yang sering tertukar dengan `md:hidden`.

**Akibat konkret**: sebuah `<div className="h-24 md:hidden" />` yang dimaksudkan sebagai
**spacer** (blank space untuk mencegah elemen `fixed` menutupi konten) akan **render normal di
mobile** (mengambil 96px ruang kosong asli, bukan hilang) — dan **hilang total di desktop**
(karena memang cuma dibutuhkan untuk mengimbangi elemen fixed yang juga cuma tampil di mobile).
Ini SESUAI DESAIN, bukan bug — tapi kalau spacer ini ditempatkan di POSISI YANG SALAH dalam
halaman (§ 5), hasilnya terlihat persis seperti bug: "ada jarak kosong yang tidak jelas asalnya".

---

## 2. Dua Skema Perlakuan Header di Mobile

Header publik (`FlexHeader`/`ClassicHeader`/`PillHeader`, dipilih admin di
`/app/{slug}/settings/display`) punya DUA skema berbeda tergantung jenis halaman, dikontrol oleh
helper terpusat **`lib/mobile-route-checks.ts`**:

### 2.1 `isSingleMobileRoute(pathname, baseUrl)` — sembunyikan SELURUH header

Untuk halaman **single-item detail** (post/agenda/campaign/produk detail — 2 segmen path — dan
halaman CMS generik 1 segmen di luar daftar statis) — header (topbar+logo+nav+search+cart+user)
disembunyikan TOTAL di mobile (`hidden md:block` di `HeaderVisibility`), diganti overlay
back+menu yang menempel di gambar fitur halaman (`SingleMobileTopBar`). Ini fondasi "Mobile
Single-Page Shell" yang sudah ada sejak sebelum sesi 2026-07-18 (Post/Event/Campaign/Produk
detail dengan `MobileActionSheet`, lihat § 4).

### 2.2 `hasOwnMobileActionBar(pathname, baseUrl)` — sembunyikan BottomNav saja

Untuk halaman **utilitas dengan aksi utama sendiri** (`/keranjang`, `/checkout`) — header
TETAP tampil PENUH (topbar/logo/cart-icon/user-menu — user butuh navigasi normal di halaman
ini), tapi `BottomNav` (tab navigasi situs generik, § 3) disembunyikan supaya tidak rebutan
ruang `bottom-0` dengan bar aksi milik halaman itu sendiri (Total+Checkout, Voucher+Buat
Invoice).

**Kedua fungsi ini WAJIB diimpor dari `lib/mobile-route-checks.ts`** oleh siapa pun yang butuh
logic serupa — JANGAN copy-paste ulang logic pathname-parsing di file baru. Dipakai oleh
`header-visibility.tsx` (§ 2.1) dan `footer-bottom-nav.tsx` (§ 2.2, § 3).

**WAJIB diupdate kalau ada folder route static baru** ditambah ke `app/(public)/[tenant]/` —
`STATIC_TOP_SEGMENTS` (di file yang sama) adalah daftar semua top-level route yang BUKAN
halaman single-item generik. Kalau lupa update, halaman baru itu salah dikategorikan sebagai
"single mobile route" dan headernya hilang di mobile tanpa alasan.

---

## 3. `BottomNav` — Kenapa Harus Dirender SETELAH Footer, Bukan Bersama Header

**Bug global yang ditemukan 2026-07-20** (§ 8.1): `FlexHeader` (salah satu dari 3 desain header)
punya `BottomNav` — tab navigasi situs (`fixed bottom-0 z-50`) + spacer `h-14 md:hidden`
miliknya sendiri. Sebelumnya KEDUANYA dirender BERSAMA `<header>`, di dalam `FlexHeader` yang
sama. Karena `PublicLayout` merender header SEBELUM `{children}` (konten halaman) dan
`<PublicFooter>`, spacer itu — yang seharusnya reserve ruang di PALING BAWAH halaman (tempat
BottomNav sungguhan berada secara visual) — malah nempel tepat di BAWAH HEADER, di ATAS seluruh
konten halaman. Bug ini aktif di **SEMUA halaman publik** tenant manapun yang pakai desain
"Flex", sejak header itu dibuat — baru ketahuan setelah audit sesi ini.

**Arsitektur final**:
```
PublicLayout (app/(public)/[tenant]/layout.tsx)
  ├─ <HeaderVisibility>          → <header> saja (topbar+nav), TANPA BottomNav
  ├─ <main>{children}</main>
  ├─ <PublicFooter>
  └─ <FooterBottomNav>           → BottomNav + spacer-nya, DISINI, setelah footer
```

`BottomNav` sendiri (fungsinya, isinya) tidak berubah — **hanya dipindah lokasi render**-nya.
Diekspor dari `flex-header.tsx` (`export function BottomNav`), dipakai oleh
`footer-bottom-nav.tsx` (`components/website/public/layout/footer-bottom-nav.tsx`) yang jadi
satu-satunya pemanggilnya sekarang. `FooterBottomNav` sendiri client component yang cek KEDUA
kondisi di § 2 (`designId !== "flex"` → null, `isSingleMobileRoute` → null,
`hasOwnMobileActionBar` → null) sebelum render.

**Aturan untuk desain header BARU** (kalau nanti ada desain ke-4 dst yang juga butuh tab
navigasi bawah ala BottomNav): JANGAN bundel tab nav + spacer-nya di dalam file header itu
sendiri. Ekspor komponennya, render dari `FooterBottomNav` (atau turunan generik yang serupa),
persis pola yang sudah dikunci di sini.

---

## 4. `MobileActionSheet` — Primitif Bottom Sheet Bersama

`components/website/public/single/mobile-action-sheet.tsx` — bottom sheet generik: bar ringkas
(`collapsedBar`) selalu nempel di `bottom-0` (mobile only, `md:hidden` built-in), tap untuk
expand (`max-height` animasi, BUKAN translate — elemen tetap di `bottom:0`, sisi ATAS yang naik)
jadi sheet penuh berisi `children`. State `expanded` internal (self-managed) — TIDAK di-unmount
saat collapse, cuma di-clip `overflow-hidden`, supaya form di dalamnya (pilihan tiket/nominal/
variasi/dst) tidak reset saat sheet ditutup-buka berulang.

**Prop opsional `collapseSignal?: boolean`** (ditambah 2026-07-20, § 8.2) — set `true` untuk
memaksa sheet collapse dari LUAR (parent), dipakai saat parent akan membuka overlay LAIN
(Dialog/AlertDialog) di atasnya — perlu supaya sheet (z-71) tidak menutupi overlay lain yang
z-index-nya lebih rendah (shadcn Dialog/AlertDialog = z-50). Backward compatible — kalau tidak
di-pass, sheet murni self-managed seperti sebelumnya.

**4 pemakai** (per 2026-07-20): `EventMobileTicketBar` (tiket event), `CampaignMobileDonationBar`
(form donasi/qurban), `ProductDetailClient` inline (form beli produk), dan
`invoice-public-client.tsx` inline (form konfirmasi pembayaran).

---

## 5. ATURAN WAJIB — Spacer Harus Jadi Elemen PALING TERAKHIR di HALAMAN

**Ini inti dokumen ini — bug yang SAMA ditemukan 4× berturut-turut dalam satu sesi kerja**
(keranjang, checkout, campaign, produk, lalu invoice — 5 halaman, semua kelas bug identik).

### 5.1 Bentuk bug

Setiap elemen `fixed bottom-0` butuh **spacer** (blank `<div className="h-N md:hidden" />`) di
DEPANnya dalam alur normal (flow) halaman — supaya konten yang SEHARUSNYA berada di posisi itu
tidak tertutup elemen fixed yang mengambang di atasnya. Spacer ini **HARUS jadi elemen PALING
TERAKHIR di seluruh HALAMAN** (bukan cuma elemen terakhir di dalam SATU KOMPONEN).

Bug terjadi ketika developer menaruh spacer sebagai "elemen terakhir di komponen X", padahal
komponen X BUKAN elemen terakhir yang dirender di HALAMAN — ada komponen/section LAIN yang
render SETELAH komponen X (banner promosi, related items, "Bukti ditolak", dll). Spacer itu
akhirnya nyangkut di TENGAH halaman (sebelum konten tambahan itu), meninggalkan:
1. **Jarak kosong di tempat yang salah** (di tengah alur baca, bukan di paling bawah)
2. **Konten tambahan itu sendiri TIDAK terlindungi** dari elemen fixed — kalau discroll ke
   paling bawah, konten itu bisa ketutupan elemen fixed yang mengambang.

### 5.2 Cara mendiagnosis

Gejala yang dilaporkan biasanya: *"ada jarak kosong aneh di antara [section A] dan [section
B]"* — BUKAN *"tombol X ketutupan"* (meski itu juga terjadi, biasanya kurang diperhatikan user
karena mereka jarang scroll sampai paling bawah). Untuk verifikasi cepat tanpa buka browser:

```bash
# Cari elemen fixed bottom-0 di halaman yang dicurigai
grep -n "fixed.*bottom-0" path/to/page-or-component.tsx

# Untuk tiap hasil, trace: apakah ada JSX lain yang di-render SETELAH-nya
# (dalam file yang SAMA, atau di PARENT yang memanggil komponen ini)?
```

Kalau jawabannya "ya" — cek apakah spacer-nya (biasanya persis SEBELUM elemen fixed dalam
source) sudah ditempatkan setelah konten tambahan itu. Kalau tidak, itu bug ini.

### 5.3 Tiga pola fix, pilih sesuai struktur DOM sekitarnya

**Pola A — Ekstrak ke komponen berdiri sendiri, render eksplisit di titik yang benar**
(dipakai untuk `/keranjang`). Kalau parent (page.tsx) merender komponen utama LALU konten
tambahan (banner dst) SETELAHNYA, JANGAN taruh spacer+bar di dalam komponen utama — ekstrak
jadi komponen terpisah (`CartMobileBar`), render dari page.tsx SETELAH konten tambahan itu:
```tsx
// keranjang/page.tsx
<CartClient slug={slug} cart={cart} />         {/* TIDAK ada spacer/bar mobile di sini lagi */}
{donationBanners.length > 0 && <DonationBannerCart ... />}
{cart && <CartMobileBar slug={slug} subtotal={cart.subtotal} />}  {/* ELEMEN TERAKHIR */}
```

**Pola B — `mt-0` override, kalau elemen terikat grid/flex track yang tidak boleh dipindah**
(dipakai untuk `/checkout`). Kalau spacer+bar hidup DI DALAM sebuah grid column (mis. kolom kiri
`lg:grid-cols-[1fr_360px]`) dan tidak bisa dipindah keluar tanpa merusak layout desktop (karena
grid auto-placement akan menaruhnya di track yang salah) — pindahkan HANYA spacer-nya ke posisi
setelah grid ditutup (masih aman karena BUKAN bagian dari grid track manapun), sementara
elemen `fixed`-nya sendiri TETAP di dalam grid track (aman, karena `position:fixed` tidak
peduli posisi DOM-nya untuk keperluan render visual):
```tsx
return (
  <>
    <div className="grid lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {/* ...konten kolom kiri... */}
        {/* Bar sticky (fixed di mobile, static di desktop) TETAP di sini */}
      </div>
      <div>{/* Ringkasan kanan */}</div>
    </div>
    {/* Spacer di SINI — setelah grid, bukan di dalam kolom kiri */}
    <div className="h-48 md:hidden" />
  </>
);
```

**Pola C — Spacer tambahan (trailing), kalau elemen fixed berasal dari komponen SHARED yang
tidak boleh dimodifikasi** (dipakai untuk `/campaign/[slug]`, `/produk/[productSlug]`,
`/invoice/[id]`). `MobileActionSheet` (§ 4) sudah punya spacer LOKALNYA sendiri tertanam di
dalam komponennya — memodifikasi komponen itu berisiko merusak pemakai LAIN yang sudah terbukti
benar (mis. halaman Event, yang memang `MobileActionSheet`-nya betul-betul elemen terakhir).
Solusi: JANGAN sentuh `MobileActionSheet`, cukup tambah spacer TAMBAHAN (`h-24 md:hidden`,
menyamai tinggi collapsed bar-nya) sebagai elemen PALING TERAKHIR di halaman:
```tsx
{/* ...MobileActionSheet dipakai di tengah halaman... */}
{/* ...section lain yang render setelahnya (related items, dst)... */}
{canPay && <div className="h-24 md:hidden" />}  {/* trailing spacer, elemen TERAKHIR */}
```
**Trade-off yang diterima**: hasilnya ada DUA gap di halaman (satu dari spacer lokal
`MobileActionSheet` di tengah, satu dari trailing spacer di ujung) — redundan tapi tidak salah
secara visual (bisa dibaca sebagai jeda alami antar section), dan jauh lebih aman daripada
refactor komponen shared yang dipakai banyak fitur.

### 5.4 Kapan pakai pola yang mana

| Situasi | Pola |
|---|---|
| Komponen sendiri yang bikin spacer+bar, TIDAK ada grid constraint | **A** — ekstrak+render eksplisit di titik akhir |
| Spacer+bar terikat grid/flex track spesifik yang tidak boleh dipindah | **B** — `mt-0` override + pindah HANYA spacer |
| Spacer+bar berasal dari komponen SHARED (`MobileActionSheet` dst) dipakai banyak fitur | **C** — trailing spacer tambahan, jangan modif komponen shared |

---

## 6. `space-y-*` Margin Leak — `mt-0` Selalu Menang, Bukan Soal Urutan CSS

Kalau spacer/bar adalah child (bukan child PERTAMA) dari container `space-y-*`/`space-x-*`,
Tailwind otomatis menambah `margin-top`/`margin-left` ke situ juga — membuat jarak kosong LEBIH
LEBAR dari yang dimaksud (tinggi spacer + margin tambahan).

**Fix**: tambah `mt-0` (atau `ml-0`) eksplisit ke elemen itu. **Dijamin menang** — dicek
langsung di CSS hasil build (`bunx tsc && bun run build`, lalu grep `.next/static/css/*.css`):
Tailwind v4 membungkus rule `space-y-*`/`space-x-*` dengan `:where(...)` (spesifisitas CSS = 0),
sementara `.mt-0{margin-top:0}` adalah class selector biasa (spesifisitas normal, bukan 0) —
`:where()` SELALU kalah terlepas urutan di stylesheet. Ini alasan resmi Tailwind membungkus
utility `space-y`/`space-x` dengan `:where()` sejak v3.3 — supaya utility margin/padding lain
SELALU bisa menimpanya tanpa `!important`.

```tsx
// Kalau di desktop butuh gap SEMULA (mis. balik ke space-y-5's 1.25rem saat md:static),
// tambahkan md:mt-N eksplisit — space-y tetap bekerja untuk internal children lain
<div className="mt-0 md:mt-5 ...">...</div>
```

---

## 7. Nested Radix Overlay — z-Index Conflict Antara Dialog/Sheet

Kalau sebuah form yang hidup DI DALAM satu overlay (Dialog/`MobileActionSheet`) perlu memicu
overlay KEDUA (mis. `AlertDialog` konfirmasi) saat submit — overlay pertama WAJIB ditutup/
dipaksa collapse dulu SEBELUM overlay kedua dibuka. Dua Radix overlay aktif bersamaan tanpa
penanganan z-index eksplisit menghasilkan bug **"klik tidak merespons"** (bukan crash/error
yang mudah didiagnosis dari console) — gejalanya sangat mudah disalahartikan sebagai bug tidak
berhubungan (lihat kronologi bug di § 8.2).

**Pola fix**:
```tsx
// Desktop — tutup Dialog form SEBELUM buka AlertDialog konfirmasi
function handleSubmit() {
  setFormDialogOpen(false);
  setConfirmDialogOpen(true);
}

// Mobile — paksa MobileActionSheet collapse via collapseSignal (§ 4)
<MobileActionSheet collapseSignal={confirmDialogOpen} ...>
```

**Z-index yang berlaku di project ini** (referensi cepat, cek ulang ke kode kalau ragu — jangan
percaya tabel ini tanpa verifikasi, bisa berubah):
| Elemen | z-index |
|---|---|
| Header (`sticky top-0`) | 50 |
| shadcn `Dialog`/`AlertDialog` overlay+content | 50 |
| `BottomNav` (FlexHeader) | 50 |
| `SingleMobileTopBar` | 70 |
| `MobileActionSheet` backdrop | 70 |
| `MobileActionSheet` sheet | 71 |
| Drawer slide-up (`BottomNav` "Lainnya") | 60 |

Kalau menambah overlay BARU yang perlu tampil DI ATAS `MobileActionSheet` (z-71), beri z-index
> 71, atau (lebih aman) paksa `MobileActionSheet` collapse dulu via `collapseSignal` — jangan
cuma naikkan z-index tanpa mikirkan urutan buka-tutup, karena masalah "dua overlay Radix aktif
bersamaan" tetap ada meski z-index sudah benar (focus-trap/pointer-events tetap bisa bentrok).

---

## 8. Riwayat Bug — Untuk Konteks, BUKAN Operasional

> Baca § 5 untuk cara kerja final. Bagian ini murni riwayat kronologis penemuan bug (berguna
> untuk paham KENAPA aturan § 5 sekeras itu), tidak perlu dibaca ulang untuk kerja sehari-hari.

**8.1 — 4 kali kejadian bug spacer (2026-07-19 s/d 2026-07-20)**, urutan penemuan:
1. `/keranjang` — spacer di dalam `CartClient` nyangkut sebelum `DonationBannerCart`. Fix: Pola A.
2. `/checkout` — spacer di dalam grid track kolom kiri, sebelum "Ringkasan Pesanan" (kolom
   kanan yang stack di bawahnya saat mobile). Fix: Pola B.
3. `/campaign/[slug]` — `MobileActionSheet` sebelum section "Campaign Lainnya". Fix: Pola C.
4. `/produk/[productSlug]` — `MobileActionSheet` sebelum "Deskripsi Produk"+"Produk Lainnya".
   Fix: Pola C.
5. `/invoice/[id]` — `MobileActionSheet` sebelum "Bukti ditolak"/"Status final"/"Menunggu
   Verifikasi". Fix: Pola C. (Ditemukan bersamaan dengan bug § 8.2 di file yang sama.)
6. Bug GLOBAL, ditemukan terpisah dari 5 di atas: `BottomNav` FlexHeader (§ 3) — spacer nempel
   di bawah HEADER (bukan di bawah halaman) di SEMUA halaman publik yang pakai desain "Flex".

**8.2 — Bug "Kirim Konfirmasi tidak merespons"** (2026-07-20, invoice publik) — konsekuensi
LANGSUNG dari me-refactor form konfirmasi pembayaran jadi hidup di dalam Dialog (desktop)/
`MobileActionSheet` (mobile): submit form membuka `AlertDialog` KEDUA di atas overlay PERTAMA
yang masih terbuka. Mobile: `MobileActionSheet` (z-71) menutupi `AlertDialog` (z-50) TOTAL —
user klik area yang terlihat seperti tombol konfirmasi, tapi sebenarnya mengklik sheet yang
masih terbuka di atasnya. Fix: § 7 (`collapseSignal` + tutup Dialog form sebelum buka AlertDialog).

**8.3 — Header mobile FlexHeader kosong** (2026-07-20) — search & cart TIDAK PERNAH tampil di
topbar mobile desain "Flex" (`SearchBar` `hidden md:block`, `CartButton` default `hidden
md:flex`). 2 putaran desain: putaran 1 (kapsul warna primary + 3 ikon termasuk menu) DITOLAK
user ("tidak menarik"); putaran 2/final (2 ikon flat search+cart, border tipis abu-abu, style
disalin dari `IconButton` yang sudah ada di `pill-header.tsx`) DITERIMA. Menu navigasi TETAP di
`BottomNav`, tidak dipindah ke header. Detail lengkap di CLAUDE.md (tidak diulang di sini,
murni cosmetic, bukan bug struktural seperti § 8.1/8.2).

---

## 9. Checklist — Menambah Elemen `fixed bottom-0` Baru

Sebelum menambah elemen fixed baru di halaman publik manapun:

1. **Cek elemen fixed-bottom lain yang mungkin masih aktif** di halaman yang sama:
   `grep -n "fixed.*bottom-0" components/website/public/ components/billing/ app/(public)/`
   — jangan asumsikan `bottom-0` selalu kosong.
2. **Tentukan apakah halaman ini masuk kategori "single mobile route"** (§ 2.1, header hilang
   total) atau bukan. Kalau bukan, DAN halaman ini butuh bar aksi sendiri, tambahkan ke
   `PAGES_WITH_OWN_MOBILE_ACTION_BAR` di `lib/mobile-route-checks.ts` (§ 2.2) supaya `BottomNav`
   tidak rebutan ruang.
3. **Trace SELURUH konten yang di-render SETELAH titik penempatan spacer/bar** — di komponen
   yang sama MAUPUN di parent (page.tsx) yang memanggilnya. Kalau ada, pilih Pola A/B/C (§ 5.3)
   sesuai struktur DOM-nya — JANGAN taruh spacer di titik yang "terasa benar" tanpa trace ini.
4. **Kalau elemen ini bisa memicu overlay LAIN** (Dialog/AlertDialog konfirmasi) — terapkan
   § 7 dari awal (tutup diri sendiri dulu sebelum buka overlay kedua), jangan tunggu bug
   "klik tidak merespons" dilaporkan.
5. **Verifikasi**: `tsc --noEmit` di kedua package + `bun run build --filter=@jalajogja/web`
   (matikan dev server dulu, `rm -rf apps/web/.next`) — WAJIB sebelum dianggap selesai.
6. **Visual di browser** — checklist kode saja tidak cukup untuk menangkap masalah spacing;
   idealnya dicoba langsung di device/browser mobile sebelum push, meski dalam sesi-sesi
   sebelumnya verifikasi ini sering diserahkan ke user karena keterbatasan environment kerja.

---

## 10. Inventaris Spacer Saat Ini (per 2026-07-20)

| Halaman/Komponen | File spacer | Pola | Status |
|---|---|---|---|
| Semua halaman (BottomNav) | `footer-bottom-nav.tsx` | Ekstraksi ke layout | ✅ Terverifikasi (kode) |
| `/keranjang` | `cart-mobile-bar.tsx` | A | ✅ Terverifikasi (kode) |
| `/checkout` | `checkout-form.tsx` | B | ✅ Terverifikasi (kode) |
| `/campaign/[slug]` | `campaign/[slug]/page.tsx` (trailing) | C | ✅ Terverifikasi (kode) |
| `/produk/[productSlug]` | `produk/[productSlug]/page.tsx` (trailing) | C | ✅ Terverifikasi (kode) |
| `/invoice/[id]` | `invoice-public-client.tsx` (trailing) | C | ✅ Terverifikasi (kode) |
| `/agenda/[slug]` (event) | — | — | ✅ Sudah benar sejak awal, tidak butuh fix |

**"Terverifikasi (kode)"** berarti: logic sudah benar berdasarkan pembacaan struktur JSX +
`tsc`/`build` bersih, TAPI **belum dikonfirmasi visual di browser oleh siapa pun** per tanggal
dokumen ini ditulis. Update kolom status jadi "✅ Dikonfirmasi visual" setelah benar-benar dicek
di browser (mobile viewport asli, bukan cuma resize window desktop).
