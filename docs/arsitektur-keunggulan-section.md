# Arsitektur Section Keunggulan/Layanan (Features) — jalakarta

> Status: **SELESAI** (2026-07-22). Section landing page "Keunggulan/Layanan" — sebelumnya cuma
> title tetap (selalu center) + grid kartu dengan icon EMOJI teks bebas. Sekarang tetap **Design 1
> tunggal** (pola sama `docs/arsitektur-cta-section.md`) dengan banyak sub-opsi, dan icon jadi
> picker sungguhan dari `lucide-react` (bukan lagi ketik emoji manual). Sumber ide visual:
> `design-refs/sections/keunggulan/keunggulan-layanan-default.jpg` — user eksplisit bilang ini
> "cuma bayangan", bukan referensi presisi yang harus ditiru literal.
>
> **Update 2026-07-22**: blok header (eyebrow+judul+deskripsi) sekarang dirender via
> `<SectionTitleBlock>` — komponen bersama dengan section Tentang Kami dan Galeri Foto. Detail:
> `docs/arsitektur-section-title-block.md`.

---

## 1. Prolog yang Dikunci User

Semua landing page tersusun dari **section**, dan setiap section punya **desain bermacam-macam**
— prinsip umum yang sudah berlaku sejak Hero/Modules/CTA, ditegaskan ulang eksplisit sebelum
task ini dimulai. Section ini (seperti CTA) tetap **"Design 1" tunggal** — sub-opsinya adalah flat
field di data, BUKAN `section.variant` baru. Kalau nanti butuh struktur JSX yang benar-benar beda,
itu jadi Design 2 sungguhan dengan registry sendiri, bukan menambah axis di sini.

---

## 2. Lima Axis Opsi

### 2.1 Title Block (`eyebrow`, `title`, `headerDesc`)

Tiga field independen, **masing-masing tampil hanya kalau diisi** (tidak ada field wajib):
- `eyebrow` — "judul kecil", label kecil huruf kapital (mis. "FUTURE PAYMENT")
- `title` — "judul besar", heading section
- `headerDesc` — "deskripsi" header — **BEDA dari `FeatureItem.desc`** (deskripsi per-item di
  repeater) — nama field sengaja dipisah untuk hindari kebingungan

**`titleAlign`**: `left` | `center` (default) | `right` — berlaku untuk eyebrow+title+headerDesc
sekaligus, sebagai satu wrapper `max-w-3xl` (pola sama CTA — satu box lebar konsisten, bukan
masing-masing elemen punya max-width sendiri, lihat lesson CLAUDE.md soal ini).

**`descPosition`**: `below` (default) | `beside` — `below` = headerDesc mengalir di bawah title
dalam satu kolom. `beside` = 2 kolom (`md:flex-row md:justify-between`): eyebrow+title kiri,
headerDesc kanan (`md:max-w-sm`) — persis pola referensi gambar.

### 2.2 Background Section (`background`)

`light` (default, `bg-muted/40` — sama persis warna lama) | `primary` (`bg-primary text-primary-
foreground`) | `secondary` (`bg-secondary text-secondary-foreground`) | `white` (`bg-white`).

### 2.3 Lebar (`width`)

`full` (default) — section langsung punya `bgClass`, konten flow biasa di `max-w-7xl`, TIDAK ada
kartu pembungkus (perilaku lama). `boxed` — section luar transparan (`px-4 py-14`, ikut bg
halaman) + box di dalamnya (`max-w-7xl mx-auto rounded-3xl shadow-sm`) yang punya `bgClass`. Pola
identik CTA § 2 "Lebar" — TIDAK ada toggle radius terpisah untuk Features (user tidak memintanya
di sini, beda dari CTA yang punya `boxedRadius`) — boxed Features SELALU `rounded-3xl`.

### 2.4 Gaya Icon (`iconStyle`, `iconColor`, `iconShape`)

- **`iconStyle`**: `plain` (default) — icon polos `h-8 w-8 text-primary`, tanpa kotak/background.
  `colored` — icon di dalam kotak `h-12 w-12` berwarna.
- **`iconColor`** (hanya relevan saat `colored`): `primary` (default) | `secondary` — jadi
  `bg-{color} text-{color}-foreground` pada kotak icon.
- **`iconShape`** (hanya relevan saat `colored`): `square` (rounded-none) | `rounded` (rounded-
  full, lingkaran/pill) | `square-radius` (default, `rounded-xl` — kotak dengan sudut membulat,
  BEDA dari `square` siku sempurna maupun `rounded` lingkaran penuh).

**Kontras saat item di-highlight** (lihat § 2.5): icon `plain` pada item ter-highlight TIDAK
diberi `text-primary` eksplisit — dibiarkan kosong supaya inherit `currentColor` dari card
wrapper-nya (yang sudah di-set `text-{color}-foreground`), otomatis kontras. Icon `colored` tidak
perlu penanganan khusus karena kotak icon-nya independen dari background card.

### 2.5 Gaya Kartu Item (`cardRadius`, `cardBackground`, `highlightFirst`, `highlightColor`)

- **Border**: SELALU ada (`border border-border`), tipis, TIDAK ada toggle on/off — hanya
  radiusnya yang jadi axis (`cardRadius: boolean`, default `true` = `rounded-xl`, `false` =
  `rounded-none`). Bacaan literal instruksi user "border tipis cantik dengan/tanpa radius" dibaca
  sebagai SATU axis (radius), bukan dua (border presence + radius) — border-nya sendiri fixed.
- **`cardBackground`**: `none` (transparan) | `white` (default, `bg-white`) — berlaku UNIFORM ke
  semua item KECUALI yang di-highlight (lihat poin berikut).
- **`highlightFirst`** (boolean, default `false`): kalau `true`, **item index 0 SAJA** dapat
  override fill `bg-{highlightColor} text-{highlightColor}-foreground` — border tetap ada
  (`border-border`, warna netral, tetap kontras di atas fill berwarna). Item lain (index 1+) tetap
  ikuti `cardBackground` normal.
- **`highlightColor`** (hanya relevan saat `highlightFirst=true`): `primary` (default) |
  `secondary`.

---

## 3. Icon Picker — Komponen Baru (`components/ui/icon-picker.tsx`)

**Sebelumnya field icon adalah `<Input>` teks bebas** — admin ketik emoji manual (`⭐`). Ini
diganti total: dropdown searchable dari katalog kurasi `lib/icon-catalog.ts`.

### Keputusan cakupan katalog (dikonfirmasi user 2026-07-22)

**Kurasi ~120 icon relevan konteks bisnis/layanan**, BUKAN seluruh `lucide-react` (~1700+ icon
di versi terinstall). Alasan: mayoritas icon di library penuh tidak relevan (bahasa pemrograman,
medis spesifik, dll) dan search UI jadi berat/berisik kalau expose semua. Dikelompokkan 10
kategori (`ICON_CATEGORIES`): Umum & Pencapaian, Keamanan, Keuangan, Komunikasi & Dukungan,
Orang & Komunitas, Teknologi, Waktu & Proses, Dokumen & Info, Logistik & Belanja, Lainnya.

### Setiap nama icon WAJIB diverifikasi dulu terhadap package yang benar-benar terinstall

**Bug yang dicegah SEBELUM ditulis, bukan ditemukan setelah build gagal**: nama icon populer di
versi lucide-react LAMA (`CheckCircle2`, `BarChart3`, `HelpCircle`, `Filter`, `PieChart`,
`LineChart`, `Fingerprint`) **TIDAK ADA** di `lucide-react@1.8.0` (versi terinstall project ini)
— sudah di-rename ke skema "Circle-first"/nama lain (`CircleCheck`, `ChartBar`, tidak ada
pengganti persis untuk `HelpCircle`, `Filter`→`ListFilter`, `ChartPie`, `ChartLine`,
`FingerprintPattern`). Verifikasi dilakukan dengan dump SELURUH nama export dari
`node_modules/.../lucide-react/dist/lucide-react.d.ts` ke daftar referensi, baru pilih icon dari
daftar itu — bukan menebak dari memori/versi lama. **Aturan untuk penambahan icon ke katalog ke
depan**: SELALU verifikasi dulu (`grep "declare const NamaIcon:" .../lucide-react.d.ts`) sebelum
menambah entry baru — jangan asumsikan nama icon dari familiaritas versi lain.

### UI Picker

Trigger `<Button variant="outline">` menampilkan icon terpilih + namanya → `Popover` berisi
`Command` (dari shadcn/cmdk) dengan `CommandInput` (search) + `CommandGroup` per kategori. Grid
7 kolom (`grid-cols-7`) per kategori — BUKAN list vertikal standar `Command` — dicapai lewat
Tailwind arbitrary selector `[&_[cmdk-group-items]]:grid` pada `className` `CommandGroup` (cmdk
merender wrapper `[cmdk-group-items]` internal yang tidak bisa ditarget langsung via prop biasa).

**Search dua lapis**: `CommandItem value={`${name} ${keywords}`}` — `keywords` adalah sinonim
Bahasa Indonesia per icon (mis. `DollarSign` → `"uang mata uang dolar rupiah"`) supaya admin non-
teknis bisa ketik "uang" dan tetap ketemu icon yang relevan, bukan cuma nama Inggris literal.
Pattern `onSelect={() => onChange(name)}` pakai closure (name dari iterasi map), BUKAN parameter
balik cmdk — konsisten dengan lesson lama "Combobox generik cari berdasar UUID" (`value` cmdk
untuk searching, resolusi via closure).

### Resolusi render — `resolveIcon(name)`

Data JSON hanya simpan STRING nama icon (mis. `"CircleCheck"`). Saat render, `resolveIcon()`
lookup ke `ICON_MAP` (dibangun sekali dari `ICON_CATALOG` via `Object.fromEntries`) — kalau nama
tidak ditemukan (termasuk EMOJI LAMA dari data pre-existing, mis. `"⭐"`), fallback otomatis ke
`DEFAULT_ICON_NAME = "CircleCheck"`. **Ini bukan backward-compat sempurna** — section Keunggulan
existing dengan emoji lama akan diam-diam berganti jadi icon default (bukan crash, bukan kosong)
begitu deploy — trade-off yang diterima karena emoji dan nama-icon-string secara struktural tidak
bisa dipetakan otomatis satu sama lain.

---

## 4. Data Shape (`FeaturesSectionData`, `lib/features-section-designs.ts`)

```typescript
export type FeatureItem = { icon: string; title: string; desc: string };

export type FeaturesSectionData = {
  eyebrow?:         string;
  title?:           string;
  headerDesc?:      string;
  titleAlign?:      "left" | "center" | "right";
  descPosition?:    "below" | "beside";
  background?:      "light" | "primary" | "secondary" | "white";
  width?:           "full" | "boxed";
  iconStyle?:       "plain" | "colored";
  iconColor?:       "primary" | "secondary";
  iconShape?:       "square" | "rounded" | "square-radius";
  cardRadius?:      boolean;
  cardBackground?:  "none" | "white";
  highlightFirst?:  boolean;
  highlightColor?:  "primary" | "secondary";
  items?:           FeatureItem[];
};
```

### Default — dipilih untuk PERSIS mereplikasi tampilan lama (backward compat)

`SECTION_DEFAULTS.features` di `lib/page-templates.ts` set semua axis ke nilai yang menghasilkan
tampilan SAMA PERSIS dengan implementasi lama sebelum sesi ini: `titleAlign:"center"` (dulu selalu
center, hardcode), `background:"light"` (dulu `bg-muted/40` hardcode), `width:"full"` (dulu tidak
ada konsep boxed), `iconStyle:"plain"` (dulu bare emoji tanpa container), `cardRadius:true` +
`cardBackground:"white"` (dulu `rounded-xl border bg-white` hardcode), `highlightFirst:false`
(fitur baru, default off). Section Keunggulan yang SUDAH ADA di database (dibuat sebelum sesi ini,
field-field baru ini tidak ada di data-nya) resolve ke nilai default yang sama via `?? "<default>"`
di titik baca — **nol migrasi data**, TIDAK ADA perubahan visual untuk section existing, KECUALI
icon (lihat § 3, satu-satunya breaking-tapi-graceful change).

---

## 5. File yang Disentuh

- `apps/web/lib/icon-catalog.ts` — **baru**, ~120 icon terverifikasi + `resolveIcon()` +
  `DEFAULT_ICON_NAME`
- `apps/web/components/ui/icon-picker.tsx` — **baru**, `<IconPicker>` searchable grid
- `apps/web/lib/features-section-designs.ts` — **baru**, `FeaturesSectionData` + 9 registry axis
- `apps/web/components/website/public/landing-template.tsx` — `FeaturesSection` ditulis ulang
  total, `type FeatureItem` lokal lama dihapus (import dari registry)
- `apps/web/components/website/section-editors.tsx` — `FeaturesEditor` ditulis ulang total, IconPicker
  dipasang di repeater item, `type FeatureItem` lokal lama dihapus (import dari registry), reuse
  `OptionRow` yang sudah dibuat untuk CTA (generik, tidak perlu helper baru)
- `apps/web/lib/page-templates.ts` — `SECTION_DEFAULTS.features` diperluas
- `docs/arsitektur-frontend-publik.md` § 4 — pointer ke dokumen ini

---

## 6. Di Luar Scope (dicatat, bukan lupa)

- Tidak ada Design 2 Features — semua di atas tetap satu layout logis (lihat § 1).
- Gaya icon/kartu (§ 2.4, § 2.5) berlaku **UNIFORM untuk semua item** (section-level, bukan
  per-item override) — kecuali `highlightFirst` yang eksplisit SATU pengecualian untuk item
  index 0. Tidak ada rencana per-item override warna/bentuk icon individual.
- `IconPicker` dirancang generik (tidak terikat khusus ke Features) — siap dipakai ulang section
  lain di masa depan yang butuh pilih icon, tanpa perubahan.
- Tidak ada verifikasi visual di browser (keterbatasan environment) — user perlu cek kombinasi
  axis di `/app/{slug}/website/pengaturan` setelah deploy, termasuk konfirmasi icon lama (emoji)
  pada section existing sudah berganti ke icon default dengan wajar (tidak rusak/kosong).
