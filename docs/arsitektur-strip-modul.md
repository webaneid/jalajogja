# Arsitektur Strip Modul — jalakarta

> Status: **SELESAI** (2026-07-16 – 2026-07-17). Section landing page independen yang menampilkan
> kartu-kartu link ke modul/direktori tenant (Donasi, Toko, Event, dst), dengan 2 desain dan sistem
> fallback foto otomatis. Dokumen terkait: `docs/arsitektur-frontend-publik.md` § 4,
> `docs/arsitektur-website.md` (landing page section builder secara umum), `design-refs/README.md`.

---

## 1. Konsep & Sejarah Singkat

Sebelum fitur ini ada, strip 4-modul (Donasi/Agenda/Dokumen/Anggota) cuma bisa hidup **di dalam**
section Hero — toggle `showModuleStrip`, daftar modul hardcoded (`HERO_MODULES`), tidak bisa
ditaruh di luar hero atau dikustomisasi. Section "Strip Modul" (`modules`) memisahkan konsep ini
jadi section landing page mandiri:

- Bisa ditambah, dipindah urutan, dihapus di landing page — seperti section lain (Posts, Products,
  Hero, dst), tidak terikat ke hero.
- Katalog modul diperluas dari 4 jadi **8**: Donasi, Toko, Event, Dokumen, Anggota (4 lama) +
  Usaha, Profesional, Pesantren (3 direktori publik yang sebelumnya tidak pernah bisa ditonjolkan
  di strip manapun).
- Admin **memilih** modul mana yang mau ditampilkan (checklist), bukan daftar tetap.

**Hero tetap punya strip modulnya sendiri** (`HERO_MODULES`, 4 item, Hero Desain 1/Klasik) — kedua
sistem ini SENGAJA independen dan tidak berbagi kode (lihat § 6).

---

## 2. Katalog Modul (`lib/module-strip-designs.ts`)

```typescript
export const MODULE_CATALOG = {
  donasi:      { path: "campaign",    label: "Donasi",          desc: "Program & infaq",       Icon: Heart },
  toko:        { path: "produk",      label: "Toko",            desc: "Belanja produk",         Icon: Store },
  event:       { path: "agenda",      label: "Event",           desc: "Agenda & kegiatan",      Icon: CalendarDays },
  dokumen:     { path: "dokumen",     label: "Dokumen",         desc: "Arsip & laporan",        Icon: FolderOpen },
  anggota:     { path: "anggota",     label: "Data Anggota",    desc: "Direktori anggota",      Icon: Users },
  usaha:       { path: "usaha",       label: "Direktori Usaha", desc: "UMKM & usaha anggota",   Icon: Building2 },
  profesional: { path: "profesional", label: "Profesional",     desc: "Direktori profesi",      Icon: Briefcase },
  pesantren:   { path: "pesantren",   label: "Pesantren",       desc: "Lembaga pendidikan",     Icon: School },
} as const;
```

`path` adalah segmen URL publik (`${baseUrl}/${path}`) — semua sudah rute publik yang ada
(`/campaign`, `/produk`, `/agenda`, dst). Icon Usaha sengaja pakai `Building2` (bukan `Briefcase`
yang dipakai halaman `/usaha` sendiri) supaya tidak collide visual dengan Profesional dalam satu
strip yang sama.

---

## 3. Dua Desain

| ID | Label | Deskripsi |
|----|-------|-----------|
| `1` | Ikon | Kartu ikon + label + deskripsi kecil, tanpa foto. Desain asli, dibuat 2026-07-16. |
| `2` | Foto | Kartu foto overlay portrait, rail scroll horizontal. Dibuat 2026-07-17, sumber ide section "Ekosistem" di `design-refs/jalakarta-v2/`. |

Picker desain di editor sama persis pola dengan section lain (Hero, Posts, dst) — button list,
`onVariantChange`.

### Desain 1 — Ikon

File: `sections/modules/modules-design-1.tsx`. Grid/rail kartu ikon (40×40 rounded box), label,
deskripsi, "Lihat semua →" muncul saat hover. Tidak butuh query database sama sekali — pure
presentasional, `data.items` langsung di-map ke `MODULE_CATALOG`.

### Desain 2 — Foto

File: `sections/modules/modules-design-2.tsx` (`"use client"` — perlu ref+onClick untuk tombol
scroll prev/next). Kartu portrait 3:4 (`rounded-[22px]`), rail `overflow-x-auto snap-x`, tiap
kartu:
- Ada foto → foto full-bleed (`object-cover`) + gradient gelap bawah (`from-black/85`) + label
  putih + tombol panah bulat putih pojok kanan-bawah.
- Tidak ada foto → gradasi warna tema (`from-primary/25 to-secondary/25`) + ikon besar di tengah.

Judul section (opsional) mendukung sintaks aksen `*kata*` → `<em>` berwarna primary, lewat
`renderAccentTitle()` (helper shared, dipakai juga oleh `CtaSection` dan Hero Desain 2 Full-Bleed
Modern — lihat `lib/render-accent-title.tsx`).

---

## 4. Data Model

```typescript
// lib/module-strip-designs.ts
export type ModuleItemConfig = {
  id:        string;  // ModuleId
  imageUrl?: string;  // foto custom, HANYA relevan untuk Desain 2
};

export type ModulesSectionData = {
  title?: string;
  items:  ModuleItemConfig[];
};
```

Field `imageUrl` per item **hanya dipakai Desain 2** — Desain 1 mengabaikannya sepenuhnya (tidak
ada konsep foto di desain itu). Tidak ada kolom/tabel database baru — semua tersimpan sebagai
JSONB di `pages.body` (kolom yang sama dipakai semua section landing page).

### Backward-compat: `normalizeModuleItems()`

Sebelum Desain 2 ada, `items` disimpan sebagai `string[]` polos (daftar ID modul, tanpa foto).
Data yang sudah tersimpan dalam format itu **tidak ikut migrasi otomatis**. Helper
`normalizeModuleItems(raw: unknown): ModuleItemConfig[]` di `lib/module-strip-designs.ts`
menormalkan kedua bentuk saat DIBACA (string → `{id: string}`, object valid → pass-through, apapun
selain itu → dibuang) — dipakai di `modules-section.tsx` (render publik) dan `ModulesEditor`
(dashboard). Begitu admin buka+simpan ulang section manapun yang masih format lama, otomatis
ter-normalisasi ke format baru saat disimpan (self-healing, tanpa migration script terpisah).

**Aturan untuk perubahan bentuk data JSONB berikutnya**: jangan asumsikan "fitur baru = aman ubah
bentuk data tanpa compat-shim" hanya karena baru dibuat di sesi yang sama — kalau sempat dites atau
disimpan sekali saja, data lama sudah ada. Lihat lesson CLAUDE.md `[2026-07-17] Bug Review
Pasca-Commit` untuk kronologi bug ini ditemukan dan diperbaiki.

---

## 5. Fallback Foto Berlapis (Desain 2)

Untuk tiap item yang dipilih admin, resolusi foto berjalan berlapis:

```
1. item.imageUrl (foto custom yang diupload admin)?  → pakai itu
2. Modul termasuk MODULES_NO_AUTO_PHOTO?              → null (fallback gradasi+ikon)
3. Query "item terbaru" modul itu, ada foto?          → pakai foto item terbaru
4. Tidak ketemu apa-apa                               → null (fallback gradasi+ikon)
```

Resolver: `resolveModuleImages()` di `sections/modules/modules-section.tsx` — pola arsitektur
identik `fetchFunfacts()` di `sections/hero/hero-section.tsx` (lazy-resolve `tenants.id` cuma
kalau ada modul yang butuh cross-schema join, `Promise.all` paralel per item).

### Field foto & query "terbaru" per modul

Field foto **tidak seragam** antar modul — 3 pola berbeda:

| Modul | Sumber foto | Query "terbaru" |
|---|---|---|
| Donasi | `campaigns.coverId` → FK `media`, resolve via `getImageUrl()` | `status='active'`, `coverId IS NOT NULL`, `ORDER BY createdAt DESC LIMIT 1` |
| Toko | `products.images[0].variants.large` atau `.url` — **sudah URL penuh**, jangan `publicUrl()` lagi | `status='active'`, `ORDER BY createdAt DESC LIMIT 1` |
| Event | `events.coverId` → FK `media`, resolve via `getImageUrl()` | `status='published' AND startsAt > NOW()`, `coverId IS NOT NULL`, `ORDER BY startsAt ASC LIMIT 1` — **event MENDATANG terdekat**, bukan "terbaru dibuat" (pola sama `heroCard` di Hero) |
| Dokumen | **tidak ada** — schema `documents` sama sekali tidak punya kolom foto/thumbnail | — (selalu `MODULES_NO_AUTO_PHOTO`) |
| Anggota | `members.photoUrl` ADA secara teknis, tapi **sengaja diskip** — keputusan eksplisit user (privasi: foto pribadi individu bukan representasi organisasi yang pantas untuk kartu promosi) | — (selalu `MODULES_NO_AUTO_PHOTO`) |
| Usaha | `member_businesses.coverUrl` — sudah URL penuh | Cross-schema: JOIN `tenantMemberships` scoped tenant, `isActive=true`, `coverUrl IS NOT NULL`, `ORDER BY createdAt DESC LIMIT 1` |
| Profesional | `member_professionals.coverUrl` — sudah URL penuh | Sama pola dengan Usaha |
| Pesantren | `member_owned_pesantren.coverUrl` — sudah URL penuh | Sama pola dengan Usaha, **tanpa** filter `isActive` (tabel ini tidak punya kolom itu) |

`MODULES_NO_AUTO_PHOTO: ModuleId[] = ["dokumen", "anggota"]` — kedua modul ini masih bisa dikasih
**foto custom** oleh admin, cuma tidak ada fallback otomatis tingkat 3 di atas.

**Query cross-schema (Usaha/Profesional/Pesantren)** memakai pola JOIN yang identik dengan halaman
direktori publik (`app/(public)/[tenant]/{usaha,pesantren,profesional}/page.tsx`) dan dengan
`fetchFunfacts()` di Hero — `members` → `tenantMemberships` filtered `tenantId` + status
`active`/`alumni`.

---

## 6. Independensi dari Hero

Strip Modul (section ini) dan strip modul Hero (`HERO_MODULES`, Hero Desain 1) **sengaja tidak
berbagi kode maupun katalog**:

- `lib/module-strip-designs.ts` (section ini, 8 modul) vs `lib/hero-section-designs.ts`
  (`HERO_MODULES`, 4 modul, dipakai HANYA Hero Desain 1).
- `sections/modules/*` (render section ini) vs `sections/hero/hero-design-1.tsx` (render strip di
  dalam hero) — markup kartu ikon awalnya disalin dari yang sama, tapi jadi 2 file independen
  sejak Bagian 1 dibangun.

Alasan: perubahan pada satu tidak boleh pernah merambat ke yang lain — terutama supaya Hero
Desain 1 (Klasik) tetap 100% tidak berubah sepanjang pengembangan section ini (dikonfirmasi via
`git diff` kosong di setiap commit terkait).

Hero Desain 2 (Full-Bleed Modern) juga punya slot serupa tapi kontennya beda total — bukan strip
modul, melainkan **Funfact** (statistik live dari database). Lihat
`docs/arsitektur-website.md` § catatan Hero untuk detail Funfact.

---

## 7. Struktur File

```
lib/module-strip-designs.ts              → MODULE_CATALOG, tipe data, design registry,
                                             MODULES_NO_AUTO_PHOTO, normalizeModuleItems()
components/website/public/sections/modules/
├── modules-section.tsx                  → dispatcher async + resolveModuleImages()
├── modules-design-1.tsx                 → render Ikon (server component, no DB query)
└── modules-design-2.tsx                 → render Foto (client component, rail scroll)
components/website/section-editors.tsx   → ModulesEditor (checklist + upload foto + design picker)
components/website/section-wireframes.tsx → ModulesWireframe (satu wireframe, tidak variant-aware
                                             — konsisten dengan section lain yang punya banyak desain)
lib/page-templates.ts                    → registrasi SectionType "modules"
components/website/public/landing-template.tsx → dispatch case "modules"
```

---

## 8. Editor (Dashboard)

`ModulesEditor` (`components/website/section-editors.tsx`):

1. **Judul Section** (opsional) — teks bebas, mendukung sintaks `*aksen*` di Desain 2.
2. **Checklist modul** — grid 2 kolom, 8 opsi dari `MODULE_CATALOG`, multi-select bebas (tidak ada
   batas jumlah).
3. **Foto per Modul** (HANYA muncul saat Design Layout = 2) — daftar modul yang dicentang, tiap
   baris: thumbnail preview, keterangan status ("Foto custom" / "Otomatis dari item terbaru" /
   "Tanpa foto — otomatis gradasi+ikon" untuk `MODULES_NO_AUTO_PHOTO`), tombol Upload Foto
   (`MediaPicker`, `module="website"`), tombol hapus foto custom (kembali ke auto-fallback).
   Satu `MediaPicker` dipakai bergantian untuk semua item (state `pickerForId: ModuleId | null`) —
   bukan satu dialog per item, supaya tidak render N dialog sekaligus.
4. **Design Layout** — picker 2 pilihan (Ikon/Foto), pola sama section lain.

---

## 9. Status & Verifikasi

- `tsc --noEmit` + `bun run build` — 0 error di setiap tahap pengembangan.
- `hero-design-1.tsx` dikonfirmasi nol perubahan di setiap commit terkait section ini.
- **Belum diverifikasi visual di browser** dari sisi asisten (keterbatasan environment
  pengembangan) — perlu dicek langsung di dashboard `/app/{slug}/website` setelah deploy:
  tambah section "Strip Modul", coba kedua desain, coba upload foto custom, coba kosongkan foto
  untuk lihat fallback otomatis (butuh tenant dengan data campaign/produk/event/usaha aktif yang
  punya foto untuk benar-benar menguji fallback tingkat 3).

## 10. Hal yang Sengaja Disederhanakan

- Tidak ada drag-reorder urutan modul di checklist editor — urutan render mengikuti urutan tetap
  di `MODULE_CATALOG`, bukan urutan admin mencentang. Bisa ditambah kalau diminta.
- Query "item terbaru" untuk fallback foto tidak dicache secara khusus — mengandalkan ISR
  halaman landing page yang sudah ada (~120 detik), sama seperti Funfact di Hero.
- Threshold/limit fallback (1 item terbaru saja, bukan galeri beberapa pilihan) — sesuai permintaan
  awal user, tidak ada UI untuk memilih "item spesifik yang mana" untuk fallback, murni otomatis.
