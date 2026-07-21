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
  title?:       string;
  description?: string;
  background?:  SectionBackground;   // untuk warna eyebrow — default "none"
  className?:   string;
};
```

**Cakupan tanggung jawab — sengaja sempit**: komponen ini HANYA merender trio konten (eyebrow,
judul, deskripsi). Layout luar (align kiri/tengah/kanan, max-width, mode "beside" vs "below",
posisi di dalam grid) tetap tanggung jawab CALLER via prop `className` (diteruskan ke root
`<div>`) — bukan diseragamkan paksa, karena tiga section ini punya kebutuhan layout luar yang
LEGIT berbeda:
- Galeri: wrapper terpusat `max-w-3xl mx-auto text-center mb-10`
- Tentang Kami: TANPA wrapper terpisah — jadi child pertama dari kolom teks `space-y-4`
  (eyebrow+title saja, `description` TIDAK dipakai — body/list About dirender terpisah setelahnya)
- Keunggulan/Layanan: `max-w-3xl ${textAlignCls}` (mode "below") atau `flex-1 min-w-0
  ${textAlignCls}` (mode "beside", deskripsi dirender terpisah sebagai sibling — lihat § 4)

Return `null` kalau eyebrow, title, DAN description semuanya kosong — caller yang butuh
membungkus dengan margin/wrapper (mis. Galeri `mb-10`) tetap mengecek `hasHeader` sendiri di
level pemanggilan supaya wrapper kosong tidak ikut ter-render saat title-block-nya null.

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

## 6. File yang Disentuh

| File | Perubahan |
|------|-----------|
| `components/website/public/sections/section-title-block.tsx` | Baru — komponen `<SectionTitleBlock>` |
| `components/website/public/sections/section-see-all-link.tsx` | Baru — komponen `<SectionSeeAllLink>` |
| `lib/section-background.ts` | Tambah `resolveAccentTextClass()` |
| `app/globals.css` | Tambah `.section-title` |
| `components/website/public/sections/posts/posts-section-title.tsx` | "Lihat Semua" pakai `<SectionSeeAllLink>`, hapus implementasi inline lama |
| `components/website/public/landing-template.tsx` | `GallerySection`/`AboutTextSection`/`FeaturesSection` pakai `<SectionTitleBlock>` menggantikan JSX trio yang diulang |

## 7. Di Luar Scope (dicatat, bukan lupa)

- CTA tidak disentuh (lihat § 1) — judulnya tetap independen.
- Keunggulan/Layanan tidak diretrofit ke `SectionBackground` 5-opsi standar (`FeaturesBackground`
  4-opsi tetap dipertahankan) — keputusan lama, dipertahankan lagi di sesi ini.
- Belum ada field "Lihat Semua" di data shape Keunggulan/Tentang Kami/Galeri — `SectionTitleBlock`
  sudah SIAP menerima itu (lewat komposisi `<SectionSeeAllLink>` di caller), tapi belum divariabel-
  kan sebagai prop resmi karena belum ada section yang genuinely butuh fitur ini.
