# Arsitektur Section CTA — jalakarta

> Status: **SELESAI** (2026-07-22). Section landing page "Call to Action" — sebelumnya cuma 1
> layout tetap (bg sekunder, rata kiri, 1 tombol, full-bleed). Sekarang tetap **Design 1 tunggal**
> tapi dengan 4 axis sub-opsi yang bisa dikombinasikan bebas oleh admin. Sumber ide visual:
> `design-refs/sections/cta/cta-design-2.jpg` (layout "boxed" + tombol beside text + tombol kedua
> outline) — TIDAK jadi Design 2 terpisah, cukup opsi tambahan di Design 1 (lihat § 1 alasannya).

---

## 1. Kenapa Tetap "Design 1", Bukan Design 2

Section lain di app ini (Hero, Modules, Posts, dst) membedakan **layout berbeda struktur** sebagai
nomor Design terpisah (`variant: "1"|"2"|...`, resolve via registry `*_SECTION_DESIGNS`). CTA
berbeda kasus — permintaan awal eksplisit: opsi-opsi ini (align teks, warna bg, lebar, posisi
tombol) adalah **variasi tampilan dalam satu layout yang sama**, bukan struktur JSX yang beda
total. Pola yang ditiru: `funfactStyle` di Hero Design 2 (`lib/hero-section-designs.ts`) — sub-opsi
hidup sebagai field datar (flat enum) langsung di `data`, bukan `section.variant` baru.

**Aturan turunan**: kalau nanti CTA butuh layout yang STRUKTURNYA benar-benar beda (bukan cuma
kombinasi align/bg/lebar/posisi), baru itu jadi Design 2 sungguhan dengan registry sendiri
(`CTA_SECTION_DESIGN_IDS`) — ikuti pola Hero/Modules, bukan menambah axis baru di sini.

---

## 2. Empat Axis Opsi (`lib/cta-section-designs.ts`)

| Axis | Field | Nilai | Default |
|---|---|---|---|
| Align teks | `textAlign` | `left` \| `center` \| `right` | `left` |
| Background | `background` | `secondary` \| `primary` | `secondary` |
| Lebar | `width` | `full` \| `boxed` | `full` |
| Radius (hanya relevan saat `width=boxed`) | `boxedRadius` | `boolean` | `true` |
| Posisi tombol | `buttonPosition` | `below` \| `beside` | `below` |

Semua axis **independen dan bisa dikombinasikan bebas** (mis. `background=primary` +
`width=boxed` + `buttonPosition=beside` sekaligus) — bukan preset gabungan.

### Interaksi yang dikunci

- **`background=primary`** → section pakai `bg-primary text-primary-foreground`, tombol utama
  otomatis jadi `variant="secondary"` (bukan `light` lagi) — supaya tetap kontras terhadap bg
  primary. Saat `background=secondary` (default), tombol utama tetap `variant="light"` seperti
  sebelumnya.
- **`buttonPosition=beside`**: layout jadi `flex md:flex-row md:items-center md:justify-between`
  — teks (judul+deskripsi) di kolom kiri, tombol di kolom kanan, vertically centered (persis
  referensi `cta-design-2.jpg`). `textAlign` di mode ini HANYA mempengaruhi alignment teks di
  dalam kolom teksnya sendiri (title/subtitle) — posisi kolom tombol tetap di kanan, tidak ikut
  `textAlign` (kalau butuh tombol di kiri, itu use-case Design 2 sungguhan nanti, bukan axis ini).
- **`boxedRadius`** hanya render toggle di editor kalau `width=boxed` — tidak relevan untuk
  `width=full` (background span penuh viewport, radius tidak akan pernah terlihat).
- **`width=boxed`**: section terluar TIDAK punya warna (transparan, ikut bg halaman) + padding
  `py-14 px-4`; box di dalamnya (max-w-7xl mx-auto) yang punya `bgClass` + optional `rounded-3xl`.
  `width=full`: section langsung yang punya `bgClass`, full-bleed edge-to-edge seperti sebelumnya.

---

## 3. Tombol Kedua ("Tombol Kedua / Outline")

**Baru — sebelumnya CTA cuma punya 1 tombol.** Field `ctaSecondaryLabel`/`ctaSecondaryUrl`,
**selalu tersedia di editor apapun kombinasi axis lain** (dikonfirmasi user 2026-07-22 — bukan
dibatasi hanya muncul saat `background=primary`, supaya fleksibel seperti pola Hero yang sudah
punya "Tombol Kedua (opsional)"). Kalau field ini kosong → tombol kedua tidak dirender sama
sekali (section tetap valid dengan cuma 1 tombol, atau 0 tombol).

### Variant CSS baru: `outline-light`

Tombol kedua pakai `<PublicButton variant="outline-light">` — **variant baru** di sistem
`PublicButton` (`components/website/public/ui/public-button.tsx` + `.btn-outline-light` di
`globals.css`), BUKAN reuse `outline-primary`/`outline-dark` yang sudah ada (keduanya
hover-nya "fill flip" ke warna CSS var tetap — salah kalau dipakai di atas background primary/
secondary tenant yang warnanya arbitrary).

```css
.btn-outline-light {
  background-color: transparent;
  color: inherit;              /* ikut warna teks context (text-secondary-foreground / text-primary-foreground) */
  border-color: currentColor;  /* border ikut warna teks juga — otomatis "putih" di kebanyakan kasus, tapi tetap
                                   benar kalau warna tenant terang (foregroundFor() bisa hasilkan teks gelap) */
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 10%);
  &:hover  { background-color: color-mix(in srgb, currentColor 12%, transparent); transform: translateY(-1px); }
  &:active { background-color: color-mix(in srgb, currentColor 20%, transparent); transform: translateY(0); }
}
```

**Kenapa `currentColor`/`inherit`, bukan hardcode putih**: tombol ini SELALU dirender di dalam
section yang sudah punya `text-secondary-foreground`/`text-primary-foreground` di ancestor-nya —
warna itu sudah dihitung kontras yang benar oleh `foregroundFor()` (lihat `lib/theme-palette.ts`)
untuk warna tenant manapun, tidak selalu putih. `currentColor` mewarisi nilai itu otomatis, jadi
tombol tetap benar bahkan untuk tenant dengan warna sekunder/primary yang terang (teks gelap).

**Icon default**: `arrow-up` (`ArrowUpRight`, panah diagonal ↗) — cocok dengan "Learn More ↗" di
referensi. `PublicButtonVariant` diperluas jadi 9 nilai (tambah `outline-light` di akhir daftar,
posisi tidak masalah karena union type). Tidak ada perubahan ke 8 variant existing.

---

## 4. Judul — Ukuran Disamakan dengan Hero

**Sebelumnya**: `<h2>` CTA pakai inline `style={{ fontSize: "clamp(48px, 6vw, 88px)", lineHeight:
0.95 }}` + `font-normal` — SATU-SATUNYA title di seluruh sistem section yang size-nya lewat inline
CSS `clamp()`, bukan Tailwind class, dan jauh lebih besar dari Hero (88px vs Hero max 60px).

**Sekarang**: classes persis Hero Design 1 (`sections/hero/hero-design-1.tsx`):
```
text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight
```
`renderAccentTitle()` (sintaks `*teks*` → `<em>`) tidak berubah, tetap dipakai.

---

## 5. Data Shape (`CtaSectionData`, `lib/cta-section-designs.ts`)

Sebelumnya CTA TIDAK punya type khusus (anonymous inline type di 2 tempat, landing-template.tsx
dan section-editors.tsx, gampang drift). Sekarang satu sumber:

```typescript
export type CtaSectionData = {
  title?:              string;
  subtitle?:            string;
  ctaLabel?:            string;
  ctaUrl?:              string;
  ctaSecondaryLabel?:   string;
  ctaSecondaryUrl?:     string;
  textAlign?:           CtaTextAlign;        // "left" | "center" | "right"
  background?:          CtaBackground;       // "secondary" | "primary"
  width?:               CtaWidth;            // "full" | "boxed"
  boxedRadius?:         boolean;
  buttonPosition?:      CtaButtonPosition;   // "below" | "beside"
};
```

Default di `SECTION_DEFAULTS.cta` (`lib/page-templates.ts`): semua axis di nilai default-nya
(`textAlign:"left"`, `background:"secondary"`, `width:"full"`, `boxedRadius:true`,
`buttonPosition:"below"`) — supaya section CTA existing (data lama tanpa field-field ini) resolve
identik ke tampilan sebelum perubahan ini via `?? "<default>"` di titik baca, TANPA migrasi data.

---

## 6. Editor (`CtaEditor`, `section-editors.tsx`)

Field baru pakai helper lokal `OptionRow` (button-row kompak, beda dari picker "Design Layout"
yang list-vertikal-dengan-deskripsi — axis di sini cuma 2-3 pilihan singkat, bukan layout
alternatif penuh):
```tsx
function OptionRow<T extends string>({ label, ids, labels, value, onChange }: {...}) { ... }
```
Dipakai 4× (textAlign, background, width, buttonPosition) di dalam `CtaEditor`. Toggle
`boxedRadius` (checkbox biasa) HANYA dirender kondisional saat `width === "boxed"`.

`CtaEditor` **tidak dapat `variant`/`onVariantChange`** — tetap Design 1 tunggal, tidak ada
picker "Design Layout" untuk CTA (beda dari Hero/Posts/Modules yang punya >1 desain).

---

## 7. File yang Disentuh

- `apps/web/lib/cta-section-designs.ts` — **baru**, type + 4 registry axis + label
- `apps/web/app/globals.css` — tambah `.btn-outline-light`
- `apps/web/components/website/public/ui/public-button.tsx` — `PublicButtonVariant` +9,
  `VARIANT_DEFAULT_ICON.outline-light = "arrow-up"`
- `apps/web/components/website/public/landing-template.tsx` — `CtaSection` ditulis ulang total
- `apps/web/components/website/section-editors.tsx` — `CtaEditor` ditulis ulang + `OptionRow` baru
- `apps/web/lib/page-templates.ts` — `SECTION_DEFAULTS.cta` diperluas
- `docs/arsitektur-frontend-publik.md` § 4 — pointer ke dokumen ini

---

## 8. Di Luar Scope (dicatat, bukan lupa)

- Tidak ada Design 2 CTA — semua di atas tetap satu layout logis (lihat § 1).
- `outline-light` HANYA dipakai CTA saat ini — variant CSS-nya generik dan bisa dipakai section
  publik lain di masa depan yang butuh tombol outline di atas bg berwarna arbitrary, tapi belum
  ada pemanggil lain saat ditulis.
- Tidak ada verifikasi visual di browser (keterbatasan environment) — perlu dicek user langsung
  di `/app/{slug}/website/pengaturan` (section builder) setelah deploy: coba tiap kombinasi axis
  sekaligus (textAlign×background×width×buttonPosition) minimal sekali.
