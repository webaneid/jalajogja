# CLAUDE.md — jalajogja Project Brain

## Identitas Project

**Nama platform: Jalakarta** (folder/repo tetap `jalajogja` — jangan campur)

- **Apa**: Platform ekosistem digital Ikatan Keluarga Pondok Modern Gontor (IKPM)
- **Bukan**: SaaS generik untuk semua organisasi — ekosistem ini khusus IKPM Gontor
- **Backbone organisasi** yang didukung (tiga tipe tenant):
  1. **IKPM Cabang** — PC IKPM per wilayah (PC IKPM Yogyakarta, PC IKPM Jakarta, dll)
  2. **Forum** — komunitas tematik di bawah IKPM (Forum Bisnis, Forum Olahraga, dll)
  3. **Angkatan / Marhalah** — komunitas per tahun lulus KMI (Angkatan 2005, 1999 Awal, dll)
- **Registrasi tenant**: hanya bisa dilakukan oleh admin platform — tidak ada self-service daftar tenant
- **Developer**: Webane (familiar dengan WordPress/PHP, belajar TypeScript/Next.js)

## Stack
- Runtime: Bun
- Framework: Next.js 15 App Router
- Monorepo: Turborepo
- Database: PostgreSQL (schema-per-tenant isolation)
- ORM: Drizzle ORM
- Auth: Better Auth
- Styling: Tailwind CSS v4 + shadcn/ui
- Icons: lucide-react
- Payment: Midtrans, Xendit, iPaymu (manual confirm + QRIS)
- Storage: MinIO (self-hosted)
- Deploy: Docker + Nginx di VPS

## Cara Claude Harus Bekerja
1. SELALU jelaskan pendekatan dan risikonya sebelum menulis kode
2. SELALU pertimbangkan implikasi multi-tenant di setiap keputusan
3. Pecah task besar menjadi sub-steps yang jelas
4. Jika ada lebih dari satu solusi, tampilkan trade-off-nya
5. Setelah setiap task selesai, update dokumen yang TEPAT — bukan CLAUDE.md langsung:
   fakta arsitektur baru → `docs/arsitektur-<topik>.md` terkait; bug root-cause preventif →
   `docs/lessons-learned.md`; status yang sedang dikerjakan → bagian "Status Project" di
   CLAUDE.md (di-OVERWRITE, bukan ditambah). CLAUDE.md sendiri HANYA untuk fakta global
   lintas-modul yang jarang berubah — kalau ragu taruh di mana, defaultnya BUKAN di sini.
6. Jika menemukan bug atau masalah, catat polanya di `docs/lessons-learned.md` agar tidak terulang
7. Selalu tanya konfirmasi sebelum mengubah arsitektur atau keputusan besar
8. Instruksi sekali-pakai user (mis. "jangan push dulu", "jangan commit dulu") berlaku HANYA
   untuk permintaan itu saat itu — jangan generalisasi jadi mode permanen untuk sesi/task
   berikutnya tanpa diminta ulang secara eksplisit

## Konvensi Kode
- Bahasa komentar: Indonesia
- TypeScript strict mode: aktif
- Selalu gunakan server components kecuali perlu interaktivitas
- Error handling wajib di setiap API route
- Semua fungsi database wajib multi-tenant aware (gunakan tenant schema)
- Penamaan: camelCase untuk variabel/fungsi, PascalCase untuk komponen/types

## Arsitektur Kontak (Phone & WhatsApp)
> Detail lengkap: **`docs/arsitektur-kontak.md`**

**Tiga aturan yang tidak boleh dilanggar:**
1. **Input phone/WA** → selalu `<PhoneInput>` dari `components/ui/phone-input.tsx` — tidak boleh `<input type="tel">` biasa
2. **Server insert/update phone/WA** → selalu `normalizePhone()` dari `lib/phone.ts`
3. **Display phone/WA** → selalu `displayPhone()` dari `lib/phone.ts`

**Format DB: E.164** (`+6281234567890`) atau NULL. Default negara: Indonesia (+62).

Yang sudah benar (jangan diubah): `PhoneInput`, `step2-contact.tsx`, `akun/data/page.tsx`, `akun/lengkapi/page.tsx` Step 2.
Yang belum difix: `register-form.tsx`, `event-register-form.tsx`, server actions tanpa normalize → lihat arsitektur.

## UI Standards
- **Container width front-end publik: selalu `max-w-7xl mx-auto px-4`** — header, footer, semua section (hero, posts, events, dll) wajib pakai lebar yang sama agar layout proporsional. Jangan pakai `max-w-6xl`, `max-w-5xl`, atau lebar lain kecuali ada alasan desain yang eksplisit.
- **Border dekoratif: selalu sertakan `border-border`** — `border-l`, `border-t`, dst tanpa kelas warna menggunakan warna default browser (hitam). Wajib: `border-l border-border`, `border-t border-border`, dst.
- SEMUA dropdown/select wajib menggunakan Combobox (autocomplete), bukan plain `<select>` HTML
- Implementasi: shadcn/ui Command + Popover pattern
- Untuk data kecil (<100 items): filter client-side
- Untuk data besar (>100 items, misal wilayah): server-side fetch per keystroke / on-open
- Komponen standar: `components/ui/wilayah-select.tsx` untuk wilayah, generic combobox pattern untuk lainnya
- Konsisten di seluruh aplikasi: wizard form, edit form, filter tabel, search, semua

## Public Button System (Front-end Publik)

**Aturan mutlak: SEMUA button/CTA di front-end publik WAJIB pakai sistem ini.**
Jangan pernah buat button baru dengan Tailwind classes manual di komponen publik.

### Dua cara pakai

**Cara 1 — CSS class langsung** (paling ringan, untuk HTML/JSX non-interaktif):
```html
<a href="/daftar" class="btn btn-primary btn-lg">Daftar Sekarang</a>
<button class="btn btn-danger btn-sm">Hapus</button>
<a href="/semua" class="btn btn-ghost btn-xs">Lihat Semua</a>
```

**Cara 2 — React component** (untuk link+button polimorfik, dengan ikon otomatis):
```tsx
import { PublicButton } from "@/components/website/public/ui/public-button";

// Link (href → render <a>)
<PublicButton href="/daftar" variant="primary" size="lg">Daftar Sekarang</PublicButton>

// Button (no href → render <button>)
<PublicButton variant="danger" size="sm" onClick={handleDelete}>Hapus</PublicButton>

// Ikon kiri (← Kembali)
<PublicButton href="/post" variant="ghost" iconLeft="chevron" icon="none">Kembali</PublicButton>

// Override ikon
<PublicButton variant="primary" icon="heart">Donasi</PublicButton>
```

### Variant dan use case

| CSS Class | Variant | Kegunaan | Ikon Default |
|---|---|---|---|
| `btn-primary` | primary | CTA utama, warna primer tenant | ArrowRight |
| `btn-secondary` | secondary | Alternatif, warna sekunder tenant | Zap |
| `btn-dark` | dark | Kontras di section terang | ArrowUpRight |
| `btn-light` | light | Kontras di section gelap/hero | ArrowRight |
| `btn-outline-primary` | outline-primary | Ringan beridentitas, filter aktif | ChevronRight |
| `btn-outline-dark` | outline-dark | Netral, pagination, navigasi | MoveRight |
| `btn-ghost` | ghost | "Lihat Semua", "Kembali" — tidak mencolok | ChevronRight |
| `btn-danger` | danger | Hapus, aksi destruktif | Trash2 |

### Ukuran

| CSS Class | Kegunaan |
|---|---|
| `btn-xs` | Badge/chip kecil, inline teks |
| `btn-sm` | Header, pagination, secondary action |
| `btn-md` | Default — form, card CTA |
| `btn-lg` | Hero CTA, section CTA |
| `btn-xl` | Landing page besar |

### Ikon yang tersedia (prop `icon` / `iconLeft`)
`arrow` · `arrow-up` · `move` · `chevron` · `zap` · `sparkles` · `send` · `download` · `calendar` · `cart` · `heart` · `external` · `trash` · `x` · `plus` · `minus` · `check` · `none`

### File
- **CSS**: `apps/web/app/globals.css` — `@layer utilities { .btn ... }`
- **Component**: `apps/web/components/website/public/ui/public-button.tsx`

### Catatan implementasi
- Semua variant pakai CSS variables (`--primary`, `--secondary`, `--foreground`) → warna otomatis ikut tema tenant dari settings/display
- Bentuk kapsul (`border-radius: 9999px`) — tidak boleh diubah ke `rounded-lg` atau lainnya
- Hover effect: `opacity + translateY(-1px)` + shadow; active: `translateY(0)`
- `btn-full` untuk lebar penuh (form submit)
- Komponen `PublicButton` polimorfik: auto jadi `<a>` kalau ada prop `href`, jadi `<button>` kalau tidak

## Keputusan Arsitektur & Database (ADR)
Keputusan besar yang sudah dikunci dipindah ke `docs/decisions/` (format ADR, tidak
diedit setelah `Accepted` — kalau keputusan berubah, buat ADR baru dengan
"Supersedes ADR-XXXX"):
- Multi-tenant via schema isolation → `docs/decisions/adr-0001-multi-tenant-schema-isolation.md`
- Payment wajib konfirmasi manual → `docs/decisions/adr-0002-payment-manual-confirmation.md`
- Pattern tabel tenant (Drizzle pgSchema factory, FK via DDL, enum-as-text) → `docs/decisions/adr-0003-tenant-table-pattern.md`
- Auth stack (Better Auth + Drizzle adapter, tabel di public schema) → `docs/decisions/adr-0004-auth-stack-better-auth.md`

Fakta stack singkat (bukan keputusan yang butuh rationale panjang):
- Storage: self-hosted MinIO di VPS
- Monorepo: Turborepo, workspace Bun
- Port dev: 6202 (frontend + API dalam satu Next.js app) — `bun run dev --filter=@jalajogja/web`. Port 6201 dicadangkan untuk API server terpisah di masa depan.
- Double-entry accounting + helpers (`recordExpense`/`recordIncome`/`recordTransfer`/`generateFinancialNumber`) → `docs/arsitektur-keuangan.md`
- Struktur `packages/db/src/` (client, tenant-client, schema/public, schema/tenant, helpers) → lihat kode langsung, sudah jarang berubah

Model identitas & level akses (federated member identity, 3 level akses, routing
pasca-login) — **jangan diduplikasi di sini**, referensi utamanya:
- `docs/arsitektur-keanggotaan.md` — identitas global anggota lintas tenant
- `docs/arsitektur-akun.md` — 3 level akses (Pengurus/Anggota/Publik) + routing

## Peta Dokumen Tambahan
> Topik-topik ini tidak punya section tersendiri di atas — kalau task menyangkut salah satu,
> baca file-nya langsung, jangan asumsikan "belum ada dokumentasinya".

| Topik | Dokumen |
|---|---|
| Add-on Ongkos Kirim (RajaOngkir, dropship mitra) | `docs/arsitektur-addon-ongkir.md` |
| Section landing "CTA" | `docs/arsitektur-cta-section.md` |
| Section landing "Keunggulan/Layanan" | `docs/arsitektur-keunggulan-section.md` |
| Section landing "Tentang Kami" | `docs/arsitektur-tentang-kami-section.md` |
| `SectionTitleBlock` (blok judul standar semua section) | `docs/arsitektur-section-title-block.md` |
| Alur front-end donasi publik (detail, bukan skema) | `docs/arsitektur-donasi-alur.md` |
| Editor Tiptap & Content Renderer Universal | `docs/arsitektur-editor.md` |
| Ekosistem Sinergi Anggota (interkoneksi Usaha/Profesional/Pesantren) | `docs/arsitektur-ekosistem.md` |
| Bergabung ke tenant tipe Forum (pendaftaran) | `docs/arsitektur-gabung-forum.md` |
| Header & footer publik (semua desain) | `docs/arsitektur-header-footer-publik.md` |
| Import Anggota bulk (Excel/CSV) | `docs/arsitektur-import-anggota.md` |
| Import/Export Post WordPress (WXR) | `docs/arsitektur-import-export-post-wordpress.md` |
| Koneksi Instagram otomatis (Graph API) | `docs/arsitektur-instagram-embed.md` |
| Integrasi KBLI (klasifikasi usaha) — perencanaan, belum dieksekusi | `docs/arsitektur-integrasi-kbli.md` |
| Mobile shell (header global, sticky bar, aturan spacer) | `docs/arsitektur-mobile-shell.md` |
| Penulis & Editor Post (byline system) | `docs/arsitektur-penulis-post.md` |
| Data Pesantren anggota | `docs/arsitektur-pesantren.md` |
| Data Profesional anggota — perencanaan, belum dieksekusi | `docs/arsitektur-profesional.md` |
| Role & User Management (custom role, permission matrix) | `docs/arsitektur-role-user.md` |
| Taksonomi bidang usaha spesifik/sub-sektor | `docs/arsitektur-usaha-taxonomy-gemini.md` |
| Data Usaha anggota (`/akun/usaha`) | `docs/arsitektur-usaha.md` |

## Arsitektur Website (Dashboard CMS + Front-end Publik)
> **Peta/indeks SEMUA dokumen front-end publik** (header, footer, landing, post, card+section,
> direktori, akun, SEO, gallery, dll — 14 dokumen dirangkai jadi satu peta rute + struktur file):
> **`docs/arsitektur-frontend-publik.md`** — mulai dari sini kalau kerja di front-end publik.
> Detail lengkap — dashboard CMS, domain routing, front-end publik, caching, open questions: **`docs/arsitektur-website.md`**
> Detail lengkap — tiga fase routing, masalah custom domain, roadmap perbaikan: **`docs/arsitektur-domain.md`**
> SEO helper, bug `og:type` + Twitter images, rencana Related Posts: **`docs/arsitektur-seo.md`**
> Section "Strip Modul" (katalog 8 modul, 2 desain, fallback foto berlapis): **`docs/arsitektur-strip-modul.md`**

- Dashboard CMS (`/{slug}/website/`): posts, pages, kategori, tag — **SELESAI**
- **Halaman Legal Singleton** — `terms` (Syarat dan Ketentuan) dan `privacy` (Kebijakan Privasi): template terkunci, satu per tenant, buat via tombol khusus di list pages, render `DefaultTemplate` di front-end
- Domain routing 3 fase (path → subdomain → custom domain) — schema selesai, middleware Fase 2–3 saat front-end
- Front-end publik Layer 1–4 — **SELESAI** (header/footer, homepage, post cards, section post, search)
- Route group `(public)` sudah ada, donasi/event/dokumen/surat sudah render publik
- **View Counter** — ✅ SELESAI: `lib/view-counter.ts` + integrasi post detail (`after()` + bot detection) + kolom admin. Arsitektur di `docs/arsitektur-views-count.md`.
- **Gallery System** — komponen universal (Grid + Lightbox + Carousel + Picker + Tiptap Block); arsitektur di `docs/arsitektur-gallery.md`; dipakai di: produk, event, donasi, editor, landing section

### Sistem Card + Section (Universal)
> Arsitektur lengkap semua tipe konten: **`docs/arsitektur-card-section.md`**
> Detail Post Card: **`docs/arsitektur-template-post-card.md`**
> Detail Section Post: **`docs/arsitektur-section-post.md`**

Satu arsitektur berlaku untuk semua tipe konten publik: Post, Produk, Event, Campaign/Donasi.
Pola: `{Type}Section (fetch)` → `{Type}DesignN (layout)` → `{Type}Card (render)`.

**Post Card — ✅ Selesai**
- 6 variant: `klasik` | `list` | `overlay` | `ringkas` | `judul` | `ticker`
- 5 section design: Hero 3 Kolom | Klasik | Twin Columns | Trio Column | Carousel
- URL: `/{slug}/post` (arsip) | `/{slug}/post/{postSlug}` (detail)

**Produk Card + Section — ✅ Selesai**
- 3 variant: `grid` | `list` | `ringkas`
- 3 section design: Grid 4 kolom | Showcase 1+4 | Carousel
- URL: `/{slug}/produk` (arsip ✅) | `/{slug}/produk/{slug}` (detail ✅) | `/produk/kategori/{slug}` (✅)
- Cover dari `images[0]` JSONB (bukan coverId); support harga 3 tier + badge Mitra

**Event Card + Section — ✅ Selesai**
- 3 variant: `grid` | `list` | `ringkas` — `components/website/public/event-cards/`
- 3 section design: Design 1 | Design 2 | Design 3 — `sections/events/`
- Terdaftar di landing-template + section-editors + page-templates
- URL: `/{slug}/agenda` (arsip ✅) | `/{slug}/agenda/{slug}` (detail ✅)
- Filter kategori + toggle Mendatang/Semua Event

**Campaign Card + Section — ✅ Selesai**
- 3 variant: `grid` | `list` | `ringkas`
- 3 section design: Grid | Unggulan | Daftar
- URL: `/{slug}/campaign` (arsip ✅) | `/{slug}/campaign/{slug}` (detail ✅ — tab Detail+Donatur)
- `progressPercent` pre-computed; terkumpul selalu tampil meski tanpa target

**`PostsSectionTitle`** dipakai ulang semua tipe — sudah generik (title + href + "Lihat Semua").
**Menambah card/design/tipe baru** → lihat panduan di `docs/arsitektur-card-section.md`.

### Public Link Picker (URL Autocomplete)
> Detail lengkap: **`docs/arsitektur-public-link-picker.md`**

Komponen autocomplete universal untuk memilih URL front-end publik. Dipakai di admin di mana saja
ada field link ke halaman website organisasi (nav menu, CTA section, widget area, dll).

**Inventaris URL:**
- **14 rute statis**: beranda, post, agenda, produk, campaign, anggota, pesantren, usaha, statistik, keranjang, login, register, akun, transaksi
- **9 tipe konten dinamis** (dari DB): pages, posts, post-category, post-tag, products, product-category, campaigns, pesantren detail, usaha detail

**URL konten dinamis — pattern:**
```
/{slug}/{pageSlug}              → halaman statis
/{slug}/post/{postSlug}         → post individual
/{slug}/post?category={slug}    → post by kategori (query param, bukan path!)
/{slug}/post?tag={slug}         → post by tag (query param)
/{slug}/produk/{productSlug}    → produk individual
/{slug}/produk/kategori/{slug}  → produk by kategori
/{slug}/campaign/{slug}         → campaign/donasi individual
/{slug}/pesantren/{id}          → pesantren detail
/{slug}/usaha/{id}              → usaha detail
```

**File yang sudah dibuat (✅ SELESAI):**
```
lib/public-url-registry.ts            → daftar statis + helper buildPublicUrl()
app/api/ref/public-links/route.ts     → GET ?slug=&q=, max 5 per tipe, grouped
components/ui/public-link-picker.tsx  → Command + Popover, debounce 300ms
```

**Integrasi yang sudah ada:**
- `components/settings/website-settings-client.tsx` — nav menu builder pakai `<PublicLinkPicker>`
- Phase 3 (section editor CTA) — belum diintegrasikan ke semua field CTA di section editor

- **Status: ✅ Phase 1+2+3 (nav menu) SELESAI. Section editor CTA belum semua.**

### Widget Area System
> Detail lengkap: **`docs/arsitektur-sidebar.md`**

Sistem **named widget area** — area konten yang dikonfigurasi admin via DnD section builder,
dan bisa di-drop di mana saja di front-end cukup dengan `<WidgetArea id="..." tenantSlug={slug} />`.
Analogi `dynamic_sidebar()` di WordPress.

- Instance pertama: `default-sidebar` — tampil di sisi kanan post (archive + detail)
- Storage: `settings` key `widget_areas`, group `website` — JSONB `Record<string, SidebarSection[]>`
- Satu key menampung semua named areas — nambah area baru tidak butuh perubahan schema
- Phase 1: section type **posts** — filter `recent | popular | category | tag`, limit 1–10, display `PostCardList`
- `popular` memanfaatkan `view_count` dari view counter
- Admin route: `/{slug}/website/pengaturan` — nav item baru (gantikan Komentar coming-soon)
- Render publik: `<WidgetArea>` SERVER component, `hidden lg:block`, `w-72`
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- **Status: ✅ SELESAI** — `components/website/public/widget-area.tsx` live di post archive + detail

## Arsitektur Shell UI Dashboard

### Struktur Komponen
```
components/dashboard/
├── sidebar.tsx         — sidebar desktop, SERVER component
├── sidebar-nav.tsx     — nav items + active state, CLIENT component (butuh usePathname)
├── user-menu.tsx       — dropdown user + sign out, CLIENT component (butuh signOut + useState)
├── mobile-sidebar.tsx  — drawer overlay mobile, CLIENT component (butuh useState)
└── header.tsx          — tidak dipakai langsung; UserMenu di-embed langsung di layout
```

### Struktur Route Dashboard
```
app/(dashboard)/[tenant]/
├── layout.tsx              → wraps SEMUA halaman /{slug}/* — auth check di sini
├── page.tsx                → /{slug} → redirect ke /{slug}/dashboard
├── dashboard/
│   └── page.tsx            → /{slug}/dashboard
├── members/
│   ├── actions.ts          → Server Actions: create, update, removeMemberFromTenant
│   ├── page.tsx            → /{slug}/members — list + search + filter + pagination
│   ├── new/page.tsx        → /{slug}/members/new — form tambah anggota
│   └── [id]/
│       ├── page.tsx        → /{slug}/members/{id} — detail anggota
│       ├── delete-button.tsx → CLIENT component, inline confirm
│       └── edit/page.tsx   → /{slug}/members/{id}/edit — form edit anggota
├── toko/                   → /{slug}/toko/*
│   ├── actions.ts          → SEMUA server actions toko (produk + pesanan + kategori)
│   ├── layout.tsx          → toko shell: TokoNav (sub-nav kiri) + slot konten kanan
│   ├── page.tsx            → redirect ke /toko/produk
│   ├── produk/
│   │   ├── page.tsx        → list produk: grid + filter status + search + pagination
│   │   ├── new/page.tsx    → pre-create draft → redirect ke edit
│   │   └── [id]/edit/page.tsx → full editor: ProductForm (Tiptap + MediaPicker + SeoPanel)
│   ├── pesanan/
│   │   ├── page.tsx        → list pesanan: tabel (orders lama) + "Pesanan via Keranjang" (invoices cart)
│   │   ├── new/page.tsx    → buat pesanan manual (fetch produk aktif → OrderCreateClient)
│   │   ├── [id]/page.tsx   → detail pesanan (orders table lama: info + items + pembayaran + OrderActions)
│   │   └── invoice/
│   │       └── [invoiceId]/page.tsx → fulfillment page (5-stage timeline + resi input + items)
│   └── kategori/
│       └── page.tsx        → CRUD kategori produk (inline create)
├── website/                → /{slug}/website/*
├── letters/                → /{slug}/letters/* (keluar, masuk, nota, template)
├── finance/                → Keuangan (Pemasukan, Pengeluaran, Jurnal, Akun, Laporan, Billing)
└── settings/               → /{slug}/settings/*
```

### Pola Layout Dashboard
- `TenantLayout` mengambil `session` + `getTenantAccess()` satu kali untuk semua child
- Child page tidak perlu query ulang data tenant/user dasar
- Data spesifik modul (list anggota, dll) tetap diambil di page masing-masing

### Dashboard Home (`/{slug}/dashboard`)
- Komponen wajib: `StatCard` (angka ringkasan) dan `ModuleCard` (kartu navigasi per modul) —
  dipakai konsisten, jangan reimplementasi kartu ad-hoc per modul baru.
- Semua modul ditampilkan tanpa filter role (keputusan disengaja, bukan gap keamanan — akses
  aktual tetap dicek per-halaman via middleware/guard, ini murni landing page navigasi).

## Status Project
- [x] Setup monorepo & dependencies
- [x] Database schema (public + tenant schema)
- [x] Auth system (login, register, multi-role)
- [x] Shell UI (sidebar, header, user menu, mobile drawer)
- [x] **Dashboard Admin `/app/{slug}/dashboard`** — ringkasan live lintas modul (KPI, grafik tren 30 hari, perlu tindakan, quick actions). Detail di lesson `[2026-07-16]` di bawah.
- [x] Modul Anggota (list, tambah, detail, edit, hapus dari cabang)
- [x] Member Wizard 4-step (identitas, kontak+alamat, pendidikan, usaha)
- [x] Domain routing schema (subdomain + custom_domain + status columns)
- [x] Modul Settings (7 sections: general, domain, contact, payment, display, email, notifications)
- [x] Media Library (upload, grid/list view, MediaPicker, metadata edit)
- [x] SEO Module (helpers, SeoPanel, snippet preview, social preview, score)
- [x] Website Module (Posts + Pages + Block Editor + SeoPanel + Featured Image)
- [x] Kategori & Tag (CRUD + inline add di post editor, autocomplete tag dengan comma creation)
- [x] Modul Toko (Produk + Pesanan + Kategori + MediaPicker multi-gambar)
- [x] Modul Pengurus (divisions, officers, letter_signatures schema + UI)
- [x] Modul Surat — CRUD dasar (schema + keluar + masuk + nota + template + jenis surat)
- [x] Modul Surat lanjutan — TTD digital, QR verifikasi, halaman publik verifikasi, PDF Playwright
- [ ] Komentar — **DITUNDA** (deprioritized, bukan kebutuhan utama saat ini)
- [x] Modul Surat — Mail Merge Bulk (kirim surat massal ke banyak penerima, picker anggota + kontak)
- [x] Modul Surat — Manajemen Kontak (letter_contacts CRUD, menu Kontak di nav)
- [ ] **Modul Surat — sisa fitur**: inter-tenant, attachment MediaPicker
- [x] **Modul Surat — Layout TTD + signing via URL** — SELESAI SEMUA — lihat `docs/arsitektur-tandatangan.md`
      - Layer 1: `lib/letter-signature-layout.ts` ✅
      - Layer 2: `components/letters/signature-block.tsx` ✅
      - Layer 3: `components/letters/signature-slot-manager.tsx` ✅ (mode "form" + mode "detail")
      - Layer 4: `lib/letter-html.ts` ✅
      - Layout picker + assign combobox di `letter-form.tsx` (di bawah body, selalu tampil) ✅
      - `syncSignatureSlotsAction` — reconcile slot state ke DB saat save ✅
      - Edit/new pages: fetch `availableOfficers` (dengan `userRole`) + `initialSlots` ✅
      - Detail pages: `mode="detail"` + fetch `userRole` via tenant.users JOIN ✅
      - Halaman publik `/(public)/[tenant]/sign/[token]` ✅
      - Token expiry 30 hari + migration SQL tenant existing ✅
- [x] Keuangan — SELESAI (Pemasukan, Pengeluaran, Jurnal, Akun, Dashboard, Laporan 4 jenis + CSV export); integrasi Toko/Donasi/Event → universal payments; Budget belum ada UI — arsitektur di `docs/arsitektur-keuangan.md`
- [x] **Billing Phase 1** — schema 7 tabel + nav + dashboard invoice (list/create/detail + partial payment)
- [x] **Billing Phase 2** — cart + checkout + halaman publik (`/keranjang`, `/checkout`, `/invoice/[id]`) SELESAI. Item type product/ticket/donation menunggu halaman publik masing-masing modul.
- [x] **Billing Phase 3** — Toko + Donasi + Event semua sudah terintegrasi (invoice otomatis via `createLinkedInvoice`). Billing dashboard tampilkan badge sumber untuk semua tipe. ✅
- [~] **Billing sisa** — item picker di invoice manual admin (produk+tiket+donasi), PDF, cicilan UI. **DITUNDA**.
- [x] **Billing Phase 4 — Fulfillment** — 5-stage pengiriman (pending→processing→packed→shipped→delivered), `updateFulfillmentStatusAction`, halaman admin `/toko/pesanan/invoice/[invoiceId]`, `FulfillmentCard` + `FulfillmentTimeline`, lightbox bukti transfer, pelanggan lihat 5 status di `/akun/transaksi`. Detail di `docs/arsitektur-fulfillment.md`.
- [x] **Kode Unik Transaksi** — nominal Rp 100–999 per invoice untuk identifikasi transfer masuk. Setting toggle di `/settings/payment`. Arsitektur di `docs/arsitektur-kode-unik.md`. **SELESAI** — bug `submitPaymentProofAction` tidak include kode unik (invoice nyangkut partial) + bug race condition double-payment sudah difix (2026-07-12).
- [x] **Diskon & Voucher (Fase 1 — berkode)** — memotong `invoice_items.total` PER ITEM (produk/tiket/donasi/qurban), tidak pernah invoice keseluruhan. Voucher 100% → checkout Rp 0 auto-lunas TANPA kode unik. Admin CRUD `/finance/billing/voucher/*`, preview+input kode di halaman checkout publik. Arsitektur di `docs/arsitektur-voucher.md`. **Kode SELESAI (2026-07-19)** — migration `0034_vouchers.sql` belum dijalankan di VPS, belum dites manual end-to-end. Fase 2 (diskon otomatis tanpa kode, target mitra) **DITUNDA**.
- **Prinsip**: front-end pakai cart universal, admin pakai invoice manual — SATU infrastruktur. Fulfillment terpisah dari payment. Detail di `docs/arsitektur-billing.md` + `docs/arsitektur-fulfillment.md`.
- [x] Donasi / Infaq — arsitektur di `docs/arsitektur-donasi.md` (schema + CRUD + SEO + kategori) + **Registry Desain Kartu Arsip** (setting bernomor "Desain 1/2/..." di `/donasi/pengaturan`, pola sama Hero/Strip Modul — setiap desain WAJIB grid desktop/list mobile, § 14m — § 14j dan § 14l dua putaran koreksi sebelumnya, keduanya superseded) + **Info Block Polimorfik** (slot info card yang beda per tipe campaign — progress bar vs harga+ketersediaan qurban, terbuka untuk sub-tipe qurban baru nanti seperti patungan/tabungan) — § 14k + **Desain 2 "Modern Capsule"** (card, sumber `design-refs/Bantuanku/`, donor count) — setting arsip adalah satu sumber kebenaran, section landing "Grid Donasi" otomatis ikut (bukan pilihan terpisah) — § 14o, § 14n ditandai superseded — sekalian fix bug pre-existing `CampaignsEditor` yang belum pernah punya picker Design Layout
- [x] Event — arsitektur di `docs/arsitektur-event.md` — semua Step 1–6 selesai + fitur tiket wajib anggota (`requires_membership`, commit `4f3c185`) + **Tab Peserta & Statistik** (commit `9cf2b12`, migration 0023) + **E10 Donation Prompt UI** (routing kondisional cart vs direct, migration 0024+0025)
- [x] Dokumen — arsitektur di `docs/arsitektur-document.md` (schema + CRUD + versioning + PDF viewer + halaman publik)
- [x] Role System & User Management — custom roles + permission matrix + `/settings/users` + `/settings/roles` + halaman undangan publik + 3 jalur aktivasi + **sidebar filtering + 10 module guards (selesai)**
- [x] **Modul Akun Phase 1** — `public.profiles` schema + migrasi `profile_id` ke 4 tabel transaksi (invoices, orders, donations, event_registrations). TypeScript 0 errors. Tenant existing `pc-ikpm-jogjakarta` sudah dimigrasikan manual.
- [x] **Modul Akun Phase 2** — `resolveIdentity()` helper + update `checkoutAction`. TypeScript 0 errors.
- [x] **Modul Akun Phase 3** — API routes selesai (front-end ditunda sampai website dibangun). 3 endpoints: register, profil (GET/PATCH/DELETE), transaksi (GET). TypeScript 0 errors.
- [x] **Modul Akun Phase 4** — Dashboard admin `/akun` — list page + detail page + link/unlink ke anggota IKPM. TypeScript 0 errors.
- [x] **Front-end Publik** — PublicLayout (header+footer switcher), `/post` archive + detail, 6 PostCard variants, PostsSection (5 designs), PostsSectionTitle, search API, login/register pages, `/settings/website` dengan header/footer design picker. TypeScript 0 errors.
- [x] **ProductCard** — 3 variant (grid, list, ringkas) + `lib/product-card-templates.ts`. Support harga mitra + badge Mitra + nama usaha. TypeScript 0 errors.
- [x] **ProductsSection** — 3 design (Grid 4 kolom, Showcase 1+4, Carousel). Fetch layer: JOIN mitras aktif + business name + priceMin/priceMax untuk variable product. Terdaftar di page-templates + landing-template + section-editors + section-wireframes. TypeScript 0 errors.
- [x] **Produk Variasi V1–V6+V9** — schema (product_type, attribute_groups, product_variations), DDL, AttributeGroupEditor, VariationTable, saveVariationsAction, generateVariationsAction (cartesian product), ProductCardData (priceMin/priceMax), edit page load variations. TypeScript 0 errors.
- [x] **Produk Variasi V7** — halaman detail publik variasi picker (`ProductDetailClient`). TypeScript 0 errors.
- [~] **Produk Variasi V8** — validasi stok server-side saat add to cart. **DITUNDA**.
- [~] **ProductCard Phase 3 Mitra** — integrasi fetch publik (JOIN mitras) + order commission snapshot + filter seller_type admin. **DITUNDA**.
- [x] **Sistem Harga Berlapis** — 3 tier: `price` (tidak login) → `public_price` (siapapun yang login) → `member_price` (anggota IKPM seluruh dunia). Schema Drizzle + DDL + form admin + ProductCard + `resolvePrice()` helper. Berlaku untuk tenant dan mitra. TypeScript 0 errors.
- [x] **Halaman publik `/produk`** — archive + filter kategori + search + pagination. URL `/produk` (bukan `/toko` — hindari konflik dashboard). TypeScript 0 errors. + **Registry Desain Kartu Arsip** (setting bernomor "Desain 1/2/..." di `/toko/pengaturan`, pola sama Donasi § 14m — 3 titik: arsip, kategori, "Produk Lainnya") + **Coupling ke landing "Grid Produk"** (satu sumber kebenaran, plus fix mobile slider yang sebelumnya tidak ada + fix picker Design Layout `ProductsEditor`) — `docs/arsitektur-product.md`
- [x] **Halaman publik `/produk/kategori/{slug}`** — arsip per kategori + breadcrumb + SEO. TypeScript 0 errors.
- [x] **Halaman publik `/produk/{slug}`** — detail produk: gallery + variasi picker + add to cart via `addToCartAction` + produk terkait. TypeScript 0 errors.
- [x] **EventCard + EventsSection** — 3 card variant (grid/list/ringkas) + 3 section design + integrasi landing-template + section-editors. Archive `/{slug}/agenda` + detail `/{slug}/agenda/{slug}` ✅. TypeScript 0 errors. + **Registry Desain Kartu Arsip** (setting bernomor "Desain 1/2/..." di `/app/{slug}/event/pengaturan` — halaman baru, pola sama Donasi § 14m) + **Coupling ke landing "Grid Event"** (satu sumber kebenaran, mobile tetap list sesuai keputusan user, plus fix picker Design Layout `EventsEditor`) — `docs/arsitektur-event.md`, migration `0031_settings_group_event.sql` wajib jalan di VPS dulu
- [x] **CampaignCard + CampaignsSection** — 3 variant (grid/list/ringkas), 3 design (Grid/Unggulan/Daftar), fetch layer filter tipe+kategori, terdaftar di landing page + section-editor. TypeScript 0 errors.
- [x] **Halaman publik `/campaign`** — arsip donasi dengan filter tipe (donasi/zakat/wakaf/qurban) + kategori. URL `/campaign` (bukan `/donasi` — hindari konflik dashboard). TypeScript 0 errors.
- [x] **Halaman publik `/campaign/{slug}`** — detail campaign + form donasi: donasi reguler (nominal chips + custom) dan qurban (hewan cards = variasi), keduanya → `addToCartAction`. Atas nama qurban di `notes`. TypeScript 0 errors.
- [x] **Donasi/Qurban perencanaan lengkap** — arsitektur donasi rutin (Section 12 R1–R7) + front-end section (Section 11b). Docs di `docs/arsitektur-donasi.md`.
- [~] **Donasi Rutin** — perencanaan selesai, implementasi belum. **DITUNDA** (Phase R).
- [x] **Image System** — Phase A (variant system Sharp + 6 WebP variants + cron cleanup) + Phase B (metadata UI autosave panel) + Phase C (alt/title/caption di semua front-end post) SELESAI. Arsitektur lengkap di `docs/arsitektur-image.md`.
- [x] **Image System Phase D — Autocrop + Variant Baru**: `square-large` (800×800); module-aware generation; `position:"attention"` (libvips smart crop); manual crop editor UI (`react-image-crop`) + `crop_data` kolom + `/api/media/[id]/recrop`. Phase D3 (2026-07-21): guard upscale — variant dilewati kalau sumber lebih kecil dari target, cegah logo/favicon dipaksa jadi ukuran konten. ✅ SELESAI.
- [ ] **Image System Phase E — Upload Pipeline Refactor**: client-side compress (Canvas API), `processImage()` hanya generate variant yang dibutuhkan, cap `original` 1600px untuk module `akun`, HEIC/HEIF support. Rencana lengkap: **`docs/arsitektur-upload-pipeline.md`**.
- [x] **View Counter** — DDL + Drizzle schema + `lib/view-counter.ts` + integrasi post detail + kolom admin. Arsitektur lengkap di `docs/arsitektur-views-count.md`.
- [x] **Widget Area System** — `default-sidebar` live di post archive + detail. DnD builder di `/website/pengaturan`. Arsitektur di `docs/arsitektur-sidebar.md`.
- [x] **Single post header refactor** — urutan: Kategori → Judul → Meta date (tz-aware: WIB/WITA/WIT) → Author (Gravatar + nama + "Tim Redaksi").
- [x] **SEO Fix + Related Posts** — Bug `og:type` tidak dirender + Twitter images format salah di `lib/seo.ts`. Related Posts (5 post, fallback: tag → kategori → global, label "Konten Terkait" / "Konten Lain") di halaman post detail. Rencana: **`docs/arsitektur-seo.md`**.
- [x] **Login Universal Phase 1** — SELESAI. Login, register (2-jalur: IKPM vs publik + stambuk lookup + auto-link member), forgot-password, reset-password, dashboard `/akun`. Schema `whatsapp` di `public.profiles`. TypeScript 0 errors.
- [x] **Login Universal Phase 2** — SELESAI. Self-service profile completion wizard anggota IKPM (`/akun/lengkapi`). API routes `member-data` + `member-contact`. Banner kelengkapan data di dashboard `/akun`. Legal singleton pages (terms/privacy). TypeScript 0 errors.
- [x] **Gallery System Phase 1–3** — `<Gallery>`, `<GalleryGrid>`, `<GalleryLightbox>`, `<GalleryPicker>`, `GalleryBlock` Tiptap, kolom `gallery` JSONB di Event + Campaign, Landing section pakai `<Gallery>`. TypeScript 0 errors. Arsitektur di `docs/arsitektur-gallery.md`. Phase 4 (masonry + carousel) belum.
- [x] **Public Link Picker** — `lib/public-url-registry.ts` + `/api/ref/public-links` + `components/ui/public-link-picker.tsx` + integrasi nav-menu builder (`website-settings-client.tsx`). Sisa: field CTA di section editor belum semua pakai `<PublicLinkPicker>`.
- [ ] Add-on Marketplace UI (settings + install flow)
- [ ] Docker deployment
- [x] **Migrasi URL Admin** — admin dashboard pindah dari `/{slug}/*` ke `/app/{slug}/*`. Redirect 301 dari URL lama. Front-end publik tidak berubah. Rencana lama (`docs/rencana-migrasi-url.md`) sudah dihapus (2026-08-25) — riwayat lengkap ada di lesson `[2025-05] Migrasi URL Admin — Lessons Learned` di bawah.
- [x] **Admin-on-Custom-Domain** — menggantikan rencana lama "Fase 5 subdomain admin" (`admin.{customdomain}`, tidak pernah dieksekusi, kontradiktif dengan pendekatan SSL yang berjalan). Solusi final: path-based (`{custom-domain}/admin/*`). Detail: `docs/arsitektur-domain.md` § 7.

## Arsitektur Media Library

### Konsep
Media Library adalah modul **tersendiri** — bukan bagian dari Website atau modul lain.
Semua modul yang butuh file/gambar menggunakan infrastruktur yang sama.

**Route:** `/{slug}/media` (bukan `/{slug}/website/media`)

### Dipakai oleh semua modul
| Modul | Kegunaan |
|-------|----------|
| Website | Featured image posts/pages, konten block editor |
| Toko | Foto produk (multiple images) |
| Surat | Lampiran PDF/dokumen, TTD digital |
| Anggota | Foto profil anggota |
| Settings | Logo, favicon, gambar QRIS |

### Storage: MinIO (self-hosted di VPS)
- **Bucket per tenant:** `tenant-{slug}`
- **Path struktur:** `/{module}/{year}/{month}/{filename}`

```
Contoh:
/website/2025/04/artikel-foto.jpg
/members/2025/04/foto-profil.jpg
/letters/2025/04/ttd-direktur.png
/shop/2025/04/produk-baju.jpg
/general/2025/04/logo-org.png
```

### Permission per role
| Role | Upload | Lihat | Hapus |
|------|--------|-------|-------|
| owner/admin | ✓ | ✓ | ✓ |
| editor | ✓ | ✓ | ✗ |
| viewer | ✗ | ✓ | ✗ |

### Schema DB — `tenant_{slug}.media`
Tabel sudah ada. Kolom yang sudah ada:
```
id, filename, original_name, mime_type, size, path, alt_text, uploaded_by, created_at
```

Kolom yang ditambah (via `create-tenant-schema.ts` untuk tenant baru):
```
module   TEXT    — 'website'|'members'|'letters'|'shop'|'general'
is_used  BOOLEAN DEFAULT false — untuk cleanup orphan files nanti
```

**Tenant existing** perlu migration terpisah jika kolom ini diperlukan.

### Sidebar Navigation
Media Library masuk ke sidebar utama, posisi setelah Anggota:
```
Dashboard
Anggota
Media       ← ditambahkan
Website
Surat
Keuangan
Toko
Pengaturan
```

### Settings Contact — TIDAK pakai helper tables
Helper tables (`contacts`, `addresses`, `social_medias`) dipakai untuk **member** dan **member_business** — entity yang queryable dengan FK. Data kontak organisasi adalah **konfigurasi** (satu record, bukan entitas relasional) → disimpan di `settings` JSONB:
```
key="contact_email"    group="contact"  value="ikpm@gmail.com"
key="contact_phone"    group="contact"  value="0274-123456"
key="contact_address"  group="contact"  value={detail, provinceId, regencyId, ...}
key="socials"          group="contact"  value={instagram, facebook, youtube, website, ...}
```

## Arsitektur Settings
- SATU halaman settings terpusat: `/{slug}/settings`
- TIDAK ada settings tersebar di masing-masing modul
- Semua konfigurasi tenant ada di sini

### Route Structure
```
app/(dashboard)/[tenant]/settings/
├── layout.tsx              → settings shell: sidebar nav kiri + slot konten kanan
├── page.tsx                → redirect ke /settings/general
├── general/page.tsx        → Umum
├── domain/page.tsx         → Domain & Routing
├── contact/page.tsx        → Kontak & Sosial Media
├── payment/page.tsx        → Pembayaran (rekening + QRIS + gateway)
├── display/page.tsx        → Tampilan
├── email/page.tsx          → Email / SMTP
├── notifications/page.tsx  → Notifikasi
├── website/page.tsx        → Website (skip — butuh modul Website selesai dulu)
└── navigation/page.tsx     → Navigasi (skip — butuh drag-drop builder)
```

### Sections dalam /settings

```
├── Umum (general)
│   ├── Nama organisasi, tagline
│   ├── Logo URL (upload MinIO — skip dulu, isi URL manual)
│   ├── Favicon URL
│   ├── Timezone (combobox)
│   ├── Bahasa default (combobox: id / en)
│   └── Currency (default IDR)
│
├── Domain (/settings/domain)         ← BARU
│   ├── Default URL (read-only): app.jalakarta.com/{slug}
│   ├── Subdomain jalakarta: [input].jalakarta.com
│   ├── Custom Domain: input domain + status badge
│   │   ├── Status: none | pending | active | failed
│   │   ├── Instruksi DNS: "Tambahkan A record: {domain} → {IP_VPS}"
│   │   └── Tombol "Verifikasi DNS"
│   └── Catatan: Fase 2 & 3 aktif saat Front-end diimplementasikan
│
├── Kontak & Sosial Media (/settings/contact)
│   ├── Email organisasi
│   ├── Telepon organisasi
│   ├── Alamat (WilayahSelect — sama seperti di wizard member)
│   ├── Instagram, Facebook, YouTube, TikTok, LinkedIn
│   └── Website resmi organisasi
│       └── CATATAN: field "website" di sini = URL eksternal org (bukan jalakarta)
│           Domain jalakarta dikelola di /settings/domain
│
├── Pembayaran (/settings/payment)
│   ├── Rekening Bank (dynamic list: add/edit/remove)
│   │   └── Per rekening: bankName, accountNumber, accountName, categories[]
│   ├── QRIS (dynamic list: add/edit/remove)
│   │   ├── Mode static: upload gambar imageUrl
│   │   └── Mode dynamic: paste EMV payload → QR di-generate server-side
│   └── Gateway Config (tab per gateway)
│       ├── Midtrans: server key, client key, sandbox toggle
│       ├── Xendit: API key
│       └── iPaymu: VA number, API key
│
├── Tampilan (/settings/display)
│   ├── Primary color (color picker)
│   ├── Font (combobox)
│   └── Footer text
│
├── Email/SMTP (/settings/email)
│   ├── Host, port, username, password
│   ├── From name, from email
│   └── Tombol "Kirim Test Email"
│
├── Notifikasi (/settings/notifications)
│   ├── Email: anggota baru, pembayaran masuk, pembayaran dikonfirmasi
│   └── WhatsApp (tampil jika add-on WA aktif, CTA upgrade jika tidak)
│
├── Website (/settings/website)        ← SKIP — tunggu modul Website selesai
│   ├── Homepage layout
│   ├── Post per halaman
│   └── Kode analitik (GA, GTM, Meta Pixel)
│
└── Navigasi (/settings/navigation)   ← SKIP — tunggu drag-drop builder
    ├── Menu header
    └── Menu footer
```

### Urutan Eksekusi Settings
```
Step 1 — DB Helper: packages/db/src/helpers/settings.ts
          getSettings(tenantDb, group)
          getSetting(tenantDb, key, group)
          upsertSetting(tenantDb, key, group, value)

Step 2 — Settings Shell: layout.tsx + page.tsx (redirect)

Step 3 — /settings/general

Step 4 — /settings/domain
          (UI lengkap, verifikasi DNS background job — implementasi saat Front-end)

Step 5 — /settings/contact
          (WilayahSelect untuk alamat org, socials JSONB)

Step 6 — /settings/payment
          Step 6a: Rekening Bank (dynamic list)
          Step 6b: QRIS (static dulu, dynamic EMV nanti)
          Step 6c: Gateway Config

Step 7 — /settings/display

Step 8 — /settings/email

Step 9 — /settings/notifications
```

### Server Actions (settings/actions.ts)
```typescript
saveGeneralSettingsAction()
saveDomainSettingsAction()        // simpan custom_domain ke tenants table (bukan settings)
saveContactSettingsAction()
savePaymentAccountsAction()       // rekening bank array
saveQrisAccountsAction()          // QRIS array
saveGatewayConfigAction()         // midtrans / xendit / ipaymu
saveDisplaySettingsAction()
saveSmtpConfigAction()
saveNotificationSettingsAction()
```

### Storage Settings di DB
Semua pakai `tenant_{slug}.settings` (key/group/value JSONB), kecuali domain yang langsung ke `public.tenants`:
```
key="site_name"       group="general"   value="IKPM Yogyakarta"
key="tagline"         group="general"   value="Satu Hati, Satu Langkah"
key="logo_url"        group="general"   value="https://..."
key="timezone"        group="general"   value="Asia/Jakarta"
key="contact_email"   group="contact"   value="ikpm@gmail.com"
key="contact_phone"   group="contact"   value="0274-123456"
key="contact_address" group="contact"   value={detail, provinceId, regencyId, districtId, villageId}
key="socials"         group="contact"   value={instagram, facebook, youtube, tiktok, website}
key="bank_accounts"   group="payment"   value=[{id, bankName, accountNumber, accountName, categories}]
key="qris_accounts"   group="payment"   value=[{id, name, imageUrl, categories, isDynamic, emvPayload}]
key="midtrans"        group="payment"   value={serverKey, clientKey, isSandbox}
key="xendit"          group="payment"   value={apiKey}
key="ipaymu"          group="payment"   value={va, apiKey}
key="smtp_config"     group="email"     value={host, port, user, password, fromName, fromEmail}
key="primary_color"   group="display"   value="#2563eb"
key="font"            group="display"   value="Inter"
key="footer_text"     group="display"   value="© 2025 IKPM Yogyakarta"
```

Domain settings disimpan langsung ke `public.tenants` (bukan `settings` table):
```
tenants.subdomain              → "ikpm" (untuk ikpm.jalakarta.com)
tenants.custom_domain          → "ikpm.or.id"
tenants.custom_domain_status   → "pending" | "active" | "failed"
```

### Kategori Rekening & QRIS
Rekening bank dan QRIS punya field `categories` (array) untuk menentukan di modul mana mereka
ditampilkan. Sistem: specific match → fallback ke `general`.

**Kategori yang tersedia:**
| Value | Label | Tampil di |
|-------|-------|-----------|
| `general` | Umum | Semua modul (fallback/catch-all) |
| `toko` | Toko | Checkout modul Toko |
| `donasi` | Donasi | Modul Donasi/Infaq |

Satu rekening/QRIS bisa punya multiple kategori, misal `["toko", "donasi"]`.
Jika modul butuh rekening "toko" tapi tidak ada → fallback ke rekening `["general"]`.

### Struktur Data Rekening Bank (JSONB)
```json
{
  "id": "bank-abc123",
  "bankName": "BCA",
  "accountNumber": "1234567890",
  "accountName": "IKPM Yogyakarta",
  "categories": ["general"]
}
```

### Struktur Data QRIS (JSONB)
Diadaptasi dari blueprint Bantuanku (`03-qris-autonominal-blueprint.md`):
```json
{
  "id": "qris-abc123",
  "name": "IKPM Jogja",
  "nmid": "0000123456789",
  "imageUrl": "https://minio.../qris-static.png",
  "categories": ["general"],

  "emvPayload": "00020101021126...",
  "merchantName": "IKPM YOGYAKARTA",
  "merchantCity": "YOGYAKARTA",
  "isDynamic": false
}
```

**Mode QRIS:**
- `isDynamic: false` / `emvPayload` kosong → tampilkan gambar static dari `imageUrl`
- `isDynamic: true` + `emvPayload` ada → generate QR per-transaksi dengan nominal terkunci

**Cara dynamic nominal bekerja** (dari blueprint Bantuanku):
1. Parse EMV TLV payload dari admin settings
2. Ubah Tag 01: `"11"` (static) → `"12"` (dynamic) — KRITIS agar nominal terkunci
3. Inject Tag 54 = `totalAmount + uniqueCode` (nominal terkunci)
4. Inject Tag 62.05 = nomor transaksi (referensi)
5. Hitung ulang CRC16-CCITT
6. Generate QR image sebagai SVG — server-side via `qrcode` package
- Admin juga bisa decode gambar QRIS upload → auto-extract EMV payload via jsQR

### Storage Settings di DB
Semua pakai tabel `settings` yang sudah ada (key, group, value JSONB):
```
key="site_name",     group="general",  value="IKPM Jogja"
key="bank_accounts", group="payment",  value=[{bankName:"BCA", accountNumber:"1234", categories:["general"]}]
key="qris_accounts", group="payment",  value=[{name:"IKPM", nmid:"...", categories:["general"], isDynamic:false}]
key="smtp_config",   group="email",    value={host:"...", port:587, ...}
key="primary_color", group="display",  value="#2563eb"
```

## Arsitektur Modul Donasi / Infaq
> Detail lengkap: **`docs/arsitektur-donasi.md`**

**PENTING — Alur donasi publik sepenuhnya via cart universal (invoice_items), BUKAN tabel `donations`.**
Tabel `donations` adalah legacy — hanya berisi data historis sebelum migrasi ke cart universal.

- **Alur publik saat ini**: `addToCartAction(itemType:"donation")` → `checkoutAction` → `invoices` + `invoice_items`
- **Konfirmasi**: admin konfirmasi invoice → update `invoices.status = "paid"` → `campaign.collected_amount` naik
- **Anon di cart**: `notes = "Anonim"` → tersimpan di `invoice_items.description`
- **Dua sumber donor list** (wajib gabungkan keduanya): tabel `donations` (legacy) + `invoice_items` WHERE `itemType='donation' AND itemId=campaignId AND invoices.status='paid'`
- Kategori: umum / infaq / sedekah / wakaf / zakat / iuran — dipilih per campaign
- Halaman publik: `/(public)/[tenant]/campaign/[slug]` (bukan `/donasi/[slug]`)

## Visi Super-App & Arsitektur Platform

### Konsep Utama
jalakarta adalah super-app untuk organisasi — bukan satu aplikasi monolitik, melainkan **ekosistem modular** di mana organisasi memilih fitur sesuai kebutuhan.

### Modul vs Add-on — Perbedaan Kunci
| | Modul | Add-on |
|---|---|---|
| Fungsi | Fitur utama aplikasi | Ekstensi/integrasi opsional |
| Contoh | Anggota, Website, Toko | WhatsApp, Midtrans, Google Analytics |
| Akses | Ditentukan oleh Package | Install + konfigurasi mandiri |
| Harga | Termasuk dalam Package | Berlangganan terpisah |
| DB | Tabel di tenant schema | `tenant_addon_installations` |
| Catalog | `public.modules` | `public.addons` |

### Package — Bundle Modul + Add-on
Organisasi membeli **Package** yang berisi bundel modul + add-on tertentu.
Package dikelola di `public.tenant_plans` dengan field `features` JSONB:
```json
{
  "modules": ["settings", "anggota", "website"],
  "addons": ["google-analytics"]
}
```

**Tiga Package saat ini (seeded di migration 0004):**
| Package | Harga | Modul | Add-on |
|---------|-------|-------|--------|
| Starter | Rp 0 | settings, anggota | - |
| Standar | Rp 199.000/bln | settings, anggota, website, surat | google-analytics |
| Pro | Rp 499.000/bln | semua modul | google-analytics, meta-pixel, midtrans, xendit, ipaymu, whatsapp-starter, qris-dynamic |

**Logika akses modul di aplikasi:**
- Cek `tenant.plan_id` → ambil `tenant_plans.features.modules`
- Jika slug modul tidak ada di list → tampilkan "coming soon" / blokir
- Add-on tambahan bisa dibeli terpisah di luar package

### Empat Domain dalam Ekosistem Jalakarta

```
1. jalakarta.com               → website/landing page platform Jalakarta itu sendiri
                                  Status: BELUM DIBANGUN

2. platform.jalakarta.com      → admin platform (hanya tim Jalakarta, bukan pengurus tenant)
                                  Fitur: kelola tenant, modul, add-on, backbone IKPM, cabang resmi
                                  Login: /platform/login → JWT terpisah
                                  Status: ✅ SELESAI (+ buat owner pertama tenant)

3. jalakarta.com/app/{slug}/*  → dashboard admin tenant (pengurus IKPM Cabang/Forum/Angkatan)
                                  Status: ✅ SELESAI

4. jalakarta.com/{slug}/*      → front-end publik tenant (anggota IKPM + masyarakat umum)
   atau {custom-domain}/*        Status: ✅ SELESAI
```

**Registrasi tenant: HANYA via platform admin** — tidak ada self-service pendaftaran tenant.
URL `/register` sudah dinonaktifkan (`REGISTRATION_OPEN = false` di `(auth)/register/page.tsx`).

### Tiga Level User dalam Sistem

**Level 1 — Platform Users** (`public.platform_users`)
Tim internal Jalakarta — bukan pengurus IKPM.
- Role: `owner | admin | staff`
- Login di: `/platform/login` — path-based, jalan sama persis dari `jalakarta.com/platform/login`
  maupun `platform.jalakarta.com/platform/login` (subdomain cuma wildcard DNS, bukan routing
  terpisah — lihat `docs/arsitektur-domain.md` § 2). JWT terpisah (`lib/platform-auth.ts`)
- Bisa: buat/kelola tenant, aktifkan add-on, kelola user platform

**Level 2 — Tenant Users** (`tenant_{slug}.users`)
Pengurus organisasi yang mengelola tenant masing-masing.
- Role: `owner | ketua | sekretaris | bendahara | custom`
- Login di: `jalakarta.com/app/login` — via Better Auth
- WAJIB punya record di `public.members` (`tenant.users.member_id` tidak boleh NULL)

**Level 3 — End Users** (`public.members` dan `public.profiles`)
Anggota IKPM dan masyarakat umum pengguna layanan tenant.
- Anggota IKPM (`public.members`): login di front-end tenant
- Akun Publik (`public.profiles`): daftar sendiri, akses lebih terbatas
- Login di: `jalakarta.com/{slug}/login`

**Aturan yang tidak boleh dilanggar:**
- Platform users ≠ tenant users — dua sistem auth terpisah (JWT vs Better Auth)
- Pengurus wajib juga anggota IKPM (`tenant.users.member_id` tidak boleh NULL)
- Platform admin tidak bisa login ke dashboard tenant (dan sebaliknya)

### Modul Catalog (seeded di migration 0004)
```
public.modules
├── settings   → active (wajib di semua package)
├── anggota    → active
├── website    → coming_soon
├── surat      → coming_soon
├── keuangan   → coming_soon
├── toko       → coming_soon
└── donasi     → coming_soon
```

## Arsitektur Backbone IKPM
> Detail lengkap arsitektur, tiga tipe tenant, keanggotaan, forum registration: **`docs/arsitektur-backbone-ikpm.md`**

### Konsep Backbone
Backbone IKPM adalah layer data acuan statis yang menjadi pondasi federasi anggota lintas tenant.
Berbeda dari tenant operasional, backbone adalah **master data PP IKPM** yang tidak berubah:
- Daftar resmi 136 PC IKPM (dari struktur resmi PP IKPM)
- Identitas tunggal anggota (satu `public.members` per orang)
- Primary cabang tiap anggota (editable, menentukan keanggotaan otomatis)

### Tiga Tipe Tenant + Schema
```
tenant_type: "cabang" | "marhalah" | "forum"
```

| Tipe | Keanggotaan | Auto-populate |
|------|-------------|--------------|
| Cabang | Otomatis jika `primary_cabang_ref_id` cocok | Ya (saat link ke ref_cabang) |
| Marhalah | Otomatis jika `graduation_year` + `graduation_period` cocok | Ya (saat buat tenant) |
| Forum | Manual / opt-in | Tidak |

Kolom baru di `public.tenants` (migration 0018):
- `tenant_type TEXT` — cabang/marhalah/forum
- `marhalah_year INT` — hanya untuk tipe marhalah
- `marhalah_period TEXT` — "awal" / "akhir" (hanya untuk angkatan 1999)
- `parent_tenant_id UUID` — induk cabang untuk forum/marhalah (opsional)

Kolom baru di `public.tenant_memberships` (migration 0018):
- `membership_type TEXT` — "cabang" / "marhalah" / "forum"
- `registered_via` — enum lebih lengkap: `admin | self | import | invite | auto_marhalah | auto_cabang`
- `forum_status TEXT` — pending/approved/rejected/expired (untuk forum berbayar)
- `approved_at`, `expires_at` — lifecycle forum membership

### Tabel Referensi PC IKPM Resmi (`public.ref_ikpm_cabang`)
Migration 0019. 136 cabang resmi PP IKPM seeded saat setup.

```typescript
ref_ikpm_cabang: { id, nama, nama_pendek, kode, kota, provinsi, is_active }
```

**Kolom FK:**
- `public.tenants.ref_cabang_id` → link tenant cabang ke data resmi PP IKPM
- `public.members.primary_cabang_ref_id` → cabang utama anggota (editable)

**Alur auto-populate:**
1. Platform admin buat tenant cabang → pilih PC IKPM resmi dari dropdown
2. `createTenantAction` auto-insert `tenant_memberships` untuk semua anggota yang `primary_cabang_ref_id` = cabang tersebut
3. Anggota update `primary_cabang_ref_id` di `/akun/lengkapi` → auto-join `tenant_memberships`
4. Register di tenant cabang → `primary_cabang_ref_id` diset ke cabang tersebut

### Platform Admin Backbone UI
```
/platform/cabang       → CRUD daftar PC IKPM resmi (136 cabang)
/platform/tenants      → list tenant + filter tipe (Cabang/Marhalah/Forum) + tombol Tambah
/platform/tenants/new  → form buat tenant: pilih tipe → form dinamis per tipe
/platform/tenants/[slug] → detail tenant + link ke cabang resmi + buat owner pertama
```

### API Backbone
```
GET /api/ref/ikpm-cabang?search=&limit= → dropdown autocomplete 136 cabang
```

### Buat Owner Pertama dari Platform Admin
Setelah buat tenant, platform admin langsung bisa buat akun owner pertama tanpa masuk ke dashboard tenant.
Tersedia di `/platform/tenants/[slug]` — muncul banner kuning "Belum Ada Pengurus" jika `tenant.users` kosong.

**`createFirstOwnerAction`** di `platform/actions.ts`:
- Input: nama, email, password
- Jika email sudah di Better Auth: link ke member yang ada
- Jika email baru: `signUpEmail` → `INSERT members` → `INSERT tenant.users (role=owner)`
- Rollback: jika `INSERT members` gagal → hapus Better Auth account (cegah orphan)
- Setelah berhasil: banner hijau + instruksi login `jalakarta.com/app/login`

## Arsitektur Add-on System

### Konsep
- Organisasi berlangganan add-on secara opsional — tidak semua butuh semua fitur
- Ada yang gratis (payment gateway, analytics) dan berbayar (WhatsApp, QRIS Dynamic)
- Pengiriman dibatasi per quota/bulan untuk add-on berbayar

### Schema (public)
```
addons                      → katalog semua add-on tersedia (dikelola jalakarta)
tenant_addon_installations  → tenant mana install add-on apa + config + quota
addon_usage                 → tracking penggunaan per bulan per tenant per add-on
```

### Katalog Add-on (seeded di migration 0003)
| Slug | Nama | Tier | Harga |
|------|------|------|-------|
| `whatsapp-starter` | WhatsApp Starter | Paid | 49k/bln (200 msg) |
| `whatsapp-pro` | WhatsApp Pro | Paid | 129k/bln (1.000 msg) |
| `whatsapp-unlimited` | WhatsApp Unlimited | Paid | 299k/bln (∞) |
| `midtrans` | Midtrans Gateway | Free | - |
| `xendit` | Xendit Gateway | Free | - |
| `ipaymu` | iPaymu Gateway | Free | - |
| `qris-dynamic` | QRIS Dynamic Nominal | Paid | 29k/bln |
| `google-analytics` | Google Analytics | Free | - |
| `meta-pixel` | Meta Pixel | Free | - |
| `webhook-out` | Webhook Out | Free | coming soon |

### WhatsApp Gateway — Arsitektur
> Arsitektur lengkap (notifikasi, template, OTP, peta event): **`docs/arsitektur-whatsapp.md`**
> Infrastruktur, deployment, Docker, Nginx, self-hosted VPS: **`docs/arsitektur-gowa-deployment.md`**

- Library: [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) (GOWA)
- **Hosting: Self-hosted di VPS jalakarta** (72.61.215.7) — Docker service port 3002. Sumopod menutup layanan 2026-06-30.
- Satu instance GOWA untuk semua tenant — dipisahkan via `device_id = slug` unik per tenant
- Tenant self-service: scan QR di `/app/{slug}/settings/notifications` → nomor WA terdaftar
- Platform env: `WHATSAPP_SERVICE_URL=https://gowa.jalakarta.com`, `WHATSAPP_API_USER`, `WHATSAPP_API_PASS`
- Helper utama: `lib/whatsapp.ts` — `sendWaNotification()` + `toE164()`; **fire-and-forget** (`void`)
- Template: `lib/wa-templates.ts` — 15+ template per event, di kode bukan di DB
- Config per tenant di `tenant_{slug}.settings` (group="notif", key="whatsapp_config"):
  ```json
  { "device_id": "pc-ikpm-jogjakarta", "phone_number": "628xxx", "verified": true,
    "notifications": { "payment_submitted": true, "payment_confirmed": true, ... } }
  ```
- 7 fase implementasi, lihat `docs/arsitektur-whatsapp.md` § 12 — **Fase 1+2 SELESAI** + **Fase 7 (OTP) SELESAI** + **Fase 3 (Billing) SELESAI (2026-07-13)**. **Fase 4–6 belum** (fulfillment, event, surat).
- **Teks notifikasi WA sekarang editable per tenant** — default seed di `lib/wa-templates.ts` (`WA_TEMPLATE_DEFAULTS`, sintaks `{{var}}` string-replace, bukan eval JS), override tersimpan di `tenant.settings` (group="notif", key="wa_message_templates"). Resolusi custom→default via `resolveWaTemplateText()` di `lib/wa-notify.ts`. UI: tombol "Edit Teks" per notifikasi di `/settings/notifications` → `WhatsAppSetupClient` → `saveWaTemplateAction`/`resetWaTemplateAction`.
- **OTP via WA (Fase 7)**: `public.otp_tokens` table + `/api/akun/send-otp` + `/api/akun/verify-otp` + `/api/wa/available`. Register form + forgot-password sudah terintegrasi. Toggle OTP ada di dashboard WA settings. Migration: `0016_otp_tokens.sql`.
- ⚠️ Implementasi menyimpang dari desain: config WA tersimpan di `tenant.settings` (bukan `tenant_addon_installations`), **tidak ada quota enforcement / addon billing check** sama sekali — lihat `docs/arsitektur-whatsapp.md` § 16 untuk detail gap dan cara menutupnya.
- **GOWA API Endpoints (versi `latest`, confirmed 2026-07-02)** — lihat `docs/arsitektur-whatsapp.md` § 2.4:
  - Create device: `POST /devices` + JSON body `{device_id}` — return 500 jika sudah ada (normal, lanjutkan)
  - QR: `GET /app/login` + header `X-Device-Id: {slug}`
  - Status: `GET /app/devices` + `X-Device-Id` → cek `results[].jid != ""`
  - Send: `POST /send/message` + `X-Device-Id` (endpoint sama dari versi lama)
  - Logout: `GET /app/logout` + `X-Device-Id`

### Quota Enforcement
Sebelum kirim notifikasi WA:
1. Cek `tenant_addon_installations.status = active`
2. Cek `addon_usage.count < quota_monthly` (bulan berjalan)
3. OK → kirim → `UPDATE addon_usage SET count = count + 1`
4. Over quota → tolak + tampilkan pesan upgrade

### Cara Tambah Add-on Baru
1. Insert row baru di tabel `addons` (via migration atau platform admin)
2. Tambah handler di `apps/web/app/api/addons/[slug]/` untuk konfigurasi spesifik
3. Tambah trigger di event yang relevan (misal: `onPaymentConfirmed` → kirim WA)

## Arsitektur Universal Payments & Disbursements
> Detail lengkap: **`docs/arsitektur-keuangan.md`**

Semua uang masuk melalui tabel `payments` (source_type polymorphic: order/donation/event_registration/manual).
Semua uang keluar melalui tabel `disbursements` (2-level approval: draft→approved→paid).
Konfirmasi → auto-generate journal entry double-entry. Nomor: `620-PAY/DIS/JNL-YYYYMM-NNNNN`.

### Kategori Rekening & QRIS untuk Modul
Rekening bank dan QRIS punya field `categories` di settings JSONB:
- `general` → fallback/catch-all semua modul
- `toko` → checkout Toko
- `donasi` → Modul Donasi/Infaq
Logika: cari yang spesifik dulu → fallback ke `general`.

## Technical Debt
- `getFirstTenantForUser()` loop O(n) — perlu tabel `public.user_tenant_index` saat tenant > 100
- `check-slug` endpoint perlu rate limiting per-IP (saat ini hanya referer check)
- `getTenantAccess()` dipanggil di layout DAN page — perlu `React.cache()` saat query makin banyak
- **[SELESAI Fase 1-4] Migrasi URL** — admin dashboard dipindah ke `/app/{slug}/*`, publik tetap `/{slug}/*`. Redirect 301 dari path lama di `next.config.ts`. Dokumen rencana lama (`docs/rencana-migrasi-url.md`) sudah dihapus (2026-08-25) setelah Fase 5-nya (admin subdomain `admin.ikpmjogja.com`) digantikan solusi lain — lihat baris di bawah.
- **Post-login routing multi-tenant tidak deterministik** — `getFirstTenantForUser()` tidak ada `ORDER BY`, user di 2+ tenant bisa dikirim ke tenant mana saja. Perlu difix sebelum tenant kedua aktif.
- ~~**Fase 5 URL migrasi** — admin subdomain~~ **SUDAH DIGANTIKAN**: proposal subdomain
  (`admin.ikpmjogja.com` via Cloudflare proxy) tidak pernah dieksekusi — kontradiktif dengan
  pendekatan SSL custom domain yang sudah berjalan (DNS-only + Certbot manual, bukan Cloudflare
  proxy). Solusi yang benar-benar dibangun dan live: **Admin-on-Custom-Domain path-based**
  (`{custom-domain}/admin/*`), selesai 2026-07-16, detail `docs/arsitektur-domain.md` § 7.
- **[EVALUASI DOMAIN SELESAI, SEBAGIAN DIEKSEKUSI] Arsitektur domain/URL menyeluruh (2026-07-16)** —
  sesi yang diminta di catatan `[RENCANA]` 2026-07-14. Hasil: **`docs/arsitektur-domain.md`** ditulis
  ulang total (versi lama 2026-05-26 punya beberapa klaim basi — dikoreksi, lihat § 8 dokumen tsb).
  Prinsip yang dikunci: **"satu domain = satu identitas, tidak boleh menyeberang"**. Status per
  temuan (update setelah re-review 2026-07-16 sore — dokumen sempat punya referensi rusak/§ yang
  tidak ada, sudah dibenahi juga, lihat lesson terpisah di bawah):
  - ✅ **Fixed**: footer publik (`dark-footer.tsx`+`light-footer.tsx`) yang bocor "Jalakarta —
    developed with ❤️ by Webane" ke custom domain — sudah dibungkus `{baseUrl !== "" && ...}`.
  - `tenants.subdomain` (Fase 2) ada kolom + ada input UI di `/settings/domain`, tapi **mati total**
    — tidak dibaca di manapun dalam kode routing. Menyesatkan admin yang mengisinya. **Belum difix.**
  - Duplikasi `isOwnHost(host) ? "/${slug}" : ""` dihitung ulang independen di ~15 file — bukan bug
    aktif, tapi pola berulang di balik beberapa bug custom-domain yang sudah pernah terjadi. **Belum
    dikonsolidasi.**
  - Komentar "SSL via Caddy" di `packages/db/src/schema/public/tenants.ts` (baris 29, 46) salah —
    infrastruktur nyata 100% Nginx+Certbot manual. **Belum dikoreksi.**
  - **Admin-on-Custom-Domain** (skenario diminta user: dashboard admin tenant via custom domain
    sendiri) — fitur belum ada kodenya sama sekali, ada guard aktif (sejak 2026-07-08) yang
    memblokirnya. **2 dari 2 keputusan produk sudah dijawab user** (§ 7.3 dokumen): Opsi B
    (path-based, `{custom-domain}/admin/*`) dipilih atas subdomain-based; auth cross-domain pakai
    sesi terpisah per domain (login manual) sebagai pendekatan awal. **Implementasi belum dimulai**
    — masih perlu cek collision slug `admin` di database production dulu (§ 7.1 dokumen) sebelum
    baris kode pertama, dan sinyal "mulai" eksplisit dari user.
  Roadmap sisa (§ 9 dokumen): koreksi 2 komentar/dokumen basi (murah) → putuskan nasib `subdomain`
  → konsolidasi `baseUrl` → Admin-on-Custom-Domain (implementasi, sudah tidak terblokir keputusan
  produk tapi tetap fitur besar security-sensitive).

- **[RENCANA] Invoice jatuh tempo — tidak ada konsekuensi otomatis (dicatat 2026-07-15)**:
  Ditemukan saat verifikasi cron `invoice-reminder` — status invoice **tidak pernah** otomatis
  berubah ke `overdue` setelah `due_date` lewat (grep konfirmasi: nol `UPDATE ... SET status =
  'overdue'` di seluruh kode), meski kolom status & UI (badge merah "Jatuh Tempo") sudah siap
  menampilkannya. Invoice yang telat tetap diam di `pending`/`partial` selamanya sampai dibayar
  atau admin batalkan manual — tidak ada pengingat susulan (cron cuma H-1 sekali), tidak ada denda,
  tidak ada auto-cancel. `dueDate` sendiri **hardcoded +3 hari** di dua tempat: `checkoutAction`
  (cart/actions.ts) dan `createLinkedInvoice` (packages/db/src/helpers/billing.ts).
  **Keputusan user**: biarkan seperti sekarang (customer boleh bayar kapan saja) — TAPI rencanakan
  ke depan: tambah setting di `/settings/payment` supaya **admin bisa atur sendiri** (1) berapa hari
  jatuh tempo invoice (ganti hardcoded +3 hari), (2) apakah invoice yang lewat jatuh tempo di-auto-
  cancel atau tidak (dan setelah berapa hari). Kalau nanti dikerjakan: perlu key baru di settings
  group `"payment"` (mis. `invoice_due_days`, `invoice_auto_cancel_enabled`,
  `invoice_auto_cancel_days`), cron baru untuk transisi status + auto-cancel (perhatikan: auto-
  cancel invoice tiket/produk perlu lepas kuota/stok yang ter-reserve, ikuti pola
  `cancelInvoiceAction` yang sudah ada). **Belum dijadwalkan eksekusi** — tunggu instruksi user.

## Prinsip Penggunaan CLAUDE.md

> **CLAUDE.md adalah project brain, bukan source of truth untuk status fitur.**
> Sebelum menyimpulkan fitur "belum ada", selalu verifikasi ke kode aktual.
> Status di CLAUDE.md cenderung tertinggal — kode yang berubah lebih cepat dari dokumentasi.

**Cara verifikasi cepat:**
```bash
# Cek file ada atau tidak
ls apps/web/components/website/public/event-cards/
# Cek fungsi ada atau tidak
grep -r "normalizePhone" apps/web/lib/phone.ts
# Cek integrasi di landing
grep -n "EventsSection" apps/web/components/website/public/landing-template.tsx
```

**Yang sudah pernah out-of-sync (dikoreksi 2026-05-16):**
- Public Link Picker: CLAUDE.md bilang "belum dimulai" → sudah ada 3 file + integrasi nav-menu
- EventCard + EventsSection + Agenda archive: CLAUDE.md bilang "DITUNDA" → 4 card + 3 designs + landing integration + `/{slug}/agenda` page lengkap
- Widget Area: CLAUDE.md bilang "belum dimulai" → `widget-area.tsx` sudah live
- View Counter: CLAUDE.md bilang "belum dimulai" → `lib/view-counter.ts` + post integration
- normalizePhone: CLAUDE.md bilang "belum dibuat" → `lib/phone.ts` sudah ada
- finance/ route: CLAUDE.md bilang "(belum dibuat)" → folder lengkap dengan actions.ts, billing/, dll
- profiles.ts: CLAUDE.md bilang "(BELUM)" → file ada di `packages/db/src/schema/public/`

## Arsitektur Modul Toko
> Detail lengkap: **`docs/arsitektur-product.md`**
> Sistem Mitra (anggota IKPM berjualan): **`docs/arsitektur-mitra.md`**
> Gambar produk: **`docs/arsitektur-image.md`** (module `shop` → hanya `square` + `square-large`)
> Front-end card + section: **`docs/arsitektur-card-section.md`**

- Dashboard: CRUD Produk + Pesanan + Kategori — **✅ Selesai**
- `ProductImage` menyimpan `variants` — pakai `square` untuk thumbnail, `square-large` untuk display besar
- Status produk: `draft → active → archived → draft`
- Nomor pesanan: `ORD-YYYYMM-NNNNN`
- Konfirmasi bayar → `recordIncome()` + kurangi stok
- Front-end `/toko` + `/toko/{slug}` + ProductCard (grid/list/ringkas) + ProductsSection — **⬜ Belum**
- **Sistem Mitra** — **✅ Phase 0–2 Selesai** (pengaturan toko, schema, admin approve/reject/suspend, frontend mitra di `/akun/mitra/*`, API CRUD produk mitra + validasi komisi). Phase 3 (integrasi card produk) belum. Arsitektur di `docs/arsitektur-mitra.md`.

## Arsitektur Modul Surat
> Peta dokumen, status fitur, fondasi schema/route/actions: **`docs/arsitektur-modul-surat.md`**
> Identitas surat, tujuan surat, format tanggal, render PDF: **`docs/arsitektur-surat.md`**
> Render body, merge fields, halaman detail: **`docs/arsitektur-surat-detail.md`**
> Layout TTD, slot-based signing, alur URL publik: **`docs/arsitektur-tandatangan.md`**

## Status Project (terkini)
> Ini status singkat yang di-OVERWRITE tiap kali berubah, BUKAN log yang ditambah terus.
> Riwayat detail tiap perbaikan ada di `docs/lessons-learned.md` dan `docs/arsitektur-*.md` masing-masing modul.

- Commit terakhir per `git log`: `aa4c1ea` (fix kode unik pesanan Rp 0 karena voucher) dan
  `34d5906` (fix kota tujuan wajib + search kota toko), keduanya 2026-09-04 — SUDAH di-commit
  (cross-check manual sebelum asumsi status deploy/verifikasi VPS, jangan percaya klaim lama).
- Backlog lama belum dikonfirmasi statusnya (perlu verifikasi manual apakah sudah dikerjakan di
  sesi lain atau masih tertunda): sertifikat PDF untuk donasi, fitur V8 (cek stok produk),
  Donasi Rutin (siklus R1-R7, termasuk subscriptions `/{slug}/akun/subscriptions`), dan Fase 5
  migrasi URL (admin subdomain terpisah `admin.ikpmjogja.com`).
- Backlog lain belum dikonfirmasi statusnya (cek ulang sebelum diasumsikan masih relevan):
  Role System (email SMTP otomatis untuk invite — saat ini link di-copy manual; update role UI
  pengguna aktif; notifikasi login pertama), Modul Dokumen (uploader name di version history perlu
  cross-schema join `tenant.users` → `public.user`), Surat (inter-tenant letters, attachment
  MediaPicker), Keuangan (Budget UI, export PDF laporan — detail `docs/arsitektur-keuangan.md`),
  Billing Phase 2 (public cart/checkout) & Phase 3 (integrasi modul existing — cek status aktual,
  kemungkinan sudah lebih maju), View Counter Step 10 (tampil di detail publik ≥50 — detail
  `docs/arsitektur-views-count.md`), Member Media Library Phase 1-4 (upload foto sendiri, lihat
  file sendiri, MemberMediaPicker — detail `docs/arsitektur-medialibrary.md`), WhatsApp Gateway
  Fase 4-6 (fulfillment, event, surat), cron reminder (`invoice_reminder`, `event_reminder`), quota
  enforcement/addon billing (detail `docs/arsitektur-whatsapp.md` § 12 dan § 16).

## Arsitektur Modul Billing
> Detail lengkap: **`docs/arsitektur-billing.md`**

Billing adalah lapisan universal antara modul produk (Toko/Donasi/Event) dan Keuangan.
**Posisi di UI: submenu di bawah Keuangan** (bukan modul terpisah di sidebar).

Alur: Cart → Checkout (input HP/email, lookup member) → Invoice → Payment → Finance Verifikasi → Jurnal.

**Keputusan desain yang dikunci:**
- Guest boleh tambah ke cart, tapi checkout wajib input minimal HP atau email
- Harga di cart adalah snapshot — tidak berubah meski admin edit harga produk
- Cicilan (`installment_plans`) default hidden — admin publish manual per program
- Cart session via httpOnly cookie (TTL 24 jam), bukan localStorage
- Public API (cart/checkout) terpisah rate-limit dan CSRF dari dashboard API
- Invoice number: `INV-YYYYMM-NNNNN` via `financial_sequences` type baru
- Partial payment didukung: `invoice.paid_amount < total` → status `partial` (piutang aktif)
- Source tabel existing (orders, donations, event_registrations) tidak dihapus — tetap ada sebagai detail, invoice sebagai header universal

**6 tabel baru:** `carts`, `cart_items`, `invoices`, `invoice_items`, `invoice_payments`, `installment_plans`, `installment_schedules`

## Arsitektur Direktori Publik (Anggota, Pesantren, Usaha, Statistik)
> Detail lengkap: **`docs/arsitektur-direktori-publik.md`**

Empat halaman front-end publik yang menampilkan data IKPM kepada pengunjung.
Semua masuk route group `(public)/[tenant]/`, tidak butuh login.

**Empat halaman:**
- `/{slug}/anggota` — direktori anggota: grid kartu + popup detail
- `/{slug}/pesantren` + `/{slug}/pesantren/[id]` — arsip pesantren + detail
- `/{slug}/usaha` + `/{slug}/usaha/[id]` — direktori usaha anggota + detail
- `/{slug}/statistik` — dashboard statistik anggota, pesantren, usaha

**Aturan visibilitas data (dikunci, tidak boleh dilanggar):**
- `nik`, `birthDate` (tanggal+bulan), detail alamat (kecamatan/desa/jalan) → **tidak pernah ditampilkan**
- HP/WA/Email anggota → tampil hanya jika `contacts.is_*_public = true` (pilihan anggota)
- HP/WA/Email pesantren → tampil hanya jika `contacts.is_*_public = true` pada `contactId` pesantren
- HP/WA/Email usaha → tampil hanya jika `contacts.is_*_public = true` pada `contactId` usaha
- `hpPimpinan` di pesantren → **tidak pernah ditampilkan** (nomor pribadi, tidak ada toggle)
- `revenue` usaha → **tidak pernah ditampilkan** (finansial sensitif meski berupa range)
- Social media → selalu tampil publik jika diisi (tidak ada toggle per-platform)
- Domisili → tampil hanya 2 level: provinsi + kabupaten/kota (bukan kecamatan/desa)

**Scope query:**
Semua query WAJIB JOIN `tenant_memberships WHERE tenant_id = {tenantId}`.
Direktori menampilkan anggota cabang ini, bukan lintas cabang.

**Popup anggota:**
Lazy fetch via `GET /api/member-public/[id]?slug=` saat Dialog dibuka.
Endpoint publik (no auth), scope check via tenant_memberships.

## Arsitektur Login Universal (Front-end Publik)
> Detail lengkap: **`docs/arsitektur-login-universal.md`**
> Alur akun, 3 level akses, aktivasi akun login: **`docs/arsitektur-akun.md`**
