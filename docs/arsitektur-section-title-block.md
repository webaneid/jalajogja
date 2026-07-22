# Arsitektur `SectionTitleBlock` — jalakarta

Blok judul standar (eyebrow + judul besar + deskripsi opsional) untuk section landing page.
Ditulis 2026-07-22 sebagai ekstraksi dari tiga implementasi yang sebelumnya identik persis:
section Keunggulan/Layanan, Tentang Kami, dan Galeri Foto (lihat `docs/arsitektur-keunggulan-
section.md`, `docs/arsitektur-tentang-kami-section.md`, `docs/arsitektur-gallery.md`).

## 1. Kenapa Diekstrak

Ketiga section di atas dibangun terpisah (sesi berbeda-beda), masing-masing menyalin ulang trio
JSX yang sama persis:
```tsx
{d.eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">{d.eyebrow}</p>}
{d.title && <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight">{d.title}</h2>}
{d.headerDesc && <p className="text-base opacity-80 leading-relaxed mt-3">{d.headerDesc}</p>}
```
Begitu user minta ukuran judul distandarkan (CSS `clamp()` baru) dan warna eyebrow dibuat
kontras-otomatis terhadap background section, mengubah tiga tempat terpisah dengan risiko drift
tidak masuk akal — diekstrak jadi satu komponen.

**CTA sengaja TIDAK ikut** — CTA punya judul besar tersendiri yang menyamai ukuran Hero
(`text-3xl sm:text-4xl md:text-5xl xl:text-6xl`, lihat `docs/arsitektur-cta-section.md`), bukan
"judul section" biasa — beda kelas, beda tujuan visual (CTA = penutup halaman yang mencolok).

## 2. Komponen `<SectionTitleBlock>`

`apps/web/components/website/public/sections/section-title-block.tsx`:
```tsx
type Props = {
  eyebrow?:     string;
  title?:       ReactNode;   // biasanya string, tapi PostsSectionTitle mengirim markup *italic* terparsing
  description?: string;
  background?:  SectionBackground;   // untuk warna eyebrow — default "none"
  as?:          "h2" | "h3";          // default "h2" — h3 untuk sub-header (mis. kolom Trio Column Post)
  className?:   string;
};
```

**Cakupan tanggung jawab — sengaja sempit**: komponen ini HANYA merender trio konten (eyebrow,
judul, deskripsi). Layout luar (align kiri/tengah/kanan, max-width, mode "beside" vs "below",
posisi di dalam grid) tetap tanggung jawab CALLER via prop `className` (diteruskan ke root
`<div>`) — bukan diseragamkan paksa, karena section-section ini punya kebutuhan layout luar yang
LEGIT berbeda:
- Galeri/Statistik: wrapper terpusat (default) atau kiri, lihat § 12a
- Tentang Kami: TANPA wrapper terpisah — jadi child pertama dari kolom teks `space-y-4`
  (eyebrow+title saja, `description` TIDAK dipakai — body/list About dirender terpisah setelahnya)
- Keunggulan/Layanan: `max-w-3xl ${textAlignCls}` (mode "below") atau `flex-1 min-w-0
  ${textAlignCls}` (mode "beside", deskripsi dirender terpisah sebagai sibling — lihat § 4)
- Post/Produk/Campaign/Event/Strip Modul: lihat § 9b/12b — layout beda tergantung ada/tidaknya
  tombol di sampingnya

Return `null` kalau eyebrow, title, DAN description semuanya kosong — caller yang butuh
membungkus dengan margin/wrapper (mis. Galeri `mb-10`) tetap mengecek `hasHeader` sendiri di
level pemanggilan supaya wrapper kosong tidak ikut ter-render saat title-block-nya null.

**`title` bertipe `ReactNode` (bukan `string`)** — sejak § 9a, supaya `PostsSectionTitle` bisa
mengirim hasil parsing markup `*italic*`→`<em>` berwarna primary, bukan string polos. Caller lain
(Features/About/Gallery/Statistik/Strip Modul) tetap kirim `string` biasa — valid subset dari
`ReactNode`, nol perubahan perilaku untuk mereka.

## 3. `.section-title` — CSS Class Baru (`globals.css`)

Diminta user via CSS spec eksternal:
```css
.section-title {
  font-size: clamp(1.8rem,3vw,2.6rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--slate-900);
  line-height: 1.1;
  margin-bottom: 0.6rem;
}
```
Diterjemahkan ke token proyek — project ini TIDAK punya skala `--slate-*` (dicek di
`globals.css` root, hanya ada `--foreground/--primary/--secondary/--muted/--border/--radius`
per konvensi shadcn/Tailwind v4). Hasil final, dipasang setelah blok `.dark {}`:
```css
.section-title {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin-bottom: 0.6rem;
}
```

**`color` SENGAJA DIHILANGKAN** (bukan alpa) — sebelumnya `<h2>` di ketiga section TIDAK punya
color utility sendiri, murni mewarisi warna teks section (`text-foreground` normal, atau
`text-primary-foreground`/`text-background` saat background section berwarna, via
`resolveSectionBgClass`). Kalau `.section-title` hardcode `color: var(--foreground)`, declared
property SELALU menang atas inheritance — judul di section Keunggulan dengan background
primary/secondary akan jadi teks gelap di atas bg gelap/berwarna (tidak kebaca). Menghilangkan
`color` mempertahankan perilaku kontras yang sudah benar tanpa kode tambahan.

Efek samping kecil yang disengaja: `.section-title`'s `margin-bottom: 0.6rem` menambah sedikit
spasi trailing di bawah judul yang sebelumnya nol margin — nyaris tidak kelihatan di Galeri/
Keunggulan (wrapper luar sudah punya `mb-10`/gap sendiri yang jauh lebih besar), paling terasa
(masih kecil) di Tentang Kami karena `.section-title` kini jadi child tunggal `space-y-4`
bersama body — total jarak title→body naik tipis dari sebelumnya. Diterima sebagai trade-off
konsistensi ukuran, bukan regresi yang perlu ditambal.

## 4. Warna Eyebrow — `resolveAccentTextClass()` (`lib/section-background.ts`)

```ts
export function resolveAccentTextClass(bg: SectionBackground): string {
  return bg === "primary" || bg === "secondary" || bg === "dark" ? "opacity-70" : "text-primary";
}
```
- `none`/`light` (bg netral/terang) → `text-primary` — warna aksen brand seperti sebelumnya.
- `primary`/`secondary`/`dark` (bg berwarna) → `opacity-70` — `text-primary` di atas `bg-primary`
  akan hilang total; solusi bukan warna baru, cukup redupkan warna teks section yang SUDAH benar
  (`text-primary-foreground`/`text-background`, di-set oleh `resolveSectionBgClass` di elemen
  `<section>` pembungkus, diwarisi turun) via opacity — menciptakan hierarki visual (eyebrow
  lebih redup dari judul) tanpa masalah kontras.

Keunggulan/Layanan (`FeaturesBackground = light|primary|secondary|white`, BUKAN
`SectionBackground` — lihat § 5 `docs/arsitektur-keunggulan-section.md`, sengaja tidak diretrofit
ke standar 5-opsi) di-map manual sebelum diteruskan ke `SectionTitleBlock`:
`background === "white" ? "none" : background` — `"white"` (tidak ada di `SectionBackground`)
diperlakukan sama seperti `"none"` (bg netral, aksen `text-primary` aman di keduanya).

## 5. "Lihat Semua" — `<SectionSeeAllLink>` (Bordered Pill)

Diminta user restyle jadi bordered pill (CSS eksternal lain, kembali pakai token `--slate-*`
yang tidak ada di proyek ini — diterjemahkan sama seperti § 3). **Satu-satunya tempat "Lihat
Semua" yang benar-benar ada saat ini adalah `PostsSectionTitle`** (dipakai section Post/Produk/
Campaign/Event, lihat `arsitektur-frontend-publik.md`) — Keunggulan/Tentang Kami/Galeri TIDAK
punya field link "Lihat Semua" sama sekali saat ini (di luar scope untuk menambahkannya sekarang,
tidak diminta eksplisit), tapi arsitekturnya disiapkan untuk itu.

**PENTING — bukan turunan dari `.btn-ghost`**: Public Button System sudah punya `.btn-ghost`
sistem-wide (`globals.css`, `variant="ghost"` di `<PublicButton>`) dengan visual BERBEDA
(`background:transparent; color:var(--primary); border:transparent` — link tipis tanpa border,
dipakai luas untuk "Lihat Semua"/"Kembali" sesuai tabel variant di CLAUDE.md). Reference CSS user
memakai nama class yang sama (`.btn-ghost`) tapi mendeskripsikan visual TOTAL BERBEDA (pill
berbingkai, ada background+border). **Tidak ditimpa** — akan merusak semua pemakai `.btn-ghost`
lain di aplikasi. Dibuat sebagai komponen React berdiri sendiri dengan Tailwind inline, bukan
class global baru:

```tsx
// apps/web/components/website/public/sections/section-see-all-link.tsx
<a className="inline-flex items-center gap-[7px] shrink-0 rounded-md border-[1.5px] border-border
  bg-background px-[1.4rem] py-[0.72rem] text-[0.95rem] font-medium text-muted-foreground
  shadow-sm transition-all duration-200 hover:border-primary hover:text-primary">
```

Terjemahan token: `var(--white)` → `bg-background`, `var(--slate-600)` → `text-muted-foreground`,
`var(--slate-200)` (border) → `border-border`, `var(--radius-md)` → `rounded-md` (sudah identik
`--radius-md: var(--radius)` di proyek ini, tidak perlu diterjemahkan). "Warna sesuaikan branding
masing2" (instruksi eksplisit user) dipenuhi oleh `hover:border-primary hover:text-primary` — state
hover ikut `--primary` per-tenant, bukan warna hardcode.

Dipakai ulang oleh `PostsSectionTitle` (menggantikan implementasi lama yang duplikat inline) —
satu komponen, dua pemakai (Posts/Produk/Campaign/Event via `PostsSectionTitle`, dan siap dipakai
Keunggulan/Tentang Kami/Galeri via `SectionTitleBlock` kapan pun field "Lihat Semua" ditambahkan
ke salah satu section itu — belum dikerjakan, di luar scope sesi ini).

## 6. Sweep Lanjutan — Screening SEMUA Section (2026-07-22, sesi sama)

User minta "screening semua section ... menggunakan ukuran yang sama pakai section title", eksplisit
kecuali Hero dan CTA (keduanya punya judul besar tersendiri, § 1). Audit menyeluruh
(`grep -rn "<h1\|<h2\|<h3"` di seluruh `components/website/public/sections/` +
`landing-template.tsx`) memisahkan dua kelas elemen:

1. **Judul SECTION** (chrome section, bukan konten individual di dalamnya) — semua disamakan ke
   `.section-title`.
2. **Judul ITEM/CARD** (nama post/produk/event/campaign di dalam card, judul item repeater
   Keunggulan/Tentang Kami) — SENGAJA TIDAK disentuh, beda kelas (konten individual, bukan chrome
   section) — contoh: `<h3 className="text-4xl md:text-5xl ...">` di `posts-design-2.tsx` adalah
   judul artikel unggulan di dalam kartu, bukan judul section "Berita Terbaru"-nya.

**Titik yang disamakan ke `.section-title`:**

| Lokasi | Sebelum | Sesudah |
|--------|---------|---------|
| `PostsSectionTitle` (Post/Produk/Campaign/Event, hampir semua design) | `font-normal leading-none m-0 text-4xl lg:text-[48px]` + inline `letterSpacing:-0.02em` | `section-title !mb-0` (margin dinolkan — flex `items-end` dengan tombol "Lihat Semua", tidak ada konten di bawahnya) |
| `posts-design-1.tsx` (Design "Hero 3 Kolom", judul bespoke tanpa `PostsSectionTitle`) | `text-2xl font-bold mb-6 border-b border-border pb-3` | `section-title !mb-6 border-b border-border pb-3` (`!mb-6` mempertahankan jarak visual asli ke grid post di bawahnya — bukan mengandalkan margin bawaan 0.6rem `.section-title`) |
| `modules-design-2.tsx` (Strip Modul Desain 2, flex `items-end` dengan tombol scroll rail) | `text-2xl sm:text-3xl font-bold m-0` | `section-title !m-0` |
| `ContactInfoSection` ("Info Kontak", judul statis tanpa eyebrow/deskripsi) | `text-2xl font-bold mb-6` | `section-title !mb-6` |
| `StatsSection` ("Statistik") | **Tidak ada judul sama sekali** — cuma grid angka | `<SectionTitleBlock>` baru ditambahkan (lihat § 6a) |

**Pola `!mb-*`/`!m-0` (Tailwind important-modifier)**: `.section-title` bawaannya
`margin-bottom: 0.6rem`. Di tempat yang butuh margin BEDA dari bawaan itu (nol untuk layout flex
`items-end`, atau angka lama seperti `mb-6` untuk mempertahankan proporsi visual desain yang
sudah ada), override WAJIB pakai `!` (compile ke `margin-bottom: ... !important`) — `.section-title`
didefinisikan di luar `@layer utilities` (plain top-level rule di `globals.css`), jadi urutan
cascade vs utility Tailwind biasa (yang emit di dalam `@layer utilities`) tidak bisa diandalkan
tanpa `!important` eksplisit.

### 6a. `StatsSection` — Judul Ditambahkan dari Nol

Beda dari 4 titik lain (murni ganti ukuran, sudah punya judul) — `StatsSection` sebelumnya
SAMA SEKALI tidak punya mekanisme judul (`SECTION_DEFAULTS.stats = { items: [] }`, `StatsEditor`
cuma repeater number+label). Ditambahkan `eyebrow`/`title`/`headerDesc` opsional (default string
kosong — section existing manapun otomatis TIDAK berubah tampilan, `SectionTitleBlock` return
`null` kalau ketiganya kosong, persis pola backward-compat yang sama dipakai Features/About/
Gallery). Wrapper sama seperti Galeri: `max-w-3xl mx-auto text-center mb-10`. Tidak menambahkan
opsi `background` ke Stats (di luar scope permintaan — hanya soal ukuran judul, bukan varian
visual baru) — selalu `background="none"` (default), eyebrow selalu `text-primary`.

## 9. Perluasan ke Post/Produk/Campaign/Event — `PostsSectionTitle` Dapat Trio Standar + Align

Lanjutan langsung (sesi berikutnya) — user minta Product/Event/Campaign/Donasi (dan secara implisit
Post, karena semuanya berbagi `PostsSectionTitle`) juga punya standar 3-judul yang sama
(eyebrow/judul/deskripsi), dengan syarat tambahan: tombol "Lihat Semua" **selalu di kanan** untuk
align "left" (perilaku default, tidak berubah), tapi **pindah ke baris terpisah di bawah, terpusat**
untuk align "center" — HANYA 2 opsi align (left/center), beda dari Keunggulan/CTA yang punya 3
(left/center/right).

### 9a. `PostsSectionTitle` Direstrukturisasi — Reuse `SectionTitleBlock`, Bukan Duplikasi

Sebelumnya `PostsSectionTitle` render eyebrow/judul secara manual sendiri (JSX terpisah dari
`SectionTitleBlock`). Sekarang delegasikan sepenuhnya ke `<SectionTitleBlock>` untuk trio konten —
dua perubahan pada `SectionTitleBlock` diperlukan supaya reuse ini valid:
- `title` type: `string` → `ReactNode` — `PostsSectionTitle` mengirim `renderTitle(title)` (array
  elemen hasil parsing markup `*italic*`→`<em>` berwarna primary), bukan string polos. Existing
  caller (Features/About/Gallery/Statistik) tetap kirim `string` — valid subset dari `ReactNode`,
  nol perubahan perilaku.
- `as?: "h2" | "h3"` (default `"h2"`) — `PostsSectionTitle` butuh dukungan `h3` untuk sub-header
  per-kolom Design 4 "Trio Column" (lihat § 9d), diteruskan lewat komponen ini juga.

Field `label` (teks mono kecil, TIDAK PERNAH dipakai satu caller pun — dikonfirmasi grep sebelum
dihapus) **dihapus total** dari `PostsSectionTitle`, digantikan `eyebrow` yang konsepnya sama
(teks kecil di atas judul) tapi konsisten secara visual dengan section lain.

### 9b. Layout Dua Mode — `align="left"` (default) vs `align="center"`

```tsx
// align="left" — flex items-end justify-between, SAMA seperti sebelumnya
<div className="flex items-end justify-between gap-6 mb-10 flex-wrap">
  <SectionTitleBlock ... className="[&>*:last-child]:!mb-0" />
  {href && <SectionSeeAllLink ... className="self-end" />}
</div>

// align="center" — title block terpusat, tombol di baris terpisah di bawah
<div className="mb-10">
  <div className="max-w-3xl mx-auto"><SectionTitleBlock ... className="text-center" /></div>
  {href && <div className="flex justify-center mt-6"><SectionSeeAllLink .../></div>}
</div>
```

**`[&>*:last-child]:!mb-0` (arbitrary child selector) — bukan `!mb-0` langsung pada
`SectionTitleBlock`**: di mode "left", trailing margin HARUS nol supaya tombol "Lihat Semua" align
persis ke baseline via `items-end` — tapi elemen TERAKHIR di dalam title block bisa berbeda
(judul kalau tanpa deskripsi, deskripsi kalau ADA — baru mungkin sekarang karena `description`
adalah fitur BARU di komponen ini). Selector `[&>*:last-child]` menargetkan child TERAKHIR
APAPUN bentuknya secara otomatis, alih-alih hardcode asumsi "yang terakhir pasti judul" seperti
sweep sebelumnya (§ 6, sebelum `description` ada di `PostsSectionTitle`).

### 9c. Data Shape — 3 Field Baru di 4 Tipe Section

`PostsSectionData`/`ProductsSectionData`/`CampaignsSectionData`/`EventsSectionData` (masing-masing
`lib/*-section-designs.ts`) — tambah `eyebrow?: string`, `headerDesc?: string`, `titleAlign?:
SectionTitleAlign` (baru, `lib/section-title-align.ts`, 2 opsi: `left`/`center`). Semua opsional,
TIDAK ditambahkan ke `SECTION_DEFAULTS` di `page-templates.ts` — mengikuti konvensi LOKAL 4 tipe
section ini (minimal defaults, andalkan optional chaining `?? ""`/`?? "left"` di titik baca),
BEDA dari CTA/Features yang exhaustive-list semua field di default (dua konvensi berbeda yang
sudah ada di codebase ini sebelum sesi ini, dihormati masing-masing bukan diseragamkan paksa).

Editor (`section-editors.tsx`) — `PostsEditor`/`ProductsEditor`/`CampaignsEditor`/`EventsEditor`
semua dapat 2 `Field` (eyebrow, deskripsi) + 1 `OptionRow` (posisi judul) tepat setelah field
"Judul Section". Untuk `PostsEditor` khusus: field ini disembunyikan (`showTitleFields = !isHero
&& !isTrio`) saat Design 1 "Hero 3 Kolom" atau Design 4 "Trio Column" aktif — keduanya TIDAK
memakai `PostsSectionTitle` sebagai judul section (lihat § 9d) sehingga field itu tidak akan
berpengaruh sama sekali kalau tetap ditampilkan.

### 9d. Yang SENGAJA Tidak Ikut — Design 1 "Hero 3 Kolom" dan Design 4 "Trio Column" (Post)

Dua design Post ini TIDAK memakai `PostsSectionTitle` untuk judul section secara keseluruhan:
- **Design 1** (`posts-design-1.tsx`) — judul bespoke (`section-title !mb-6 border-b...`, § 6),
  tanpa tombol "Lihat Semua" sama sekali. Struktural berbeda dari 3 design Post lain (dan semua
  design Product/Campaign/Event) — TIDAK diberi eyebrow/deskripsi/align, dibiarkan seperti hasil
  § 6 (murni penyamaan ukuran).
- **Design 4** (`posts-design-4.tsx`) — TIDAK punya judul section sama sekali. Setiap dari 3
  kolomnya render `<PostsSectionTitle as="h3" title={col.filterLabel} href={col.filterHref} />`
  sendiri-sendiri (nama kategori/tag per-kolom sebagai sub-header) — bukan judul section
  keseluruhan, tidak ada `data.eyebrow`/`headerDesc`/`titleAlign` yang relevan di level ini.

11 design lain (Post 2/3/5, Produk 1/2/3, Campaign 1/2/3, Event 1/2/3) semuanya SATU baris
`<PostsSectionTitle title={sectionTitle} href={filterHref} .../>` di level section (bukan
per-item) — semua diperluas menerima `eyebrow={data.eyebrow} description={data.headerDesc}
align={data.titleAlign}`. Beberapa design (Post 5, Produk 3 — keduanya carousel dengan tombol
panah scroll) menaruh `<PostsSectionTitle className="mb-0" />` di dalam `flex-1` bersama tombol
panah — `align="center"` masih BISA dipilih admin di sana, tapi hasilnya kurang ideal (title block
akan center DI DALAM kolom sempit `flex-1`, bukan center relatif ke section penuh) — trade-off
yang diterima (bukan bug, admin cukup tidak memilih "center" untuk 2 design carousel ini), tidak
ada guard khusus yang mencegah pemilihannya.

## 10. File yang Disentuh (§ 1–9)

| File | Perubahan |
|------|-----------|
| `components/website/public/sections/section-title-block.tsx` | Baru — komponen `<SectionTitleBlock>` |
| `components/website/public/sections/section-see-all-link.tsx` | Baru — komponen `<SectionSeeAllLink>` |
| `lib/section-background.ts` | Tambah `resolveAccentTextClass()` |
| `app/globals.css` | Tambah `.section-title` |
| `components/website/public/sections/posts/posts-section-title.tsx` | "Lihat Semua" pakai `<SectionSeeAllLink>`; judul pakai `.section-title`; § 9: restrukturisasi total — reuse `SectionTitleBlock`, tambah `eyebrow`/`description`/`align`, hapus `label` |
| `components/website/public/sections/posts/posts-design-1.tsx` | Judul "Hero 3 Kolom" pakai `.section-title` |
| `components/website/public/sections/modules/modules-design-2.tsx` | Judul Strip Modul Desain 2 pakai `.section-title` |
| `components/website/public/landing-template.tsx` | `GallerySection`/`AboutTextSection`/`FeaturesSection`/`ContactInfoSection` pakai `.section-title`/`<SectionTitleBlock>`; `StatsSection` dapat judul baru |
| `lib/page-templates.ts` | `SECTION_DEFAULTS.stats` tambah `eyebrow`/`title`/`headerDesc` (opsional, default kosong) |
| `components/website/section-editors.tsx` | `StatsEditor` tambah 3 field judul; § 9: `PostsEditor`/`ProductsEditor`/`CampaignsEditor`/`EventsEditor` — 2 `Field` + 1 `OptionRow` baru |
| `lib/section-title-align.ts` | Baru — `SectionTitleAlign` (`left`/`center`) untuk § 9 |
| `lib/posts-section-designs.ts`, `products-section-designs.ts`, `campaigns-section-designs.ts`, `events-section-designs.ts` | Tambah `eyebrow?`/`headerDesc?`/`titleAlign?` (§ 9c) |
| 11 file `sections/{posts,products,campaigns,events}/*-design-*.tsx` | Wire `eyebrow`/`description`/`align` ke `<PostsSectionTitle>` (§ 9d) |

## 11. Di Luar Scope (§ 1–9, dicatat bukan lupa)

- CTA & Hero tidak disentuh (lihat § 1, dikonfirmasi ulang eksplisit oleh user di sweep ini) —
  judulnya tetap independen.
- Judul ITEM/CARD (post/produk/event/campaign individual, item repeater Keunggulan/Tentang Kami)
  SENGAJA TIDAK disamakan — beda kelas dari judul SECTION, lihat § 6.
- Keunggulan/Layanan tidak diretrofit ke `SectionBackground` 5-opsi standar (`FeaturesBackground`
  4-opsi tetap dipertahankan) — keputusan lama, dipertahankan lagi di sesi ini.
- `StatsSection` tidak dapat opsi `background` (§ 6a) — di luar scope permintaan ukuran judul.
- Belum ada field "Lihat Semua" di data shape Keunggulan/Tentang Kami/Galeri/Statistik —
  `SectionTitleBlock` sudah SIAP menerima itu (lewat komposisi `<SectionSeeAllLink>` di caller),
  tapi belum divariabel-kan sebagai prop resmi karena belum ada section yang genuinely butuh
  fitur ini.
- `posts-design-1.tsx` (Hero 3 Kolom) dan per-kolom `posts-design-4.tsx` (Trio Column) TIDAK dapat
  eyebrow/deskripsi/align — struktural tidak memakai `PostsSectionTitle` sebagai judul section
  keseluruhan, lihat § 9d.
- `titleAlign="center"` TIDAK di-guard dari 2 design carousel (Post 5, Produk 3) meski hasilnya
  kurang ideal di sana (title block center di dalam kolom sempit, bukan center penuh section) —
  lihat § 9d, trade-off diterima bukan bug.
- `eyebrow`/`headerDesc`/`titleAlign` TIDAK ditambahkan ke `SECTION_DEFAULTS` (`page-templates.ts`)
  untuk 4 tipe section di § 9 — mengikuti konvensi lokal (minimal defaults) yang sudah ada
  sebelumnya untuk Posts/Produk/Campaign/Event, berbeda dari konvensi exhaustive CTA/Features.

## 12. Audit Kelengkapan + Perluasan ke Strip Modul/Galeri/Statistik

Setelah § 9 selesai, user minta audit menyeluruh: dari 13 tipe section (`SECTION_TYPES`,
`lib/page-templates.ts`), mana yang BELUM lengkap standar 3-judulnya. Hasil audit:

| Section | Eyebrow | Deskripsi | Align (left/center) | Status sebelum § 12 |
|---|---|---|---|---|
| Post/Produk/Campaign/Event | ✅ | ✅ | ✅ | Selesai (§ 9) |
| Hero, CTA | — | — | — | Sengaja dikecualikan (§ 1) |
| Tentang Kami, Keunggulan/Layanan | ✅ | ✅ | ✅* | Selesai (sesi sebelumnya) — *Keunggulan pakai 3 opsi (kiri/tengah/**kanan**), bukan 2, dari desain awalnya sendiri, TIDAK diubah di § 12 |
| **Strip Modul** | ❌ | ❌ | ❌ | GAP — Design 1 pakai `PostsSectionTitle` tapi tidak diwire; Design 2 raw `<h2>` tanpa `SectionTitleBlock` sama sekali |
| **Galeri Foto** | ✅ | ✅ | ❌ | GAP — sudah punya eyebrow/judul/deskripsi (sesi lalu), wrapper di-hardcode `text-center`, tidak ada pilihan align |
| **Statistik** | ✅ | ✅ | ❌ | GAP sama seperti Galeri |
| Info Kontak | ❌ | ❌ | ❌ | Judul "Info Kontak" hardcode, BUKAN field admin — di luar scope (§ 11) |
| Divider | — | — | — | Tidak ada konsep judul sama sekali — N/A |

User pilih beresin ketiganya (Strip Modul, Galeri, Statistik) sekaligus.

### 12a. Default Align BERBEDA per Section — Kunci Backward-Compat

**Yang paling kritis di perluasan ini**: Post/Produk/Campaign/Event (§ 9) defaultnya `"left"`
(perilaku ASLI mereka sebelum align ada — title kiri, tombol kanan). Tapi Galeri dan Statistik
perilaku ASLI-nya SUDAH SELALU center (hardcode `text-center`, tanpa opsi lain) — kalau
`titleAlign` di-default ke `"left"` untuk keduanya, section EXISTING yang sudah dikonfigurasi
(punya eyebrow/judul/deskripsi tersimpan) akan tiba-tiba lompat dari center ke kiri, REGRESI
VISUAL nyata. Fix: `const titleAlign = d.titleAlign ?? "center"` (bukan `"left"`) khusus di
`GallerySection` dan `StatsSection` — satu-satunya baris kritis yang membedakan perluasan ini
dari pola default § 9. `SECTION_DEFAULTS.gallery`/`SECTION_DEFAULTS.stats` juga eksplisit set
`titleAlign: "center"` (bukan diam-diam mengandalkan fallback runtime) — kedua entri ini SUDAH
pakai gaya exhaustive-default (beda dari Post/Produk/dst yang minimal-default, § 9c), jadi
`titleAlign` ditambahkan ke situ juga demi konsistensi dengan field-field lain di entri yang sama.

Pola align-nya sendiri (2-part: `flex flex-col ${alignItemsCls}` mengatur POSISI blok,
`max-w-3xl ${textAlignCls}` mengatur ALIGN TEKS di dalamnya) disalin dari `FeaturesSection`
(sudah lebih dulu ada, bukan pola baru) — bukan cukup `text-center`/`text-left` saja pada
`SectionTitleBlock`, karena tanpa `items-center`/`items-start` di flex parent, blok `max-w-3xl`
akan selalu menempel ke kiri (default flex alignment) terlepas dari `text-align` di dalamnya.

### 12b. Strip Modul — Dua Design, Dua Pendekatan Beda

**Design 1 (Ikon)** — sudah pakai `PostsSectionTitle` sejak awal, TAPI dispatcher
(`modules-section.tsx`) dan `ModulesDesign1` belum diwire menerima `eyebrow`/`description`/
`align` (kelewat saat § 9 karena Modules tidak disebut eksplisit user waktu itu). Fix murni
plumbing — tambah 3 prop, teruskan ke `<PostsSectionTitle>`, otomatis dapat seluruh mekanisme
(termasuk tombol) yang sudah dibangun di § 9.

**Design 2 (Foto)** — TIDAK memakai `PostsSectionTitle` sama sekali (raw `<h2 className=
"section-title !m-0">`), karena "tombol"-nya bukan href-based "Lihat Semua" (`SectionSeeAllLink`)
melainkan SEPASANG tombol panah `ChevronLeft`/`ChevronRight` yang mengontrol scroll rail carousel
— beda semantik, tidak bisa langsung reuse `PostsSectionTitle` (yang built-in untuk 1 tombol
opsional berbasis href). Direstrukturisasi manual mengikuti POLA yang sama (bukan komponennya):
`align="left"` → title+panah satu baris (`flex items-end justify-between`, panah SELALU tampil
karena bukan opsional seperti "Lihat Semua"); `align="center"` → title block terpusat lalu panah
di baris terpisah di bawah, juga terpusat — identik strukturnya dengan `PostsSectionTitle`'s
mode "center", cuma `<SectionSeeAllLink>` diganti pasangan tombol panah. Reuse `<SectionTitleBlock>`
langsung (bukan `PostsSectionTitle`) karena Design 2 tidak butuh href/`linkLabel` sama sekali.

## 13. File yang Disentuh (§ 12)

| File | Perubahan |
|------|-----------|
| `lib/module-strip-designs.ts` | `ModulesSectionData` tambah `eyebrow?`/`headerDesc?`/`titleAlign?` |
| `components/website/public/sections/modules/modules-section.tsx` | Dispatcher teruskan 3 field baru ke kedua design |
| `components/website/public/sections/modules/modules-design-1.tsx` | Terima+teruskan `eyebrow`/`description`/`align` ke `PostsSectionTitle` |
| `components/website/public/sections/modules/modules-design-2.tsx` | Restrukturisasi total — reuse `SectionTitleBlock`, 2 mode align manual dengan tombol panah (§ 12b) |
| `lib/gallery-section-designs.ts` | `GallerySectionData` tambah `titleAlign?` (default runtime `"center"`, § 12a) |
| `lib/page-templates.ts` | `SECTION_DEFAULTS.gallery`/`.stats` tambah `titleAlign: "center"` eksplisit |
| `components/website/public/landing-template.tsx` | `GallerySection`/`StatsSection` — 2-part align pattern (§ 12a), import `SectionTitleAlign` |
| `components/website/section-editors.tsx` | `ModulesEditor`/`GalleryEditor`/`StatsEditor` — tambah `Field` eyebrow/desc (Modules) + `OptionRow` align (ketiganya) |

## 14. Di Luar Scope (§ 12, dicatat bukan lupa)

- Keunggulan/Layanan TETAP 3 opsi align (kiri/tengah/kanan) — TIDAK diseragamkan ke 2 opsi
  seperti section lain, itu bukan gap tapi desain awalnya sendiri (§ 12 tabel).
- Info Kontak dan Divider TETAP tidak tersentuh — keduanya bukan gap (§ 12 tabel: Info Kontak
  judulnya bukan field admin sama sekali; Divider tidak punya konsep judul).
- Strip Modul Design 2 TIDAK diberi opsi menyembunyikan tombol panah — panah selalu tampil
  (fungsional, mengontrol rail), beda dari "Lihat Semua" yang genuinely opsional (§ 12b).
