# Arsitektur Section Tentang Kami (About) — jalakarta

> Status: **SELESAI** (2026-07-22). Section landing page "Tentang Kami" — sebelumnya title +
> body teks + gambar posisi kiri/kanan, layout flex tidak proporsional (teks fleksibel + gambar
> fix 320px, bukan 50/50). Sekarang tetap **Design 1 tunggal** (pola sama `docs/arsitektur-cta-
> section.md`, `docs/arsitektur-keunggulan-section.md`) dengan banyak sub-opsi, SELALU 2 kolom
> 50/50. Sumber ide visual: `design-refs/sections/about/design-about-default-1a.png` (mode list)
> dan `design-about-default-1b.png` (mode teks) — "cuma bayangan", tidak ditiru literal.
>
> **Update 2026-07-22**: blok eyebrow+judul (bukan body/list) sekarang dirender via
> `<SectionTitleBlock>` — komponen bersama dengan section Keunggulan/Layanan dan Galeri Foto.
> Detail: `docs/arsitektur-section-title-block.md`.

---

## 1. Prolog (berlaku semua section landing page)

"Semua sections di landingpage terdiri dari sections, yang mana masing-masing section memiliki
design bermacam-macam" — prinsip yang dikunci user sejak sesi CTA, ditegaskan ulang di sesi ini.
Section ini tetap **"Design 1"** tunggal — sub-opsinya flat field di data, BUKAN
`section.variant` baru.

---

## 2. Struktur Tetap: SELALU 2 Kolom 50/50

**Perubahan struktural yang disengaja, BUKAN backward-compat** — implementasi lama pakai
`flex flex-1` (teks) + `md:w-80` (gambar fix 320px), TIDAK pernah 50/50. Implementasi baru:
`grid grid-cols-1 md:grid-cols-2` — dua kolom SELALU sama lebar, bukan opsi yang bisa dimatikan.
Posisi kolom (`imagePosition`) mengatur ORDER via `md:order-1`/`md:order-2`, bukan lebar.

---

## 3. Axis Opsi

### 3.1 Background (`background`) — Standar BARU 5-Opsi

**Section PERTAMA yang pakai standar background baru** (`lib/section-background.ts`):
`none` (default — tanpa bg, ikut warna halaman, PERSIS perilaku lama) | `light` (`bg-muted/40`)
| `primary` | `secondary` | `dark` (`bg-foreground text-background`, BARU — belum ada di
CTA/Features).

**Dikunci sebagai standar untuk section BARU ke depan** (dikonfirmasi user 2026-07-22) — TAPI
**SENGAJA TIDAK diretrofit** ke CTA (2 opsi: secondary/primary) atau Keunggulan/Layanan (4 opsi:
light/primary/secondary/white) — keduanya baru saja selesai dan sudah dipakai; user eksplisit
pilih "biarkan seperti sekarang" saat ditanya, supaya tidak menambah risiko ke section yang sudah
stabil tanpa kebutuhan mendesak. `resolveSectionBgClass()` + `resolveOutlineButtonVariant()` di
`lib/section-background.ts` dirancang REUSABLE — section BERIKUTNYA yang butuh background standar
tinggal impor dari sini, tidak perlu redefinisi.

### 3.2 Lebar (`width`)

`full` (default) | `boxed` — pola identik CTA/Features (section luar transparan + box
`max-w-7xl rounded-3xl` di dalamnya saat boxed).

### 3.3 Posisi Teks Vertikal (`textVAlign`)

`top` | `center` (default) | `bottom` — align-items pada grid 2-kolom, berguna saat tinggi
kolom teks dan gambar tidak sama (mis. mode list dengan banyak item vs gambar pendek).

### 3.4 Title Block (`eyebrow`, `title`)

Dua field opsional (tampil hanya kalau diisi) — pola sama Keunggulan/Layanan: judul kecil
(eyebrow, uppercase kecil) + judul besar. TIDAK ada field "headerDesc" terpisah di sini —
beda dari Keunggulan/Layanan — karena § 3.5 (mode deskripsi) SUDAH mengisi slot itu.

### 3.5 Mode Deskripsi (`descMode`)

- **`text`** (default) — paragraf bebas (`body`), PERSIS perilaku lama.
- **`list`** — repeater item `{icon, title, desc}` (shape SAMA PERSIS `FeatureItem` dari
  Keunggulan/Layanan, tipe baru `AboutListItem` didefinisikan terpisah supaya tidak ada import
  silang yang membingungkan, meski strukturnya identik). Icon pakai `<IconPicker>` yang SAMA
  (`components/ui/icon-picker.tsx`, `lib/icon-catalog.ts`) — nol duplikasi.
  - **TIDAK ADA card/border/background per item** (beda dari Keunggulan/Layanan yang punya kartu
    berbingkai) — item list benar-benar bare, cuma `flex gap-4` (icon + judul + deskripsi).
  - **`listDividers`** (boolean, default `false`) — SATU-SATUNYA elemen visual antar-item: garis
    pemisah `divide-y divide-border` on/off. Sesuai instruksi literal user: "tidak memiliki border
    untuk box, cuma border bottom aja diaktifkan atau tidak".
  - **Gaya icon** (`iconStyle`/`iconColor`/`iconShape`) — REUSE LANGSUNG tipe+konstanta dari
    `lib/features-section-designs.ts` (`FeaturesIconStyle` dkk) — bukan didefinisikan ulang,
    konsep icon plain/berwarna+bentuk SAMA PERSIS dengan Keunggulan/Layanan.

### 3.6 Tombol (`ctaLabel`, `ctaUrl`)

**Baru — section ini sebelumnya TIDAK PUNYA tombol sama sekali.** Pakai `<PublicLinkPicker>` di
editor (pola sama CTA/Hero — "terintegrasi dengan public URL seperti header menu"). Render
`<PublicButton variant={resolveOutlineButtonVariant(background)}>` — variant OTOMATIS menyesuaikan
kontras: `outline-light` (border `currentColor`, dari sistem CTA) kalau background berwarna
(primary/secondary/dark), `outline-dark` kalau background netral (none/light). Tombol TIDAK
digantung ke `descMode` — tetap tampil terlepas mode teks atau list.

### 3.7 Gambar

- **`imagePosition`**: `left` | `right` (default) — kontrol ORDER kolom (§ 2), bukan lebar.
- **`imageRatio`**: `square` (1:1, default) | `profile` (3:4 potret — **BUKAN variant baru**,
  murni pilihan `aspect-[3/4]` CSS di tampilan, reuse nama "profile" dari variant foto profil
  anggota yang SUDAH ADA di `lib/image-processor.ts` [300×400] supaya vocabulary konsisten,
  meski modul `website` yang dipakai `MediaPicker` di sini tidak generate variant `profile`
  secara fisik — sumber gambar tetap `variants.large`/`variants.medium` seperti sebelumnya,
  CSS `object-cover` yang melakukan crop visual ke rasio manapun yang dipilih).
- **`imageRadius`**: boolean (default `true`) — SATU-SATUNYA gaya visual gambar. Gambar
  **TIDAK PERNAH** punya border/ring apa pun — "pastikan semuanya tanpa border, clean" dipegang
  ketat, tidak ada opsi border sama sekali untuk elemen gambar.

**Keputusan implementasi (dikonfirmasi user 2026-07-22, via `AskUserQuestion`)**: sempat
diusulkan opsi rasio "4:3" + kemungkinan menambah variant baru di `lib/image-processor.ts` —
user koreksi: maksudnya adalah variant **"profile"** yang SUDAH ADA (300×400, "panjang ke
bawah"), BUKAN 4:3, dan eksplisit **"jangan bikin varian baru"**. Pendekatan final: CSS-only,
nol perubahan ke pipeline gambar inti.

---

## 4. Data Shape (`AboutSectionData`, `lib/about-section-designs.ts`)

```typescript
export type AboutListItem = { icon: string; title: string; desc: string };

export type AboutSectionData = {
  eyebrow?:        string;
  title?:          string;
  body?:           string;              // descMode="text"
  items?:          AboutListItem[];     // descMode="list"
  descMode?:       "text" | "list";
  listDividers?:   boolean;
  iconStyle?:      FeaturesIconStyle;   // reuse dari features-section-designs.ts
  iconColor?:      FeaturesIconColor;
  iconShape?:      FeaturesIconShape;
  ctaLabel?:       string;
  ctaUrl?:         string;
  background?:     SectionBackground;   // reuse dari section-background.ts
  width?:          "full" | "boxed";
  textVAlign?:     "top" | "center" | "bottom";
  imagePosition?:  "left" | "right";
  imageUrl?:       string;
  imageRatio?:     "square" | "profile";
  imageRadius?:    boolean;
};
```

### Default — SEBAGIAN PRESERVASI, SEBAGIAN PERUBAHAN VISUAL DISENGAJA

Beda dari CTA/Features (yang defaultnya 100% mereplikasi tampilan lama), section ini punya
**beberapa perubahan visual yang disengaja** untuk data existing, konsekuensi langsung dari § 2
(struktur 50/50 baru) — bukan kelalaian:
- `background:"none"`, `descMode:"text"`, `textVAlign:"center"` — **preservasi**, sama persis
  perilaku lama.
- **Kolom 50/50 (§ 2)** — section existing manapun otomatis pindah dari layout lama
  (flex fleksibel + gambar 320px fix) ke grid 50/50 baru. Tidak ada toggle untuk kembali ke
  layout lama — perubahan struktural yang memang diminta ("selalu seperti ini").
- **`imageRatio:"square"` + `imageRadius:true`** — gambar existing (yang dulu TIDAK punya
  aspect-ratio paksa, render di rasio alami sumbernya) sekarang DIPAKSA jadi persegi 1:1.
  Perubahan visual yang disengaja, konsekuensi dari redesain kolom 50/50 — bukan preservasi.

Kedua perubahan ini didokumentasikan eksplisit (pola sama lesson icon-emoji-fallback di
Keunggulan/Layanan) — bukan silent regression yang tidak disadari.

---

## 5. File yang Disentuh

- `apps/web/lib/section-background.ts` — **baru**, standar 5-opsi background REUSABLE untuk
  section berikutnya + `resolveSectionBgClass()` + `resolveOutlineButtonVariant()`
- `apps/web/lib/about-section-designs.ts` — **baru**, `AboutSectionData` + 5 registry axis
  (width, textVAlign, descMode, imagePosition, imageRatio), re-export `SectionBackground`, reuse
  tipe icon dari `features-section-designs.ts`
- `apps/web/components/website/public/landing-template.tsx` — `AboutTextSection` ditulis ulang
  total, signature diperluas terima `baseUrl`+`tenantSlug` (sebelumnya cuma `data` — perlu untuk
  `PublicButton`/`stripTenantPrefix` tombol baru)
- `apps/web/components/website/section-editors.tsx` — `AboutTextEditor` ditulis ulang total,
  reuse `OptionRow` (dari CTA) dan `IconPicker`+konstanta icon Keunggulan/Layanan tanpa modifikasi
- `apps/web/lib/page-templates.ts` — `SECTION_DEFAULTS.about_text` diperluas
- `docs/arsitektur-frontend-publik.md` § 4 — pointer ke dokumen ini

---

## 6. Di Luar Scope (dicatat, bukan lupa)

- Tidak ada Design 2 Tentang Kami — semua di atas tetap satu layout logis (lihat § 1).
- Background 5-opsi (`lib/section-background.ts`) TIDAK diretrofit ke CTA/Keunggulan — lihat
  § 3.1. Kandidat retrofit terpisah kalau diminta user nanti.
- `imageRatio` TIDAK menambah variant baru ke `lib/image-processor.ts` — murni CSS, lihat § 3.7.
- Kolom SELALU 2, tidak ada opsi 1-kolom/stack-selalu (mis. untuk mobile-first tanpa gambar) —
  di luar scope permintaan, mobile tetap stack otomatis via `grid-cols-1` breakpoint bawaan.
- Tidak ada verifikasi visual di browser (keterbatasan environment) — user perlu cek kombinasi
  axis (termasuk kedua reference image 1a/1b) di `/app/{slug}/website/pengaturan` setelah deploy.
