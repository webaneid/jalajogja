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
5. Setelah setiap task selesai, update CLAUDE.md — lessons learned + context sesi
6. Jika menemukan bug atau masalah, catat polanya agar tidak terulang
7. Selalu tanya konfirmasi sebelum mengubah arsitektur atau keputusan besar

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

## Keputusan Arsitektur yang Sudah Dikunci
- Multi-tenant: schema isolation per tenant (bukan row-level tenant_id)
- **Member data: terpusat di `public.members`** — bukan di tenant schema
- **Akses member: dikontrol via `public.tenant_memberships`** — tenant hanya lihat member mereka sendiri
- Super admin jalakarta: akses semua `public.members` tanpa filter
- Payment: semua butuh konfirmasi manual (cash/transfer/QRIS/gateway)
- Storage: self-hosted MinIO di VPS
- Auth: Better Auth dengan Drizzle adapter
- Monorepo: Turborepo dengan workspace Bun
- Port dev: 6202 (frontend + API dalam satu Next.js app). Jalankan: `bun run dev --filter=@jalajogja/web`
- Port 6201: dicadangkan untuk API server terpisah di masa depan

## Keputusan Teknis Database

### Pattern: pgSchema Factory untuk Tenant Tables
Tenant tables menggunakan `pgSchema()` factory dari Drizzle, bukan `pgTable` biasa.
```typescript
const s = pgSchema(`tenant_${slug}`); // → "tenant_ikpm"
const users = s.table("users", { ... }); // → tenant_ikpm.users
```
- `getTenantSchema(slug)` di `packages/db/src/schema/tenant/index.ts` adalah entry point utama
- Result di-cache in-memory agar tidak buat objek baru setiap request
- `createTenantDb(slug)` di `tenant-client.ts` mengembalikan `{ db, schema }` siap pakai

### FK Constraints di Tenant Tables
FK **tidak** didefinisikan di Drizzle untuk tenant tables (menghindari circular ref di factory pattern).
FK tetap ada di DB via raw SQL DDL yang dijalankan saat tenant baru dibuat (`createTenantSchemaInDb`).
Drizzle schema dipakai untuk TypeScript types + query building saja.

### Enum di Tenant Tables
Gunakan `text` column dengan TypeScript enum constraint, **bukan** `pgEnum`:
```typescript
status: text("status", { enum: ["draft", "published"] }).notNull().default("draft")
```
Alasan: `pgEnum` bersifat schema-scoped di PostgreSQL → ratusan tenant = ribuan enum objects.

### drizzle-kit: Public Schema Only
`drizzle-kit` hanya mengelola **public schema**. Tenant schema dibuat programmatically via
`createTenantSchemaInDb(db, slug)` — dipanggil saat tenant baru dibuat, bukan via migration file.

### Double-Entry Accounting + Helpers
> Detail lengkap: **`docs/arsitektur-keuangan.md`**

Helper di `packages/db/src/helpers/finance.ts` (tanda tangan memakai `tenantDb`, bukan `{db, schema}`):
- `recordExpense(tenantDb, { amount, expenseAccountId, cashAccountId, ... })`
- `recordIncome(tenantDb, { amount, incomeAccountId, cashAccountId, ... })`
- `recordTransfer(tenantDb, { amount, fromAccountId, toAccountId, ... })`
- `generateFinancialNumber(tenantDb, type)` — format `620-PAY/DIS/JNL-YYYYMM-NNNNN`

### Better Auth Tables: Public Schema
Tabel auth (user, session, account, verification) ada di `public` schema.
Satu user bisa akses multiple tenant. Mapping role per tenant ada di `tenant_{slug}.users`.

### Arsitektur Member: Federated Identity
> Detail lengkap — visi, skenario, implementasi, lessons learned: **`docs/arsitektur-keanggotaan.md`**

- `public.members` — identitas global IKPM, satu record per orang lintas semua cabang
- `public.tenant_memberships` — relasi cabang, satu orang bisa di banyak cabang
- `public.member_number_seq` — SEQUENCE global atomic
- Tenant schema **TIDAK punya tabel members** — semua referensi via UUID ke `public.members.id`
- Query tenant: **wajib** JOIN `tenant_memberships WHERE tenant_id = {current}` (application-level, bukan RLS)

### Arsitektur Akun: Tiga Level Akses
> Detail lengkap: **`docs/arsitektur-akun.md`**

jalakarta punya **tiga level akses** yang berbeda entitas, berbeda tabel, berbeda lifecycle.
**PRINSIP UTAMA (tidak boleh dilanggar):**

> Pengurus adalah anggota IKPM yang sedang bertugas — bukan entitas terpisah.
> Satu akun Better Auth berlaku di dua konteks: dashboard (saat menjabat) + front-end (selamanya).

**Super Admin jalakarta** (platform level) — terpisah dari sistem tenant, tidak dibahas di sini.

**Level 1 — Pengurus** (subset Anggota IKPM, per tenant)
- Anggota IKPM yang diangkat owner/super admin, masa jabatan terbatas
- Login di **dashboard tenant** + **front-end** (sebagai anggota IKPM)
- Saat masa jabatan berakhir → turun ke Level 2, akun tetap ada
- Data: `public.members` + `public.user` + `tenant_{slug}.users`
- Wajib: `tenant.users.member_id` TIDAK BOLEH null — pengurus HARUS anggota IKPM

**Level 2 — Anggota IKPM** (alumni Gontor)
- Login di **front-end saja** (belanja, donasi, event lintas semua tenant)
- Data: `public.members` + `public.user` (via `members.better_auth_user_id`)
- TIDAK ada di `tenant.users` kecuali diangkat jadi pengurus

**Level 3 — Akun Publik** (orang umum, bukan alumni)
- Login di **front-end saja**
- Data: `public.profiles` + `public.user`
- Tidak bisa diangkat jadi pengurus

**Kolom kunci yang membedakan:**
- `public.members.better_auth_user_id` → anggota IKPM yang sudah aktivasi login front-end
- `public.profiles.better_auth_user_id` → akun publik
- `tenant.users.member_id` → wajib tidak null (pengurus HARUS anggota IKPM)

**`public.profiles` HANYA untuk akun publik** — tidak ada `member_id` atau `account_type` di sini.

**Routing pasca login:**
- `/{slug}/login` → cek session → ada → `getAkunIdentity()` ada → `/akun` | null → `/dashboard`
- `/{slug}/akun` → `getAkunIdentity()` null (pengurus-only) → redirect `/dashboard`
- Dashboard → dilindungi middleware, cek `tenant.users`

**Fix dilakukan** di 3 tempat: `pengurus/actions.ts`, `settings/actions.ts`, `invite/actions.ts`.
Semua alur aktivasi pengurus sekarang set `members.better_auth_user_id` → pengurus langsung
dapat akses front-end sebagai anggota IKPM. Guard `isNull()` mencegah overwrite akun yang sudah ada.

### Struktur File packages/db/src/
```
src/
├── index.ts               ← public API
├── client.ts              ← public schema db instance
├── tenant-client.ts       ← factory: createTenantDb(slug)
├── schema/
│   ├── public/            ← auth.ts, tenants.ts, members.ts, tenant-memberships.ts, profiles.ts
│   └── tenant/            ← factory tables: users, website, letters, finance, shop, settings
│                             (members TIDAK ADA di sini — sudah dipindah ke public)
└── helpers/
    ├── finance.ts         ← double-entry helper functions
    ├── member-number.ts   ← generateMemberNumber() via PostgreSQL SEQUENCE
    └── create-tenant-schema.ts ← DDL provisioning tenant baru
```

### Orders & Payment
`member_id` di `orders` nullable — untuk donasi dari luar yang tidak perlu login.
Semua payment butuh konfirmasi manual (cash/transfer/QRIS/gateway).

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
- [x] **Image System Phase D — Autocrop + Variant Baru**: `square-large` (800×800); module-aware generation; `position:"attention"` (libvips smart crop); manual crop editor UI (`react-image-crop`) + `crop_data` kolom + `/api/media/[id]/recrop`. ✅ SELESAI.
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
- [x] **Migrasi URL Admin** — admin dashboard pindah dari `/{slug}/*` ke `/app/{slug}/*`. Redirect 301 dari URL lama. Front-end publik tidak berubah. Detail: `docs/rencana-migrasi-url.md`.
- [ ] **Fase 5 URL** — admin subdomain custom domain (`admin.ikpmjogja.com`). Dijadwalkan setelah 2 minggu production stable dari 2026-05-21.

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
- **[SELESAI Fase 1-4] Migrasi URL** — admin dashboard dipindah ke `/app/{slug}/*`, publik tetap `/{slug}/*`. Redirect 301 dari path lama di `next.config.ts`. Fase 5 (admin subdomain `admin.ikpmjogja.com`) ditunda. Detail: `docs/rencana-migrasi-url.md`.
- **Post-login routing multi-tenant tidak deterministik** — `getFirstTenantForUser()` tidak ada `ORDER BY`, user di 2+ tenant bisa dikirim ke tenant mana saja. Perlu difix sebelum tenant kedua aktif.
- **Fase 5 URL migrasi** — admin subdomain custom domain (`admin.ikpmjogja.com`). Ditunda, perlu 2 minggu observasi production dulu. Detail di `docs/rencana-migrasi-url.md`.
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

## Lessons Learned

### [2025-04] Database Schema Selesai
- 18 file schema: public (auth, tenants) + tenant (users, members, website, letters, finance, shop, settings)
- Pattern: getTenantSchema(slug) dengan in-memory cache
- drizzle-kit hanya kelola public schema, tenant schema via createTenantSchemaInDb()
- schemaFilter: ["public"] di drizzle.config.ts wajib ada untuk proteksi tenant schemas

### [2025-04] Auth System Selesai
- Two-layer auth: middleware (cookie check) + layout (session validation)
- Register flow: Better Auth signUp → Server Action buat tenant + schema
- Security fix: userId diambil dari session server, bukan dari client
- Rollback mechanism: gagal buat schema → hapus tenant dari public
- params di Next.js 15 adalah Promise<> — wajib await

### [2025-04] Bug: Port Change → BETTER_AUTH_URL Harus Ikut Diganti
- Error: "An unexpected response was received from the server" dari Better Auth client
- Artinya: server return HTML (bukan JSON) — biasanya karena port mismatch atau DB error
- Setiap ganti port: update `BETTER_AUTH_URL` + `NEXT_PUBLIC_APP_URL` di `.env.local`, restart server, clear cookie browser

### [2025-04] Bug: Infinite Redirect Loop — "Partial Registration" State
**Skenario**: `signUp.email()` berhasil, tapi `registerAction` (buat tenant) gagal → user punya session tapi tidak punya tenant.

**Root cause**: Auth gate diduplikasi di dua tempat yang saling bertabrakan:
1. `middleware.ts` blok `/register` → redirect `/dashboard-redirect`
2. `AuthLayout` JUGA redirect semua user login → `/dashboard-redirect`
3. `/dashboard-redirect` tidak ada tenant → redirect ke `/register?error=no-tenant`
4. Loop tak henti

**Fix**:
- `middleware.ts`: hapus `/register` dari `AUTH_PAGES`
- `AuthLayout`: cek tenant dulu. Punya tenant → redirect dashboard. Belum → render halaman
- `register/page.tsx`: jika email sudah ada, skip `signUp`, langsung ke `registerAction`

**Pelajaran utama**:
- Auth gate JANGAN diduplikasi di middleware DAN layout tanpa koordinasi
- Selalu pikirkan "partial state": jika step 1 berhasil tapi step 2 gagal, user bisa recover
- Setiap redirect chain harus punya exit condition — hindari pola A → B → A

### [2025-04] Bug: 404 pada `/{slug}/dashboard`
- `app/(dashboard)/[tenant]/page.tsx` hanya menangani `/{slug}`, bukan `/{slug}/dashboard`
- Solusi: buat subfolder `dashboard/` → `app/(dashboard)/[tenant]/dashboard/page.tsx`
- Root `[tenant]/page.tsx` dijadikan redirect ke `/{slug}/dashboard`

**Aturan route Next.js App Router**:
```
[tenant]/page.tsx            → /{slug}
[tenant]/dashboard/page.tsx  → /{slug}/dashboard
[tenant]/members/page.tsx    → /{slug}/members
```
Setiap modul baru = subfolder baru di dalam `[tenant]/`.

**Client vs Server component**:
- `usePathname`, `useState`, `useRouter`, `signOut` → wajib `"use client"`
- Data fetching DB → server component. Jangan jadikan seluruh layout client hanya karena satu bagian kecil butuh interaktivitas — pecah jadi komponen terpisah

### [2025-04] Shell UI Selesai
- Sidebar desktop: server component, SidebarNav (client) untuk `usePathname` active state
- Mobile drawer: client component, render `<Sidebar>` dalam overlay — tidak duplikasi markup
- UserMenu: dropdown dengan inisial avatar, role badge, tombol keluar via Better Auth `signOut`
- Layout TenantLayout mengambil session + tenant 1× — child pages tidak perlu query ulang
- `dashboard/page.tsx` terpisah dari `page.tsx` — root redirect, dashboard content di subfolder

### [2025-04] Modul Anggota + Member Wizard Selesai
> Detail implementasi, lessons learned, keputusan sentralisasi: **`docs/arsitektur-keanggotaan.md`**

- 3 Server Actions: `createMemberAction`, `updateMemberAction`, `removeMemberFromTenantAction`
- Delete: hanya hapus dari `tenant_memberships` — data di `public.members` tidak dihapus
- NIK duplicate: deteksi via constraint name `members_nik_not_null_unique` di catch block
- Wizard 4-step: submit wajib di Step 1, Step 2–4 opsional
- SEQUENCE `public.member_number_seq` wajib dibuat manual via raw SQL; selalu pakai prefix `public.`

### [2025-04] UI Standard — Autocomplete
- Semua select/dropdown pakai Combobox (shadcn Command + Popover)
- Keputusan ini karena ref_villages 83k rows — plain select tidak feasible
- Berlaku untuk SEMUA form di seluruh aplikasi, bukan hanya wilayah
- Komponen `WilayahSelect` di `components/ui/wilayah-select.tsx` sebagai referensi implementasi
- Data kecil (<100): filter client-side via CommandInput; data besar: lazy fetch on-open per level


### [2025-04] Setup Awal
- Struktur monorepo: apps/web + packages/db + packages/ui + packages/types
- Bun sebagai package manager, bukan npm/yarn
- Tailwind v4 tidak butuh tailwind.config.ts

### [2025-04] SEO Module Selesai
- SeoPanel: accordion 3 tab (SEO Dasar, OG, Advanced) — collapsed by default, embed di form apapun
- Benchmark: Yoast SEO style — familiar bagi developer WordPress
- Traffic light score: 5 checks (keyword in title, desc, content; title length; desc length)
- Google Snippet Preview: real-time, toggle desktop/mobile, truncate otomatis di batas Google
- Social Preview: Facebook card + Twitter/X card — gambar OG atau placeholder abu-abu
- SEO helpers (`lib/seo.ts`): `generateMetadata`, `generateArticleJsonLd`, `generateProductJsonLd`, `generateOrganizationJsonLd`, `generateBreadcrumbJsonLd`, `truncateForSeo`, `generateSlug`, `buildTitle`
- SEO constants (`lib/seo-defaults.ts`): batas karakter, AI-friendly crawlers, robots preset, schema.org types
- AI-friendly robots.txt: izinkan GPTBot, ClaudeBot, Google-Extended (konten organisasi bersifat publik)
- Schema columns: posts, pages (cover_id FK → media, 9 SEO columns per tabel), products (og_image_id, SEO cols)
- DDL ordering fix: media dipindah ke step 5 (sebelum pages/posts) agar FK `cover_id` + `og_image_id` valid
- SeoValues type di-export dari seo-panel.tsx — parent form cukup `useState<SeoValues>(DEFAULT_VALUES)` + `onChange`
- Test page: `/{slug}/seo-test` — dummy page untuk verifikasi sebelum integrasi ke form post/page

### [2025-04] Website Module Selesai

**Block Editor (Tiptap v3):**
- Tiptap v3 banyak breaking change dari v2: BubbleMenu di `@tiptap/react/menus` (subpath), `immediatelyRender: false` wajib untuk Next.js SSR, named import `{ TextStyle }` dan `{ Table }`, tidak ada `tippyOptions` (ganti Floating UI `options={{ placement: "top" }}`), `setContent(parsed)` tanpa arg kedua
- `atom: true` di custom Node → leaf node → renderHTML TIDAK boleh ada `0` (content hole)
- Prose modifier Tailwind v4 tidak reliable di contenteditable — pakai direct selectors `[&_p]:my-3` dst
- oEmbed universal via `noembed.com/embed?url=` — support 300+ platform, tidak perlu package tambahan
- EmbedBlockView: `dangerouslySetInnerHTML` tidak re-execute `<script>` → pakai `useEffect` re-inject scripts (untuk Twitter/Instagram embeds)
- Preview konten embed: jangan pakai `dangerouslySetInnerHTML` di preview biasa — pakai `TiptapEditor editable={false}` agar React NodeView tetap aktif

**Client Components & Next.js App Router:**
- Namespace export `export const X = { A, B, C }` → import `{ X }` → `X.A` **tidak bekerja** dengan baik di Next.js client boundary. Selalu pakai individual named exports: `export function A()`, `export function B()`.
- `useSearchParams` wajib dibungkus `<Suspense>` di Next.js App Router — jika tidak dipakai, hapus importnya untuk menghindari warning.

**Pre-create Pattern:**
- Buat record kosong di DB dulu saat klik tombol, redirect ke edit page — tidak perlu modal input dulu. Pattern ini lebih baik dari "form create" karena: autosave bisa jalan, draft tersimpan meski browser tutup, URL bisa dibookmark.

**Tag Sync:**
- Gunakan diff (bukan delete-all + insert-all) untuk pivot table: hitung `toRemove` dan `toAdd`, jalankan DELETE dan INSERT hanya untuk yang berubah. Lebih aman untuk race condition.

**Label Tombol yang Jelas:**
- Tombol simpan harus mencerminkan status: "Simpan Draft" / "Simpan Perubahan" / "Arsipkan" — bukan "Simpan" generik
- Tombol ubah status harus eksplisit: "Publikasikan" / "Jadikan Draft" — bukan "Publish/Unpublish" dalam bahasa Inggris
- Hindari `useTransition` ganda untuk aksi yang memanggil function yang sama — cukup satu `isPending`

### [2025-04] Kategori & Tag Selesai

**SelectItem value="" — Error Radix**
- `<SelectItem value="">` tidak valid di shadcn/ui — Radix melarang empty string karena dipakai sebagai sentinel "clear selection"
- Fix: gunakan sentinel explicit seperti `value="none"`, lalu konversi ke `null` sebelum dikirim ke server action
- Berlaku di SEMUA SelectItem di seluruh aplikasi — pattern ini harus konsisten

**Combobox untuk Select di Sidebar**
- Category di post editor pakai Popover + Command (bukan Select), sesuai standar UI Combobox
- "Tambah kategori baru" sebagai inline form di bawah CommandList — tidak perlu navigasi ke halaman kategori
- Setelah inline create: update local state (tidak perlu router.refresh) + select item baru otomatis

**TagInput dengan Comma Creation**
- Pattern: input field + Popover dropdown dengan PopoverAnchor
- Ketik → dropdown filter existing tags; koma/Enter → cek exact match (case-insensitive) → select existing ATAU create baru
- onBlur + setTimeout(150ms) untuk tutup dropdown — memberi waktu click di dropdown terdaftar sebelum blur menutup
- `onInteractOutside={(e) => e.preventDefault()}` di PopoverContent untuk cegah Radix auto-close saat klik item
- Backspace saat input kosong → hapus tag terakhir (UX standar tag input)
- Local state untuk tag/category yang baru dibuat — tidak butuh router.refresh(), ID langsung dipakai

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

### [2026-04] Modul Pengurus Selesai

**Schema baru:**
- `divisions` — hierarkis self-referential (parent_id FK ke diri sendiri), kode singkatan (SEKR, BEND, dll)
- `officers` — FK cross-schema ke `public.members` (bukan tenant members), `can_sign` flag untuk penandatangan resmi
- `letter_signatures` — multi-signer per surat (signer/approver/witness), `verification_hash` unik per approval event

**Keputusan desain yang dikunci:**
- QR Code verifikasi: hash di-generate **saat officer menandatangani** (`letter_id + officer_id + timestamp`), bukan stored di officer table
- Layout TTD **tidak di-hardcode** — posisi QR Code bebas ditempatkan di template surat oleh admin
- Info di QR Code: nama + jabatan + divisi + tanggal (bukan data sensitif)
- `deleteOfficerAction` diblokir jika officer sudah punya `letter_signatures` — gunakan toggle non-aktif saja
- `deleteDivisionAction` diblokir jika masih ada officer di divisi

**Route:**
```
/{slug}/pengurus/ — list per divisi, avatar, badge "Penandatangan"
/{slug}/pengurus/new — combobox pilih anggota + combobox pilih divisi
/{slug}/pengurus/[id]/edit — edit + toggle aktif + hapus (dengan guard)
/{slug}/divisi/ — CRUD inline divisi (nama, kode, deskripsi, urutan)
```

**Bug fix saat type-check:**
`access.id` → `access.tenant.id` — `TenantAccessResult` punya struktur `{ tenant, tenantUser, userId }`, bukan flat. Periksa setiap kali pakai `access.*` di server page.

### [2026-04] Modul Surat Lanjutan — TTD Digital + QR + PDF

**Pattern: `getSettings` butuh TenantDb lengkap, bukan raw db**
- `getSettings(tenantDb, group)` gagal jika `tenantDb` adalah hasil destructure `{ db, schema }` — TypeScript menolak karena tipe berbeda
- Fix: simpan hasil `createTenantDb(slug)` dulu, baru destructure:
```typescript
const tenantClient             = createTenantDb(slug);
const { db: tenantDb, schema } = tenantClient;
// Query pakai tenantDb; helper (getSettings) pakai tenantClient
await getSettings(tenantClient, "contact");
```

**PDF margin — jangan dobel antara CSS dan Playwright**
- `page.pdf({ margin: { top: "20mm" } })` di Playwright + `body { padding: 20mm }` di CSS = margin 40mm di PDF
- Fix: gunakan CSS `@page { margin: Xmm }` di HTML, dan JANGAN set `margin` di `page.pdf()`
- `@page` adalah print-specific CSS yang dikehormati browser rendering engine (Chromium)
- Playwright kemudian tidak perlu tahu soal margin sama sekali

**Playwright di Next.js API Route**
- Import dari `playwright`, bukan `@playwright/test`: `import { chromium } from "playwright"`
- Wajib `args: ["--no-sandbox", "--disable-setuid-sandbox"]` untuk Docker/VPS environment
- Jalankan di Node.js runtime (bukan Edge) — default di Next.js App Router
- Pattern: `let browser; try { browser = await chromium.launch(...) } finally { await browser?.close() }`
- `await page.setContent(html, { waitUntil: "networkidle" })` — tunggu semua resource (gambar MinIO) loaded

**QR Code optimistic update caveat**
- QR di-generate server-side (Node.js) saat halaman detail dimuat
- Setelah officer sign (optimistic update via client), QR tidak tersedia langsung — tampilkan placeholder
- QR baru muncul setelah halaman di-refresh (server render ulang)
- Pattern ini sudah didokumentasikan di `LetterSigningSection`: `qrDataUrl: null` untuk signature baru

**Public route group untuk halaman tanpa auth**
- `app/(public)/[tenant]/verify/[hash]/page.tsx` — route group `(public)` sejajar dengan `(dashboard)`
- Karena di luar `(dashboard)`, layout auth tidak teraplikasi — tidak ada `redirect("/login")`
- Halaman tetap bisa query DB langsung (server component) tanpa auth
- Pattern ini cocok untuk halaman publik lain: invoice, receipt, link undangan

**Halaman verifikasi: tampilkan "invalid" bukan 404**
- Jika hash tidak ditemukan → jangan `notFound()` (return 404) — itu membingungkan
- Tampilkan halaman "Tanda Tangan Tidak Valid" yang informatif — hash mungkin dipalsukan atau surat diedit
- Hanya `notFound()` untuk tenant yang tidak ada / tidak aktif

**`renderBody` — Tiptap JSON di server**
> Detail lengkap arsitektur render, merge fields, QR, dan bulk: **`docs/arsitektur-surat-detail.md`**

- Implementasi: custom renderer di `lib/letter-render.ts` — pure string manipulation, **tanpa** `@tiptap/core` / `prosemirror-model`
- Alasan: `prosemirror-model` akses `window.document` saat serialisasi → crash di RSC/Node
- Fallback: jika body bukan JSON valid → `escapeHtml(body).replace(/\n/g, "<br>")`
- Urutan wajib: `resolveMergeFields(rawJsonString)` dulu → baru `renderBody()` → HTML

## Arsitektur Modul Surat

### Tabel Schema
```
letter_types      → jenis surat (SK, Undangan, dll) — CRUD inline di /letters/template
letter_contacts   → kontak luar + opsional link ke public.members
letter_templates  → kop surat (ukuran kertas, font, margin, gambar header/footer)
letters           → surat utama — type: outgoing | incoming | internal
letter_number_sequences → counter nomor surat per year+type+category (atomic)
letter_signatures → tanda tangan digital per officer (multi-signer)
```

### Route Structure
```
app/(dashboard)/[tenant]/letters/
├── layout.tsx            → shell: LettersNav (sub-nav kiri) + slot konten kanan
├── page.tsx              → redirect ke /letters/keluar
├── keluar/
│   ├── page.tsx          → list surat keluar (type=outgoing)
│   ├── new/page.tsx      → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx → LetterForm (subject, body, nomor, jenis, template, paper size)
├── masuk/
│   ├── page.tsx          → list surat masuk (type=incoming)
│   └── new/page.tsx      → IncomingLetterForm (direct save, no pre-create)
├── nota/
│   ├── page.tsx          → list nota dinas (type=internal)
│   ├── new/page.tsx      → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx → LetterForm (sama seperti keluar)
└── template/
    ├── page.tsx          → LetterTypeManageClient + LetterTemplateList
    ├── new/page.tsx      → LetterTemplateForm
    └── [id]/edit/page.tsx → LetterTemplateForm
```

### Server Actions (letters/actions.ts)
```
createLetterDraftAction(slug, type)           → pre-create draft → return letterId
createIncomingLetterAction(slug, data)        → direct create surat masuk
updateLetterAction(slug, letterId, data)      → update semua field
updateLetterStatusAction(slug, letterId, s)   → quick status change
deleteLetterAction(slug, letterId)            → delete sigs dulu, baru letter
getNextLetterNumberAction(slug, type, cat?)   → atomic SELECT FOR UPDATE

CRUD letter_types:    createLetterTypeAction, updateLetterTypeAction, deleteLetterTypeAction
CRUD letter_templates: createLetterTemplateAction, updateLetterTemplateAction, deleteLetterTemplateAction
CRUD letter_contacts: createLetterContactAction, updateLetterContactAction, deleteLetterContactAction
```

### Nomor Surat — Format
```
{counter}/{kategori}/{bulan-romawi}/{tahun}
Contoh: 001/IKPM/IV/2025
Counter atomic: SELECT FOR UPDATE di letter_number_sequences
Kategori = letter_types.default_category (mis. UMUM, SEKR, IKPM)
```

### Fitur yang Sudah Diimplementasikan (Surat Lanjutan)

**Step 3a — Tanda Tangan Digital**
- `signLetterAction(slug, letterId, officerId, role)` — insert `letter_signatures`, hash = SHA-256(`${letterId}:${officerId}:${signedAt.toISOString()}`)
- `removeSignatureAction(slug, signatureId)` — admin/owner only
- `LetterSigningSection` client component — role select (signer/approver/witness) per officer, optimistic update
- `isCurrentUser` detection: prioritas `officers.userId === tenantUser.id`, fallback `officers.memberId === tenantUser.memberId`
- Body surat di-render dari Tiptap JSON via `lib/letter-render.ts` (custom renderer, lihat `docs/arsitektur-surat-detail.md`)
- Detail page untuk keluar/[id], nota/[id] (masuk read-only)

**Step 3b+3c — QR Code + Halaman Verifikasi Publik**
- `lib/qr-code.ts`: `generateQrDataUrl(text)` → base64 PNG via `qrcode` npm package (server-side only)
- `buildVerifyUrl(slug, hash)` → `${NEXT_PUBLIC_APP_URL}/${slug}/verify/${hash}`
- QR di-generate server-side saat halaman detail dimuat; optimistic state setelah sign menampilkan placeholder
- `app/(public)/[tenant]/verify/[hash]/page.tsx` — route group `(public)` di luar `(dashboard)`, NO auth
- Halaman publik: cek tenant aktif → lookup hash → tampilkan letter info + signer info + QR ulang

**Step 3d — PDF Generation**
- `lib/letter-merge.ts`: `resolveMergeFields(template, ctx)` — regex replace `{{key}}` dari flat map
- `lib/letter-html.ts`: build HTML lengkap (kop surat header image, metadata, body, signers + QR, footer image)
  - Margin via CSS `@page { margin: Xmm }` — bukan body padding, agar tidak dobel dengan Playwright
  - Footer: `position: fixed; bottom: 0` → muncul di SETIAP halaman PDF
  - Body mendapat `padding-bottom: 36mm` kondisional saat footer ada (cegah overlap)
  - F4/Folio: lebar tepat `215mm` (bukan 210mm)
- `POST /api/letters/[id]/generate-pdf?slug=` — auth check → fetch data → build HTML → Playwright → MinIO → update `pdf_url`
- `components/letters/generate-pdf-button.tsx` — tombol unduh + link buka PDF terakhir (auto-download)
- Tombol muncul di halaman detail keluar + nota

**Step 4 — Mail Merge Bulk**
- `createBulkLettersAction(slug, parentId, recipients[])` — insert N child letters, set `isBulk=true` di parent setelah selesai
  - `BulkRecipient` type: `{ type: "member"|"contact", id, name, phone?, email?, address?, number?, nik? }`
  - Nomor anak: `parent.letterNumber + "/1"`, `"/2"`, dst — null jika parent belum punya nomor
  - Sequential insert (bukan Promise.all) untuk suffix yang konsisten
  - Guard: max 500 recipients, admin/owner only
- `markAllChildrenSentAction(slug, parentId)` — bulk update status anak dari draft → sent
- `lib/letter-merge.ts` — extended: tambah `recipient` context (name, phone, email, address, number, nik)
  - Merge fields baru: `{{recipient.name}}`, `{{recipient.phone}}`, dll — resolved per-anak saat generate PDF
- `GET /api/ref/tenant-members` — paginated API (PAGE_SIZE=30) dengan filter `status`, `search`, `page`
  - JOIN: `members INNER JOIN tenantMemberships LEFT JOIN contacts` (phone/email dari contacts table via FK)
  - Gunakan `access.tenant.id` dari `getTenantAccess()` — tidak butuh lookup tenant terpisah
- `app/(dashboard)/[tenant]/letters/keluar/[id]/bulk/page.tsx` — server component, fetch parent + contacts
- `components/letters/bulk-recipient-picker.tsx` — client component dua tab:
  - Tab "Dari Anggota": debounced search (300ms), pagination, filter status (aktif/alumni/semua), "Pilih semua halaman ini"
  - Tab "Dari Kontak": pre-loaded dari server (biasanya kecil)
  - Chip display selected recipients (removable), call `createBulkLettersAction`, redirect setelah 1.5s
- `components/letters/bulk-children-section.tsx` — client component, daftar salinan dengan:
  - "Generate Semua PDF" — fire and forget via `Promise.allSettled`, trigger paralel per anak, re-enable tombol setelah 2 detik
  - "Tandai Semua Terkirim" — optimistic update via `markAllChildrenSentAction`
  - Status icon: CheckCircle2 (sent) / Clock (draft)
- `keluar/[id]/page.tsx` — updated: tombol "Kirim Massal", warning banner jika sudah isBulk, section BulkChildrenSection di bawah

**Step 5 — Manajemen Kontak Surat + Nav Fix**
- `letters-nav.tsx` — tambah item "Kontak" (path: `kontak`) di antara Nota Dinas dan Template
- `app/(dashboard)/[tenant]/letters/kontak/page.tsx` — server component, fetch `letterContacts` orderBy name
- `components/letters/letter-contact-manage-client.tsx` — inline CRUD: form tambah/edit (name, title, org, phone, email, address), list dengan Pencil + Trash2
- `letter-list-client.tsx` — updated:
  - Kolom aksi: Eye (detail) + FileDown (PDF, jika pdfUrl ada) + Copy badge (bulk parent) + Pencil (edit, non-incoming) + Trash2 (delete)
  - `LetterRow` type: tambah `isBulk: boolean` dan `pdfUrl: string | null`
  - Search diperluas ke field `recipient`
- Semua list page (keluar, nota, masuk) — query ditambah `isBulk` dan `pdfUrl` di SELECT

**Step 6 — Arsitektur Ulang Template + Format Nomor Dinamis + Pengaturan Surat**

*Template surat:*
- `letter_templates` diubah dari "kop surat" → template konten (perihal + isi surat)
- Kolom lama (paper_size, body_font, margin_*, is_default, header_image_id, footer_image_id) dihapus
- Kolom baru: `type` (outgoing/internal), `subject`, `body`, `is_active`
- Saat template dipilih di form surat → auto-isi perihal & isi jika masih kosong
- `letters-nav.tsx`: tambah item "Pengaturan" (path: `pengaturan`)

*Kop surat & styling dipindah ke `/letters/pengaturan`:*
- Disimpan di `settings` table: `key="letter_config", group="general"` (JSONB)
- Fields: `header_image_url`, `footer_image_url`, `paper_size`, `body_font`, `margin_*`, `number_format`, `org_code`, `number_padding`
- **URL gambar disimpan langsung** (bukan media ID) → PDF route tidak perlu lookup media table
- `components/letters/letter-config-client.tsx` — form pengaturan dengan MediaPicker untuk header/footer

*Format nomor surat dinamis:*
- `lib/letter-number.ts`: `resolveLetterNumberFormat()` + `resolveSequenceCategory()`
- Format string: `{number}`, `{number:N}`, `{type_code}`, `{org_code}`, `{issuer_code}`, `{month_roman}`, `{month}`, `{year}`, `{year:2}`
- `issuer_officer_id` ditambah ke tabel `letters` (FK ke officers)
- Form surat: dropdown "Yang Mengeluarkan" → kode divisi officer → `{issuer_code}`
- `resolveSequenceCategory()`: jika format pakai `{issuer_code}` → category = divisionCode.upper(); else "UMUM"

*Presisi ukuran kertas (piksel @ 96 DPI):*
| Ukuran | Lebar | Tinggi |
|--------|-------|--------|
| A4 | 794px | 1123px |
| F4 / Folio | 813px | 1247px |
| Letter | 816px | 1056px |

Hint dinamis di dropdown pengaturan berubah sesuai pilihan. Tinggi hanya referensi (konten menentukan panjang aktual).

### Fitur Belum Diimplementasikan
- Inter-tenant — `inter_tenant_to` + `inter_tenant_status` → kirim ke cabang IKPM lain
- Attachment lampiran — MediaPicker untuk upload lampiran surat
> Detail arsitektur identitas surat, tujuan surat, dan format tanggal: **`docs/arsitektur-surat.md`**
> Detail arsitektur layout TTD, slot-based signing, dan alur URL publik (SELESAI): **`docs/arsitektur-tandatangan.md`**

### [2026-04] Mail Merge Bulk + Kontak Surat

**`members` tidak punya kolom `phone`/`email` langsung**
Data kontak (phone, email) ada di tabel `contacts` via FK `members.contactId` — bukan kolom langsung di `members`.
Fix: `LEFT JOIN contacts ON contacts.id = members.contactId` di setiap query yang butuh data kontak anggota.
Berlaku juga untuk API paginated `/api/ref/tenant-members`.

**Sequential insert untuk suffix yang konsisten**
Saat buat N child letters sekaligus, gunakan `for` loop (bukan `Promise.all`) agar suffix `/1`, `/2`, dst
muncul sesuai urutan iterasi — `Promise.all` tidak menjamin urutan insert.

**Fire-and-forget di browser: `void Promise.allSettled(...).then(...)`**
Pattern untuk trigger batch tanpa blokir UI:
```typescript
void Promise.allSettled(items.map(item => fetch(...))).then(() => {
  setState("selesai");
});
setTimeout(() => setFiring(false), 2000); // re-enable tombol lebih cepat
```
Gunakan `void` di depan agar TypeScript tidak komplain tentang unhandled Promise.
Re-enable tombol via `setTimeout` sebelum `allSettled` selesai — cegah double-click tanpa blokir UX.

**Debounce search di client component**
Pattern standard: `useEffect` dengan `clearTimeout`/`setTimeout` 300ms pada `search` state,
hasil disimpan ke `debouncedSearch` state terpisah. `useEffect` kedua trigger fetch hanya ketika
`debouncedSearch` (atau params lain) berubah. Ini memisahkan "kapan user berhenti ketik" dari "kapan fetch jalan".

**Paginated API dengan filter: gunakan `access.tenant.id` langsung**
Di API route yang butuh filter per-tenant, `getTenantAccess(slug)` sudah mengembalikan `access.tenant.id`.
Tidak perlu query `public.tenants` lagi untuk dapat tenant ID — ini menghemat satu roundtrip DB.

### [2026-04] Arsitektur Ulang Surat — Template, Nomor Dinamis, Pengaturan

**Jangan simpan media ID di settings JSONB jika perlu URL di PDF route**
Jika menyimpan `header_image_id` di settings, PDF route harus query media table lagi untuk dapat URL.
Lebih efisien simpan URL langsung (`header_image_url`) — MediaPicker sudah mengembalikan URL via `media.url`.
Pattern: simpan ID hanya jika perlu referensi relasional (misal audit trail, cascade delete). Untuk config statis → simpan URL langsung.

**letter_templates: konten bukan styling**
Template surat = isi (perihal + body) yang bisa dipilih saat buat surat. Styling (font, margin, kop surat) adalah konfigurasi organisasi → masuk settings, bukan template per-surat.
Jangan campurkan "template konten" dengan "template tampilan" — keduanya lifecycle-nya berbeda.

**F4/Folio = 215mm, bukan 210mm**
Kertas Folio standar Indonesia adalah 215mm × 330mm. Playwright menggunakan `{ width: "215mm", height: "330mm" }`.
A4 = 210mm, F4 = 215mm — bedanya 5mm tapi mempengaruhi presisi layout kop surat.

**Footer PDF: position:fixed agar muncul di setiap halaman**
`position: fixed; bottom: 0; left: 0; right: 0` di HTML yang dirender Playwright → footer muncul di semua halaman.
Tambahkan `padding-bottom` kondisional ke body agar konten tidak tertimpa footer.
Jangan masukkan footer sebagai elemen flow biasa jika ingin muncul di setiap halaman.

**Format nomor surat dinamis: urutan replace penting**
Di `resolveLetterNumberFormat()`, `{number:N}` harus di-replace SEBELUM `{number}`, dan `{year:2}` SEBELUM `{year}`.
Jika dibalik, `{number:3}` akan di-replace sebagian oleh `{number}` lebih dulu → hasil salah.
Pattern: selalu proses yang lebih spesifik (dengan parameter) sebelum yang umum.

**officer fetch untuk dropdown form: pakai isActive, bukan canSign**
Dropdown "Yang Mengeluarkan" di form surat butuh SEMUA officer aktif (semua bisa mengeluarkan surat),
bukan hanya yang `canSign=true` (canSign khusus untuk tanda tangan digital di letter_signatures).
Jangan campur dua konsep ini.

### [2026-04] renderBody — prosemirror-model tidak server-safe

> Detail lengkap ada di `docs/arsitektur-surat-detail.md` bagian "Lessons Learned"

**Masalah**: Isi surat tampil sebagai raw JSON, bukan HTML. Root cause berlapis:
1. `TiptapEditor editable={false}` di server component → butuh JS hydration → konten tidak muncul
2. `generateHTML` dari `@tiptap/core` → `prosemirror-model` memanggil `window.document` → crash
3. Crash ditelan `try/catch` diam-diam → fallback ke `escapeHtml(body)` → tampak "raw JSON"
4. Bug tambahan: autolink lama pecah `{{variable}}` jadi empty text node → `RangeError`

**Fix**: Buang `@tiptap/core` dari `letter-render.ts`. Ganti dengan custom renderer pure string
(recursive `renderNode` + `applyMark`) — zero DOM dependency, fully server-safe.

**Aturan**: Jangan pakai `generateHTML` dari `@tiptap/core` di server. Jangan bungkus
rendering dengan `try/catch` tanpa log — error tersembunyi sangat sulit dideteksi.

### [2026-04] Modul Event — SELESAI (Step 1–6 + Audit Fixes)

**Arsitektur lengkap di `docs/arsitektur-event.md`.**

**Step 1–2 (Schema + Admin UI):**
- 5 tabel baru: `event_categories`, `events`, `event_tickets`, `event_registrations`, `event_registration_sequences`
- EventForm: Tiptap + TicketManager (diff sync, tidak delete-all) + SeoPanel + sidebar (Kategori combobox + Cover MediaPicker)
- CRUD kategori inline di `/event/kategori`
- payments.source_type diperluas: tambah `"event_registration"` — **wajib update Drizzle enum DAN DDL CHECK constraint bersamaan**

**Step 3–6 (Publik + Pendaftaran + Check-in + Sertifikat):**
- Halaman publik `/(public)/[tenant]/event/[slug]` — EventRegisterForm: pilih tiket, data peserta, metode bayar
- Admin detail event: stats (total/confirmed/pending/attended) + list pendaftaran + konfirmasi bayar + approve/cancel
- Check-in hari-H: EventCheckinClient — search real-time + satu tombol + flash konfirmasi
- Sertifikat PDF: Playwright landscape A4, upload MinIO, tombol di list pendaftaran

**Lessons Learned:**

#### Toggle tanpa render = fitur palsu
Setiap boolean toggle di form admin (`showAttendeeList`, `showTicketCount`, `requireApproval`) harus punya pasangannya di consumer. Kalau belum diimplementasikan di halaman publik, jangan tampilkan toggle dulu. Berlaku di semua modul.

#### Drizzle `.notNull()` wajib match DDL `NOT NULL`
Jika DDL sudah `NOT NULL`, Drizzle schema wajib `.notNull()`. Ketidakcocokan membuat TypeScript types lebih lebar dari realita → guard `?? ""` tidak perlu tersebar di mana-mana.

**Pattern**: setiap kali nulis DDL `NOT NULL`, langsung tambahkan `.notNull()` di Drizzle schema di baris yang sama.

#### Kuota/kapasitas terbatas wajib SELECT FOR UPDATE
Pattern `SELECT COUNT → INSERT` tanpa lock rentan race condition. Untuk quota-limited resources, gunakan:
```typescript
await db.transaction(async (tx) => {
  // Lock baris tiket agar concurrent requests antre
  await tx.select().from(schema.eventTickets)
    .where(sql`${schema.eventTickets.id} = ${ticketId} FOR UPDATE`);
  
  // Count SETELAH lock — tidak akan berubah sampai transaction selesai
  const [{ used }] = await tx.select({ used: count() })...
  if (Number(used) >= quota) throw new Error("Kuota habis.");
  
  // Insert dalam transaction yang sama
  return tx.insert(...).values(...).returning(...);
});
```
**Kapan wajib**: event populer, produk terbatas, apapun yang punya `quota != null`.

#### Public action tetap perlu revalidatePath
Server action tanpa `getTenantAccess()` (public, seperti `registerForEventAction`) tetap perlu `revalidatePath` jika ada server component yang menampilkan data yang berubah akibat action tersebut. Jangan berasumsi public action tidak perlu revalidate.

#### Semantik nama fitur menentukan validasi
"Sertifikat Kehadiran" harus hanya untuk `status=attended` — bukan siapapun yang `confirmed`. Nama fitur di UI harus dicerminkan oleh validasi di API route. Jika ragu, nama yang lebih ketat lebih aman.

#### Toggle Gratis/Berbayar per tiket: pattern `_isGratis`
Untuk input yang conditional (muncul/sembunyi berdasarkan pilihan user), simpan state UI sebagai field `_` di local state (`_isGratis`, `_expanded`, dll). Field `_` tidak dikirim ke server — di-strip saat `buildData()`. Pattern:
```typescript
type TicketLocal = TicketInput & {
  _key:      string;    // React key, tidak ke server
  _expanded: boolean;  // UI state, tidak ke server
  _isGratis: boolean;  // UI toggle, mengontrol price=0 dan visibilitas input harga
};

// Di addTicket: _isGratis: true (default gratis)
// Di loading existing: _isGratis: t.price === 0
// Di toggle → gratis: updateTicket(key, { _isGratis: true, price: 0 })
// Di buildData(): strip semua _ fields, kirim hanya TicketInput
```

#### Input conditional: disabled bukan hidden
Jika sebuah input conditional (muncul/sembunyi berdasarkan toggle), jangan sembunyikan input saat kondisi off — **tampilkan tapi disable**. Jika input disembunyikan, user tidak tahu di mana mengisi nilai setelah mengubah toggle.
- **Salah**: `{!isGratis && <Input ... />}` → input hilang saat Gratis, user bingung mencari field harga
- **Benar**: `<Input disabled={isGratis} placeholder={isGratis ? "0 (Gratis)" : "Masukkan harga"} />`
Berlaku untuk semua input conditional di seluruh aplikasi.

#### Kategori payment untuk modul baru
Saat modul baru butuh pembayaran, **buat kategori baru** di payment settings — jangan menumpang kategori modul lain. Event saat ini menggunakan kategori `"donasi"` atau `"general"` sebagai fallback. Jika ingin pisah, tambah kategori `"event"` di settings payment dan update filter di public page. Komentar TODO sudah ditambahkan di `[slug]/page.tsx`.

#### showTicketCount: hitung per-query, bukan realtime
`showTicketCount` di halaman publik mengambil count dari DB saat page di-render (server component). Tidak realtime — peserta lain yang baru daftar tidak langsung update hitungan. Untuk event dengan kuota ketat dan traffic tinggi, pertimbangkan revalidate lebih agresif atau polling client-side.

### [2026-07] Mobile Layout Overflow — `min-h-screen` Ekstra di Public Page

**Aturan**: Halaman publik (post, event, campaign, produk, dll) TIDAK BOLEH punya wrapper `<div className="min-h-screen bg-background">` sebagai elemen terluar. `PublicLayout` sudah menyediakan background dan min-height via CSS. Wrapper ekstra menyebabkan content overflow di mobile ("terlalu ke kanan frame").

**Pattern yang benar** — identik untuk semua halaman detail publik:
```tsx
return (
  <div className="max-w-7xl mx-auto px-4 py-8">
    {/* breadcrumb */}
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      <div className="space-y-6 min-w-0">  {/* ← min-w-0 wajib di kolom kiri */}
        ...
      </div>
      <div className="lg:sticky lg:top-6 space-y-4">  {/* kolom kanan */}
        ...
      </div>
    </div>
  </div>
);
```

**Referensi yang benar**: `app/(public)/[tenant]/post/[slug]/page.tsx` — tidak punya wrapper ekstra, langsung `max-w-7xl mx-auto`. Setiap kali layout publik baru tidak rapi di mobile, bandingkan strukturnya dengan post page ini.

**`min-w-0` di kolom kiri wajib** — mencegah overflow text/konten yang tidak bisa di-wrap di dalam flex/grid child.

### [2026-07] Tiket Wajib Anggota — `requires_membership` + Opsi A (Tampil, Bukan Blokir)

**Fitur**: Toggle per tiket "Wajib Anggota Terdaftar" (`requires_membership BOOLEAN NOT NULL DEFAULT false`).
Jika aktif, tiket hanya bisa dipesan oleh user yang terdaftar di `tenant_memberships` cabang ini
(status `active` atau `alumni`).

**Keputusan desain yang dikunci — Opsi A:**
Tiket tetap tampil di halaman publik — tidak disembunyikan. User yang belum terdaftar melihat:
- Badge "Anggota" di header tiket
- Link "Lengkapi Keanggotaan →" (mengarah ke `${baseUrl}/akun/lengkapi`)
- Tiket tidak bisa diklik/dipilih

Ini bukan blokir total — user diundang mendaftar dulu, baru bisa beli tiket.

**Dua lapisan perlindungan (wajib keduanya):**
1. **Client-side** (`event-register-form.tsx`): guard di `handleSubmit()` mencegah submit jika tiket locked — untuk UX yang responsif
2. **Server-side** (`registerForEventAction`): guard di action mencegah bypass via curl/Postman — query `tenant_memberships` sebelum INSERT

**Pattern enrollment check di server action:**
```typescript
if (ticket.requiresMembership) {
  if (!resolvedMemberId)
    return { success: false, error: "Tiket ini hanya untuk anggota terdaftar." };

  const [tenantRow] = await publicDb
    .select({ id: tenants.id }).from(tenants)
    .where(eq(tenants.slug, slug)).limit(1);

  if (tenantRow) {
    const [membership] = await publicDb
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.tenantId, tenantRow.id),
        eq(tenantMemberships.memberId, resolvedMemberId),
        sql`${tenantMemberships.status} IN ('active', 'alumni')`,
      )).limit(1);
    if (!membership)
      return { success: false, error: "Tiket ini hanya untuk anggota terdaftar cabang ini." };
  }
}
```

**`currentUserIsEnrolled` di halaman publik:**
Di-query di `agenda/[slug]/page.tsx` setelah `resolvedMemberId` diketahui — satu query ke
`tenant_memberships`. Di-pass sebagai prop ke `EventRegisterForm` bersama `baseUrl` (sudah
computed dari `isOwnHost(host)`).

**Form UX ketika locked:**
- Semua section (`Data Peserta`, `Metode Pembayaran`, `Submit`) dibungkus `{!selectedTicketLocked && ...}`
- Untuk multi-tiket: CTA amber muncul setelah daftar tiket saat tiket terpilih locked
- Untuk single tiket: amber block di bagian atas tiket info sudah cukup (tidak ada duplikasi CTA)
- Auto-fill nama/HP dari session sudah bekerja via `defaultAttendeeName`/`defaultAttendeePhone` —
  saat user enrolled, form tampil langsung dengan nama & HP terisi

**Migration**: `packages/db/migrations/0020_event_ticket_requires_membership.sql` — DO $$ loop
ALTER TABLE semua tenant aktif. Wajib dijalankan di VPS sebelum deploy kode.

**File yang terlibat:**
- `packages/db/src/schema/tenant/events.ts` — kolom baru di `createEventTicketsTable`
- `packages/db/src/helpers/create-tenant-schema.ts` — DDL kolom baru
- `apps/web/app/(dashboard)/app/[tenant]/event/actions.ts` — `TicketInput` + `syncTickets` + guard
- `apps/web/app/(dashboard)/app/[tenant]/event/acara/[id]/edit/page.tsx` — pass kolom ke form
- `apps/web/components/event/event-form.tsx` — toggle ToggleRow di TicketManager
- `apps/web/components/event/event-register-form.tsx` — locked ticket UI + guard submit
- `apps/web/app/(public)/[tenant]/agenda/[slug]/page.tsx` — enrollment check + props baru

### [2026-04] Modul Dokumen — SELESAI

**Arsitektur lengkap di `docs/arsitektur-document.md`.**

**Schema:** 3 tabel — `document_categories` (hierarkis self-ref), `documents`, `document_versions`

**Fitur selesai:**
- CRUD dokumen: create + metadata edit
- Versioning: upload versi baru, riwayat versi, restore versi lama
- File proxy API: `GET /api/documents/[id]/file` — auth check visibility → stream MinIO
- PDF Viewer: `<iframe>` dalam shadcn Dialog, fallback "Buka di tab baru"
- Kategori hierarkis: tree view inline, parent-child 2+ level
- Halaman publik: `/(public)/[tenant]/dokumen/[id]` — hanya untuk `visibility=public`
- Sidebar: "Dokumen" dengan icon FolderOpen setelah Event

**Lessons Learned:**

#### Circular FK: plain UUID tanpa constraint
`documents.current_version_id → document_versions` dan `document_versions.document_id → documents` = circular. Solusi: `current_version_id` adalah plain UUID tanpa FK constraint di DDL. Application layer menjamin konsistensi.

#### tenant.users tidak punya kolom name
`tenant_{slug}.users` hanya punya `betterAuthUserId`, `role`, `memberId`. Untuk nama user perlu join ke `public.user WHERE id = betterAuthUserId`. Saat ini uploader name di-skip (null) — diimplementasikan nanti saat ada helper cross-schema.

#### inArray untuk filter array — WAJIB, jangan pernah sql`ANY()`

> **Bug fatal yang pernah terjadi (2026-07-10)**: Halaman publik event (`/agenda/{slug}`) 500 error di production.
> Error PostgreSQL: `malformed array literal: "6e054778-fc7c-4608-a0e1-1996d64c4851"` (kode 22P02).
> Root cause: `sql\`${members.id} = ANY(${memberIds})\`` — postgres.js mengirim array JS sebagai
> satu nilai string (bukan array PostgreSQL `{uuid1,uuid2}`) → `array_in()` gagal parse.

**Aturan mutlak:**
```typescript
// SALAH — postgres.js tidak serialize array JS ke array PostgreSQL dengan benar
.where(sql`${column} = ANY(${jsArray})`)

// SALAH — sql.raw() dengan string interpolation IDs = SQL injection vulnerability
.where(sql`${column} = ANY(${sql.raw(`ARRAY[${ids.map(id => `'${id}'`).join(",")}]::uuid[]`)})`)

// BENAR — generate WHERE column IN ($1, $2, $3) yang valid
.where(inArray(column, jsArray))
```

`inArray(column, ids)` dari `drizzle-orm` adalah satu-satunya cara yang benar untuk filter array di project ini.
Berlaku untuk semua tipe kolom: UUID, integer, text. Import: `import { inArray } from "drizzle-orm"`.
Pastikan array tidak kosong sebelum panggil `inArray` — atau guard dengan `if (ids.length > 0)` dulu.

#### Content-Disposition inline untuk PDF viewer
`inline` → browser render (PDF terbuka). `attachment` → download paksa.
Pakai `inline` agar `<iframe>` PDF viewer berfungsi. Download tetap via `<a download>`.

### [2026-04+05] Role System & User Management — SELESAI

**Arsitektur lengkap di `docs/arsitektur-role-user.md`.**

**Schema:** `tenant.custom_roles` + `tenant.tenant_invites` + perubahan `tenant.users` (tambah `customRoleId`)

**TENANT_ROLES:** `owner|ketua|sekretaris|bendahara|custom`

**Permission System:** `lib/permissions.ts`
- 10 modul: `website|surat|keuangan|toko|donasi|event|dokumen|anggota|media|pengurus`
- 4 level: `full|read|own|none`
- Helper utama: `getPermission()`, `canAccess()`, `hasFullAccess()`, `hasReadAccess()`, `canManageUsers()`, `getSuratScope()`

**Tiga lapisan perlindungan (semuanya aktif):**
1. **Session** — `TenantLayout` cek login + tenant access
2. **Module guard** — 10 modul (7 layout + 3 page) punya `redirect(/${slug}/dashboard)` jika tidak punya akses. Surat pakai `canAccess("surat","own")`, modul lain `hasReadAccess()`
3. **Action guard** — server actions cek permission sebelum mutation

**Sidebar filtering (aktif):** `SidebarNav` terima `tenantUser`, filter menu via `canAccess()`. Menu hanya tampil sesuai permission. Dashboard + Pengaturan selalu tampil.

**Tiga jalur aktivasi pengurus:**
- **A — Punya akun** (`members.betterAuthUserId` terisi): `addExistingAccountAction` → INSERT `tenant.users` saja. Tidak buat akun baru.
- **B — Link undangan**: `createInviteAction` → token UUID 7 hari → user set password sendiri di halaman `/invite?token=`
- **C — Aktifkan langsung**: `activateUserDirectAction` → admin set password. Safety check: jika `betterAuthUserId` sudah ada → pakai langsung, tidak buat ganda.

**Jalur ditentukan otomatis** dari `hasAccount` (dari `!!members.betterAuthUserId`). Admin tidak perlu tahu.

**`createCustomRoleAction`** mengembalikan `{ success: true, id }` — client pakai ID asli dari DB.

**`RoleDialog`** menggunakan `key={editingRole?.id ?? "new"}` — form selalu reset saat berganti role.

**Email selalu dari contacts:** tidak pernah dari input admin. Field read-only di form, server fetch ulang dari DB.

**Invite upsert:** `createInviteAction` update token + expiry jika sudah ada, bukan insert baru.

**Available members filter:** belum ada di `tenant.users` + tidak punya invite pending.

**Route `/invite`:** route group `(public)` — aksesibel tanpa auth.

### [2026-04] Modul Surat — Layout TTD + Signing via URL SELESAI

**Arsitektur lengkap di `docs/arsitektur-tandatangan.md` — semua fitur selesai.**

**Keputusan desain yang dikunci:**

#### Pemisahan assignment (edit) vs signing (detail)
Assign officer ke slot dilakukan di **edit page** (form mode), bukan di detail page.
Detail page hanya menampilkan status + tombol signing. Ini separation of concern yang jelas:
- Admin set siapa yang harus TTD → edit page
- Officer TTD via link → halaman publik `/sign/[token]`
- Admin pantau status → detail page

**Jangan balik ke pola lama** di mana detail page juga punya combobox assign.

#### `syncSignatureSlotsAction` — idempotent + token-stable reconcile
Pattern untuk sync state form → DB: bukan delete-all + insert-all, melainkan diff per slot.
- Signed slots → skip (tidak pernah diubah termasuk token)
- Slot baru (belum di DB) → INSERT + generate token baru
- Slot existing, officer **sama** → UPDATE role saja — token DIPERTAHANKAN (link yang sudah dikirim tetap berlaku)
- Slot existing, officer **berubah** → UPDATE + generate token baru (link lama tidak valid, orangnya ganti)
- Slot existing, token null (slot lama/edge case) → UPDATE + generate token baru
- Slot kosong (officerId null) → DELETE dari DB jika ada dan belum signed
- Hapus slot DB yang tidak ada di desired (dan belum signed)

**Bug yang pernah terjadi**: update branch dulu selalu panggil `token30d()` tanpa cek apakah officer berubah → link yang sudah dikirim jadi rusak setiap kali admin simpan surat.
**Fix**: fetch `officerId` + `signingToken` dari existing row, bandingkan, generate token baru hanya jika perlu.

Sama persis dengan pattern tag sync di website module. Berlaku untuk semua resource yang punya "signed/confirmed" state yang tidak boleh di-undo.

#### `userRole` di officer combobox via JOIN
Officer ↔ user role connection: `officers.memberId → public.members.id ← tenant_users.memberId`.
Tidak perlu schema change. Cukup query `tenant.users WHERE memberId IN (officerMemberIds)`.
Hasilnya dipakai sebagai `userRole` di `AvailableOfficer` → badge berwarna di combobox.

#### `SlotInput` vs `SignatureSlot` — dua representasi
- `SlotInput` — form state (minimal: id, order, section, officerId, role, signedAt?) — dikirim ke `syncSignatureSlotsAction`
- `SignatureSlot` — display state (full: nama officer, posisi, divisi, QR, verifyUrl, token) — dipakai `SignatureBlock` + `SignatureSlotManager`
- Konversi `SlotInput → SignatureSlot` via `toDisplaySlots()` di `letter-form.tsx` menggunakan `availableOfficers` lookup

#### `appUrl` optional di `SignatureSlotManager`
Di form mode, `appUrl` tidak digunakan (tidak ada copy link). Jadikan optional dengan default `""`.
Berlaku untuk props yang hanya dibutuhkan di satu mode dari komponen dual-mode.

#### Link TTD harus tampil sebagai URL penuh, bukan tombol kecil
Tombol "Salin Link" kecil tidak cukup — admin perlu melihat URL-nya agar bisa:
- Memverifikasi token sebelum dikirim
- Menyalin sebagian URL jika perlu
- Menyadari link sudah ada (tidak perlu generate ulang)

**Pattern yang benar**: text input read-only berisi URL lengkap `{APP_URL}/{slug}/sign/{token}`,
klik field → select-all otomatis, tombol copy ikon di sebelah kanan.
Berlaku untuk semua fitur link-sharing di seluruh aplikasi.

#### `generateSigningTokenAction` — token on-demand untuk slot lama
Slot yang dibuat sebelum sistem token ada (atau edge case lain) bisa punya `signingToken = null`.
Solusi: server action on-demand yang di-trigger via tombol "Buat Link TTD" di detail page.
- Idempotent: jika token sudah ada, kembalikan yang lama (tidak generate baru)
- Jika slot sudah TTD, tolak
- Token muncul di UI langsung via optimistic state update (tanpa refresh halaman)

#### Pisahkan assignment dari status signing di form mode
Form edit ("Assign Penandatangan") hanya untuk menentukan SIAPA yang akan TTD.
- Badge `✓ TTD` dan `⏳ Menunggu` TIDAK boleh tampil di form mode — hanya di detail mode
- Tombol "TTD Sekarang" di detail mode DIHAPUS — URL adalah satu-satunya cara TTD
- Alasan: tombol direct-sign membypass alur persetujuan yang diinginkan

### **[2026-04] BUG KRITIS: `signed_at DEFAULT NOW()` di DDL lama**

> **JANGAN PERNAH beri `DEFAULT NOW()` (atau default apapun) pada kolom `signed_at` / `confirmed_at` / kolom timestamp yang menandai KONFIRMASI AKTIF dari user.**

**Masalah yang terjadi**: Kolom `signed_at` di tabel `letter_signatures` tenant lama memiliki `DEFAULT now()` dari versi DDL sebelum refactor. Akibatnya setiap INSERT slot baru via `syncSignatureSlotsAction` otomatis mendapat `signed_at = NOW()` — slot langsung dianggap "sudah ditandatangani" tanpa siapapun yang benar-benar menandatangani.

**Gejala**: Admin assign officer di edit page → simpan → buka detail page → slot langsung `✓ TTD`. Link TTD tidak pernah muncul karena `isSigned = true` menyembunyikan section link.

**Diagnosa**: `signed_at = created_at` persis sama → default DB yang mengisi, bukan kode.

**Fix yang dilakukan**:
```sql
-- Hapus default dari kolom (jalankan per tenant yang terdampak)
ALTER TABLE "tenant_{slug}".letter_signatures ALTER COLUMN signed_at DROP DEFAULT;

-- Reset slot yang auto-signed (signed_at = created_at = tidak sah)
UPDATE "tenant_{slug}".letter_signatures
SET signed_at = NULL, verification_hash = NULL, ip_address = NULL
WHERE signed_at = created_at;
```

**DDL baru sudah benar** — `create-tenant-schema.ts` tidak punya `DEFAULT NOW()` di `signed_at`. Tapi **tenant yang dibuat dengan DDL lama perlu migration manual** di atas.

**Aturan berlaku untuk semua modul**: Kolom yang merepresentasikan konfirmasi eksplisit user (`signed_at`, `confirmed_at`, `approved_at`, `paid_at`, dll) **TIDAK BOLEH punya `DEFAULT`**. Kolom ini harus selalu `NULL` saat row dibuat, dan diisi secara eksplisit oleh kode saat event konfirmasi terjadi.

### [2026-04] Modul Akun Phase 1 — public.profiles Schema

**drizzle-kit generate butuh TTY interaktif**
`drizzle-kit generate` gagal di non-TTY environment karena `promptColumnsConflicts` membutuhkan input user.
Fix: tulis migration SQL manual + update `_journal.json` secara manual, lalu jalankan via `psql -f`.
Pattern ini konsisten dengan migration 0005 yang juga manual.

**drizzle-kit migrate skip migration dengan timestamp lebih kecil**
Migration 0006 tidak tereksekusi via `drizzle-kit migrate` karena timestamp journal (`when`) lebih kecil
dari timestamp migration terakhir yang sudah ada. Fix: jalankan SQL langsung via `psql -f file.sql`.
Untuk migration manual selanjutnya, set `when` > timestamp migration terakhir, atau langsung pakai `psql -f`.

**profile_id additive ke 4 tabel transaksi**
Kolom `profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL` ditambah ke:
`invoices`, `orders`, `donations`, `event_registrations` — di Drizzle schema factory + DDL `create-tenant-schema.ts`.
Tenant existing perlu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` manual per tenant.

### [2026-04] Modul Akun Phase 2 — resolveIdentity helper

**Helper `resolveIdentity` di `packages/db/src/helpers/resolve-identity.ts`**
Urutan lookup: session (betterAuthUserId) → `public.profiles` by email/phone → `public.members` via contacts (lazy-create profile) → guest.
Mengembalikan `{ profileId, memberId, resolvedName }` — ketiganya nullable.

**Lazy-create profile untuk alumni yang checkout tanpa login**
Saat alumni IKPM checkout tanpa login, HP/email ditemukan di `public.members` via contacts.
Sistem auto-create `public.profiles` dengan `memberId` dan `accountType = 'member'`.
Pattern: `INSERT ... ON CONFLICT DO NOTHING` — aman jika dipanggil concurrent.

**`checkoutAction` diupdate: profileId disimpan ke invoices**
Import lama (`members`, `contacts`, lookup manual) dihapus, diganti `resolveIdentity(db, { phone, email })`.
`profileId` dari hasil lookup langsung di-insert ke `schema.invoices`.

**Lesson: `sql` tag masih dipakai di fungsi lain — jangan hapus import sembarangan**
Setelah hapus `sql` dari import karena dikira tidak dipakai, `tsc` menemukan `sql<number>` masih ada
di `getOrCreateCart`. Selalu verifikasi dengan `tsc --noEmit` sebelum finalisasi.

### [2026-04] Modul Akun Phase 3 — API Routes

3 endpoint REST di `app/api/akun/`:

**`POST /api/akun/register`** — daftar akun baru
- Input: `{ name, email, phone, password, tenantSlug? }`
- Cek duplikat email/phone di profiles → `auth.api.signUpEmail` → insert profiles
- Return: `{ profileId, name, email, phone }` (201)

**`GET|PATCH|DELETE /api/akun/profil`** — kelola profil (session required)
- GET: kembalikan data profil lengkap + alamat
- PATCH: update name/phone/alamat (email tidak bisa diubah tanpa verifikasi)
- DELETE: soft delete `deleted_at = NOW()` + `auth.api.signOut`

**`GET /api/akun/transaksi?slug={tenant}`** — riwayat transaksi (session required)
- Filter invoice by `profile_id` di tenant yang diminta
- Pagination: `?page=1&limit=20` (max 50)

**Front-end ditunda** — akan diimplementasikan bersamaan dengan website publik.
Login tetap via Better Auth standard: `POST /api/auth/sign-in/email`.

### [2026-04] Modul Akun Phase 4 — Dashboard Admin `/akun`

**File yang dibuat/diubah:**
```
app/(dashboard)/[tenant]/akun/
├── page.tsx              → list page (diupdate: query + tombol Tambah Akun)
├── actions.ts            → tambah createProfileAction, linkProfileToMemberAction, unlinkProfileFromMemberAction
├── new/page.tsx          → form tambah akun baru (nama, email, HP)
└── [id]/
    ├── page.tsx          → detail: identitas, riwayat invoice, section link anggota
    └── link-member-client.tsx → combobox cari anggota + tombol link/unlink
```

**List page — query diperluas (dua sumber):**
- Sebelumnya: hanya profil yang punya invoice di tenant ini
- Sekarang: profil yang punya invoice DI SINI **atau** `registered_at_tenant = tenantId`
- Ini agar akun yang baru ditambah admin langsung tampil meski belum bertransaksi
- Early-return "belum ada transaksi" dihapus — list bisa kosong tapi tetap render dengan tombol Tambah

**`createProfileAction` — tambah akun dari dashboard:**
- Input: name, email, phone (semua wajib) via FormData
- Cek duplikat email + phone sebelum insert (return error eksplisit)
- Set `registeredAtTenant = access.tenant.id` agar profil muncul di list tenant ini
- Setelah berhasil: `redirect` ke halaman detail profil baru
- Tidak membuat login/password — akun tanpa login sampai user set password sendiri

**Detail page — tiga bagian utama:**
1. Identitas (nama, email, HP, tipe akun, tanggal daftar)
2. Link ke Anggota IKPM — combobox cari anggota aktif via `/api/ref/tenant-members`, link/unlink
3. Riwayat invoice di tenant ini (maks 50 terbaru) — nomor, sumber, total, status, tanggal

**`LinkMemberClient` — combobox search anggota:**
- Debounced fetch (300ms) ke `/api/ref/tenant-members?slug=&search=&status=active`
- Dropdown manual (bukan shadcn Command) — custom scroll list + search input
- Mode "link": combobox + tombol Hubungkan; mode "unlink": tombol Lepas Link + confirm()
- `router.refresh()` setelah berhasil — update UI tanpa reload penuh

### [2026-04] Arsitektur Front-end Publik — Post Section & Card System

**URL publik post: `/post` bukan `/blog`**
Route publik untuk post menggunakan `/{tenantSlug}/post/{slug}` (detail) dan `/{tenantSlug}/post` (arsip).
Semua referensi `/blog` di kode dan dokumentasi wajib diganti ke `/post`.
Filter arsip: `/{tenantSlug}/post?category={slug}` dan `/{tenantSlug}/post?tag={slug}`.

**Dua kategori design section post: `hero` vs `section`**
Registry design punya field `type: "hero" | "section"`. `hero` = tidak ada title/filter (Design 1).
`section` = wajib ada `PostsSectionTitle` + filterHref selalu terisi. Ini dikontrol di wrapper, bukan di tiap design.

**`PostsSectionTitle` — shared component wajib**
Semua design `section` type wajib pakai `PostsSectionTitle` (heading + dashed line + "Lihat Semua ›").
Design baru cukup render `<PostsSectionTitle title={sectionTitle} href={filterHref} />` — tidak perlu implement header sendiri.

**`sectionTitle` dan `filterHref` di-resolve di wrapper, bukan di design**
Props `sectionTitle` dan `filterHref` di `PostsSectionProps` sudah di-resolve sebelum masuk ke design component.
Fallback chain: `filterLabel` (nama kategori/tag dari DB) → `data.title` → `"Berita Terbaru"`.
`filterHref` dijamin selalu terisi untuk section type (fallback ke `/{tenantSlug}/post`).

**Design 4 (Trio Column) dieksekusi terakhir**
Kompleksitas section editor lebih tinggi (3 combobox independen per kolom). Eksekusi Design 2, 3, 5 dulu.

### [2026-04] Image System — Phase A+B+C SELESAI

**Arsitektur lengkap di `docs/arsitektur-image.md`.**

**Phase A — Variant System:**
- 6 variant WebP via Sharp: `original`, `large` (1200×630), `medium` (800×420), `thumbnail` (400×210), `square` (400×400), `profile` (300×400)
- `shouldBypass(mime)`: SVG selalu bypass (simpan as-is)
- Rollback MinIO jika partial upload gagal
- `ImageVariants` JSONB di DB + 4 kolom baru di `media` table
- `getImageUrl(media, tenantSlug, variant)`: fallback chain variant → large → original → path lama
- Cron `/api/cron/cleanup-images`: hapus `_ori` file setelah 10 hari

**Phase B — Metadata UI:**
- `MediaDetailPanel`: form 4 field + debounce autosave 1000ms + indicator (saving/saved/error)
- `showDescription` prop: `true` di MediaShell (ada description SEO), `false` di MediaPicker
- `key={media.id}` wajib di parent — agar state panel reset saat item berganti (tanpa ini autosave kirim data gambar lama ke gambar baru)
- MediaShell: layout 2 zona, klik = panel detail, checkbox selalu tampil = batch delete independen
- MediaPicker single mode: klik = pilih + panel kanan (w-72). Multiple mode: tetap pakai `MediaEditModal` via pensil

**Phase C — Propagasi ke Front-end:**
- `PostCardData` diperluas: `coverAlt?` + `coverTitle?` di-resolve dari `media.alt_text` + `media.title`
- `resolveCovers` fetch 4 field: `path`, `variants`, `altText`, `title`
- Fallback alt: `media.altText ?? post.title` — tidak pernah kosong
- Single post: `<figure>` + `<figcaption>` untuk `media.caption` di featured image — hanya tampil jika caption terisi

**Lessons Learned:**

#### `key={media.id}` pada komponen autosave — kritis
Komponen dengan state internal yang di-inisialisasi dari props HARUS punya `key` yang unik per data.
Tanpa `key`, React reuse komponen lama → state tidak reset → autosave kirim nilai field gambar lama ke ID gambar baru = data corruption diam-diam.
Pattern: selalu `key={item.id}` pada komponen yang punya form/input di-inisialisasi dari props item.

#### Checkbox dan klik bisa independen pada satu komponen grid
Dua interaksi yang berbeda pada satu item: klik body = buka panel detail, klik checkbox = batch select.
Implementasi: `onClick` di wrapper div = `onClickItem`, `onClick` di `<div>` checkbox = `e.stopPropagation(); onToggleCheck(id)`.
Hasilnya: satu item bisa sekaligus tampil di panel DAN tercentang untuk delete — dua state berbeda tidak saling mempengaruhi.

#### Caption sebagai `<figcaption>` bukan `<p>` biasa
`<figure>` + `<figcaption>` adalah semantik HTML yang benar untuk gambar + keterangan.
Google membaca `<figcaption>` sebagai konteks gambar untuk indexing — lebih kuat dari `<p>` biasa di bawah gambar.
Gunakan ini konsisten di semua tempat yang menampilkan caption gambar (post detail, page detail, galeri).

### [2026-04] View Counter — postgres.js `.count` bukan `.rowCount`

**Bug:** `recordView` selalu return `false` — view tidak pernah terhitung meskipun SQL berjalan normal.

**Root cause:** Project ini pakai driver **postgres.js** (package `postgres`), bukan `node-postgres` (package `pg`).
Keduanya punya hasil DML yang berbeda:
- `node-postgres` (`pg`): jumlah baris terpengaruh ada di `result.rowCount`
- `postgres.js`: jumlah baris terpengaruh ada di `result.count`

Menggunakan `result.rowCount` dengan postgres.js selalu menghasilkan `undefined` → conditional logic tidak bekerja.

**Fix:**
```typescript
// SALAH — ini node-postgres API
const counted = ((result as unknown as { rowCount: number | null }).rowCount ?? 0) > 0;

// BENAR — ini postgres.js API (yang dipakai project ini)
const counted = ((result as unknown as { count: number }).count ?? 0) > 0;
```

**Aturan:** Setiap kali perlu cek jumlah baris terpengaruh dari `db.execute()` di project ini, **selalu pakai `.count`**, bukan `.rowCount`. Berlaku untuk INSERT, UPDATE, DELETE.

**Cara debug:** Tambah `console.log(result)` sementara untuk lihat struktur result object — jangan tebak nama property-nya.

### [2026-04] INTERVAL sebagai `sql.raw()` — bukan parameterisasi biasa

Parameterisasi angka ke PostgreSQL INTERVAL via string concatenation bisa bermasalah di beberapa driver:
```typescript
// Berpotensi masalah — driver bisa menghasilkan SQL tidak valid
`< NOW() - (${String(VIEW_WINDOW_MINUTES)} || ' minutes')::INTERVAL`

// BENAR — INTERVAL konstanta via sql.raw(), aman karena nilai dari kode (bukan user input)
const interval = sql.raw(`INTERVAL '${VIEW_WINDOW_MINUTES} minutes'`);
// ...
WHERE ${sessTable}.viewed_at < NOW() - ${interval}
```

**Aturan:** `sql.raw()` boleh dipakai untuk identifier (schema/table name) DAN konstanta numerik dari kode (bukan input user). Nilai dari user tetap harus parameterized via `sql` template tag.

### [2026-05] Route Conflict: Route Group (dashboard) vs (public) dengan Path Sama

**Masalah**: Next.js error "You cannot have two parallel pages that resolve to the same path" saat dev server start.

**Root cause**: Route group `(dashboard)` dan `(public)` **tidak mengubah URL** — mereka hanya grouping di filesystem. Jika keduanya punya `[tenant]/akun/page.tsx`, keduanya resolve ke `/{tenant}/akun` → konflik.

```
app/(dashboard)/[tenant]/akun/page.tsx  → /{tenant}/akun  ← KONFLIK
app/(public)/[tenant]/akun/page.tsx     → /{tenant}/akun  ← KONFLIK
```

**Fix**: Rename salah satu agar path URL berbeda. Dashboard admin `/akun` (manajemen profil publik) dipindah ke `/accounts`:
```
app/(dashboard)/[tenant]/accounts/page.tsx → /{tenant}/accounts  ✓
app/(public)/[tenant]/akun/page.tsx        → /{tenant}/akun       ✓
```
Update juga: semua `href` dan `revalidatePath` di files dalam folder, plus entri `path` di `sidebar-nav.tsx`.

**Aturan**: Setiap kali menambah halaman baru di `(public)`, cek apakah path yang sama sudah ada di `(dashboard)` — dan sebaliknya. Gunakan nama path yang berbeda untuk halaman admin vs halaman publik yang konsepnya serupa.

### [2026-05] Better Auth v1.6.2 — `forgetPassword` tidak ada, pakai direct fetch

**Masalah**: `authClient.forgetPassword()` tidak ada → TypeScript error "Property 'forgetPassword' does not exist".

**Fix**: Gunakan direct fetch ke endpoint Better Auth yang sebenarnya:
```typescript
const res = await fetch("/api/auth/request-password-reset", {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify({ email, redirectTo: `/${slug}/reset-password` }),
});
```

**Reset password (confirm)**: `authClient.resetPassword({ newPassword, token })` — ini BENAR dan ada di client.

**Aturan**: Jika client method tidak ditemukan, cek endpoint API-nya langsung di `dist/api/index.d.mts`. Path endpoint → nama method: `/request-password-reset` → `requestPasswordReset`. Jika TypeScript tidak ekspos method-nya di client, direct fetch selalu bisa dipakai.

### [2026-05] KOREKSI ARSITEKTUR AKUN — Tiga Level Akses

**Arsitektur lama SALAH TOTAL.** Implementasi Phase 1–4 Modul Akun mencampur anggota IKPM dan publik dalam satu tabel `public.profiles` via kolom `accountType` dan `memberId`. Ini salah secara konseptual.

**Konsep yang benar (dikunci oleh owner project):**

jalakarta adalah super-app komunitas IKPM. Ada tiga level akses yang berbeda entitas:

1. **Pengurus** = anggota IKPM yang diangkat, satu-satunya yang bisa login dashboard
2. **Anggota IKPM** = alumni Gontor, login front-end saja, bisa diangkat jadi pengurus
3. **Akun Publik** = orang umum, login front-end saja, tidak bisa jadi pengurus

**Implikasi teknis yang benar:**
- `public.members` butuh kolom `better_auth_user_id` untuk front-end login anggota
- `public.profiles` HANYA untuk akun publik — hapus `member_id` dan `account_type`
- Register jalur IKPM = klaim data existing (stambuk/email/HP), **bukan** insert record baru
- Register jalur publik = insert `public.profiles` baru
- `tenant.users.member_id` TIDAK BOLEH null — pengurus wajib anggota IKPM

**Yang perlu direfactor:**
- `public.profiles` schema — hapus `member_id`, `account_type`
- `POST /api/akun/register` — pisah benar-benar dua jalur
- `resolveIdentity()` helper — cek `members.better_auth_user_id` dulu
- Semua implementasi Login Universal Phase 1–4 yang berkaitan dengan `accountType`

Detail lengkap: `docs/arsitektur-akun.md`

### [2026-05] Arsitektur Akun Universal — Refactoring Selesai

**File kunci:**
- `lib/akun-identity.ts` — `getAkunIdentity(userId)` + `isMemberDataIncomplete(identity)`
- `docs/arsitektur-akun.md` — arsitektur 3 level akses lengkap

**Perubahan schema DB:**
- `public.members` — tambah `better_auth_user_id TEXT UNIQUE REFERENCES public.user(id)`
- `public.profiles` — hapus `member_id`, `account_type`; data lama di-truncate

**Alur register:**
- Jalur IKPM → lookup stambuk/email/HP di `public.members`
  - Ketemu + belum punya akun → klaim: `UPDATE members SET better_auth_user_id`
  - Tidak ketemu → daftar baru: `INSERT contacts` + `INSERT members`
  - Ketemu + sudah punya akun → arahkan ke forgot-password
- Jalur Publik → `INSERT public.profiles`

**`lib/akun-identity.ts` — pattern universal:**
Selalu cek `members.better_auth_user_id` dulu, baru `profiles.better_auth_user_id`.
Gunakan `AkunIdentity` type di semua halaman `/akun/*` — tidak perlu tahu asalnya dari tabel mana.
Field `memberId`/`profileId` null sesuai type; UI branching hanya via `identity.type`.

**`/api/akun/transaksi` — dua filter:**
- `type === "member"` → `WHERE invoices.member_id = memberId`
- `type === "public"` → `WHERE invoices.profile_id = profileId`

**Jangan pernah** menyimpan relasi anggota IKPM di `public.profiles` (tidak ada `member_id` lagi).
**Jangan pernah** insert ke `public.members` dari front-end selain via register jalur IKPM.
**Jangan pernah** buat `better_auth_user_id` di `public.members` jika sudah ada — cek dulu sebelum register.

---

### [2026-05] Refactor: Konstanta Bulan Surat Dipusatkan

Sebelumnya konstanta nama bulan (ROMAN, ID, Hijri) dan logika format Hijri terduplikasi di 3 file:
`letter-number.ts`, `letter-merge.ts`, `letter-html.ts`.

**Fix**: ekstrak ke `lib/letter-date.ts` — satu sumber kebenaran.
- `ROMAN_MONTHS`, `ID_MONTHS`, `HIJRI_MONTHS` — array konstanta
- `formatHijri(date, hijriOffset?)` — helper shared untuk format string Hijriah

Semua file sebelumnya di-update ke import dari `letter-date.ts`. TypeScript 0 errors.

**Aturan**: Jangan pernah mendefinisikan ulang konstanta atau helper tanggal surat di file lain.
Selalu import dari `lib/letter-date.ts`.

### [2026-05] Generate PDF Surat — Fix + 4 Improvement

**Fix error 500**: tambah `try/catch` top-level di route; `orgPhone`/`orgEmail` dari JSONB settings
dipaksa ke string via helper `toStr()` (JSONB bisa mengembalikan tipe apapun, TypeScript cast tidak cukup).

**4 improvement yang dikunci:**
- QR barcode warna sesuai `primary_color` dari `settings.display` (fallback `#2563eb` jika belum disimpan)
- Tanggal TTD **tidak pernah** tampil di PDF — `showDate: false` di-enforce langsung di `buildLetterHtml`
- Jabatan penandatangan dilengkapi nama tenant: `"Ketua 1"` → `"Ketua 1 IKPM Cabang DI Yogyakarta"`
- Layout 2 identitas surat difix: tanggal sekarang **sejajar** dengan Nomor/Lampiran/Hal (flex row),
  bukan di atas tabel identitas

**Fix tambahan**: nama divisi (`/ Ketua`) dihapus dari blok TTD PDF — cukup jabatan saja (position).
`renderSlot` di `letter-signature-layout.ts` tidak lagi render `div` field sama sekali.
Border QR code di PDF dihapus (`.qr-img` tidak punya `border`) — barcode tampil bersih tanpa frame.

**Debug color**: `console.log("[generate-pdf] primaryColor: ...")` ada di route sementara untuk verifikasi.
Hapus setelah konfirmasi warna sudah benar.

**File yang diubah**: `lib/qr-code.ts`, `lib/letter-html.ts`, `lib/letter-signature-layout.ts`,
`app/api/letters/[id]/generate-pdf/route.ts`

**Aturan PDF surat**: `signatureShowDate` di DB tidak dipakai untuk PDF — tanggal TTD hanya
untuk tampilan dashboard (jika ditambah di UI nanti). Label role ("Penandatangan") dan nama divisi
tidak tampil di PDF — blok TTD hanya berisi: QR · Nama · Jabatan+NamaTenant.

### [2026-05] PDF Surat — Design Fix & Slot Order Fix

**Fix kop-garis saat ada header image:**
`<div class="kop-garis">` selalu dirender meski header image sudah punya garis sendiri → double garis
merusak desain kop surat. Fix: render `kop-garis` hanya di cabang teks (`!headerImageUrl`), hapus dari
cabang image. Aturan: elemen dekoratif conditional harus selalu dicek terhadap konten yang
menggantikannya.

**Fix duplikasi nama organisasi di blok penerima:**
`letter.recipient` (input manual) dan `mergeFields.recipient_organization` bisa berisi nama yang sama
→ blok "Kepada Yth." tampil dua baris identik. Fix: bandingkan `normOrg !== normName`
(case-insensitive) sebelum menambahkan `orgLine`. Pattern: selalu normalisasi dan dedup sebelum
render array baris teks.

**Fix nama penerima di-bold:**
Nama orang yang dituju (`lines[1]` = `recipientName`) perlu emphasis visual. Fix: `i === 1 →
<strong>`. Posisi index 1 karena lines[0] selalu "Kepada Yth.".

**Bug kritis: urutan slot TTD di PDF ditentukan oleh siapa TTD duluan, bukan layout yang dikonfigurasi**

**Masalah**: PDF layout "2 TTD Kiri & Kanan" menampilkan penandatangan terbalik — siapa yang TTD
pertama muncul di kiri, padahal admin mungkin sudah mengatur slot 1 = kiri = Ketua, slot 2 = kanan =
Sekretaris.

**Root cause berlapis:**
1. `generate-pdf/route.ts` — `rawSigs` di-fetch tanpa `ORDER BY`, lalu di-filter dan di-map tanpa
   menyertakan `slotOrder` dan `slotSection` ke dalam objek signer
2. `lib/letter-html.ts` — `signatureSlots` dibangun dengan `order: i + 1` (array index + 1) dan
   `section: "main" as const` hardcoded, mengabaikan nilai dari DB

**Fix:**
- `SignerInfo` type diperluas: tambah `slotOrder: number` dan `slotSection: "main" | "witnesses"`
- Route: sort `rawSigs` by `slotOrder` sebelum map, sertakan `slotOrder` + `slotSection` di objek signer
- `letter-html.ts`: gunakan `s.slotOrder` dan `s.slotSection` saat membangun `signatureSlots`

**Aturan**: Setiap data urutan/posisi yang dikonfigurasi admin **harus dibawa sepanjang pipeline**
dari DB → route → builder. Jangan pernah ganti dengan array index (`i + 1`) atau hardcode konstanta
untuk field yang punya nilai semantik dari DB.

**Format tanggal per jenis surat vs global — bukan bug kode:**
Jenis surat dengan `date_format = "masehi"` eksplisit (bukan null) akan selalu override setting global,
bahkan jika global diset ke `masehi_hijri`. Ini perilaku yang benar (per-jenis bisa override global).
Cara debug: query DB langsung:
```sql
SELECT name, date_format FROM "tenant_{slug}".letter_types;
SELECT value->>'date_format' FROM "tenant_{slug}".settings
  WHERE key='letter_config' AND "group"='general';
```
Jika jenis surat punya nilai eksplisit dan user ingin ikut global → ubah ke null ("Default") di
`/letters/template`, bukan di kode.

### [2026-05] Bug: Link TTD "Tidak Valid" setelah officer menandatangani

**Masalah**: Setelah officer TTD via link, jika link dibuka lagi → "Link Tidak Valid".

**Root cause**: `signByTokenAction` meng-null-kan `signingToken` setelah signing (alasan lama:
"invalidate agar tidak bisa sign ulang"). Padahal token null = row tidak bisa ditemukan by token
= "Link Tidak Valid" alih-alih "sudah ditandatangani".

**Mengapa aman mempertahankan token setelah signing:**
Double-sign sudah dicegah oleh `if (existing?.signedAt) return { error }` di `signByTokenAction` —
bukan oleh nullifikasi token. Token yang tetap ada hanya memungkinkan link menampilkan halaman
konfirmasi "sudah ditandatangani".

**Fix (✅ dieksekusi):**
1. `signByTokenAction` — hapus `signingToken: null` dari UPDATE setelah signing
2. `generateSigningTokenAction` — hapus guard `if (sig.signedAt) return error` agar admin bisa
   pulihkan link untuk slot yang tokennya sudah terlanjur di-null; token slot signed tidak punya expiry
3. `signature-slot-manager.tsx` — tombol "Pulihkan Link Konfirmasi" muncul di signed slot yang tokennya null
   + link konfirmasi (salin) tampil di signed slot yang sudah punya token

**Untuk slot lama yang tokennya sudah di-null**: admin klik "Pulihkan Link Konfirmasi" di halaman
detail surat → token baru di-generate → bagikan link baru ke officer → halaman tampil
"sudah ditandatangani" dengan benar.

### [2026-05] Halaman TTD — Auth + Identitas Wajib (✅ SELESAI)

**Sebelumnya**: `/sign/[token]` tidak punya auth — siapapun yang punya URL bisa menandatangani surat atas nama siapapun.

**Alur baru yang dikunci:**

```
Buka link /sign/{token}
  ↓
Cek session (auth.api.getSession)
  ├─ Tidak ada session → tampilkan inline login form + konteks surat (perihal/nomor/nama penandatangan)
  │    Setelah login → redirect balik ke /sign/{token}
  │
  └─ Ada session → verifikasi identitas + canSign
       ├─ officer.canSign = false → "Anda tidak memiliki otoritas menandatangi surat ini"
       ├─ members.betterAuthUserId ≠ session.user.id → "Anda tidak memiliki otoritas..."
       └─ Cocok → tampilkan SigningPageClient (form TTD / konfirmasi sudah TTD)
```

**Identity chain**: `signing_token → letter_signatures.officer_id → officers.member_id → public.members.better_auth_user_id ↔ session.user.id`

**File yang dibuat/diubah:**
- `app/(public)/[tenant]/sign/[token]/page.tsx` — rewrite penuh dengan auth flow
- `app/(public)/[tenant]/sign/[token]/sign-login-form.tsx` — komponen login kompak (tanpa full-page wrapper)
- `app/(dashboard)/app/[tenant]/letters/actions.ts` — `signByTokenAction`: tambah session check + identity check + canSign check + hapus `signingToken: null`
- `docs/arsitektur-tandatangan.md` — update keputusan "Identifikasi via link"

**Aturan yang dikunci:**
- `signByTokenAction` sekarang wajib login — double-layer security (page + action)
- Login form di sign page adalah **inline** (bukan redirect ke `/login`) — user melihat konteks surat sebelum login
- Setelah login, `router.push(redirectTo)` + `router.refresh()` — session terbaca di server component
- `canSign = true` wajib di samping identitas — officer yang tidak di-centang "Dapat Menandatangani" tidak bisa TTD meski punya akun

### [2026-05] Bug: UUID vs nanoid di createOfficerWithAccountAction

**Masalah**: "Gagal menyimpan pengurus." tanpa output di console browser setelah fix password validation.

**Root cause**: `officers.user_id` bertipe `UUID` (FK ke `tenant.users.id`), tapi kode menyimpan
`betterAuthUserId` (nanoid, format `1bbNUBnobqznt8AZX7LqiSW92l`) ke kolom tersebut.
PostgreSQL menolak: `invalid input syntax for type uuid`. Error tertangkap `catch` di server — tidak muncul di browser console.

**Perbedaan dua identifier:**
| Variable | Tipe | Sumber | Contoh |
|----------|------|--------|--------|
| `authUserId` | nanoid | `better_auth.user.id` | `1bbNUBnobqznt8AZX7LqiSW92l` |
| `tenantUserId` | UUID | `tenant.users.id` (auto-generated) | `550e8400-e29b-41d4-a716-446655440000` |

**Fix:** Pisahkan dua variabel + ambil UUID via `.returning({ id: schema.users.id })` setelah INSERT:
```typescript
// SALAH — langsung pakai nanoid di FK UUID
const userId = authUserId;   // nanoid
await tenantDb.insert(schema.officers).values({ userId });  // crash

// BENAR — ambil UUID dari .returning()
const [insertedUser] = await tenantDb.insert(schema.users).values({...})
  .returning({ id: schema.users.id });
const tenantUserId = insertedUser.id;   // UUID valid untuk FK
await tenantDb.insert(schema.officers).values({ userId: tenantUserId });
```

**Aturan**: Error di `catch` block server action **tidak tampil di browser console** — tampil di server log (PM2/terminal). Setiap "Gagal menyimpan" tanpa trace → cek log server, bukan browser devtools.

**Aturan UUID**: Kolom FK UUID **tidak pernah** diisi dengan Better Auth nanoid. Selalu ambil UUID dari `.returning({ id })` setelah INSERT ke tabel dengan `primaryKey: uuid().defaultRandom()`.

### [2026-05] Sistem Mitra — Phase 0–2 Selesai

Detail arsitektur: `docs/arsitektur-mitra.md`.

**Keputusan dikunci**: mitra hanya di cabang sendiri, `member_price ≤ price × (1 - commission_rate)`,
komisi di `/toko/pengaturan/`, produk mitra langsung aktif, transaksi via rekening tenant.

Phase 0: settings `"toko"` + `/toko/pengaturan/` + nav
Phase 1: schema mitra_applications + mitras + kolom products/order_items + admin UI
Phase 2: API `/api/mitra/*` + frontend `/akun/mitra/*`

Tenant existing migration: `docs/migration-tenant-pc-ikpm-jogjakarta.sql`

---

### [2026-05] Add-on Ongkos Kirim — Phase 2 Selesai

**File utama:**
- `apps/web/app/(public)/[tenant]/cart/actions.ts` — `checkoutAction` + tiga tipe baru: `SellerGroup`, `CheckoutShippingLine`, `CheckoutShippingData`
- `apps/web/components/billing/checkout-form.tsx` — multi-step form (3 langkah)
- `apps/web/app/(public)/[tenant]/akun/mitra/pesanan/` — halaman + client + server action
- `apps/web/app/(public)/[tenant]/invoice/[id]/page.tsx` — fetch + pass shipping lines
- `apps/web/components/billing/invoice-public-client.tsx` — render ongkir + tracking

**Keputusan desain yang dikunci:**

#### API key RajaOngkir TIDAK PERNAH ke browser
Semua request ke RajaOngkir diproxy via `/api/ongkir/*` server-side. API key diambil dari
`tenant_addon_installations.config` di DB — tidak pernah dikirim sebagai JS variable atau
response body. Ini aturan security yang tidak boleh dilanggar di semua modul ongkir.

#### SellerGroup — satu request ongkir per seller
Produk dari tenant dan setiap mitra membentuk group terpisah. Setiap group punya satu
`originCityId` → satu request `/api/ongkir/cost`. Kurir dipilih per group secara independen.
Checkout UI menampilkan accordion per group dengan radio pilihan kurir.

#### Resi input hanya aktif saat invoice paid/waiting_verification
Guard di `ResiForm` dan `pesanan-client.tsx`: tombol simpan resi hanya enable untuk invoice
yang sudah dibayar atau menunggu konfirmasi. Status "pending" → tidak boleh input resi dulu.

#### City search dropdown — blur vs click race condition
Dropdown hasil pencarian kota harus `onMouseDown={(e) => e.preventDefault()}` di setiap item.
Tanpa ini, `onBlur` pada input menjalankan `setCityOpen(false)` sebelum `onClick` terdaftar
→ klik item tidak pernah terpilih. Pattern wajib untuk semua custom dropdown dengan blur-close.

#### `flattenCourierOptions` — response RajaOngkir nested
RajaOngkir return `{code, costs: [{service, description, cost: [{value, etd}]}]}`.
Harus di-flatten ke `{courier, service, serviceDesc, etd, cost}[]` sebelum ditampilkan.
Sort by cost ascending (termurah di atas). Implementasi di `checkout-form.tsx`.

#### `shippingTotal` di invoice — hitung sebelum INSERT
`shippingTotal = shipping.lines.reduce((s, l) => s + l.cost, 0)` dihitung **sebelum** INSERT invoice
agar kolom `total = subtotal + shippingTotal` langsung benar dari awal. Tidak perlu UPDATE setelah.

---

### [2026-05] Sistem Harga Berlapis — 3 Tier

```
price        → tidak login
public_price → siapapun yang login (profiles + anggota IKPM)
member_price → anggota IKPM seluruh dunia (members.better_auth_user_id)
```

`resolvePrice(product, sessionType)` di `lib/product-card-templates.ts` — fallback chain.
Form admin: 3 field harga bebas diset. Mitra: `member_price` tunduk constraint komisi.

---

### [2026-05] Produk Variasi — V1–V6+V9

`product_type = "simple" | "variable"` — toggle di form editor.
`attribute_groups JSONB` + tabel `product_variations` (price 3 tier, stock, images, attribute_combo).
"Generate Variasi" = cartesian product, kombinasi existing dipertahankan.
ProductCard variable: `priceMin`/`priceMax` → "Mulai dari Rp X".
V7 (detail publik) + V8 (keranjang) ditunda — butuh front-end `/toko`.

---

### [2026-05] ProductCard + ProductsSection

3 card variant: `grid` | `list` | `ringkas` — semua support badge Mitra + harga 3 tier.
3 section design: Grid 4 kolom | Showcase 1+4 | Carousel horizontal.
Fetch layer: JOIN mitras, businessName cross-schema, priceMin/priceMax via aggregate.

**Container wajib semua section landing page:**
```
<section className="py-10 px-4">
  <div className="max-w-7xl mx-auto">...</div>
</section>
```
Konsisten dengan header/footer. Tidak boleh `w-full` tanpa inner container.

---

### [2026-05] Bug: images JSONB dari MediaPicker sudah URL penuh — jangan publicUrl() lagi

`images[].url` dan `images[].variants` yang disimpan ke JSONB produk oleh MediaPicker sudah
berisi **URL lengkap** (hasil `publicUrl()` di upload route). Jika dipanggil `publicUrl()` lagi
di fetch layer → double URL: `http://localhost:9000/tenant-x/http://localhost:9000/tenant-x/...`.

**Aturan**: data dari MediaPicker (`media.url`, `media.variants`) langsung pakai — tidak perlu
wrap dengan `publicUrl()`. Hanya path mentah MinIO (dari `media.path`) yang perlu di-wrap.

---

### [2026-05] slugify dari "use server" — bug berulang, CATAT

`slugify` yang di-export dari `actions.ts` (`"use server"`) → jadi server action proxy di client
→ return `Promise<string>` bukan `string` → `slug.trim()` throw TypeError, slug field tampil
`[object Promise]`.

**Fix & Aturan**: implementasi `slugify` lokal di client component. JANGAN export fungsi utilitas
apapun dari file `"use server"` untuk dipakai di client component. Export dihapus dari actions.ts.

---

### [2026-05] Billing Universal — Prinsip Dikunci

Satu infrastruktur (tabel `invoices`), dua pintu:
- **Front-end**: cart universal (produk + tiket + donasi bisa dicampur) → checkout → invoice
- **Admin**: invoice manual dari dashboard

Toko/Donasi/Event sudah terintegrasi via `createLinkedInvoice()` + `syncInvoicePayment()`.
Yang belum: item picker katalog di invoice manual admin (pilih dari produk/tiket/donasi).

Detail: `docs/arsitektur-billing.md` § Prinsip Kunci.

---

### [2026-05] Aktivasi Pengurus — Deteksi Akun Existing + Tanpa Password Baru

**Masalah**: Form aktivasi pengurus selalu minta email + password, padahal anggota yang sudah
punya akun front-end (`members.better_auth_user_id` sudah terisi) tidak perlu password baru.
Admin bingung, dan password yang diisi pun tidak akan dipakai (karena akun sudah ada di Better Auth).

**Fix**:
- `MemberOption` diperluas dengan `hasAccount: boolean` (dari `!!members.better_auth_user_id`)
- `OfficerForm`: jika `memberHasAccount=true` → tampil banner hijau, sembunyikan form email/password
- `createOfficerWithAccountAction`: lookup `better_auth_user_id` dari `public.members` dulu.
  Jika sudah ada → pakai langsung tanpa `signUpEmail`. Jika belum → buat akun baru seperti biasa.
- Validasi password hanya wajib jika `!memberHasAccount`

**Alur lengkap aktivasi pengurus:**
```
Admin pilih anggota → centang "Aktifkan Akses Dashboard"
→ members.better_auth_user_id sudah ada?
    YA → banner hijau "pakai akun yang sudah ada" → pilih role saja → simpan
    TIDAK → isi email (dari profil) + password baru + role → simpan
              → signUpEmail + UPDATE members.better_auth_user_id + INSERT tenant.users
```

**Aturan idempotency**: `UPDATE members SET better_auth_user_id WHERE ... AND better_auth_user_id IS NULL`
— tidak pernah overwrite akun yang sudah ada.

### [2026-05] Redirect Loop Login ↔ Akun — Pengurus Tanpa Front-end Profile

**Penyebab**: `createOfficerWithAccountAction` membuat Better Auth account + insert `tenant.users`,
tapi **tidak** mengisi `public.members.better_auth_user_id`. Akibatnya:

```
/{slug}/login → session ada → redirect ke /{slug}/akun
/{slug}/akun  → getAkunIdentity() null (members.better_auth_user_id = null)
              → redirect ke /{slug}/login  ← LOOP!
```

**Fix darurat yang dilakukan**:
- `/akun` page: jika identity null + session ada → redirect ke `/{slug}/dashboard` (bukan `/login`)
- `/login` page: guard `dest` agar tidak redirect ke URL yang mengandung `/login`

**Fix permanen yang belum dilakukan**:
`createOfficerWithAccountAction` di `pengurus/actions.ts` harus tambahkan:
```typescript
await db.update(members)
  .set({ betterAuthUserId: userId })
  .where(eq(members.id, data.memberId));
```
Ini harus dilakukan SEBELUM insert `tenant.users`.

**Aturan**: Setiap kali aktivasi akun pengurus (via invite atau direct), WAJIB set
`members.better_auth_user_id`. Ini bukan opsional — ini yang membuat pengurus bisa
login di front-end sebagai anggota IKPM. Tanpa ini, mereka hanya bisa akses dashboard.

### [2026-05] Halaman Publik Toko — ProductImageViewer + renderBody

**URL `/produk` bukan `/toko` untuk hindari route conflict**
`(dashboard)/[tenant]/toko` dan `(public)/[tenant]/toko` resolve ke URL yang sama → konflik.
Fix: halaman publik pakai `/produk`. Semua href di ProductCard, ProductsSection, flex-header, nav-menu diupdate.
**Aturan**: setiap tambah halaman publik yang namanya sama dengan halaman dashboard → rename salah satu.

**`ProductImageViewer` — gambar besar + thumbnail strip**
Komponen di `components/toko/public/product-image-viewer.tsx`:
- Satu gambar besar (aspect-square) + thumbnail strip horizontal di bawah (desktop)
- Panah prev/next muncul on-hover di gambar utama
- Dot indicator di mobile (thumbnail strip hidden di mobile)
- `getFullUrl()` pakai `variants["square-large"]`, `getThumbUrl()` pakai `variants.square`
- Saat variasi dipilih di `ProductDetailClient` → `displayImages` auto-switch ke gambar variasi

**Deskripsi produk adalah Tiptap JSON — wajib `renderBody()` bukan `dangerouslySetInnerHTML` langsung**
`products.description` disimpan sebagai Tiptap JSON string (sama dengan `posts.content`).
Render langsung via `dangerouslySetInnerHTML={{ __html: row.description }}` → tampil raw JSON.
Fix: `renderBody(row.description)` dari `lib/letter-render.ts` — custom renderer server-safe.
**Aturan**: semua field yang diisi via Tiptap editor (description, body, content) wajib lewat `renderBody()` sebelum ditampilkan.

---

### [2026-05] Header Front-end — Dua Dashboard Berbeda untuk Dua Entitas

**Prinsip**: Front-end publik dan dashboard admin adalah dua konteks berbeda. Header front-end
harus mencerminkan ini — bukan selalu redirect ke satu tempat.

**UserButton dropdown:**
- "Akun Saya" → `/{slug}/akun` — selalu tampil untuk semua user login (anggota/publik/pengurus)
- "Dashboard Admin" → `/{slug}/dashboard` — hanya tampil jika user punya `tenant.users` record

**`checkDashboardAccessAction(slug)`** di `app/(public)/[tenant]/actions.ts`:
- Server action ringan — cek session → cek `tenant.users` → return `boolean`
- Dipanggil di `useEffect` saat `session.user.id` berubah (bukan di server layout)
- Layout tetap ISR-safe — tidak ada DB query saat render awal

**Kenapa tidak di-pass dari layout:** Ada komentar di `HeaderProps`:
"currentUser diambil client-side agar PublicLayout tetap ISR-safe."
Keputusan ini dipertahankan — tambahan `hasDashboard` juga client-side dengan pola yang sama.

**File:** `app/(public)/[tenant]/actions.ts` — server actions untuk public layout (bukan per-route).

---

### [2026-05] Donasi = Alur Cart Universal, Qurban = Variasi Hewan

**Keputusan dikunci**: Donasi menggunakan alur cart universal identik dengan Toko.
Tidak ada alur pembayaran terpisah untuk donasi. **Tabel `donations` adalah LEGACY** — tidak dipakai lagi di alur publik baru.

```
Donasi reguler:   nominal chips → addToCartAction(itemType:"donation", itemId:campaign.id)
Qurban:           pilih hewan   → addToCartAction(itemType:"donation", itemId:qurban_animal.id, notes:"Atas nama: X")
Anonim:           notes = "Anonim" → tersimpan di invoice_items.description
```

`qurban_animals` = tabel variasi untuk campaign qurban (persis seperti `product_variations`).
Harga per orang sapi patungan = `price / split` (calculated, tidak disimpan).
Slot patungan di-assign saat admin konfirmasi pembayaran, bukan saat add-to-cart.

**`CampaignDetailClient`** — satu komponen untuk semua tipe campaign:
- `campaignType === "qurban"` → tampilkan hewan cards
- lainnya → tampilkan nominal chips + custom input
- Keduanya berakhir di `addToCartAction` yang sama

**Alur UX donasi publik — Phone First (arsitektur lengkap: `docs/arsitektur-donasi-alur.md`)**

Tiga jalur donatur:
- **Sudah login** → nama pre-filled dari session, field HP tidak tampil
- **HP dikenal** (`isKnown=true`) → nama auto-fill dari lookup, popup "ask" (sama seperti login)
- **Guest murni** (`isKnown=false`) → nama diisi sendiri, popup "guest" (tawarkan daftar akun)

Urutan form (non-login):
1. Pilih Nominal / Hewan
2. Nominal lain (custom)
3. **Nomor HP / WhatsApp** — `<PhoneInput>` standar (flag + kode negara)
4. **Nama Donatur** — hanya muncul setelah phone diisi (`showNameField = phone !== ""`)
5. Tombol submit

Phone lookup: debounce 500ms → `GET /api/akun/lookup-member?phone={E.164}` → dua sumber paralel:
- `public.contacts` → `public.members` (anggota IKPM)
- `public.profiles.phone` (akun publik)
- Members > profiles jika keduanya ditemukan
- Response: `{ found, name, type: "member" | "profile" }`

State machine popup setelah `addToCartAction` sukses:
- `isLoggedIn || isKnown` → popup **"ask"**: "Ya, lihat program lain" | "Tidak, lanjut bayar"
- `!isLoggedIn && !isKnown` → popup **"guest"**: "Daftar Akun" (→ `/register`, cart tetap via cookie) | "Lanjut Tanpa Akun"

Aturan UI yang dikunci:
- Jangan beri label `(opsional)` di field HP — kalau phone tidak diisi, nama tidak muncul, jadi secara praktis wajib
- `PhoneInput` (bukan `<input type="tel">`) wajib di form donasi publik, sesuai standar UI project
- Field nama **tidak** tampil sampai phone diisi — dipaksa isi nomor dulu

**Donor list di halaman publik — dua sumber wajib digabungkan** (bug pernah terjadi: hanya baca sumber lama → list kosong):
```typescript
// Sumber lama (data historis) — tabel donations
.from(schema.donations)
  .leftJoin(schema.payments, ... status='paid')
  .where(eq(campaignId))

// Sumber baru (alur cart) — SUMBER UTAMA
.from(schema.invoiceItems)
  .innerJoin(schema.invoices, ...)
  .where(itemType='donation' AND itemId=campaignId AND invoices.status='paid')

// Merge → sort by createdAt desc → slice(0, 100)
```
**Jangan pernah hanya query satu sumber.** Data lama ada di `donations`, data baru ada di `invoice_items`.

### [2026-05] URL Naming Pattern untuk Hindari Route Conflict

Setiap kali ada halaman publik dengan nama route yang sama dengan dashboard:
- Dashboard admin: `/{slug}/toko` → Public: `/{slug}/produk`
- Dashboard admin: `/{slug}/donasi` → Public: `/{slug}/campaign`
- `nav-menu.ts` diupdate setiap kali ada rename

**Aturan**: sebelum buat halaman publik baru, cek apakah nama folder sudah dipakai di `(dashboard)/[tenant]/`.

### [2026-05] CampaignsSection — isRecurring Belum Ada di Schema

`campaigns.is_recurring` belum ditambahkan ke DB (menunggu Phase R).
Di `campaigns-section.tsx` dan detail page: `isRecurring: false` sebagai hardcode sementara.
Saat Phase R diimplementasikan, ganti dengan kolom aktual dari DB.

### [2026-05] Data Pesantren Anggota — Redesign Konsep Total

Arsitektur lengkap: `docs/arsitektur-pesantren.md` (status: SELESAI, commit `dbc933e`).

**Konsep lama salah total**: `member_pesantren` adalah pivot ke tabel direktori `pesantren` — anggota link ke pesantren yang sudah ada. Ini salah karena tujuannya bukan riwayat "santri di pesantren mana", melainkan "pesantren yang dimiliki/dikelola anggota".

**Konsep baru**: Identik dengan `member_businesses`. Tabel baru `public.member_owned_pesantren` — standalone, tidak ada FK ke tabel direktori pesantren. Anggota input data pesantren sendiri secara langsung (self-reported).

**7 section form**: Identitas → Pimpinan → Klasifikasi (kurikulum/jenisPondok/modelPendidikan/kategoriSantri) → Statistik (santri putra+putri+total, asatidz+asatidzah+total) → Kontak → Alamat → Sosmed.

**Pola yang diikuti** (tidak perlu reinvent):
- Three-view pattern (list/detail/edit) identik dengan `/akun/usaha`
- `focusedId` state di admin wizard (sama dengan `step4-business.tsx`)
- Helper FK conditional insert di server action (sama dengan `saveMemberBusinessesAction`)
- LEFT JOIN ke ref wilayah di API GET (sama dengan `member-business`)

**Aturan baru yang dikunci**:
- `member_owned_pesantren.hp_pimpinan` = nomor HP pimpinan di-`normalizePhone()`, bukan FK ke contacts
- Auto-total santri/asatidz = kalkulasi client saja, tidak disimpan ke DB
- `media.uploaded_by` FK ke `tenant.users` — tidak berlaku untuk file yang diupload anggota front-end (beda entitas, beda tabel). Ini jadi input untuk arsitektur Member Media Library.

### [2026-05] Member Media Library — SELESAI (Phase 1–4)

Arsitektur + implementasi lengkap: `docs/arsitektur-medialibrary.md`

**Keputusan yang dikunci:**
- Bucket sama `tenant-{slug}`, path prefix `akun/{memberId}/{year}/{month}/`
- Kolom baru `member_id TEXT` di `tenant.media` (bukan FK, karena cross-schema ke `public.members`)
- Modul baru `'akun'` di CHECK constraint media.module
- Kolom `cover_url TEXT` di `member_businesses` + `member_owned_pesantren` (URL langsung, bukan FK)
- `MODULE_VARIANTS['akun']` = `[original, large, square, profile]` di `image-processor.ts`
- `MemberMediaPicker` + `CoverImageField` di `components/media/member-media-picker.tsx`
- Halaman `/akun/media`: browse + upload + hapus per file

**File yang dibuat/diubah:**
- `packages/db/src/schema/tenant/website.ts` — `memberId` kolom + MEDIA_MODULES update
- `packages/db/src/helpers/create-tenant-schema.ts` — DDL update
- `packages/db/migrations/0009_member_cover_url.sql` — migration public schema
- `docs/migration-member-media.sql` — migration tenant + public schema
- `apps/web/app/api/akun/media/upload/route.ts` — POST upload
- `apps/web/app/api/akun/media/route.ts` — GET list
- `apps/web/app/api/akun/media/[id]/route.ts` — DELETE dengan guard
- `apps/web/components/media/member-media-picker.tsx` — picker + CoverImageField
- `apps/web/app/(public)/[tenant]/akun/media/page.tsx` — halaman browse
- Form usaha + pesantren diupdate dengan CoverImageField

---

### [2026-05] Bug: Browser Ter-Cache Redirect 301 ke `/app/api/*`

**Gejala**: MediaPicker di `/app/{slug}/letters/pengaturan` gagal load + upload gambar.
Browser DevTools menunjukkan request ke `/app/api/media/list` (404) dan `/app/api/media/upload` (500),
padahal kode menggunakan URL `/api/media/list` dan `/api/media/upload` (tanpa prefix `/app/`).

**Root cause berlapis:**
1. Pada suatu titik di history, `next.config.ts` punya bug sementara sehingga path `/api/media/*`
   dikenali sebagai `/:slug/media/*` dan di-redirect 301 ke `/app/:slug/media/*`.
   Browser men-cache redirect 301 ini secara permanen.
2. Meski kode sudah difix, browser tetap hit `/app/api/media/list` → Next.js routing mencocokkan
   `(dashboard)/app/[tenant]/media` dimana `[tenant]="api"` → 404 atau 500.
3. `media-picker.tsx` error handler memanggil `res.json()` pada response plain-text 500
   → `SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON`

**Fix:**
- `next.config.ts` — tambah `beforeFiles` rewrite: `/app/api/:path*` → `/api/:path*`
  (`beforeFiles` wajib, bukan `afterFiles` — karena Next.js sudah menemukan route cocok di
  `(dashboard)/app/[tenant]/...` sebelum `afterFiles` dijalankan)
- `media-picker.tsx` — wrap `res.json()` dengan try/catch untuk handle non-JSON response

```typescript
// next.config.ts
async rewrites() {
  return {
    beforeFiles: [{ source: "/app/api/:path*", destination: "/api/:path*" }],
    afterFiles:  [],
    fallback:    [],
  };
},
```

**Pelajaran:**
- `permanent: true` (301) → browser cache selamanya sampai ada redirect balikan atau clear cache
- Selalu pakai `beforeFiles` untuk rewrite yang perlu jalan sebelum route matching
- Upload error handler **wajib** handle non-JSON response (server 500 kadang return plain text)

---

### [2026-05] Module `letters` — Image Processor Wajib Original Size

**Aturan yang dikunci**: Gambar yang diupload untuk kop surat (header/footer surat) **TIDAK BOLEH**
di-resize atau di-crop sama sekali. Hanya dikonvert ke WebP.

**Alasan**: Kop surat organisasi punya aspek rasio yang sangat bervariasi (lebar penuh landscape,
portrait, persegi) — tidak ada satu pun preset variant yang cocok untuk semua. Resize otomatis
akan merusak proporsi dan kualitas visual kop surat.

**Implementasi** di `lib/image-processor.ts`:
```typescript
const MODULE_VARIANTS = {
  letters: ["original"],  // HANYA convert ke WebP, dimensi asli dipertahankan
  // ...
};
```

Variant `original` builder: `sharp(inputBuffer).webp({ quality: 85 }).toBuffer()` — tanpa
`.resize()`, tanpa `.extract()`.

**Render di PDF** (`lib/letter-html.ts`): gambar di-render dengan `width: 100%; object-fit: contain`
— melebar penuh sesuai kertas, aspek rasio terjaga, tidak ada bagian yang terpotong.

**Aturan berlaku untuk semua module**: Setiap kali tambah module baru ke `MODULE_VARIANTS`,
pertimbangkan apakah gambar perlu dipertahankan dimensi aslinya (dokumen, kop surat, logo)
atau boleh di-crop (foto profil, thumbnail konten).

---

### [2026-05] Migration `member_id` — Wajib Dijalankan Sebelum Deploy

`docs/migration-member-media.sql` menambah kolom `member_id` ke tabel `tenant.media` dan
update CHECK constraint `module` untuk include `'akun'`. Jika migration belum dijalankan
tapi kode sudah di-deploy (Drizzle schema sudah include kolom baru), semua query ke
`tenant.media` akan error "column member_id does not exist" → uncaught exception → 500 plain-text.

**Pattern**: Setiap kali kolom baru ditambah ke Drizzle schema dan ada di SELECT (`.select()` tanpa
kolom spesifik → auto-select semua kolom), pastikan migration sudah dijalankan di production
SEBELUM deploy kode. Urutan yang benar: **migrate DB → deploy code**, bukan sebaliknya.

### [2026-06] OTP via WhatsApp — Better Auth Token Injection Trick

**Masalah**: Untuk reset password via WA, kita perlu set password baru tanpa sesi aktif.
Better Auth tidak expose `setPassword` tanpa session. Satu-satunya cara adalah via token reset.

**Solusi**: Inject langsung ke tabel `public.verification` yang dikelola Better Auth:
```typescript
await db.insert(verification).values({
  id:         crypto.randomUUID(),
  identifier: `reset-password:${resetToken}`,  // format yang dibaca Better Auth
  value:      betterAuthUserId,
  expiresAt:  new Date(Date.now() + 15 * 60 * 1000),
});
// → redirect ke /{slug}/reset-password?token={resetToken}
// → authClient.resetPassword({ newPassword, token }) bekerja normal
```

**Kenapa aman**: Token dari `crypto.getRandomValues` (CSPRNG), TTL 15 menit, user di-lookup
di server dari nomor HP (bukan dari input user), dan sudah melewati OTP verification sebelum inject.

**Berlaku kapan saja**: Pola ini bisa dipakai untuk flow apapun yang butuh "set password tanpa login"
— misal via email magic link kustom, SMS OTP, atau provider SSO yang tidak support password reset.

### [2026-06] OTP tanpa Redis — PostgreSQL sudah cukup

Jangan reflex pakai Redis untuk OTP hanya karena "OTP = TTL = Redis". PostgreSQL sudah cukup:
- TTL via kolom `expires_at` + filter `WHERE expires_at > NOW()` di query
- Sekali pakai via kolom `used_at` (NULL = belum, non-NULL = sudah)
- Rate limit via `COUNT WHERE created_at > NOW() - 1 hour` — satu query, cukup cepat

Redis hanya diperlukan jika OTP di-generate jutaan kali per hari (high-traffic). Untuk jalakarta,
overhead PostgreSQL di sini tidak terasa. Jangan over-engineer sebelum ada masalah nyata.

### [2026-06] OTP step inline — jangan buat halaman baru

OTP step register ada di dalam `register-form.tsx` (state machine: `path → form → verify_otp`),
bukan halaman terpisah `/{slug}/register/verify`. Keuntungan:
- Data form (nama, email, HP, password) tetap di memori — tidak perlu kirim ulang / session storage
- Tidak ada URL baru yang perlu di-handle di middleware / redirect logic
- UX lebih mulus: user tidak keluar dari konteks form

Pattern ini berlaku untuk semua multi-step flow yang tidak butuh bookmark URL per step.

### [2026-07] `window.location.href` wajib setelah login — bukan `router.push`

**Masalah**: Login via email/password (dan awalnya WA OTP) menggunakan `router.push(dest)`.
Next.js App Router dapat pakai server component cache lama yang belum ada sesi → layout
memanggil `getAkunIdentity()` → null → redirect ke login lagi → loop.

**Fix**: Ganti ke `window.location.href = dest` untuk semua alur login.
Full page reload memastikan browser kirim cookie baru ke server dari awal, tidak ada stale cache.

**Aturan**: Setiap kali melakukan login (buat sesi baru), gunakan `window.location.href`, bukan:
- `router.push()` — bisa pakai cache lama
- `router.refresh()` — me-render ulang halaman saat ini (bukan tujuan), bisa bikin loop

Berlaku di: `login-form.tsx` tab email, `login-form.tsx` tab WA OTP, semua komponen login baru.

### [2026-07] `akun/layout.tsx` — pattern redirect saat identity null

**Masalah**: `if (!identity) redirect('/app/${slug}/dashboard')` langsung tanpa cek menyebabkan
loop untuk pengurus yang tidak punya `members.betterAuthUserId`:
```
/akun → identity null → /app/{slug}/dashboard
→ admin layout: user bukan pengurus → /app/login
→ middleware: punya session → /dashboard-redirect
→ getFirstTenantForUser() null → /register?error=no-tenant
```

**Fix**: Cek `tenant.users` dulu sebelum memutuskan redirect:
```typescript
if (!identity) {
  const { db: tenantDb, schema } = createTenantDb(slug);
  const [tenantUser] = await tenantDb.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.betterAuthUserId, session.user.id)).limit(1);
  redirect(tenantUser ? `/app/${slug}/dashboard` : `/${slug}/login`);
}
```

**Dua kasus yang berbeda**:
- Ada di `tenant.users` → pengurus → ke admin dashboard (benar)
- Tidak ada di mana-mana → user tidak dikenal → ke login (tidak loop)

**Pengurus lama tanpa `members.betterAuthUserId`**: Fix di `createOfficerWithAccountAction`
sudah memastikan pengurus BARU punya link. Untuk pengurus lama, backfill manual:
```sql
UPDATE public.members m
SET better_auth_user_id = tu.better_auth_user_id
FROM "tenant_{slug}".users tu
WHERE tu.member_id = m.id AND m.better_auth_user_id IS NULL;
```

### [2026-07] Loop /akun ↔ /login — jangan redirect ke halaman yang redirect balik

**Pola loop yang terbentuk:**
```
/akun (layout: identity null) → /{slug}/login
/{slug}/login (session ada, tidak ada dest) → /{slug}/akun
LOOP
```

**Root cause**: `login/page.tsx` mengasumsikan "session ada = punya identity". Tapi ada kondisi
di mana user punya Better Auth account yang tidak terhubung ke `public.members` maupun
`public.profiles` (misalnya data anggota diinput admin manual sebelum user register sendiri).
`getAkunIdentity()` return null → routing rusak.

**Fix**: Buat halaman error di LUAR route `/akun/*` — misalnya `/{slug}/akun-error`.
- Di luar route → tidak kena `akun/layout.tsx` check → tidak ada loop
- Halaman ini tampilkan pesan + tombol sign-out → user bisa keluar lalu register ulang
- `akun/layout.tsx` dan `akun/page.tsx` redirect ke sini kalau identity null + bukan pengurus

**Aturan umum**: Jika halaman A redirect ke halaman B, dan B bisa redirect balik ke A → LOOP.
Sebelum set redirect target, trace: apakah target bisa mengembalikan ke sini? Kalau iya, cari
target yang tidak punya redirect balik, atau buat halaman dead-end khusus (seperti `akun-error`).

**Penyebab data**: `members.better_auth_user_id` null terjadi kalau:
1. Admin input data anggota via dashboard (tidak buat akun) → user belum pernah register
2. Register flow ada bug yang skip `UPDATE members SET better_auth_user_id`
Fix data: `docs/fix-akun-tidak-terhubung.sql` — diagnosa + backfill otomatis (via email match
atau via tenant.users) + instruksi manual untuk yang tidak bisa dibackfill otomatis.

### [2026-07] Cookie signing WA OTP login — JANGAN `encodeURIComponent` saat pakai `response.cookies.set`

`app/api/akun/login-via-otp/route.ts` membuat cookie sesi manual. Format `signCookieValue`
adalah `"${token}.${btoa(HMAC-SHA256(secret, token))}"` — **TANPA** `encodeURIComponent`.

```typescript
// BENAR — tanpa encodeURIComponent, karena response.cookies.set() sudah encode otomatis
return `${value}.${signature}`;
```

**Mengapa berbeda dengan better-call source:**
- `better-call/dist/crypto.mjs` `signCookieValue` memang pakai `encodeURIComponent`
- Tapi better-call pakai `_serialize()` untuk menulis Set-Cookie header SECARA LANGSUNG (raw)
- `response.cookies.set(name, value)` di Next.js / @edge-runtime/cookies SELALU panggil
  `encodeURIComponent(value)` sebelum menulis Set-Cookie header (lihat `stringify` di `@edge-runtime/cookies`)
- Jika kita sudah `encodeURIComponent` lalu diserahkan ke `response.cookies.set` → DOUBLE ENCODE
- Double encode: `+` → `%2B` → `%252B` → signature jadi 47+ chars (bukan 44) → `verifySignature` return null

**Aturan**: Jika menulis cookie via `response.cookies.set()` atau `NextResponse.cookies.set()`,
JANGAN pre-encode nilai. Jika menulis via raw `headers.append("set-cookie", ...)`, barulah
pakai `encodeURIComponent` seperti yang dilakukan better-call.

### [2026-07] Bug: Register flow tidak atomic — orphan Better Auth account

**Masalah**: `POST /api/akun/register` memanggil `auth.api.signUpEmail()` dulu, kemudian
`db.insert(profiles)` / `db.update(members)` / `db.insert(contacts)`. Jika operasi DB gagal
setelah `signUpEmail` berhasil → akun terbentuk di `public."user"` (Better Auth) tapi tidak
ada di `public.members` atau `public.profiles`.

**Gejala**: User bisa login (Better Auth account valid), tapi `getAkunIdentity()` return null
→ redirect loop ke `/akun-error`. User bingung karena bisa login tapi tidak bisa kemana-mana.

**Fix** — `cleanupAuthUser()` helper di register route:
```typescript
// Hapus Better Auth account jika app-level insert/update gagal
async function cleanupAuthUser(authUserId: string): Promise<void> {
  await db.delete(authUser)
    .where(eq(authUser.id, authUserId))
    .catch(e => console.error("[register] Gagal cleanup Better Auth user:", e));
}
```

Pattern yang benar di **semua tiga jalur** (klaim, member baru, publik):
```typescript
const signUpResult = await auth.api.signUpEmail({ ... });
try {
  await db.insert(profiles).values({ betterAuthUserId: signUpResult.user.id, ... });
} catch (err) {
  await cleanupAuthUser(signUpResult.user.id);  // rollback Better Auth
  throw err;
}
```

**Aturan**: Setiap operasi yang melibatkan `signUpEmail` WAJIB wrap app-level DB operation
dengan try/catch + `cleanupAuthUser()`. Tanpa ini → orphan account yang tidak bisa akses
app tapi slot email-nya "tersita" di Better Auth.

**Diagnosa orphan yang sudah ada**: `docs/fix-akun-tidak-terhubung.sql`
- Step 1: Identifikasi orphan accounts
- Step 2: Backfill via email (via `contacts`, bukan langsung `m.email` — members tidak punya kolom email)
- Step 3: Backfill via tenant.users
- Step 4: Cleanup orphan yang tidak bisa di-backfill (DELETE dari `public."user"`)

---

### [2026-07] TENANT_SLUG Regex — `$` vs `(?:/|$)` di Path Context

**Bug**: `platform.jalakarta.com/platform/login` redirect ke `/app/login?redirect=/app/platform/dashboard`.

**Root cause**: `next.config.ts` punya `TENANT_SLUG = "(?!platform$)..."`. Regex ini diapply oleh
path-to-regexp ke **string path penuh**, bukan per segmen. Saat path adalah `/platform/dashboard`,
path-to-regexp menguji string `"platform/dashboard"` (setelah strip slash pertama). Pattern
`platform$` tidak cocok karena ada `"/dashboard"` setelahnya → negative lookahead BERHASIL (salah)
→ "platform" dianggap slug valid → `ADMIN_MODULES` redirect `"dashboard"` ke `/app/platform/dashboard`.

**Fix**: Ganti `$` dengan `(?:/|$)` di semua term lookahead:
```typescript
// LAMA — $ tidak match di tengah string saat ada path setelahnya
const TENANT_SLUG = "(?!api$|app$|platform$|...)..."

// BARU — (?:/|$) match di boundary segmen atau akhir string
const TENANT_SLUG = "(?!(?:api|app|platform|_next|register|dashboard-redirect)(?:/|$))[a-z][a-z0-9-]+";
```

**Aturan**: Setiap kali pakai `$` di lookahead yang dimaksudkan untuk mengecualikan satu *segmen*
dari path multi-level, ganti dengan `(?:/|$)`. `$` hanya cocok di akhir string total, bukan
akhir segmen.

### [2026-07] `window.location.href` Wajib setelah Login di Aplikasi Multi-Domain

**Bug**: Setelah login platform admin, `router.push("/platform/dashboard")` men-trigger
next.config.ts `redirects()` yang mencocokkan `/platform/dashboard` dan men-redirect ke
`/app/platform/dashboard` (sebelum regex fix di atas).

**Lebih dalam**: Bahkan setelah regex fix, `router.push()` di Next.js App Router menggunakan client-side
navigation yang tidak selalu mengeksekusi ulang `next.config.ts` redirects dengan benar karena
Server Router Handler bisa pakai cached response. `window.location.href` memaksa fresh request
ke server → server `redirects()` dieksekusi dari awal.

**Aturan umum**: Setiap kali setelah operasi yang membuat atau menghancurkan sesi (login, logout),
gunakan `window.location.href = dest` bukan `router.push(dest)`. Ini berlaku di semua auth flows:
- Platform admin login
- Tenant admin login
- Front-end publik login (sudah benar via pattern ini)
- Semua logout

### [2026-07] Platform Admin — Chicken-and-Egg: Tenant Tanpa Owner

**Masalah**: Platform admin buat tenant baru → tidak ada siapapun yang bisa login ke dashboard tenant.
`createTenantAction` hanya buat schema + insert `public.tenants`, tidak buat user.
Untuk masuk ke dashboard tenant (`/app/{slug}/dashboard`), butuh record di `tenant.users`. Tapi
untuk membuat record di `tenant.users`, harus masuk ke dashboard dulu. LOOP.

**Fix**: Tambah `createFirstOwnerAction` di `platform/actions.ts` — berjalan **dari konteks platform admin**
(bukan tenant admin), langsung insert ke 3 tabel sekaligus:
1. `auth.api.signUpEmail` → `public.user` (Better Auth)
2. `db.insert(members)` → `public.members`
3. `tenantDb.insert(schema.users)` → `tenant_{slug}.users` (role=owner)

**Pattern atomic dengan rollback**: Jika step 2 atau 3 gagal → `db.delete(authUser)` agar tidak
ada orphan account (user bisa login tapi tidak bisa akses apa-apa).

**UI**: Banner kuning "Belum Ada Pengurus" muncul di `/platform/tenants/[slug]` saat `tenant.users`
kosong. Berubah hijau setelah owner berhasil dibuat + tampilkan instruksi login.

**Aturan untuk modul baru yang butuh "initial setup"**: Jangan serahkan setup owner ke tenant
itu sendiri — ini chicken-and-egg. Platform admin yang buat tenant harus bisa langsung setup
admin pertama dari konteks platform. Pattern ini berlaku untuk semua resource yang punya
"pertama kali butuh yang sudah ada dulu".

### [2026-07] Login di Custom Domain — Better Auth CSRF + Hardcoded Slug Links

**Gejala**: Login berhasil di `jalakarta.com/visikita/akun` dan di `ikpmjogja.com`, tapi
GAGAL di `visikita.com`. UI menampilkan "Email atau password salah" padahal credentials benar.

**Root cause 1 (utama): Better Auth CSRF check menolak request dari custom domain**

`authClient` (tanpa `baseURL`) mengirim POST ke `visikita.com/api/auth/sign-in/email` dengan
`Origin: https://visikita.com`. Better Auth cek origin ini terhadap:
1. Origin dari `baseURL` (`https://jalakarta.com`) → tidak cocok
2. `BETTER_AUTH_TRUSTED_ORIGINS` env var → tidak cocok jika `visikita.com` belum didaftarkan

Hasilnya: Better Auth reject dengan CSRF error. Error message di client menjadi "Email atau
password salah" karena `authClient.signIn.email()` hanya return `res.error` tanpa detail.

**Fix (scalable, tidak perlu restart per domain baru)**:
Modifikasi `app/api/auth/[...all]/route.ts` — intercept POST, cek apakah Origin adalah
custom domain aktif di DB, jika ya spoof Origin ke `BETTER_AUTH_URL` sebelum forward ke handler.
Cookie tetap diset untuk domain asli karena Better Auth pakai `Host` header (bukan Origin)
untuk menentukan cookie domain. Commit `b1f017b`.

```typescript
// Spoof origin agar lolos CSRF check — Host header tidak diubah
modifiedHeaders.set("origin", process.env.BETTER_AUTH_URL ?? "https://jalakarta.com");
modifiedHeaders.set("referer", `${process.env.BETTER_AUTH_URL ?? ""}/`);
const modifiedReq = new Request(req.url, { method, headers: modifiedHeaders, body, duplex: "half" });
return handler.POST(modifiedReq as NextRequest);
```

**Root cause 2 (minor): link di `login-form.tsx` hardcode `/${slug}/`**

`href={`/${slug}/forgot-password`}` dan `href={`/${slug}/register`}` di custom domain jadi:
`visikita.com/visikita/forgot-password` (URL salah). Juga `dest = `/${slug}/akun`` → extra redirect.

**Fix**: Tambah prop `baseUrl` ke `LoginForm`. Dihitung di server (page.tsx) via `isOwnHost(host)`:
- Jalakarta.com: `baseUrl = "/${slug}"`, link = `/${slug}/forgot-password` ✓
- Custom domain: `baseUrl = ""`, link = `/forgot-password` ✓

**Aturan yang dikunci:**
- Setiap domain baru yang ditambahkan ke sistem TIDAK perlu update env var atau restart PM2 —
  cukup status `custom_domain_status = 'active'` di DB, handler akan langsung mengizinkan loginnya.
- Jangan pernah hardcode `/${slug}/` di komponen publik yang mungkin dirender dari custom domain.
  Selalu hitung `baseUrl` dari `isOwnHost(host)` di server component, lalu teruskan sebagai prop.
- Cookie custom domain diset oleh Better Auth berdasarkan `Host` header, bukan `Origin` header —
  spoofing Origin aman dan tidak mempengaruhi cookie domain.

**Kenapa `ikpmjogja.com` bisa tapi `visikita.com` tidak:**
`BETTER_AUTH_TRUSTED_ORIGINS` di VPS sudah include `ikpmjogja.com` (ditambahkan manual sebelumnya).
`visikita.com` adalah domain baru yang belum didaftarkan. Dengan fix dinamis, kedua domain
sekarang berjalan tanpa perlu tambah env var.

### [2026-07] Custom Domain Harus Diisolasi — Middleware Jangan Loloskan `/app/*`

**Bug kritis**: `visikita.com/app/pc-ikpm-jogjakarta/dashboard` bisa dibuka — dashboard
admin tenant lain terbuka dari custom domain orang lain.

**Root cause**: `middleware.ts` kondisi lama:
```typescript
// SALAH — /app/* dikecualikan dari pemeriksaan custom domain
if (!isOwnHost(host) && !pathname.startsWith("/api/") && !pathname.startsWith("/app/")) {
  // custom domain routing
}
// → /app/* lolos ke admin auth guard → session ada → MASUK
```

**Fix**: Pisahkan penanganan `/app/*` dan `/platform/*` di custom domain — langsung redirect ke
URL kanonik `jalakarta.com`:
```typescript
if (!isOwnHost(host)) {
  // Admin/platform paths di custom domain → redirect ke jalakarta.com
  if (pathname.startsWith("/app/") || pathname.startsWith("/platform/")) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, appUrl).toString(), 302);
  }
  // API paths → pass through
  if (pathname.startsWith("/api/")) return NextResponse.next();
  // Public content → resolve domain + rewrite
  // ...
}
```

**Aturan yang dikunci:**
- Custom domain **hanya boleh** melayani konten publik tenant mereka sendiri (`/{slug}/*`)
- Path `/app/*` (admin dashboard) dan `/platform/*` di custom domain SELALU di-redirect ke `jalakarta.com`
- Ini bukan hanya masalah UI — membiarkan custom domain akses `/app/*` adalah security hole: sesi cookie dari custom domain diakui oleh middleware, membuka dashboard tenant manapun

**Efek domino — semua link `/app/` di area publik wajib pakai URL absolut:**
Karena middleware kini redirect `/app/*` di custom domain, link relatif seperti
`href="/app/${slug}/dashboard"` akan menyebabkan redirect loop di custom domain.
Setiap link atau `redirect()` ke path admin WAJIB pakai URL absolut:

```typescript
// SALAH — relatif, jadi visikita.com/app/pc-ikpm-jogjakarta/dashboard
href={`/app/${tenantSlug}/dashboard`}
redirect(`/app/${slug}/dashboard`)

// BENAR — absolut, selalu ke jalakarta.com
href={`${process.env.NEXT_PUBLIC_APP_URL}/app/${tenantSlug}/dashboard`}
redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app/${slug}/dashboard`)
```

**6 file yang difix (commit `7718a36`):**
- `middleware.ts` — root fix: redirect `/app/*` dan `/platform/*` di custom domain
- `flex-header.tsx` — Dashboard Admin link → URL absolut
- `akun/layout.tsx` — redirect pengurus → URL absolut
- `akun/event/page.tsx` — redirect → URL absolut
- `invite/page.tsx` — 2 link "Buka Dashboard" → URL absolut
- `invite-accept-client.tsx` — `router.push` → `window.location.href = appUrl/app/...`

**Pattern grep untuk audit mendatang:**
```bash
grep -rn '`/app/' apps/web/app/\(public\)/ apps/web/components/website/public/
# harus return 0 baris
```

### [2026-07-12] Bug Kode Unik + Peserta Event Hilang — Root Cause Sama

> Detail lengkap + kode: **`docs/arsitektur-kode-unik.md` § 12 Lessons Learned**

**Dua gejala yang dilaporkan user ternyata satu akar masalah:**
1. Nama peserta yang daftar event via cart tidak masuk ke `event_registrations`
2. Invoice nyangkut status "partial" meski customer sudah transfer sesuai nominal yang ditampilkan

**Root cause**: `submitPaymentProofAction` (customer upload bukti transfer di
halaman invoice publik) menghitung ulang `remaining` SENDIRI secara independen
dari tampilan (yang sudah benar) — dan lupa menambahkan `uniqueCode`:
`remaining = total - paidAmount` (SALAH) alih-alih `remaining = (total +
uniqueCode) - paidAmount` (BENAR). Payment yang tercatat selalu kurang persis
sejumlah kode unik → invoice tidak pernah capai status "paid" → blok auto-create
`event_registrations` dari tiket cart (yang di-gate `if (newStatus === "paid")`)
tidak pernah jalan → nama peserta hilang.

**Bug turunan yang juga ditemukan & difix sekaligus:**
- Loop auto-create tiket jalan tanpa guard `sourceType` → invoice dari alur lama
  (`registerForEventAction`) bisa dapat entri `event_registrations` DUPLIKAT
  dengan nama = nama tiket (bukan nama peserta asli)
- `confirmInvoicePaymentAction` tidak update status `event_registrations` untuk
  alur lama (blok ini cuma ada di `verifySubmittedPaymentAction`) — disamakan
- Race condition klik ganda "Konfirmasi Pembayaran" → 2 payment untuk 1
  pembayaran nyata (invoice `620-INV-202607-00014` tenant visikita kena ini) —
  fix: `SELECT ... FOR UPDATE` lock invoice row di dalam transaction

**Aturan yang dikunci**: setiap tempat yang MENGHITUNG ULANG `remaining`/
`amountDue` invoice (bukan cuma menampilkan) wajib pakai `total + uniqueCode`,
tidak pernah `total` saja. Ada 3 titik yang harus konsisten:
`confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`,
`submitPaymentProofAction`.

**Bug UI terpisah yang ditemukan+difix di sesi yang sama**: item invoice
bertipe tiket (data peserta cart tersimpan sebagai JSON di kolom
`description`) tampil sebagai JSON mentah di halaman invoice admin dan publik
— bukan nama/HP/email yang terbaca. Fix: `parseTicketAttendee()` +
`humanizeFieldKey()` + `formatFieldValue()` di `lib/event-custom-form.ts`,
dipakai bersama oleh `invoice-detail-client.tsx` (admin) dan
`invoice-public-client.tsx` (publik).

### [2026-07-12] Bug SEO: Meta Description Halaman Event Bocorin JSON Mentah

Pattern yang sama dengan bug `renderBody` sebelumnya (lihat lesson
`[2026-04] renderBody — prosemirror-model tidak server-safe`), tapi kali ini
di SEO bukan di render konten: `generateMetadata` halaman event publik
(`/agenda/{slug}`) melakukan `event.description.slice(0, 160)` langsung ke
kolom `description` yang isinya Tiptap JSON — meta description dan
`og:description` jadi `{"type":"doc","content":[...]}` mentah, bukan teks.

**Ditemukan juga**: field SEO khusus yang sudah ada di schema
(`metaTitle`, `metaDesc`, `ogTitle`, `ogDescription`) sama sekali tidak
dipakai di `generateMetadata` event — padahal semua halaman single lain
(post, produk, campaign, page, pesantren, usaha) sudah benar pakai field ini.
Cover event juga tidak pernah dipakai untuk `og:image` (selalu fallback ke
logo tenant).

**Fix**: `tiptapToPlainText()` baru di `lib/seo.ts` — ekstrak plain text dari
Tiptap JSON secara rekursif, dipakai sebagai fallback description hanya kalau
`metaDesc` kosong. `generateMetadata` event sekarang pakai
`metaTitle`/`metaDesc`/`ogTitle`/`ogDescription` + cover event untuk
`og:image`, `ogType: "article"`.

**Aturan**: field konten yang diisi via Tiptap editor (content/description/body)
JANGAN PERNAH di-`slice()` langsung untuk keperluan apapun di luar Tiptap
renderer (`renderBody`) — baik untuk SEO, notifikasi, atau preview. Selalu
ekstrak plain text dulu, atau pakai field `metaDesc`/`excerpt` khusus yang
memang plain text.

### [2026-07-12] Tab Peserta Event Publik — Tabel Responsif No/Nama/Provinsi

Tab "Peserta" di halaman event publik (`EventDetailTabs`, § fitur
`showAttendeeList`) sebelumnya cuma daftar nama 2 kolom tanpa info tambahan.
Diubah jadi tabel dengan kolom No/Nama/Provinsi (desktop) + card list
(mobile) — pattern responsif yang sama dengan `AnggotaDirectoryClient`
(`hidden md:block` untuk tabel, `md:hidden` untuk card).

Provinsi di-resolve dari `eventRegistrations.memberId → members.homeAddressId
→ addresses.provinceId → refProvinces.name` — pattern query yang sama persis
dengan yang sudah dipakai di tab Statistik (breakdown domisili). Peserta tanpa
`memberId` (akun publik/guest) tampil provinsi "—".

### [2026-07-12] Label Organisasi Dinamis di Halaman Register per Tipe Tenant

Halaman `/{slug}/register` hardcode "Anggota IKPM Gontor" di semua tenant,
padahal ada 3 tipe tenant (cabang/marhalah/forum — lihat § Arsitektur Backbone
IKPM) dengan konteks yang beda-beda. Forum seperti "Visi Kita" tidak relevan
disebut IKPM; marhalah lebih pas disebut per angkatan.

**Fix**: `resolveOrgLabels()` baru di `lib/tenant-org-label.ts`:
- Cabang → "Anggota {nama tenant}" (nama tenant biasanya sudah include "IKPM",
  mis. "PC IKPM Yogyakarta")
- Marhalah → "Anggota Angkatan {tahun}" (+ "(Awal)"/"(Akhir)" khusus 1999,
  pattern sama dengan lesson graduationPeriod)
- Forum → "Anggota {nama tenant}" tanpa embel-embel IKPM

`register/page.tsx` fetch `tenant_type` + `name` dari `public.tenants`,
resolve label di server component, teruskan sebagai props ke `RegisterForm`.
4 titik teks statis diganti dinamis. Field "Nomor Induk Gontor" dan teks
"anggota IKPM baru" TIDAK diubah — itu memang universal (identitas global
IKPM di `public.members`), bukan spesifik tenant.

**Aturan untuk copy/label di halaman lain**: kalau ada teks yang menyebut
"IKPM" secara hardcode di halaman publik yang bisa diakses tenant tipe
forum/marhalah, pertimbangkan apakah perlu di-dinamiskan lewat
`resolveOrgLabels()` juga.

### [2026-07-13] Fitur Direktori Profesional — Implementasi Penuh

> Arsitektur lengkap: **`docs/arsitektur-profesional.md`** (perencanaan + implementasi, semua
> keputusan desain terkunci).

Entitas baru `public.member_professionals` — pola identik `member_businesses` &
`member_owned_pesantren` (self-reported, helper FK `contacts`/`addresses`/`social_medias` reused,
tidak ada moderasi admin). Riset BPS KBJI 2014 (Golongan Pokok 2 "Profesional", basis ISCO-08)
untuk 7 kategori. **Struktur 3 level** (bukan 2) hasil diskusi eksplisit dengan user — jangan
disederhanakan lagi:
1. `professionCategory` — enum 7 nilai (dropdown biasa)
2. `professionType` — jenis profesi SPESIFIK (combobox kurasi per kategori + bisa ketik custom).
   **Setiap profesi entitas terpisah** — Pengacara≠Notaris, Dokter≠Perawat≠Bidan, Akuntan≠Konsultan.
   Feedback eksplisit: `ref_professions` yang melumping ("Dokter / Tenaga Kesehatan") JANGAN ditiru.
3. `specialization` — teks bebas opsional untuk detail lanjut (mis. "Spesialis Anak")

**File utama**: `packages/db/src/schema/public/member-professionals.ts`,
`lib/professional-types.ts` (daftar kurasi §2.5 arsitektur, gampang ditambah karena hidup di kode),
`components/ui/profession-type-combobox.tsx` (creatable combobox, fully controlled — sempat ada bug
duplikasi state lokal vs prop `value` yang bisa stale saat form reset, sudah difix jadi single
source of truth dari `value` prop langsung).

Halaman: self-service `/akun/profesional` (three-view, copy pola `usaha-client.tsx`), direktori
publik `/profesional` + `/profesional/[id]`, breakdown "Profesional per Kategori" di `/statistik`.

**Data `ref_professions` existing dicek langsung production sebelum implementasi** — kategori
"Profesional" (4 entri lumped) tervalidasi konsisten dengan skema baru, 2 celah (Pendidikan &
Akademik, Teknologi Informasi) diisi sebagai kategori baru. `ref_professions` dan
`members.profession_id` **tidak diubah sama sekali** — dua sistem tetap independen.

### [2026-07-13] Bug: Field Wajib Tanpa Indikator Visual — "Tombol Tidak Muncul"

**Gejala dilaporkan user**: tombol "Simpan & Lanjutkan" di `/akun/lengkapi` Step 1 kadang "tidak
muncul". **Root cause**: field itu SELALU dirender, tapi disabled (opacity-50, tidak bisa diklik)
kalau field wajib kosong — dan 4 dari 6 field wajib (Jenis Kelamin, Tanggal Lahir, Tahun Lulus KMI,
Profesi) TIDAK punya tanda asterisk (*) merah, cuma "Wali Santri" yang benar. User tidak tahu field
mana yang wajib diisi, tombol tetap redup tanpa penjelasan (beda dari Step 2/3 yang tervalidasi
saat diklik dan tampilkan `setError` — Step 1 di-`disabled` langsung, jadi tidak pernah ter-klik,
tidak pernah dapat pesan error).

**Fix**: `FieldWrap`/`TextInput`/`SelectNative` (helper lokal di file itu) ditambah prop `required`
yang render asterisk, mirror pattern `PhoneInput` yang sudah benar.

**Aturan berlaku di SEMUA form seluruh aplikasi**: kalau sebuah field diperiksa di kondisi
`disabled={... || !field}` pada tombol submit, field itu WAJIB punya indikator visual (asterisk
merah) di labelnya. Tombol yang di-disable tanpa penjelasan terlihat seperti bug, bukan seperti
form yang belum lengkap. Audit form lain di aplikasi untuk pola serupa jika ada laporan serupa.

### [2026-07-13] PC IKPM Cabang — 3 Bug Sekaligus (Cache, Form Gap, UX)

**Investigasi 4-titik** (simpan → tampil → form admin → UX) menemukan 3 bug independen:

1. **Cache RSC basi di `/akun`**: navigasi akhir wizard `/akun/lengkapi` pakai `router.push()`
   bukan reload penuh — Next.js App Router bisa sajikan RSC cache dari SEBELUM data disimpan,
   terutama kalau user sempat buka `/akun` dulu (alur normal, ada banner "Lengkapi Data" di sana).
   Fix: `window.location.href` (pattern yang sama dengan lesson "window.location.href wajib
   setelah login" — berlaku juga untuk navigasi pasca-mutasi data, bukan cuma auth).
2. **Form admin `members/new` + `members/[id]/edit` TIDAK PUNYA field PC IKPM sama sekali** — hanya
   bisa diisi lewat self-service `/akun/lengkapi`. Kalau admin yang input/edit member, field ini
   selamanya kosong. Ditambahkan ke `step1-identity.tsx` + `MemberFormData`/`sanitize()` di
   `members/actions.ts` + prop `cabangList` dialirkan dari server page yang fetch `ref_ikpm_cabang`.
3. **136 opsi PC IKPM pakai `<select>` polos** tanpa search — diganti `<Combobox>`.

**Aturan**: kalau field ada di self-service (`/akun/*`) tapi juga masuk akal diisi admin, WAJIB cek
apakah form admin (`members/new`, `members/[id]/edit`) punya field yang sama. Dua form ini mudah
drift karena dikembangkan terpisah — `step1-identity.tsx` (admin) dan `akun/lengkapi/page.tsx`
(self-service) punya struktur field yang mirip tapi TIDAK saling sinkron otomatis.

### [2026-07-13] Card "Keanggotaan" di `/anggota/[id]` — PC IKPM Selalu Tampil, Marhalah/Forum Kondisional

Row "Cabang" (cuma nampilkan tenant yang sedang dibuka di URL — bisa salah/tidak lengkap untuk
anggota multi-tenant) diganti blok "Anggota" dengan 2 sumber data berbeda sengaja:
- **PC IKPM** — dari `members.primaryCabangRefId → ref_ikpm_cabang.nama` (tabel referensi).
  **Selalu tampil**, bahkan kalau PC IKPM itu belum onboard jadi tenant di sistem — karena semua
  136 PC IKPM resmi ada di `ref_ikpm_cabang` terlepas dari status tenant-nya.
- **Marhalah & Forum** — dari `tenant_memberships JOIN tenants WHERE tenant_type IN
  ('marhalah','forum')`. **Hanya tampil kalau tenant-nya memang ada dan anggota tergabung** —
  beda sumber data karena marhalah/forum secara konsep MEMANG hanya eksis kalau tenant-nya dibuat.

**Aturan**: jangan campur "data dari reference table" (selalu ada, independen dari tenant) dengan
"data dari tenant_memberships" (bergantung tenant eksis) dalam satu query/sumber yang sama — dua
hal ini punya siklus hidup berbeda dan harus di-query terpisah.

**Drive-by fix**: query `Status`/`Bergabung` di halaman yang sama sebelumnya TIDAK filter
`tenantId` (cuma `memberId`) — untuk anggota yang ikut banyak tenant, bisa ambil baris
`tenant_memberships` dari tenant yang salah. Sudah ditambah `and(eq(memberId), eq(tenantId))`.

**Bug turunan**: `joinedAt` bisa NULL untuk anggota yang auto-join lewat `primaryCabangRefId` (jalur
itu tidak set tanggal eksplisit) — "Tanggal Bergabung" jadi hilang. Fix: fallback ke
`tenantMemberships.createdAt` (kolom `defaultNow()`, selalu terisi) kalau `joinedAt` null.

### [2026-07-13] Komponen `SocialLinks` — react-icons untuk Brand Icon

**Masalah lama**: lucide-react (semua versi yang dicoba, termasuk v1.8.0) TIDAK mengekspor icon
brand sosial media (Facebook, Instagram, LinkedIn, TikTok) sama sekali — cuma ada `Globe` (generik)
dan `X` (huruf X polos, kebetulan cocok untuk platform X/Twitter). Solusi lama "pakai Globe untuk
semua platform" (lesson lama, superseded) bikin semua ikon sosmed terlihat sama, tidak bisa
dibedakan platform mana yang mana.

**Fix**: install `react-icons` (`react-icons/fa6` — Font Awesome 6 punya semua brand icon yang
dibutuhkan: `FaFacebook`, `FaInstagram`, `FaLinkedin`, `FaXTwitter`, `FaTiktok`, `FaGlobe`,
`FaYoutube`). Komponen baru `components/ui/social-links.tsx` — universal "sekali panggil dipakai
di mana saja" (analogi WordPress function), UI icon-only bulat, terima `value` dengan shape yang
sama dengan `SocialMediaValue` (`social-media-input.tsx`, komponen input-nya).

**Href per platform** (beda format per field, harus dikonversi):
```
instagram → https://instagram.com/{username}       (value = username tanpa @)
facebook  → value langsung kalau sudah URL, else https://facebook.com/{value}
twitter   → https://x.com/{username}                (value = username tanpa @)
tiktok    → https://tiktok.com/@{username}           (value = username tanpa @)
linkedin, youtube, website → value langsung (sudah URL penuh)
```

**Status implementasi**: baru diterapkan di `/anggota/[id]` (3 lokasi: Media Sosial utama, sub-item
Usaha, sub-item Profesional) sebagai piloting sebelum digeneralisasi ke halaman publik lain
(Usaha/Pesantren/Profesional directory pages) yang saat ini masih pakai text-list manual.
**Belum dieksekusi**: migrasi halaman publik lain ke `<SocialLinks>` — tunggu konfirmasi user.

### [2026-07-13] WhatsApp Notification Fase 3 (Billing) + Template Editable per Tenant

**Riset dulu, jangan asumsi dari dokumen**: sebelum eksekusi, `grep -rln "sendWaNotification"` di
seluruh `apps/web/app` + `apps/web/lib` hanya menemukan 1 caller (endpoint OTP) — padahal
`docs/arsitektur-whatsapp.md` sudah menulis rencana lengkap "Peta Notifikasi per Modul" dan daftar
cron reminder. Cron `invoice-reminder`/`event-reminder` yang disebut docs ternyata **tidak pernah
dibuat** (`find apps/web/app/api/cron` hanya `cleanup-images` + `verify-domains`). Prinsip
"CLAUDE.md/docs adalah project brain, bukan source of truth status fitur" berlaku juga untuk docs
turunan (`arsitektur-*.md`) — selalu verifikasi ke kode, bukan cuma baca dokumen arsitektur.

**Helper terpusat `lib/wa-notify.ts` — cegah drift orgName/URL di banyak caller**: alasan dibuatnya
(bukan langsung panggil `sendWaNotification` di tiap action): kalau tiap 5+ titik notifikasi
reimplementasi sendiri cara ambil `orgName` dan bangun URL invoice, risiko besar salah satu titik
lupa pakai URL absolut (`NEXT_PUBLIC_APP_URL`) dan malah hardcode `/${slug}/...` — persis pola bug
yang sudah pernah terjadi untuk custom domain (lihat lesson "Custom Domain Harus Diisolasi"). Satu
helper `notifyWa()` yang wajib dipakai semua caller menutup kelas bug ini di titik tunggal.

**Template WA dari fungsi JS ke string `{{var}}` — supaya bisa jadi seed database**: sebelumnya
`lib/wa-templates.ts` berisi `Record<string, (v) => string>` (fungsi JS dengan `${v.name}`). Untuk
membuat teks bisa diedit tenant dari dashboard, representasi default harus berupa **string murni**
yang sama persis dipakai sebagai (a) fallback kode dan (b) isi awal textarea editor. Fungsi JS tidak
bisa ditampilkan sebagai teks yang diedit manusia — string dengan placeholder `{{var}}` bisa.
`renderTemplateString()` melakukan **string replace murni** (`tpl.replace(/\{\{(\w+)\}\}/g, ...)`),
bukan `eval`/`Function()` — aman dari code injection meski teksnya diedit admin.

**Override tersimpan di `tenant.settings`, bukan tabel baru**: konsisten dengan `whatsapp_config`
yang sudah lebih dulu ada di sana (group="notif"). Key baru `wa_message_templates` — JSONB
`Partial<Record<WaNotifKey,string>>`, cuma isi key yang dikustomisasi. Tidak perlu migration DDL.

**Resolusi custom→default satu fungsi, dipakai dua caller**: `resolveWaTemplateText(tenantDb, event)`
dipakai oleh `notifyWa()` (notifikasi bisnis) DAN `send-otp/route.ts` (OTP) — supaya kalau nanti ada
titik notifikasi baru, tidak reimplementasi ulang logic "cek override dulu, fallback default".

**Regresi minor yang disengaja (didokumentasikan, bukan dilupakan)**: 2 template lama
(`order_shipped`, `letter_sign_request`) sebelumnya punya interpolasi kondisional JS
(`${v.trackingUrl ? "\n\nPantau: "+v.trackingUrl : ""}`) — baris hanya muncul kalau variabelnya ada.
Sintaks `{{var}}` string-replace tidak support kondisional. Diterima sebagai trade-off karena kedua
notifikasi itu belum ada caller sama sekali (masuk fase mendatang) — saat wiring nanti, caller wajib
selalu isi variabel itu dengan nilai wajar (jangan andalkan baris auto-hilang).

**Aturan untuk notifikasi WA baru ke depan**: SELALU panggil lewat `notifyWa()` dari
`lib/wa-notify.ts` (bukan `sendWaNotification()` langsung) di business-logic actions — kecuali kasus
khusus seperti OTP yang punya guard tambahan (rate limit, verified-check sebelum kirim) di mana
pemanggilan manual `resolveWaTemplateText` + `sendWaNotification` masih dibenarkan.

### [2026-07-14] Bug Kritis: `checkoutAction` Bisa Buat Invoice Duplikat — 2 Root Cause Berbeda

**Gejala production**: 2 invoice terbentuk untuk pelanggan dan tiket event yang sama
(`620-INV-202607-00017` + `00018`, tenant `visikita`, kedua-duanya `sourceType='cart'`). Efek
domino: WA `invoice_created` ikut terkirim 2x (dipicu per invoice yang terbentuk).

**Root cause #1 — race condition tanpa lock (fixed)**: `checkoutAction` (`cart/actions.ts`)
SELECT cart di awal, baru DELETE cart di paling akhir — di antaranya ada banyak `await`
(resolveIdentity, lookup harga, generate nomor invoice, beberapa INSERT). Dua request yang datang
hampir bersamaan (klik ganda, double-tap, retry jaringan) sama-sama melihat cart masih ada →
sama-sama sukses buat invoice dari isi cart yang sama.

**Fix #1**: Bungkus seluruh alur (lock cart → cek isi → hitung harga → insert invoice → hapus cart)
dalam satu `tdb.transaction()` dengan `SELECT ... FOR UPDATE` mengunci baris cart via
`session_token`. Request kedua yang datang hampir bersamaan menunggu lock, lalu menemukan
`cart_items` sudah kosong (sudah diproses request pertama) → berhenti dengan pesan "Keranjang
kosong atau sudah diproses", tanpa invoice duplikat. Pattern identik dengan lock invoice di
`confirmInvoicePaymentAction` (lihat lesson kode unik/double-payment sebelumnya).

**Investigasi lanjutan — kasus nyata TERNYATA bukan race condition**: setelah cek data production,
dua invoice yang dilaporkan berjarak **16 menit** (bukan hitungan detik) dengan `unique_code`
berbeda — bukti dua kali pemanggilan `checkoutAction` yang benar-benar terpisah, bukan request
konkuren. Root cause sebenarnya: pelanggan checkout tiket event, ragu transaksinya berhasil (tidak
ada indikasi jelas "Anda sudah punya invoice ini"), lalu checkout ulang tiket yang sama beberapa
menit kemudian dengan cart session baru — sistem tidak tahu ini permintaan yang sama.

**Root cause #2 — tidak ada deteksi "sudah checkout tiket ini sebelumnya" (fixed)**: Ditambahkan
pengecekan duplikat DI DALAM transaction yang sama, sebelum insert invoice: jika cart **hanya
berisi 1 tiket event** (`cartItems.length === 1 && itemType === 'ticket'`), cek apakah sudah ada
invoice `status IN ('pending','waiting_verification','partial')` untuk `itemId` (ticket) yang sama,
match identity via `memberId` ATAU `profileId` ATAU `customerPhone` ATAU `customerEmail` (OR, bukan
AND — salah satu cocok sudah dianggap orang yang sama). Kalau ketemu → cart dibersihkan, **tidak
buat invoice baru**, langsung kembalikan `invoiceId` invoice lama (klien redirect ke situ seolah
checkout sukses, transparan buat user).

**Keputusan scope yang disengaja — HANYA cart dengan 1 item**: deteksi duplikat TIDAK diterapkan
untuk cart campuran (tiket + produk/donasi sekaligus). Alasan: kalau diterapkan ke semua cart,
customer yang sudah checkout tiket sebelumnya tapi SEKARANG mau checkout tiket+donasi bareng akan
selalu di-redirect ke invoice lama dan tidak pernah bisa menyelesaikan donasinya — deadlock UX.
Cart tunggal (1 tiket) adalah pola traffic dominan untuk pendaftaran event, jadi trade-off ini
menutup kasus yang benar-benar terjadi tanpa membuka risiko baru di kasus campuran (jarang, dan
kalaupun terjadi duplikat, admin tetap bisa `cancelInvoiceAction` manual di dashboard).

**Diagnosa data**: jangan asumsi race condition dari gejala "2 invoice mirip" saja — SELALU cek
`created_at` kedua invoice. Selisih milidetik/detik → race condition (lock). Selisih menit/jam →
kemungkinan besar bukan race condition, tapi UX/behavioral duplicate (customer re-attempt) yang
butuh fix berbeda (deteksi duplikat berbasis identity, bukan locking).

### [2026-07-14] Audit Duplikasi Transaksi — Produk & Donasi (Lanjutan)

Setelah fix di atas, diminta pastikan Toko (produk) dan Donasi juga aman dari kelas bug yang sama.
Hasil audit — **satu fungsi `checkoutAction`, tiga pemanggil**:

```
grep -rl "checkoutAction" apps/web/app apps/web/components
→ cart/actions.ts (definisi)
→ components/billing/checkout-form.tsx     (cart: produk + tiket + campuran)
→ components/donasi/public/campaign-detail-client.tsx  (donasi "express checkout")
```

**Kesimpulan kunci**: karena produk, donasi, dan tiket-via-cart semuanya lewat SATU fungsi
`checkoutAction` yang sama, fix lock `FOR UPDATE` di atas **otomatis berlaku untuk ketiganya** —
tidak perlu logic terpisah per modul untuk race-condition class of bug. Ini konsekuensi langsung
dari prinsip Billing Universal ("satu infrastruktur, dua pintu masuk") yang sudah dikunci sejak
awal — modul Toko/Donasi/Event bukan implementasi checkout sendiri-sendiri.

**Client-side hardening tambahan (ditemukan gap, difix)**: `campaign-detail-client.tsx` —
tombol "Tidak, lanjut bayar →" dan "Lanjut Tanpa Akun →" (express checkout donasi) memanggil
`handleExpressCheckout()` langsung via `onClick={() => void handleExpressCheckout()}`, TANPA
`disabled={pending}` — beda dengan tombol "Tambah ke Keranjang"/"Donasi" di file yang sama yang
sudah pakai `useTransition` + `disabled={pending}`. Fix: pakai `startTransition(handleExpressCheckout)`
+ `disabled={pending}`, konsisten dengan tombol lain. Ini pure UX hardening (server-side lock sudah
cukup untuk korektnes) — tapi tetap penting untuk hindari request sia-sia dan flicker UI.
`checkout-form.tsx` (produk/cart) sudah benar sejak awal, tidak ada perubahan.

**Celah race-condition KEDUA ditemukan — di luar cakupan pertanyaan awal, tapi kelas bug sama**:
`registerForEventAction` (alur pendaftaran tiket event LANGSUNG, bukan lewat cart — dipakai untuk
tiket gratis atau saat event tidak punya linked campaign/product) sudah punya guard "sudah
terdaftar" (cek `eventId` + `memberId`/`attendeeEmail`), TAPI dicek **sebelum** transaction lock.
Dua request nyaris bersamaan bisa sama-sama lolos cek itu sebelum salah satunya insert → 2
registrasi (dan 2 invoice untuk tiket berbayar, via `createLinkedInvoice`). Fix: cek yang sama
diulang LAGI di dalam transaction, tepat setelah lock `FOR UPDATE` pada baris tiket (lock yang
sudah ada sebelumnya untuk validasi kuota) — request kedua yang antre di lock yang sama akan
melihat insert request pertama begitu keduanya boleh jalan berurutan.

**Keputusan scope yang disengaja (dua tempat)**:
1. Deteksi duplikat tiket di `checkoutAction` (cart) HANYA untuk cart berisi 1 item tiket —
   cart campuran (tiket+produk/donasi) tidak dicek, hindari deadlock UX (lihat entri sebelumnya).
2. Deteksi duplikat di `registerForEventAction` (alur langsung) di-scope ke lock **per-tiket**
   (bukan per-event) — kalau customer coba daftar 2 tiket BEDA jenis untuk event yang sama secara
   konkuren, race masih mungkin terjadi (edge case sangat jarang). Trade-off diterima karena
   skenario dominan (klik ganda tiket yang sama) sudah tertutup, dan menaikkan lock ke level event
   berisiko konflik locking dengan cek kuota per-tiket yang sudah ada.

**Aturan untuk modul checkout/registrasi baru ke depan**: SETIAP kali ada aksi yang (a) insert
row unik-per-identitas dan (b) punya guard "sudah ada sebelumnya" via SELECT biasa, guard itu WAJIB
diulang di dalam transaction SETELAH lock diperoleh — SELECT di luar transaction hanya boleh
dianggap "early exit UX", bukan jaminan korektnes. Pattern ini sudah berulang 3x di project
(payment confirm, cart checkout, event registration) — kemungkinan besar akan muncul lagi di modul
baru manapun yang punya konsep "kuota" atau "satu per orang".

### [2026-07-14] Bug Kritis: `next.config.ts redirects()` Salah Tangkap Path Publik di Custom Domain

**Gejala dilaporkan user**: buka `visikita.com/akun/media` (custom domain) → network tab
menunjukkan `308 Permanent Redirect (from disk cache)` → akhirnya mendarat di
`jalakarta.com/app/login?redirect=/app/akun/media`. Kalau user sedang login sesi admin di
jalakarta.com, malah nyasar ke dashboard tenant lain (tenant tempat dia kebetulan jadi owner).

**Root cause — urutan eksekusi Next.js**: `redirects()` di `next.config.ts` berjalan **SEBELUM**
`middleware.ts` (urutan resmi Next.js: `headers → redirects → middleware → rewrites`). Redirect
legacy dari migrasi URL admin Fase 1-4 (`docs/rencana-migrasi-url.md`) — dibuat untuk
backward-compat bookmark lama `jalakarta.com/{slug}/media` → `jalakarta.com/app/{slug}/media` —
punya pola:
```
source: `/:slug(${TENANT_SLUG})/media`   → destination: `/app/:slug/media`
```
Redirect ini **tidak tahu apa-apa soal custom domain** (jalan sebelum middleware yang punya logic
`isOwnHost()`). Di custom domain, halaman publik `/akun/media` (route `(public)/[tenant]/akun/media`)
diakses TANPA prefix slug — path-nya cuma 2 segment: `akun` + `media`. Pola redirect di atas
menyangka `akun` adalah tenant slug (`TENANT_SLUG` regex cocok — huruf kecil valid) → match →
redirect PERMANEN (301, browser cache selamanya) ke `/app/akun/media`, yang bukan tenant asli.

**Ini bug untuk SEMUA custom domain tenant**, bukan cuma cache browser satu user — meski cache
308 permanen memperparah (sekali kena, browser tidak pernah tanya server lagi sampai cache
dibersihkan manual). Modul lain di `ADMIN_MODULES` (`settings`, `finance`, `toko`, `donasi`,
`website`, dll) berpotensi collision serupa kalau suatu saat ada route publik `/akun/{nama-yang-sama}`.

**Fix**: tambah kondisi `has: [{ type: "host", value: "jalakarta.com" }]` ke SEMUA redirect
legacy admin (`moduleRedirects`, `eventRedirects`, `dokumenRedirects`) — redirect bookmark-lama ini
memang cuma relevan di domain sendiri; custom domain tidak pernah punya path admin lama sama sekali.

**Aturan yang dikunci**: setiap kali menambah `redirects()` di `next.config.ts` yang berbasis pola
`/:slug/...` (bukan prefix eksplisit `/app/` atau `/platform/`), WAJIB pertimbangkan apakah pola
itu bisa collision dengan path publik di custom domain (di mana slug implisit dari domain, path
jadi lebih pendek satu segment). Kalau redirect itu hanya untuk keperluan domain sendiri (bookmark
admin lama, dll), WAJIB tambah `has: [{ type: "host", value: "jalakarta.com" }]`. `redirects()`
next.config.ts TIDAK bisa diandalkan untuk tahu bedanya custom domain vs domain sendiri — logic
itu hanya ada di `middleware.ts` (`isOwnHost()`), dan `redirects()` jalan SEBELUM middleware.

**Konsekuensi cache untuk user yang sudah kena**: perbaikan config tidak otomatis membersihkan
cache 308 yang sudah tersimpan di browser user. User yang sudah pernah kena harus hard refresh /
clear cache / buka Incognito untuk melihat perbaikan — server-side fix saja tidak cukup untuk
browser yang sudah cache redirect permanen sebelumnya (pola sama dengan lesson lama "Browser
Ter-Cache Redirect 301 ke `/app/api/*`").

### [2026-07-14] Bug Sistemik: `href="../"` di 6 Halaman `/akun/*` Salah Resolve

**Gejala dilaporkan user**: tombol "Kembali ke Dashboard" di `/akun/pesantren`, `/akun/usaha`,
`/akun/profesional` mengarah ke homepage tenant (`visikita.com`), bukan `/akun`.

**Root cause — matematika resolusi URL relatif (RFC 3986)**: `href="../"` TIDAK berarti "naik satu
level dari halaman saat ini" seperti intuisi umum. Aturan sebenarnya: "direktori" dari URL adalah
semua segment KECUALI yang terakhir (`/akun/usaha` → direktori `/akun/`), lalu `../` naik SATU
LEVEL LAGI dari direktori itu. Hasilnya `../` dari path 2-segment (`/akun/usaha`, `/akun/media`)
selalu mendarat di **root domain** (`/`), dan dari path 3-segment (`/akun/mitra/pesanan`,
`/akun/mitra/produk`) mendarat di **`/akun/`** (bukan `/akun/mitra` yang jadi tujuan wajar tombol
"Kembali"). Pola `href="../"` untuk tombol "kembali ke level atas" HAMPIR SELALU salah — ia selalu
melompat satu level LEBIH JAUH dari yang dimaksud.

**6 file terkena** (ditemukan via `grep -rln 'href="\.\./"'` di seluruh `/akun/*`):
`akun/usaha/usaha-client.tsx`, `akun/pesantren/page.tsx`, `akun/profesional/profesional-client.tsx`,
`akun/media/page.tsx`, `akun/mitra/pesanan/page.tsx`, `akun/mitra/produk/page.tsx` — user cuma
laporkan 3, sisanya ditemukan proaktif karena pola bug identik.

**Fix**: ganti semua ke path eksplisit `${baseUrl}/akun` (2-segment pages) atau
`${baseUrl}/akun/mitra` (3-segment sub-pages) — TIDAK PERNAH mengandalkan `../` untuk navigasi
"kembali" di aplikasi ini. `baseUrl` dihitung sesuai pattern custom-domain yang sudah dikunci
(`isOwnHost(host) ? "/${slug}" : ""`).

**Server component vs full-client component — dua pendekatan baseUrl:**
- Server page (`usaha/page.tsx`, `profesional/page.tsx`, `mitra/*/page.tsx`) → hitung `baseUrl` via
  `headers()` + `isOwnHost()`, teruskan sebagai prop ke client component.
- Full-client page (`pesantren/page.tsx` pakai `"use client"` dari awal, tidak ada server wrapper;
  `media/page.tsx` sama) → TIDAK bisa akses `headers()`. Pattern: `useState(`/${slug}`)` sebagai
  default (asumsi domain sendiri, kasus dominan) — SSR dan render klien PERTAMA sama persis
  (tidak ada hydration mismatch warning) — lalu dikoreksi via `useEffect` yang cek
  `isOwnHost(window.location.host)` HANYA jika ternyata custom domain. Jangan pernah mulai dari
  default `""` lalu koreksi ke `/${slug}` — itu menyebabkan flash redirect salah sebelum effect
  jalan untuk kasus dominan (jalakarta.com).

**Aturan berlaku ke depan**: JANGAN PERNAH pakai `href="../"` atau `href="./"` untuk tombol
navigasi "kembali" di halaman manapun — matematikanya gampang salah dan sulit di-review sekilas.
Selalu bangun path eksplisit dari `baseUrl` + path absolut yang jelas maksudnya.

### [2026-07-14] Label Keanggotaan Dinamis di `/akun` — Reuse `resolveOrgLabels()`

Card "Keanggotaan IKPM" di `/akun` dan badge "Anggota IKPM" di sidebar (`akun/layout.tsx`) tadinya
hardcode teks generik, padahal `lib/tenant-org-label.ts` (`resolveOrgLabels()`) sudah ada sejak
sesi label dinamis di halaman register — fungsi ini sudah menghasilkan label yang tepat per tipe
tenant: `Anggota {tenant.name}` (cabang/forum) atau `Anggota Angkatan {tahun}` (marhalah). Fix:
reuse fungsi yang sama di `akun/page.tsx` (fetch `tenants.tenantType/marhalahYear/marhalahPeriod`
via JOIN `tenantMemberships`) dan `akun/layout.tsx` (fetch tenant row terpisah, hanya saat
`isMember`). Tidak ada field baru di DB — murni pakai kolom yang sudah ada dari fitur backbone IKPM.

**Aturan**: kalau ada teks "IKPM" hardcode baru muncul di halaman lain yang tenant-nya bisa
cabang/marhalah/forum, cek dulu apakah `resolveOrgLabels()` sudah bisa dipakai sebelum menulis
ulang logic serupa.

### [2026-07-14] Member Media Library — Jadi Global Cross-Tenant (Step 1-3 Selesai)

> Arsitektur lengkap: `docs/arsitektur-medialibrary.md` § 3

**Masalah**: user melaporkan foto usaha/profesional yang sudah diupload tidak muncul di
`/akun/media`. Root cause: `member_businesses`/`member_professionals`/`member_owned_pesantren`
(data) sudah **global** (`public` schema, satu row per member lintas semua tenant), tapi
**foto pendukungnya** (`tenant_{slug}.media`, kolom `member_id`, hasil desain Phase 1-4 lama)
terkunci ke **tenant tempat upload dilakukan**. Upload di tenant A hanya query-able saat browsing
tenant A — mismatch dengan prinsip "1 akun anggota IKPM berlaku di semua tenant".

**Solusi yang dipilih (dari 3 opsi yang dibandingkan)**: tabel metadata baru `public.member_media`
— **global**, dengan kolom `source_tenant_slug` menunjuk bucket MinIO asal. **File fisik TIDAK
PERNAH dipindah** — hanya metadata-nya yang jadi global. Ini jauh lebih murah/aman dibanding
memindahkan file ke bucket baru (yang butuh copy fisik semua file + downtime risk), dan benar-benar
menyelesaikan akar masalah (beda dengan opsi "aggregate query N-tenant saat load" yang cuma
menyamarkan gejala, upload baru tetap "terjebak" per tenant).

**3 keputusan yang dikunci** (jangan diubah tanpa alasan kuat):
1. **Bukti transfer TETAP TERPISAH** dari media library — alasan user: invoice publik sengaja tidak
   wajib login (guest checkout), upload bukti bayar harus tetap bisa tanpa akun member. Tidak
   pernah digabung ke `member_media` (yang scoped by `member_id`, wajib ada akun).
2. **Upload baru tetap ke bucket tenant tempat sedang browsing** — tidak ada perubahan pada logic
   fisik upload (`uploadFile()`, `processImage()` identik seperti sebelumnya). Yang berubah HANYA
   baris INSERT metadata: target `public.member_media` (bukan `tenant.media`).
3. **Row lama di `tenant.media` dibiarkan 30 hari**, cron cleanup (Step 4, **belum dieksekusi**)
   WAJIB cek dulu apakah foto masih dipakai di `members.photo_url`/`member_businesses.cover_url`/
   `member_professionals.cover_url`/`member_owned_pesantren.cover_url` sebelum benar-benar hapus —
   skip kalau masih dipakai di manapun.

**Perubahan teknis (Step 1-3, sudah dieksekusi, commit menyusul):**
- `packages/db/src/schema/public/member-media.ts` (baru) — tabel `member_media`, FK asli ke
  `public.members` (bukan TEXT non-FK seperti `tenant.media.memberId` — karena sekarang SAMA-SAMA
  di public schema, FK cross-schema tidak lagi jadi masalah)
- `packages/db/migrations/0028_member_media_global.sql` (baru) — CREATE TABLE + backfill via
  `DO $$ ... LOOP` semua tenant aktif (skip tenant yang belum punya kolom `member_id` di
  `tenant.media`, guard untuk tenant sangat lama)
- `app/api/akun/media/upload/route.ts` — INSERT target pindah ke `memberMedia` (public), file fisik
  tetap upload ke bucket `tenant-{slug}` seperti biasa (tidak berubah)
- `app/api/akun/media/route.ts` (GET) — query `memberMedia WHERE member_id = X` TANPA filter tenant
  sama sekali; setiap row resolve URL via `publicUrl(row.sourceTenantSlug, row.path)` — bukan dari
  slug di query param. Param `?tenant=` sekarang diabaikan (dipertahankan di caller untuk backward
  compat, tidak breaking)
- `app/api/akun/media/[id]/route.ts` (DELETE) — guard `member_id` tetap wajib, hapus file fisik
  pakai `sourceTenantSlug` dari row (bukan dari query param) — penting karena file bisa di bucket
  tenant manapun

**Tidak ada breaking change di komponen** — `MemberMediaPicker`/`CoverImageField` tetap kirim prop
`slug` yang sama seperti sebelumnya (maknanya berubah jadi "tenant tujuan upload FILE BARU", bukan
lagi dipakai untuk fetch). `usaha-client.tsx`, `profesional-client.tsx`, `pesantren/page.tsx`,
`lengkapi/page.tsx` — nol perubahan diperlukan.

**Gap yang belum ditutup (dicatat, bukan dilupakan)**: cron `cleanup-images` (hapus `_ori` setelah
10 hari) hanya scan `tenant_{slug}.media` — TIDAK menjangkau `public.member_media` yang baru. File
`_ori` dari upload member sekarang tidak pernah dibersihkan otomatis (minor storage leak, bukan bug
korektnes). Perlu cron terpisah atau extend `cleanup-images` untuk scan `member_media` juga — belum
diprioritaskan, masukkan ke follow-up kalau storage MinIO mulai terasa penuh.

**Step 4 (cron cleanup legacy `tenant.media`) — KODE SELESAI (2026-07-14)**:
`app/api/cron/cleanup-member-media-legacy/route.ts` — batch-check referensi ke 4 kolom
(`members.photo_url`, `member_businesses.cover_url`, `member_professionals.cover_url`,
`member_owned_pesantren.cover_url`) per-tenant sebelum hapus, skip kalau masih dipakai. Hard
safety-gate `CLEANUP_CUTOFF = 2026-08-13` hardcoded di kode — endpoint return `{skipped:true}`
tanpa hapus apapun kalau dipanggil sebelum tanggal itu. Aman deploy + jadwalkan crontab kapan
saja (pola sama `cleanup-images`, header `x-cron-secret`) — gate ada di kode, bukan di jadwal.

### [2026-07-14] WhatsApp Notification Fase B — Cron Reminder Selesai

`app/api/cron/invoice-reminder/route.ts` (baru) — harian, per tenant aktif query
`invoices WHERE status IN (pending,partial) AND due_date = besok` → kirim `invoice_reminder`.
`amount` dihitung `(total + uniqueCode) - paidAmount` (sisa tagihan sesungguhnya, konsisten
dengan aturan kode unik yang sudah dikunci — bukan `total` mentah).

`app/api/cron/event-reminder/route.ts` (baru) — harian, per tenant aktif query
`events WHERE status='published' AND starts_at::date = besok`, lalu per event query
`event_registrations WHERE status='confirmed'` → kirim `event_reminder` per peserta.
`eventDate` diformat `Asia/Jakarta` timezone eksplisit + suffix "WIB" (event Indonesia).
Template `event_reminder` ditambah `{{eventUrl}}` (sebelumnya tidak ada link sama sekali).

Kedua cron pakai pola auth yang sama (`x-cron-secret` header) dan `notifyWa()` dari
`lib/wa-notify.ts` — otomatis skip kalau toggle notifikasi belum diaktifkan admin tenant
(dicek di dalam `sendWaNotification`), tidak perlu guard tambahan di level cron.

**Belum dijadwalkan di crontab VPS** — perlu ditambahkan manual (`crontab -e`), sama seperti
`cleanup-member-media-legacy`. Tidak ada safety-gate tanggal di kedua cron ini (beda dengan
cleanup-member-media-legacy) — begitu dijadwalkan, langsung aktif kirim notifikasi H-1.

### [2026-07-15] WhatsApp Notification Fase 4-6 — Semua Fase Notifikasi Selesai

**Fase 4 — Fulfillment**: `updateFulfillmentStatusAction` (billing/actions.ts) sekarang fetch
`customerName`/`customerPhone`/`invoiceNumber` sekaligus dengan cek status invoice, dan kirim
`order_processing`/`order_shipped`/`order_delivered` sesuai `newStatus` (stage `packed` sengaja
tidak punya notifikasi — tidak ada template untuk itu). `trackingUrl` diarahkan ke halaman invoice
publik (`/invoice/{id}`) — bukan tracking resi asli karena RajaOngkir tracking proxy belum ada
(tercatat sebagai technical debt terpisah).

**Fase 5 — Event**: `event_registered` dikirim di **dua titik berbeda** secara sengaja (bukan
duplikat, dua alur yang beda):
1. `registerForEventAction` (alur direct/legacy, bukan cart) — fire SEGERA setelah insert
   registrasi (gratis maupun berbayar, pending maupun confirmed). Ini satu-satunya touchpoint
   untuk alur ini karena `createLinkedInvoice` (dipakai di sini) hidup di `packages/db` — package
   terpisah yang TIDAK BISA import `apps/web/lib/wa-notify.ts` (apps/web depends on packages/db,
   bukan sebaliknya) — jadi tiket berbayar via alur direct tidak dapat `invoice_created` sama
   sekali, `event_registered` menutup gap itu.
2. Auto-create block di `confirmInvoicePaymentAction` + `verifySubmittedPaymentAction`
   (billing/actions.ts, alur cart E10) — fire SETELAH `event_registrations` ter-insert dari cart
   ticket saat payment dikonfirmasi. Ini titik PERTAMA nomor registrasi ada untuk alur cart (tidak
   ada sebelumnya), jadi natural untuk kasih tahu customer nomor registrasinya di sini — TIDAK
   redundan dengan `payment_confirmed` generik yang sudah fire di titik yang sama (pesan beda:
   satu soal pembayaran, satu soal detail tiket/event).

Pola implementasi: `newEventRegs: Array<{...}>` dikumpulkan DI DALAM transaction (lewat closure),
lookup detail event + fire `notifyWa` SETELAH transaction commit (side-effect di luar tx, pola sama
dengan `payment_confirmed` yang sudah ada). `formatEventDateWib()` di-duplikasi di
`event/actions.ts` DAN `billing/actions.ts` — sengaja, pola sama dengan `generateEventRegNumber`
yang sudah duplikat sebelumnya ("agar billing tidak bergantung ke modul event").

`event_certificate_ready` — ditambahkan di `api/events/[id]/certificate/[regId]/route.ts` setelah
`certificateUrl` di-update, sebelum response.

**Fase 5 — Donasi**: `donation_received` fire di `submitPaymentProofAction` (cart/actions.ts),
ALASAN dipilih di titik ini (bukan `payment_confirmed`): template bahasanya eksplisit
"telah kami terima dan **sedang diverifikasi**" — cocok dengan tahap submit-bukti, bukan tahap
sudah-terkonfirmasi. Query `invoice_items WHERE itemType='donation'` per invoice (invoice bisa
campur produk+tiket+donasi) — satu notifikasi per row donasi, `campaignName` = `item.name` (sudah
berisi nama campaign sejak `addToCartAction`, tidak perlu JOIN ke tabel campaigns).

**Keputusan scope disengaja**: `createDonationAction`/`confirmDonationAction` (admin manual entry,
`donasi/actions.ts`) SENGAJA TIDAK disentuh — ini jalur **legacy** untuk donasi offline/cash yang
diinput admin langsung (lihat lesson "Donasi = Alur Cart Universal" — `donations` tabel legacy,
alur publik aktif sepenuhnya via cart). Fokus di jalur cart yang aktif dipakai publik.

**Fase 6 — Surat**: `letter_sign_request` ditambahkan di `syncSignatureSlotsAction`
(letters/actions.ts) — fire HANYA saat slot signature dapat **token baru** (insert slot baru, atau
officer berubah, atau token hilang) — TIDAK fire kalau token dipertahankan (officer sama, link lama
masih berlaku, tidak perlu notifikasi ulang). Resolusi phone officer: `officers.memberId →
public.members.contactId → public.contacts.(whatsapp||phone)` — 3-level lookup batched (bukan
per-officer query) untuk efisiensi.

**Bug ditemukan+difix saat implementasi**: `syncSignatureSlotsAction` sebelumnya destructure
`const { db: tenantDb, schema } = createTenantDb(slug)` di awal fungsi — artinya `tenantDb` di
fungsi itu SUDAH raw db instance, BUKAN objek `TenantDb` utuh `{db, schema}` yang dibutuhkan
`notifyWa()`. TypeScript langsung menangkap ini (`missing properties db, schema`). Fix: simpan
`tenantClient = createTenantDb(slug)` dulu, baru destructure `{db: tenantDb, schema} = tenantClient`,
pakai `tenantClient` (bukan `tenantDb`) saat panggil `notifyWa()`. **Ini persis lesson lama**
"Pattern: getSettings butuh TenantDb lengkap, bukan raw db" — kesalahan yang sama berulang di
konteks berbeda (notifyWa, bukan getSettings) — aturan generalisasi: **fungsi manapun yang
menerima parameter `tenantDb: TenantDb` (bukan raw db) WAJIB dicek variabel yang dikirim benar-benar
objek `{db, schema}` utuh, bukan hasil destructure `.db` saja** — cek ini di SETIAP file yang mau
dipasangi `notifyWa()`, jangan asumsikan variabel bernama `tenantDb` selalu tipe yang benar.

**Status akhir**: Semua 6 fase WhatsApp Notification (1,2,3,4,5,6,7 minus quota enforcement) sudah
lengkap dari sisi kode. TypeScript 0 error, build sukses di setiap tahap.

### [2026-07-15] `member_welcome` — Trigger di Selesainya Wizard `/akun/lengkapi` (Step 3)

**Klarifikasi user**: `member_welcome` tadinya di rencana Fase 6 dikaitkan ke `createMemberAction`
(admin tambah anggota) — TAPI Step 1 wizard admin tidak punya field nomor HP sama sekali (nomor
baru diisi Step 2, seringkali sesi terpisah). Ditemukan saat investigasi, dikonfirmasi user: trigger
yang benar adalah **selesainya wizard self-service 3-step `/akun/lengkapi`** (Data Identitas →
Kontak & Alamat → Riwayat Pendidikan) — bukan saat admin tambah anggota.

**Kolom baru**: `public.members.welcome_sent_at` (nullable timestamp, migration
`0029_member_welcome_sent_at.sql`) — flag idempoten, **tidak pernah di-reset**. Mencegah kirim
berulang setiap kali member kembali edit data pendidikan setelah onboarding pertama selesai.

**Implementasi**: `POST /api/akun/member-education` (endpoint Step 3, step TERAKHIR wizard) — sudah
menerima param baru `slug` (endpoint ini sebelumnya sama sekali tidak tenant-aware, hanya identity
via session). Setelah save sukses: kalau `welcomeSentAt IS NULL` DAN `contactId` sudah ada (Step 2
selesai) DAN ada nomor telepon → kirim `notifyWa(event:"member_welcome")` → set `welcomeSentAt =
NOW()`. `profileUrl` di template mengarah ke `/akun` (dashboard), bukan balik ke `/akun/lengkapi`.

**Aturan pola**: endpoint API akun (`/api/akun/*`) yang sebelumnya "identity-only" (auth via
session saja, tidak butuh `slug`) — begitu perlu kirim notifikasi WA, WAJIB ditambah param `slug`
dari client (client selalu punya `slug` dari `useParams()`/URL path tenant), karena `notifyWa()`
butuh tenant context untuk resolve WA gateway + config.

### [2026-07-15] `profile_incomplete_reminder` — Notifikasi WA Baru (di Luar Rencana Awal)

Fitur baru diminta user saat diskusi `member_welcome`, bukan bagian dari 7 fase yang sudah
direncanakan sebelumnya — cron pengingat lengkapi profil (pendidikan/usaha/pesantren/profesional),
sekali kirim, 14 hari setelah `member_welcome` terkirim.

**Kondisi kirim** (dikunci setelah beberapa putaran klarifikasi dengan user — jangan diubah tanpa
alasan kuat, gampang disalahpahami): kirim jika **riwayat pendidikan kosong** ATAU **usaha DAN
pesantren DAN profesional kosong SEMUA**. Bukan "OR sederhana 4 kategori" — pendidikan diperlakukan
sebagai kondisi independen, sementara usaha/pesantren/profesional diperlakukan sebagai SATU
kelompok (harus kosong SEMUA baru dianggap "belum melengkapi", cukup salah satu terisi = lolos).

**2 kolom baru di `public.members`** (migration `0030_member_profile_reminder.sql`):
- `welcome_sent_tenant_slug` — tenant yang dipakai kirim `member_welcome`, dipakai LAGI sebagai WA
  gateway untuk reminder ini (konsisten "kirim dari rumah yang sama"), diisi di endpoint
  `/api/akun/member-education` bersamaan dengan `welcome_sent_at`
- `profile_reminder_sent_at` — flag idempoten, sekali kirim saja (bukan berulang tiap 14 hari)

**Cron baru**: `app/api/cron/profile-incomplete-reminder/route.ts` — **TIDAK loop per tenant**
seperti `invoice-reminder`/`event-reminder` (yang perlu loop karena data invoice/event ada di
`tenant_{slug}` schema) — data pendidikan/usaha/pesantren/profesional semuanya di **public schema**
(global), jadi cukup SATU scan `public.members` + batch-count 4 tabel sekaligus via `groupBy`
(bukan query per-member, untuk efisiensi kalau kandidat banyak).

**WaNotifKey baru**: `profile_incomplete_reminder` — ditambah ke `lib/whatsapp.ts`
(`WaNotifKey` type + `WA_NOTIF_DEFAULTS`), `lib/wa-templates.ts` (template baru, var
`{{missingList}}` dibangun manual di cron sebagai daftar bullet), toggle dashboard di
`WhatsAppSetupClient` NOTIF_GROUPS group "Anggota & Pengurus".

**Belum dijadwalkan di crontab VPS** — perlu ditambahkan manual sama seperti cron lain,
`0 10 * * * curl ... /api/cron/profile-incomplete-reminder`.

### [2026-07-15] Bug: Link WA Selalu `jalakarta.com`, Tidak Pernah Custom Domain Tenant

**Gejala dilaporkan user**: link invoice yang dikirim via WA selalu `jalakarta.com/{slug}/invoice/...`,
padahal tenant sudah punya custom domain aktif (mis. `visikita.com`).

**Root cause**: `waAppUrl(slug, path)` di `lib/wa-notify.ts` — komentarnya sendiri menyebut soal
custom domain ("Jangan pernah hardcode `/${slug}/...`"), tapi fungsinya SENDIRI adalah pure
synchronous function yang TIDAK PERNAH query `public.tenants.custom_domain` — selalu return
`${NEXT_PUBLIC_APP_URL}/{slug}{path}` apa adanya. Ironis: helper yang dibuat khusus untuk
"mencegah bug URL custom domain" (lihat lesson sebelumnya soal ini) ternyata sendiri kena bug yang
persis sama karena tidak pernah benar-benar cek status custom domain tenant.

**Fix**: `waAppUrl()` diubah jadi `async` — query `public.tenants WHERE slug=X` untuk
`customDomain` + `customDomainStatus`. Kalau custom domain **aktif**
(`customDomainStatus === "active"`) → return `https://{customDomain}{path}` (tanpa prefix slug,
konsisten dengan pola `baseUrl` yang dipakai halaman web publik). Kalau tidak → fallback ke
`jalakarta.com/{slug}{path}` seperti sebelumnya. Fail-safe: kalau query gagal (try/catch) →
fallback juga, supaya notifikasi tidak pernah gagal terkirim gara-gara lookup custom domain error.

**Efek domino — 9 titik pemanggilan perlu `await`**: karena `waAppUrl()` sekarang async, semua
caller (`cart/actions.ts`, `event/actions.ts`, `billing/actions.ts` ×3, `letters/actions.ts`,
`member-education/route.ts`, 3× cron routes) perlu di-`await`. Pola yang dipakai: kalau titik
pemanggilan berada SEBELUM `void notifyWa(...)` dalam alur yang sepenuhnya sinkron sampai situ →
bungkus keduanya dalam `void (async () => { ... })()` supaya tetap fire-and-forget murni (tidak
menambah latency ke transaksi utama). Kalau sudah berada di dalam `for` loop yang sudah melakukan
`await` lain sebelumnya (mis. fetch `eventDetail`) → `await waAppUrl(...)` langsung tanpa wrapper
tambahan (konsisten dengan blocking pattern yang sudah ada di loop itu).

**Aturan ke depan**: setiap fungsi helper yang membangun URL publik tenant (bukan cuma `waAppUrl`)
WAJIB benar-benar query status custom domain — jangan cukup menulis komentar peringatan tanpa
implementasi aktual. Kalau ada helper serupa lain yang ditemukan (search: URL builder dengan
`NEXT_PUBLIC_APP_URL` hardcoded), audit apakah sama-sama kena bug ini.

### [2026-07-15] Bug: Double Konfirmasi Pembayaran — `submitPaymentProofAction` Tanpa Guard + Lock

**Masalah**: Customer bisa submit bukti pembayaran dua kali untuk invoice yang sama — hasilnya
2 baris `payments` dengan `status: 'submitted'` untuk satu invoice, admin melihat dua bukti
transfer padahal cuma transfer sekali.

**Root cause berlapis (server + client):**

1. **Server — tidak ada guard status, tidak ada lock**: `submitPaymentProofAction` di
   `app/(public)/[tenant]/cart/actions.ts` langsung INSERT payment baru + UPDATE invoice tanpa
   cek dulu apakah invoice sudah `waiting_verification` (artinya sudah ada submission yang
   menunggu admin verifikasi). Dua request nyaris bersamaan (double-click submit, browser retry)
   sama-sama lolos.
2. **Client — status invoice tidak pernah di-refresh setelah submit**: `invoice-public-client.tsx`
   tidak pernah memanggil `router.refresh()` setelah submit sukses. `canPay` dihitung dari prop
   `invoice.status` yang stale (`["pending","partial","overdue"].includes(status)`) → tombol
   "Konfirmasi Pembayaran" tetap muncul dan bisa diklik lagi meski invoice sudah
   `waiting_verification` di DB.

**Fix:**
- `submitPaymentProofAction` dibungkus `tdb.transaction()` dengan `SELECT ... FOR UPDATE` lock
  pada baris invoice sebelum insert payment — pattern yang sama dengan
  `confirmInvoicePaymentAction` dan `checkoutAction` (lihat lesson race condition sebelumnya).
  Guard eksplisit di dalam transaction, SETELAH lock diperoleh:
  ```typescript
  if (lockedInv.status === "waiting_verification") {
    return { error: "Bukti pembayaran Anda sedang diverifikasi admin. Mohon tunggu, tidak perlu kirim ulang." };
  }
  ```
  Semua insert (`payments`, `invoicePayments`) dan update status invoice dipindah ke dalam
  transaction yang sama. Return value pakai discriminated union `TxResult` (`{error} | {data}`)
  — dicek dengan `if ("error" in txResult)` setelah transaction selesai. `notifyWa()` tetap di
  luar transaction (fire-and-forget, tidak boleh menambah latency transaksi).
- `invoice-public-client.tsx`: tambah `useRouter()` + `router.refresh()` di `handleSubmitProof`
  pada branch sukses (setelah `setShowPayForm(false)`), supaya prop `invoice.status` ter-update
  dari server dan `canPay` langsung `false` setelah submit.

**Aturan yang dikunci (perluasan pattern lock+guard yang sudah berulang di project ini)**:
setiap aksi customer-facing yang bisa dipicu ulang (klik ganda, retry jaringan, tab ganda) DAN
menyebabkan efek permanen (insert payment, insert registrasi, dll) wajib punya DUA lapis:
1. **Server**: transaction + `FOR UPDATE` lock + guard status diulang setelah lock (bukan cuma
   dicek sebelum transaction dimulai)
2. **Client**: `router.refresh()` (atau setara) setelah mutasi sukses, supaya UI state tidak
   stale dan tombol aksi tidak terlihat "masih bisa diklik" padahal servernya sudah menolak

Ini pattern ke-4 di project yang kena kelas bug sama: payment confirm admin, cart checkout,
event registration, dan sekarang payment proof submission customer.

### [2026-07-15] Audit `/akun/mitra` — Crash Bug + Security Gap + UI Gap

User curiga halaman `/akun/mitra/produk*` "belum digarap". Audit terhadap
`docs/arsitektur-mitra.md` vs kode aktual menemukan fitur SUDAH diimplementasikan (Phase 0–2 +
sebagian Phase 3 shipping), tapi 3 kelas bug nyata membuatnya terasa rusak/belum jadi:

**1. Bug crash — pengulangan bug header-forwarding yang sudah pernah difix di file tetangga.**
`produk/page.tsx`, `produk/new/page.tsx`, `produk/[id]/edit/page.tsx` melakukan internal fetch ke
`/api/mitra/*` dengan `{ headers: hdrs }` atau `{ headers: await headers() }` — meneruskan SELURUH
incoming request `Headers` (termasuk `connection`, hop-by-hop header terlarang) ke fetch keluar.
Ini persis root cause `UND_ERR_INVALID_ARG` / "TypeError: fetch failed" yang sudah didokumentasikan
dan difix di `akun/mitra/page.tsx` (lihat lesson "Internal Fetch di Server Component") — tapi 3 file
saudaranya tidak ikut difix saat itu. Mengunjungi "Produk Saya", "Tambah Produk", atau "Edit Produk"
sebagai mitra kemungkinan besar crash 500 — ini kemungkinan penyebab utama kesan "belum digarap".
**Fix**: ganti semua ke `{ headers: { cookie: hdrs.get("cookie") ?? "" } }`, pola yang sama dengan
`akun/mitra/page.tsx` yang sudah benar.

**2. Security gap — syarat "mitra terikat cabang" tidak pernah ditegakkan.**
`docs/arsitektur-mitra.md` mengunci: "Mitra hanya bisa mendaftar di tenant yang mana dia terdaftar
sebagai anggota (`tenant_memberships`)". Tapi `GET /api/mitra/status` menghitung variabel
`membership` dengan query yang secara eksplisit belum lengkap (ada komentar TODO: "tenantMemberships
juga punya tenantId, kita perlu lookup slug → tenantId") dan variabelnya **tidak pernah dipakai** di
response. `POST /api/mitra/apply` bahkan tidak punya pengecekan ini sama sekali. Akibatnya: anggota
IKPM dari cabang manapun bisa mendaftar jadi mitra di toko cabang lain mana saja — melanggar
keputusan arsitektur yang sudah dikunci. **Fix**: kedua route sekarang query `tenants.id` dari slug
lalu cek `tenantMemberships` (tenantId + memberId + status IN active/alumni) — pattern yang sama
dengan guard `requires_membership` di modul Event. `status/route.ts` expose `eligibility.isTenantMember`
untuk UI; `apply/route.ts` menolak dengan 403 di server (baris pertahanan sesungguhnya).
`page.tsx` sekarang tampilkan pesan "Khusus Anggota Cabang Ini" dan sembunyikan form pendaftaran
kalau `!isTenantMember`.

**3. UI gap — endpoint ada, tombolnya tidak.**
`DELETE /api/mitra/apply` (batalkan pengajuan) dan `DELETE /api/mitra/products/[id]` (hapus produk)
sudah ada di backend sejak awal, tapi tidak ada satupun tombol di UI yang memanggilnya. Anggota
yang pengajuannya pending tidak bisa membatalkan; mitra tidak bisa menghapus produknya sendiri dari
form edit. **Fix**: komponen baru `mitra-cancel-button.tsx` (client, confirm + DELETE + `router.refresh()`)
dipasang di section "Pengajuan Sedang Diproses"; tombol "Hapus Produk" ditambahkan di
`mitra-product-form.tsx` (hanya muncul saat `isEdit`).

**4. Drive-by fix — inkonsistensi `baseUrl` custom domain.**
`page.tsx`, `apply/page.tsx`, `mitra-product-form.tsx` hardcode `/${slug}/...` di href/redirect —
padahal file saudaranya (`produk/page.tsx`, `pesanan/page.tsx`) sudah benar pakai pola `baseUrl`.
Diselaraskan: server component pakai `isOwnHost(hdrs.get("host"))`, full-client component
(`apply/page.tsx`, `mitra-product-form.tsx`, tidak ada server wrapper) pakai pola
`useState(`/${slug}`)` default + koreksi di `useEffect` via `isOwnHost(window.location.host)` —
identik dengan pola yang sudah dikunci di lesson `href="../"` sebelumnya.

**Aturan yang ditegaskan ulang**: setiap kali sebuah fitur punya beberapa halaman/route yang serupa
(sibling files), fix bug di salah satu file **wajib** dicek juga di file-file lain yang punya pola
identik — bug header-forwarding di sesi ini seharusnya sudah ditemukan sekaligus saat fix pertama
kali di `akun/mitra/page.tsx`, bukan menunggu laporan user di file tetangga.

### [2026-07-15] Footer — Ikon Sosial Media Konsolidasi ke `<SocialLinks>`

**Masalah**: `dark-footer.tsx` dan `light-footer.tsx` masing-masing punya implementasi ikon sosial
media sendiri (`SOCIAL_BRAND_COLORS` + `SOCIAL_SVG_PATHS` + `SocialIcon` — SVG path tangan, duplikat
persis di dua file), terpisah dari `<SocialLinks>` (`components/ui/social-links.tsx`, react-icons
Font Awesome, sudah dipakai di `/anggota/[id]` sejak lesson `[2026-07-13] Komponen SocialLinks`).
Dua implementasi berbeda untuk hal yang sama = ikon di footer tidak konsisten dengan ikon di
direktori publik, dan SVG path tangan lebih rawan tidak akurat dibanding icon set resmi.

**Fix — generalisasi `<SocialLinks>` jadi satu-satunya sumber ikon sosmed di seluruh aplikasi:**
- Tambah platform `whatsapp` (`FaWhatsapp`) ke `SocialLinksValue` + `PLATFORMS` — sebelumnya hanya
  7 platform (tanpa whatsapp), padahal footer butuh ini (dibangun dari `contact_whatsapp` sebagai
  URL `wa.me` penuh, `buildHref` pass-through sama seperti linkedin/youtube).
- Tambah prop `variant?: "outline" | "brand"` — `"outline"` (default) = gaya monokrom berbingkai
  yang sudah ada (dipakai di `/anggota/[id]`, tidak berubah tampilannya). `"brand"` = latar bulat
  warna resmi per platform (dipindah dari footer: `SOCIAL_BRAND_COLORS` sekarang di-export dari
  `social-links.tsx`) — dipakai khusus di footer agar tetap "berwarna sesuai logo".
- `dark-footer.tsx` + `light-footer.tsx`: hapus ~35 baris SVG path tangan + `SocialIcon` per file,
  ganti dengan `<SocialLinks value={socialsRaw} variant="brand" size="md" className="pt-1" />`.
- Platform `telegram` (ada di kode SVG lama tapi tidak pernah bisa diisi — `SocialMediaInput` di
  `/settings/contact` tidak punya field telegram) SENGAJA tidak dibawa ke `SocialLinks` — konsolidasi
  ini menyelaraskan kode dengan kapabilitas nyata, bukan mempertahankan dead code.

**Aturan**: `<SocialLinks>` dari `components/ui/social-links.tsx` adalah satu-satunya komponen ikon
sosial media di aplikasi ini — jangan pernah tulis ulang SVG path atau daftar warna brand di
komponen lain. Kalau butuh gaya visual berbeda (misal footer perlu warna, halaman lain perlu
monokrom), tambah varian baru via prop `variant`, bukan implementasi paralel.

### [2026-07-16] Dashboard Admin `/app/{slug}/dashboard` — Refactor Total dari Placeholder

**Sebelumnya**: halaman ini murni placeholder sejak awal proyek — 4 stat card hardcode `"—"`,
tanpa satu pun query DB, plus `href` masih pola URL lama (`/${slug}/members` tanpa prefix `/app/`,
sisa sebelum migrasi URL admin Fase 1-4). User eksplisit: "kita belum sama sekali bikin dashboard".

**Keputusan yang dikonfirmasi user via `AskUserQuestion` sebelum eksekusi:**
1. **Tambah grafik tren** — install `recharts` (dependency chart pertama di seluruh project, tidak
   ada sebelumnya sama sekali, termasuk di `/finance/laporan` yang murni tabel/angka).
2. **Semua modul selalu tampil**, TIDAK difilter per role/permission (`canAccess()`/`hasReadAccess()`
   dari `lib/permissions.ts` sengaja TIDAK dipakai di sini) — beda dengan `sidebar-nav.tsx` yang
   memang memfilter menu per role. Bendahara pun melihat ringkasan Anggota, Toko, dst.

**Struktur halaman baru** (`dashboard/page.tsx`, rewrite total):
1. KPI row (4 `StatCard`): Total Anggota (+delta bulan ini), Saldo Kas Bulan Ini, Perlu Tindakan
   (agregat), Event Mendatang 7 Hari
2. Grafik tren Pemasukan vs Pengeluaran 30 hari (`IncomeExpenseChart`, client component recharts
   `AreaChart`)
3. Daftar "Perlu Tindakan" — 5 jenis action item lintas modul (invoice menunggu verifikasi, disbursement
   menunggu approval, registrasi event pending, stok produk rendah, pengajuan mitra pending), hanya baris
   dengan count > 0 yang tampil
4. Grid 7 `ModuleCard` (Keuangan, Anggota, Toko, Donasi, Event, Surat, Website+Media)
5. Quick actions — 6 link ke halaman "buat baru" yang sudah diverifikasi ada

**Komponen baru reusable** (project sebelumnya TIDAK punya `StatCard` sama sekali — semua halaman
termasuk `finance/dashboard/page.tsx` hand-roll markup stat card sendiri):
- `components/dashboard/stat-card.tsx` — KPI card dengan prop `tone` (neutral/positive/negative/warning)
- `components/dashboard/module-card.tsx` — card ringkasan modul, `children` bebas + link "Lihat Semua"
- `components/dashboard/income-expense-chart.tsx` — `"use client"`, wrapper tipis recharts

**Query gabungan `Promise.all` 21 query, bukan sequential**: beda dari pola `finance/dashboard/page.tsx`
(sequential `await` satu-satu) — di sini jumlah query jauh lebih banyak (lintas 7+ modul) jadi
paralelisasi penting untuk latency halaman. Query Anggota lewat `db` (public schema,
`tenantMemberships` scoped `tenantId = access.tenant.id`) — SEMUA query lain lewat `createTenantDb(slug)`.
Jangan tertukar dua sumber ini (lihat lesson lama soal ini di bagian Members module).

**Formula "Saldo Kas" dan "Perlu Tindakan (Keuangan)" di-replikasi PERSIS dari `finance/dashboard/page.tsx`**
(bukan diimpor — file itu tidak mengekspor logicnya sebagai fungsi) — pola duplikasi kecil yang sudah
berulang beberapa kali di project ini (`generateEventRegNumber`, `formatEventDateWib`), diterima supaya
modul dashboard baru tidak bergantung ke internal file `finance/dashboard/page.tsx`.

**Tren 30 hari — `GROUP BY DATE(...)`, bukan 30 query terpisah per hari**: 2 query (`payments` +
`disbursements`) masing-masing `GROUP BY DATE(confirmed_at/paid_at)`, hasil di-map ke `Map<string,number>`
lalu diisi ke array 30 hari penuh (hari tanpa transaksi = 0) di server sebelum dikirim ke client chart
component. Helper `normalizeDay()` menyamakan hasil grouping ke `"YYYY-MM-DD"` — perlu karena postgres.js
bisa mengembalikan `DATE()` sebagai JS `Date` object atau string tergantung driver, jangan asumsikan salah satu.

**Simplifikasi yang disengaja (dicatat, bukan lupa)**:
- Grouping tren pakai `DATE()` PostgreSQL (UTC-based), bukan `Asia/Jakarta` timezone-aware — cukup untuk
  grafik tren, TIDAK untuk laporan keuangan resmi (itu tetap di `/finance/laporan`).
- Threshold stok rendah di-hardcode `≤5` — belum ada setting per tenant untuk ini di manapun.
- "Pendaftaran event menunggu konfirmasi" dan link "Perlu Tindakan" lain diarahkan ke halaman list
  modul (bukan halaman filtered khusus) untuk item yang memang belum punya filter cross-entity di UI
  (event registrations tidak query-able lintas-event dari satu halaman manapun saat ini).

**Aturan untuk halaman ringkasan/dashboard baru ke depan**: kalau butuh stat card atau module summary
card, WAJIB pakai `<StatCard>`/`<ModuleCard>` dari `components/dashboard/` — jangan hand-roll markup
`rounded-xl border ... p-5` lagi seperti pola lama. `finance/dashboard/page.tsx` sengaja TIDAK
direfactor untuk pakai komponen ini di sesi ini (di luar scope) — kandidat cleanup terpisah kalau
diminta nanti.

**Bug runtime ditemukan saat verifikasi (bukan oleh `tsc`/build)**: `sql\`... >= ${startOfMonth}\`` —
interpolasi objek JS `Date` mentah ke dalam raw `sql` template tag (drizzle-orm) crash di driver
`postgres.js` saat binding parameter: `TypeError: The "string" argument must be of type string or an
instance of Buffer or ArrayBuffer. Received an instance of Date`. **`tsc --noEmit` dan `next build`
lolos sepenuhnya** — TypeScript tidak tahu ini SQL yang dikirim ke driver, error hanya muncul saat
query benar-benar dieksekusi ke DB. Fix: `${startOfMonth.toISOString()}` — string, bukan Date, di
dalam raw `sql\`...\``. **Aturan**: `gte(column, dateObj)` / `lte(column, dateObj)` (typed drizzle API)
aman menerima `Date` mentah — drizzle yang serialize. Tapi begitu Date diselipkan ke raw `sql\`...\``
template (biasanya karena butuh `COALESCE`/ekspresi custom yang tidak ada helper typed-nya), WAJIB
`.toISOString()` dulu. Ditemukan dengan cara menjalankan ke-21 query dashboard secara langsung
(bukan lewat browser) terhadap data lokal `pc-ikpm-jogjakarta` via script sekali-pakai — pola
verifikasi ini (eksekusi query nyata di luar UI saat tidak ada kredensial admin untuk browser-test)
lebih murah daripada menunggu error di production dan sebaiknya diulang untuk halaman data-berat
berikutnya yang tidak bisa di-browser-test langsung.

**Bug deploy kedua: `bun add --filter=@jalajogja/web recharts` salah taruh dependency di ROOT
package.json, bukan `apps/web/package.json`** — build lokal tetap lolos (hoisting dari root
`node_modules` masih resolve via Node module walk-up), tapi build VPS gagal
`Module not found: Can't resolve 'recharts'`. Root cause pasti tidak dikonfirmasi (kemungkinan
proses `bun install` di VPS tidak dijalankan ulang / environment lain), tapi diperbaiki permanen
dengan cara yang benar: `recharts` dipindah ke `apps/web/package.json` dependencies langsung
(package yang benar-benar mengimpornya), dihapus dari root. **Aturan**: dependency WAJIB
dideklarasikan di `package.json` workspace yang benar-benar mengimpornya (`apps/web`,
`packages/db`, dst) — root `package.json` bukan tempat parkir dependency baru meski `bun add
--filter=` kadang salah taruh di sana. Root package.json project ini sudah lama punya beberapa
dependency legacy di sana (`lucide-react`, `jsqr`, dll) yang seharusnya juga di `apps/web` — TIDAK
disentuh di sesi ini (di luar scope, sudah terlanjur bekerja via hoisting, risiko regresi kalau
dipindah tanpa alasan mendesak), tapi jangan tambah entry baru ke pola lama ini.

### [2026-07-16] Fix Footer Branding Leak ke Custom Domain (Item #1 Roadmap `arsitektur-domain.md`)

**Fix**: `dark-footer.tsx` + `light-footer.tsx` — baris atribusi "Jalakarta — developed with ❤️ by
Webane" dibungkus `{baseUrl !== "" && (...)}`. `baseUrl` sudah tersedia sebagai prop di kedua
komponen (dipakai untuk href logo) — cuma belum dipakai untuk gate baris ini. Baris "© {tahun}
{siteName}. All rights reserved." TIDAK diubah — tetap tampil di semua mode (itu copyright tenant
sendiri, bukan atribusi platform).

**Konteks**: temuan dari sesi evaluasi arsitektur domain menyeluruh (lihat entri sebelumnya +
`docs/arsitektur-domain.md`) — satu-satunya kebocoran identitas Jalakarta yang ditemukan aktif di
custom domain tenant, melanggar prinsip "satu domain = satu identitas" yang baru dikunci. Semua
permukaan lain (header, SEO canonical/OG, halaman login) sudah benar sejak awal.

**Keputusan produk terkait dicatat sekaligus** (§ 7.3 `arsitektur-domain.md`, untuk fitur
Admin-on-Custom-Domain yang BELUM dieksekusi): Opsi B (path-based, `{custom-domain}/admin`) dipilih
atas subdomain-based — nol SSL/DNS tambahan per tenant. Auth cross-domain: sesi terpisah per domain
(login manual) sebagai pendekatan awal — preferensi user "SSO kalau bisa, kalau tidak ya sudah,
login manual saja" secara teknis paling murah dipenuhi dengan sesi terpisah (cookie native memang
tidak bisa dibaca lintas domain berbeda). **Kedua keputusan ini planning saja — implementasi
Admin-on-Custom-Domain sendiri belum dijadwalkan.**

### [2026-07-16] Re-review `docs/arsitektur-domain.md` — 4 Referensi/Klaim Rusak Ditemukan & Dibenahi

User eksplisit minta dokumen dicek ulang sebelum eksekusi domain lanjutan ("agar tidak terjadi
error lagi"). Bukan sekadar baca ulang — hasil audit kritis menemukan dokumen yang baru ditulis
sendiri **sudah punya cacat** yang berpotensi menyesatkan eksekusi berikutnya:

1. **Referensi rusak**: § 1 menunjuk ke "§ 6.3" yang tidak ada (§ 6 tidak punya subsection
   bernomor). Seharusnya § 5.3 (bagian yang benar-benar membahas branding dashboard admin).
2. **Konten hilang yang masih direferensikan**: § 7.1 dan § 8.4 menyebut "§ 6, 'Fase D'" (usulan
   Caddy jangka panjang) — tapi saat menulis ulang dokumen, konten Fase D dari versi lama tidak
   ikut dibawa, jadi referensinya menunjuk ke tempat kosong. Fix: tambah § 6.1 berisi konten itu.
3. **Ambiguitas keputusan yang belum benar-benar final**: § 7.1 Opsi B menyebut DUA kemungkinan
   path (`{domain}/admin/*` ATAU `{domain}/app/*`) tanpa memilih satu — meski bagian "Keputusan"
   di bawahnya sudah menyebut path tunggal. Fix: pilih `/admin/*` secara eksplisit, hapus alternatif
   `/app/*` yang menggantung.
4. **Klaim teknis tidak diverifikasi**: Opsi B disebut berisiko "path-collision dengan konten
   publik tenant" tanpa bukti konkret. Diverifikasi: `app/(public)/[tenant]/[pageSlug]/page.tsx`
   memang catch-all 1-segmen yang PASTI bentrok kalau ada tenant dengan slug post/page/produk/
   campaign/event persis `admin`. Dicek ke DB dev lokal (nol collision) — **tapi belum dicek ke
   production**, dicatat eksplisit sebagai syarat wajib sebelum implementasi (bukan asumsi "aman").

**Staleness lintas dokumen juga ditemukan**: entri ringkasan di CLAUDE.md sendiri (bagian
"Evaluasi arsitektur domain/URL") masih bilang footer "Belum difix" dan "semua menunggu arahan
user" — padahal keduanya sudah berubah di sesi yang sama. Diperbaiki bersamaan. Juga ditemukan
`platform.jalakarta.com/login` (tanpa segmen `/platform`) di section "Tiga Level User" — URL yang
sebenarnya tidak pernah ada (rute asli `/platform/login`, path-based, kebetulan bisa diakses dari
subdomain manapun karena wildcard DNS, bukan karena ada routing terpisah). Diperbaiki.

**Aturan yang ditegaskan**: dokumen arsitektur yang ditulis dalam SATU sesi tetap wajib di-review
ulang sebelum dianggap "siap eksekusi" — menulis dokumen panjang dengan banyak cross-reference
antar section rawan menghasilkan referensi ke section yang berubah nomor/hilang saat proses
penulisan itu sendiri, terutama saat konten dipadatkan dari versi lama. Baca ulang dengan mode
"cari yang salah", bukan "baca ulang untuk konfirmasi", sebelum menyatakan dokumen final.

### [2026-07-16] Eksekusi Roadmap Domain Fase 1 — Koreksi Dokumen/Komentar Basi

Mulai eksekusi bertahap roadmap `docs/arsitektur-domain.md` § 9 (SOP: baca CLAUDE.md dulu → per
fase → cek `tsc`/build sebelum lanjut fase berikutnya → dokumentasikan sebelum fase berikutnya →
sinkron dokumentasi+kode sebelum commit/push). **Fase 1 = item #2+#3 roadmap**, keduanya
dokumentasi/komentar saja, zero risk terhadap perilaku aplikasi:

- `packages/db/src/schema/public/tenants.ts` — komentar salah "SSL sudah provisioned via Caddy"
  (baris 29, sekarang dikoreksi: DNS-check saja, SSL tetap manual Certbot+Nginx). Sekalian ditemukan
  komentar terkait yang salah nama domain — `app.jalajogja.com`/`{subdomain}.jalajogja.com`
  (mencampur nama repo `jalajogja` dengan brand domain publik `jalakarta.com`, pelanggaran langsung
  aturan penamaan yang sudah dikunci di CLAUDE.md — "Identitas Project"). Kedua komentar dikoreksi bersamaan
  karena satu kelas masalah (dokumentasi inline yang tidak pernah diupdate seiring project berjalan).
- `docs/panduan-custom-domain.md` — Langkah 6 ditulis ulang: sebelumnya menyuruh admin update status
  domain manual via psql atau "tombol Verifikasi DNS" yang tidak pernah ada di UI. Alur sebenarnya
  sudah otomatis (trigger saat simpan domain + cron fallback) sejak lama — panduan cuma telat
  diupdate. psql sekarang diposisikan sebagai jalur debug/darurat, bukan langkah wajib.

**Verifikasi**: `tsc --noEmit` + `bun run build --filter=@jalajogja/web` — 0 error, sesuai SOP
"cek error type sebelum boleh lanjut fase berikutnya". `docs/arsitektur-domain.md` § 9 (tabel
roadmap) dan § 8.4/8.6 diupdate status jadi ✅ Selesai bersamaan dengan commit ini — sinkron
dokumentasi-kode, bukan menyusul di sesi lain.

**Fase berikutnya (belum dieksekusi)**: item #4 (nasib `tenants.subdomain`) butuh keputusan user
dulu — implementasi Fase 2 subdomain routing sungguhan, atau sembunyikan field dari UI settings
sampai siap dikerjakan. Tidak dieksekusi sepihak karena mengubah perilaku produk, bukan sekadar
koreksi dokumentasi.

### [2026-07-16] Eksekusi Roadmap Domain Fase 2 — Sembunyikan Field Subdomain yang Mati Total

User memilih opsi "sembunyikan dulu" untuk item #4 roadmap (bukan implementasi Fase 2 sungguhan —
itu pekerjaan berjam-jam, di luar scope fase murah/cepat ini).

**Fix**: `components/settings/domain-settings-form.tsx` — fieldset "Subdomain jalakarta" (input
aktif + `useState` + onChange) diganti catatan statis "Segera hadir — subdomain belum bisa
diaktifkan. Gunakan Custom Domain di bawah untuk sekarang." `defaultValues.subdomain` tetap
di-pass-through (bukan hardcode kosong) saat memanggil `saveDomainSettingsAction` — supaya tidak
diam-diam menghapus data existing kalau ada tenant yang kebetulan pernah mengisinya. Kolom DB dan
server action TIDAK diubah — cuma UI edit yang dimatikan. `settings/domain/page.tsx` deskripsi
halaman ikut disesuaikan ("subdomain jalakarta segera hadir").

**Kenapa bukan hapus total**: field ini kandidat diaktifkan lagi begitu Fase 2 (routing subdomain
sungguhan) dikerjakan — mempertahankan kolom DB + plumbing server action (yang sudah benar) jauh
lebih murah daripada menghapus lalu membangun ulang nanti. Yang dihapus cuma bagian yang
**menyesatkan** (input yang terlihat berfungsi padahal tidak).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. `docs/arsitektur-domain.md` § 2 dan § 9
diupdate status jadi ✅ Selesai bersamaan dengan commit.

### [2026-07-16] Eksekusi Roadmap Domain Fase 3 — Konsolidasi `baseUrl` (16 File)

Item #5 roadmap `docs/arsitektur-domain.md` § 9 — refactor teknis murni (bukan keputusan produk),
dilanjutkan langsung tanpa perlu tanya user lagi sesuai arahan "eksekusi bertahap".

**2 helper baru**:
- `lib/resolve-base-url.ts` — `resolveBaseUrl(slug)`, async, server-only (`next/headers`). Cek
  `x-forwarded-host` dulu baru `host` — sebelumnya cuma `login/page.tsx` yang proxy-aware, sekarang
  berlaku universal (perbaikan kecil sekalian, bukan cuma dedup).
- `lib/use-base-url.ts` — `useBaseUrl(slug)`, `"use client"`, hook untuk komponen yang tidak punya
  akses `next/headers()`. Pola `useState(/${slug}) + useEffect koreksi` dipertahankan identik dari
  implementasi lama di tiap file (bukan pola baru).

**16 file diupdate** (semua pemanggil `isOwnHost()` langsung di `app/(public)/[tenant]/**` sebelum
fase ini): `layout.tsx`, `page.tsx`, `[pageSlug]/page.tsx`, `agenda/[slug]/page.tsx`, `login/page.tsx`,
`akun/layout.tsx`, `akun/page.tsx`, `akun/profesional/page.tsx`, `akun/usaha/page.tsx`,
`akun/pesantren/page.tsx`, `akun/media/page.tsx`, dan 5 file di `akun/mitra/**`.

**Kehati-hatian saat refactor mekanis lintas banyak file** — 3 jebakan yang dicek satu-satu per
file sebelum edit (bukan cari-ganti membabi buta):
1. Variabel `host`/`hdrs` kadang dipakai lagi di tempat lain dalam file yang sama (mis. untuk
   `auth.api.getSession({ headers: hdrs })` atau forward cookie ke internal fetch) — di file-file
   ini `headers()` call TETAP dipertahankan terpisah dari `resolveBaseUrl()`, cuma baris
   `isOwnHost(host) ? ... : ...`-nya yang diganti. Bukan hapus `headers()` secara membabi buta.
2. `useEffect` import kadang masih dipakai untuk hal lain di client component yang sama (mis. debounce
   search, fetch on mount) — dicek per file mana yang aman dihapus dari import dan mana yang harus
   dipertahankan.
3. `layout.tsx` punya turunan `isCustomDomain` dari `baseUrl` yang dipakai lagi di tempat lain (strip
   prefix nav menu) — diganti `baseUrl === ""` (setara secara logis, satu sumber, bukan hitung ulang
   `isOwnHost()` kedua kalinya).

**Verifikasi**: `tsc --noEmit` (0 error, 16 file sekaligus) + `bun run build` (sukses) + grep akhir
`isOwnHost(` di seluruh `app/(public)/[tenant]/` — nol hasil (satu-satunya pemanggil tersisa ada di
2 helper baru itu sendiri). `docs/arsitektur-domain.md` § 5.2/8.3/9 diupdate status ✅ Selesai
bersamaan dengan commit.

### [2026-07-16] Item #6 Sub-fase 1 — Middleware Admin-on-Custom-Domain (Opsi B)

Setelah cek collision slug `admin` di production (nol hasil, § 7.1 dokumen), user pilih lanjut
langsung ke implementasi sub-fase middleware (dari 3 sub-fase: middleware → branding → auth).
Fitur SECURITY-SENSITIVE — dikerjakan hati-hati, tsc+build dicek sebelum commit seperti biasa.

**`middleware.ts` — cabang baru di dalam blok custom domain** (`!isOwnHost(host)`), ditempatkan
SEBELUM guard blanket `/app/*`+`/platform/*` yang sudah ada (guard lama TIDAK diubah — carve-out
sempit dan eksplisit untuk `pathname === "/admin" || pathname.startsWith("/admin/")` saja):

1. Resolve slug SELALU dari `Host` header request ini sendiri (fungsi baru
   `resolveCustomDomainSlug()`, reuse endpoint `/api/internal/resolve-domain` yang sama dengan
   flow publik) — TIDAK PERNAH dari path. Ini kunci keamanannya: `/admin/*` di sebuah custom
   domain cuma bisa membuka dashboard tenant PEMILIK domain itu, tidak pernah tenant lain — kelas
   celah yang sama persis dengan yang ditutup 2026-07-08 untuk `/app/*` biasa (lesson "Custom
   Domain Harus Diisolasi").
2. Guard cookie sesi (`better-auth.session_token`) dicek proaktif di cabang ini juga, mencerminkan
   guard `/app/*` yang sudah ada — bukan cuma diserahkan ke layout dashboard (yang tetap jalan
   sebagai lapis kedua/defense-in-depth karena rewrite tetap merender route yang sama).
3. Kalau `slug` tidak resolve (domain belum/tidak aktif) → fallback `jalakarta.com/app/login`
   (tidak ada konteks tenant untuk diarahkan kemana pun di domain itu).
4. Kalau resolve sukses tapi belum login → rewrite ke `/app/{slug}{restPath}`.

**Temuan penting yang menyederhanakan implementasi**: visitor belum login di-redirect ke `/login`
**di domain custom itu sendiri** (bukan `jalakarta.com/app/login`), dan ini langsung bekerja tanpa
menyentuh `login-form.tsx` sama sekali, karena dua infrastruktur yang sudah lebih dulu ada saling
melengkapi: (a) cookie sesi Better Auth di-scope oleh `Host` header saat proses login (sudah difix
sesi sebelumnya, lesson "Login di Custom Domain — Better Auth CSRF") — jadi login via
`{custom-domain}/login` otomatis menghasilkan cookie yang valid untuk `{custom-domain}/admin/*`
juga; (b) `login-form.tsx` sudah punya `window.location.href = redirectTo || baseUrl/akun` — begitu
saja sudah mendarat balik ke path admin asli setelah login sukses. **Ini sekaligus jawaban natural
untuk keputusan "auth cross-domain: sesi terpisah per domain" (§ 7.3) — tidak perlu bangun
mekanisme SSO/token-exchange apapun, infrastruktur existing sudah cukup.**

**Duplikasi kecil yang disengaja**: `resolveCustomDomainSlug()` menduplikasi ~15 baris logic fetch
yang sudah ada di blok resolve-domain publik di bawahnya dalam file yang sama, alih-alih di-share
lewat refactor. Trade-off sadar: custom domain content routing adalah jalur PALING kritis di
seluruh aplikasi (kalau rusak, semua tenant dengan custom domain langsung down) — mengubahnya demi
menghindari duplikasi ~15 baris dianggap risiko lebih besar daripada manfaatnya. Konsisten dengan
pola duplikasi-demi-isolasi yang sudah berulang di project ini (`generateEventRegNumber`,
`formatEventDateWib`, dst — selalu didokumentasikan eksplisit, bukan kelupaan).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error, bundle middleware naik wajar (32.9→33.1
kB). `docs/arsitektur-domain.md` § 7.2/7.3/9 diupdate status bersamaan dengan commit — sub-fase 1
dari 3 selesai, sub-fase 2 (branding dashboard tenant-branded di `/admin/*`, § 5.3) dan sub-fase 3
(auth, ternyata sudah otomatis terselesaikan di sub-fase 1) dicatat statusnya di roadmap.

### [2026-07-16] Item #6 Sub-fase 2 — Branding Dashboard Admin Kondisional per Domain

Sub-fase terakhir dari 3 (middleware+auth sudah selesai di sub-fase 1). Dashboard admin
sebelumnya SELALU platform-generic (avatar inisial `bg-primary` Jalakarta, tanpa logo tenant,
footer statis "jalakarta v0.1", tanpa injeksi CSS tema tenant sama sekali) — beda dengan
`PublicLayout` yang sudah tenant-branded penuh untuk front-end publik.

**Fix — kondisional, bukan selalu-aktif** (sesuai Prinsip #1: domain sendiri boleh co-branding
Jalakarta, custom domain tidak boleh sama sekali):
- `(dashboard)/app/[tenant]/layout.tsx` deteksi `isCustomDomainAdmin` dari `Host` header
  (`!isOwnHost(host)`) — reliable karena rewrite middleware sub-fase 1 tidak mengubah `Host`,
  cuma `pathname`. Akses via `jalakarta.com/app/{slug}/*` → tidak berubah sama sekali. Akses via
  `{custom-domain}/admin/*` → fetch `general.logo_url` + `display.primary_color` tenant, inject
  `<style>` scoped ke class baru `.tenant-admin-branded` (override `--primary`/`--primary-foreground`).
- `foregroundFor()` di `lib/theme-palette.ts` di-export (sebelumnya private) — dipakai ulang untuk
  hitung warna teks kontras di atas `primary_color`, bukan reimplementasi logic WCAG luminance yang
  sudah ada.
- `Sidebar`/`MobileSidebar`: prop baru `logoUrl` (render `<img>` tenant kalau ada, fallback ke
  huruf inisial seperti semula) + `showPlatformFooter` (sembunyikan "jalakarta v0.1" saat
  tenant-branded).

**Scope sengaja dibatasi** — cuma logo + primary color + hilangkan atribusi platform, TIDAK ikut
font/secondary color/tema penuh seperti `buildTenantThemeCss()` di front-end publik. Dashboard
admin tetap prioritaskan konsistensi UI internal (pengurus yang kelola banyak tenant familiar
dengan satu layout) di atas replikasi brand penuh — beda tujuan dari front-end publik yang memang
harus terasa 100% milik tenant untuk pengunjung awam. Scope ini sudah ditetapkan di dokumen
sebelum implementasi dimulai (§ 7.2 poin 2), bukan penyempitan sepihak saat coding.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. `docs/arsitektur-domain.md` §
5.3/7.2/7.3/9 diupdate status ✅ Selesai untuk seluruh item #6 (ketiga sub-fase) bersamaan dengan
commit — **roadmap domain (9 item) sekarang 100% selesai dari sisi kode**. Rekomendasi eksplisit
dicatat di § 9: uji manual di production dengan 1 tenant custom domain nyata sebelum dianggap
production-ready penuh — belum ada automated end-to-end test untuk alur `/admin/*` lengkap
(routing + auth + branding sekaligus).

### [2026-07-16] Bug ditemukan saat uji manual: `visikita.com/admin` 404 — `/app/{slug}` bare bukan route valid

Persis rekomendasi "uji manual production" di atas langsung menemukan bug nyata — bukti kenapa
rekomendasi itu ditulis eksplisit, bukan formalitas. `visikita.com/admin` (path bare, tanpa
sub-path) → 404.

**Root cause**: `apps/web/app/(dashboard)/app/[tenant]/` **tidak punya `page.tsx` di root** —
hanya `layout.tsx` + subfolder (`dashboard/`, `members/`, dst). `/app/{slug}` (bare) **tidak pernah
jadi route valid sejak migrasi URL Fase 1** — dashboard selalu diakses via `/app/{slug}/dashboard`
secara eksplisit di semua link internal (sidebar, dst), tidak pernah ada fallback redirect bare→
dashboard baik di `next.config.ts` maupun middleware. Middleware `/admin` (sub-fase 1) yang baru
dibuat menghitung `restPath = pathname === "/admin" ? "" : ...` → untuk `/admin` bare, target jadi
`/app/{slug}` (bare) → 404, mewarisi gap yang sudah lama ada tapi baru sekarang punya entry point
publik yang benar-benar dipakai (sebelumnya tidak ada yang pernah mengarah ke path bare itu).

**Fix**: `restPath = pathname === "/admin" || pathname === "/admin/" ? "/dashboard" : pathname.slice(...)`
— bare `/admin` di-map eksplisit ke `/app/{slug}/dashboard`, bukan diteruskan apa adanya.

**Aturan**: sebelum membuat rewrite/redirect baru ke sebuah base path, **selalu verifikasi base
path itu sendiri (tanpa sub-path apapun) benar-benar punya `page.tsx`** — jangan asumsikan
"tentu ada root page-nya" untuk route group yang sudah lama ada. Route group besar yang sudah
matang (seperti dashboard admin di sini) kerap TIDAK punya root page kalau semua akses internalnya
selalu eksplisit ke sub-route tertentu — gap ini baru kelihatan saat ada entry point BARU yang
mengasumsikan base path itu valid.

### [2026-07-16] Bug Besar Kedua: CORS Error di Semua Link Dashboard — Opsi C, Bukan Refactor Total

Setelah bug bare-path di atas difix, uji manual lanjutan menemukan masalah jauh lebih besar:
**seluruh link sidebar/navigasi di dalam `/admin/*` memicu CORS error** ("Redirect is not allowed
for a preflight request") dan melempar user keluar ke `jalakarta.com` begitu diklik — bukan cuma
kosmetik, ini merusak TUJUAN UTAMA fitur (tetap di domain sendiri).

**Root cause**: seluruh dashboard admin (ratusan file di `(dashboard)/app/[tenant]/**` — sidebar,
semua modul, semua server action) hardcode path absolut `/app/{slug}/...` untuk link/redirect/
revalidatePath — wajar, karena sampai sesi ini dashboard cuma pernah hidup di `jalakarta.com`. Saat
dirender via rewrite `/admin/*` di custom domain, browser meresolve path absolut itu terhadap
**origin saat ini** (`visikita.com`, bukan `jalakarta.com`) — Next.js Link prefetch (IntersectionObserver)
langsung memicu fetch ke `visikita.com/app/{slug}/...`, yang kena guard blanket "`/app/*` di custom
domain → redirect jalakarta.com" yang sudah ada sejak sub-fase 1 — redirect lintas-origin di tengah
CORS preflight request = diblokir browser (CORS melarang redirect pada preflight, bukan cuma pada
request sesungguhnya).

**Dua opsi yang dipertimbangkan** (dipresentasikan ke user via `AskUserQuestion`, bukan diputuskan
sepihak — perubahan sebesar ini butuh keputusan user):
- **(A) Refactor total**: terapkan pola `baseUrl`-aware ke semua link/redirect di seluruh dashboard
  admin — sebanding migrasi URL Fase 1-4 dulu (127 `redirect()` + 131 `revalidatePath()`), effort
  multi-sesi.
- **(C) Opsi C** (ditemukan setelah user awalnya memilih opsi A, dibawa kembali karena secara
  fungsional setara dengan effort jauh lebih kecil): izinkan `/app/{slug}/*` render LANGSUNG di
  custom domain (tidak diredirect) asal `{slug}` di path cocok dengan slug yang di-resolve dari
  `Host` header request itu sendiri — verifikasi TETAP by-Host, bukan by-path, jadi tidak membuka
  celah cross-tenant apapun (kelas keamanan yang sama dijaga persis seperti guard `/admin/*`).
  Karena semua link dashboard SUDAH menulis format `/app/{slug}/...`, begitu format itu diizinkan
  render, SEMUA link otomatis jalan tanpa satu file pun disentuh.

**User memilih ulang ke Opsi C** setelah kedua opsi dijelaskan dengan trade-off yang jujur — bukan
saya putuskan sendiri meski awalnya user sempat memilih opsi A (refactor total) sebelum opsi C
ditemukan/dipresentasikan.

**Implementasi Opsi C**: `middleware.ts`, di dalam blok custom domain, guard blanket `/app/*` diberi
pengecualian — hitung `ownSlug = await resolveCustomDomainSlug(host)` dan `pathSlug =
pathname.split("/")[2]`, kalau cocok → **tidak** `return` (biarkan eksekusi jatuh alami ke guard
cookie `/app/*` standar yang sudah ada di bagian bawah fungsi middleware, diperlakukan identik
dengan request `/app/*` di `jalakarta.com` sendiri).

**Trade-off yang disetujui secara eksplisit**: address bar berubah dari `/admin/...` ke
`/app/{slug}/...` begitu user klik menu pertama kali — middleware tidak bisa memaksa browser
menampilkan URL berbeda dari yang tertulis di `href` pada client-side navigation (fakta teknis, bukan
keterbatasan implementasi yang bisa dihindari tanpa refactor). **Branding (Host-header-based, § 5.3)
dan "tetap di domain sendiri" tetap terjaga penuh** meski path berubah — tujuan fungsional utama
fitur ini tercapai, cuma bukan lewat address bar yang konsisten estetis.

**Aturan yang ditegaskan**: kalau menemukan opsi baru yang secara fungsional setara tapi jauh lebih
kecil scope-nya SETELAH user sudah memilih opsi yang lebih besar, **bawa kembali ke user** dengan
penjelasan jujur — jangan diam-diam eksekusi pilihan lama yang ternyata boros, tapi juga jangan
diam-diam ganti ke opsi baru tanpa izin. Sampaikan trade-off, biarkan user memutuskan ulang dengan
informasi lengkap.

### [2026-07-16] Bug Susulan Opsi C: "Tidak `return`" Salah Asumsi Soal Kode Setelahnya

Deploy pertama Opsi C menghilangkan CORS error (benar), tapi menggantinya dengan 404 di semua link
dashboard (`/app/visikita/pengurus` dst). Ditemukan dan difix di hari yang sama.

**Root cause**: implementasi awal menulis "kalau `allowOwnApp` true, JANGAN `return` — biarkan jatuh
ke guard cookie `/app/*` standar yang sudah ada di bagian bawah fungsi middleware". Asumsi ini SALAH
— antara blok itu dan guard cookie di bagian bawah, MASIH ADA kode lain yang juga berada di dalam
`if (!isOwnHost(host)) { ... }` yang sama: blok resolve-domain untuk KONTEN PUBLIK biasa. Tanpa
`return` eksplisit, eksekusi jatuh ke blok itu, bukan ke guard cookie yang dimaksud — dan blok
publik itu salah rewrite `/app/visikita/pengurus` jadi `/visikita/app/visikita/pengurus` (concat
slug + pathname asli, 4 segmen, tidak match route manapun) → 404.

**Fix**: `return NextResponse.next()` eksplisit ditambahkan tepat setelah verifikasi
`allowOwnApp`+cookie sesi selesai — TIDAK mengandalkan fall-through sama sekali. Guard cookie sesi
juga dipindah jadi dicek LANGSUNG di cabang ini (duplikasi kecil dari guard standar di bawah),
bukan berharap eksekusi "nyasar" ke sana.

**Aturan yang ditegaskan (generalisasi dari bug ini)**: dalam fungsi middleware/handler panjang
dengan banyak `if` block bersarang, **JANGAN PERNAH mengandalkan "tidak return = otomatis lanjut ke
kode yang saya maksud"** — trace ulang SECARA EKSPLISIT kode apa saja yang ada di antara titik saat
ini dan titik yang dituju, terutama kalau keduanya berada di dalam blok kondisional yang sama
(seperti `if (!isOwnHost(host)) { ... }` di sini). Kalau tujuannya adalah "lewati semua kode lain di
blok ini, lanjut ke kode SETELAH blok ini", satu-satunya cara yang benar adalah `return` eksplisit
dengan response yang sesuai (`NextResponse.next()`) — bukan mengandalkan fall-through implisit.

### [2026-07-16] Dokumentasi Arsitektur — Pisahkan "Riwayat Debugging" dari "Cara Kerja Final"

Setelah 3 bug berurutan ditemukan+difix dalam satu sesi uji manual (Admin-on-Custom-Domain, lihat
entri di atas), `docs/arsitektur-domain.md` § 7 sempat jadi "battle log" — daftar bernomor yang
mencampur "ini desainnya" dengan "lalu ketemu bug, difix, ketemu bug lagi, difix lagi" secara
inline. Pembaca baru (termasuk sesi Claude berikutnya) harus mem-replay seluruh riwayat debugging
di kepala hanya untuk memahami perilaku akhir yang benar — padahal riwayat itu sudah tidak relevan
untuk operasional, hanya relevan untuk pembelajaran.

**Fix**: pisahkan dua audiens berbeda ke dua tempat berbeda:
- **§ 7.2 (baru, "Implementasi Final")** — HANYA mendeskripsikan cara kerja final: alur routing
  (diagram ASCII bernomor), keamanan, auth cross-domain, branding, trade-off yang disetujui. Tidak
  ada satu kalimat pun tentang "awalnya salah begini, lalu..." — ditulis seolah tidak pernah ada
  bug sama sekali, karena dari sudut pandang operasional sekarang memang tidak ada.
- **§ 8.1 ("Riwayat bug nyata")** — daftar bernomor ringkas (root cause + fix, 2-3 baris per bug)
  untuk konteks/pembelajaran, ditutup pointer eksplisit "Deskripsi lengkap cara kerja FINAL (bukan
  riwayat perbaikannya): § 7.2." — supaya pembaca yang butuh operasional tidak nyasar ke sini.

**Aturan untuk dokumentasi arsitektur ke depan**: setelah sesi debugging yang menghasilkan beberapa
iterasi fix untuk fitur yang sama, WAJIB dilakukan pass terpisah "convert to final-state" sebelum
dianggap selesai — jangan biarkan dokumen tumbuh sebagai log kronologis selamanya. Kronologi bug
tetap berharga (pola yang sama bisa terulang di fitur lain, § 8.1 sudah beberapa kali jadi rujukan
begitu), tapi taruh di section terpisah yang eksplisit ditandai "untuk konteks, bukan operasional" —
jangan campur dengan deskripsi cara kerja yang harus dibaca cepat oleh siapapun yang menyentuh
fitur ini di masa depan.

### [2026-07-16] Audit Branding — Nol "Jalajogja"/"Jalagon" di Luar Folder/Git/VPS

User eksplisit: aplikasi harus konsisten bernama **Jalakarta** di semua permukaan — dua nama brand
lama ("jalajogja", "jalagon") tidak boleh muncul lagi, KECUALI di tiga kategori yang sengaja
dipertahankan: nama folder/repo, konfigurasi git, dan path/kredensial di VPS. Audit dilakukan
dengan grep case-insensitive menyeluruh (`jalajogja`, `Jalagon`) di seluruh repo, bukan hanya
front-end — mencakup juga dokumentasi (`docs/*.md`, `CLAUDE.md`, `AGENTS.md`) sesuai permintaan
eksplisit user.

**Ditemukan & difix (bocor ke user/pembaca):**
- `apps/web/app/layout.tsx` — `metadata.title = "Jalajogja"` — **browser tab title di SETIAP
  halaman non-tenant** (root, platform, admin fallback). Fix → `"Jalakarta"`.
- `apps/web/app/page.tsx` — stub landing page `<h1>Jalagon</h1>` (brand lama sebelum "jalajogja"
  bahkan, dua generasi nama lama sekaligus). Fix → `<h1>Jalakarta</h1>`.
- `apps/web/app/(platform)/platform/(protected)/users/new/page.tsx` — placeholder input email
  `"email@jalajogja.com"`. Fix → `"email@jalakarta.com"`.
- `packages/db/migrations/0003_military_ken_ellis.sql` — **bukan cuma komentar, ini SEED DATA**:
  `addons.description` untuk add-on `webhook-out` berisi teks "Kirim event jalajogja ke sistem
  eksternal..." — string ini ter-INSERT ke production DB dan tampil di halaman katalog add-on admin
  (`/app/{slug}/settings/addons`). Fix di file migration (untuk instalasi baru) — **row yang sudah
  ada di production DB TIDAK ikut berubah otomatis**, perlu `UPDATE public.addons SET description =
  '...' WHERE slug = 'webhook-out'` manual jika ingin data production juga dikoreksi (belum
  dieksekusi — perlu akses VPS yang tidak tersedia dari environment ini).
- Komentar kode di `packages/db/src/helpers/finance.ts`, `schema/public/{addons,index,members,
  modules,pesantren}.ts` — semua menyebut "jalajogja" sebagai brand/platform (bukan folder), diganti
  "jalakarta".
- Komentar di 5 file migration lain (`0004`, `0005`, `0006`, `0010`) — termasuk `0005` yang secara
  historis salah menulis domain planning sebagai `app.jalajogja.com`/`*.jalajogja.com` (persis pola
  bug yang sama dengan yang sudah pernah difix di `tenants.ts` schema comment, lihat lesson
  Fase 1 domain roadmap) — dikoreksi ke `jalakarta.com`.
- **21 judul dokumen** `docs/arsitektur-*.md` — pola `# Judul — jalajogja` di baris pertama, diganti
  `— jalakarta` secara massal (title-line only, bukan isi dokumen).
- Puluhan baris prosa brand-reference tersebar di `arsitektur-backbone-ikpm.md`, `arsitektur-akun.md`
  (termasuk ASCII diagram box `SUPER ADMIN JALAJOGJA`), `arsitektur-donasi.md`,
  `arsitektur-keanggotaan.md`, `arsitektur-login-universal.md`, `arsitektur-keuangan.md`,
  `arsitektur-template-post-card.md`, `arsitektur-gowa-deployment.md`, `arsitektur-whatsapp.md`,
  `arsitektur-website.md` (termasuk contoh domain stale `app.jalajogja.com`/`{subdomain}.jalajogja.com`
  di tabel Fase 1-2 dan snippet kode `host === "app.jalajogja.com"`) — semua diganti "jalakarta".
- `docs/arsitektur-header-footer-publik.md` — pernyataan "bukan jalajogja — sedang dalam proses
  rebranding" (menyiratkan proses belum selesai) diganti frasa final yang konsisten dengan CLAUDE.md
  ("folder/repo tetap `jalajogja` — nama internal, tidak pernah tampil ke user"), sekaligus
  ditambahkan catatan cross-reference ke § 5.1 `arsitektur-domain.md` (baris atribusi footer memang
  disembunyikan di custom domain — dokumen ini sebelumnya tidak menyebutkan itu sama sekali, stale).
- `AGENTS.md` (file instruksi untuk agent Codex, duplikat lama dari CLAUDE.md, terakhir diupdate
  2026-05-16) — set fix identik: title tidak diubah, tapi baris "Identitas Project" yang sebelumnya
  cuma `- Nama: jalakarta` (tanpa penjelasan folder/repo) diperkuat jadi frasa penuh yang sama dengan
  CLAUDE.md; 11 baris prosa brand-reference lain diganti dengan pola line-targeted sed yang sama.
- `docs/arsitektur-domain.md:49` — deskripsi stub landing page yang menyebut `<h1>Jalagon</h1>`
  sekarang stale setelah fix di atas — diupdate untuk mencerminkan kondisi kode terkini + catatan
  historis bahwa itu nama brand lama.

**Sengaja DIPERTAHANKAN (masuk 3 kategori eksklusi user):**
- **Folder/package**: `@jalajogja/db`, `@jalajogja/web`, `@jalajogja/types`, `@jalajogja/ui` (npm
  workspace specifier, ratusan file import) — mengubah ini setara refactor sekelas migrasi Fase 1-4
  URL, dan bertentangan langsung dengan keputusan terkunci "folder/repo tetap jalajogja — jangan
  campur". `package.json`/`bun.lock` "name" field, sama alasan.
- **VPS**: `/var/www/jalajogja` (semua bentuk), `pm2 (restart|delete|logs) jalajogja` (nama proses
  PM2, match `ecosystem.config.cjs`), `POSTGRES_USER`/`POSTGRES_DB` default fallback di
  `docker-compose.yml` dan `.env.example`, docker volume name `jalajogja_gowa_data`/
  `jalajogja_minio_data`, `WHATSAPP_API_USER=jalajogja` (kredensial Basic Auth GOWA yang benar-benar
  dipakai di VPS — mengganti teks doc tanpa mengganti env var production akan bikin dokumentasi
  menyesatkan, bukan lebih benar).
- **Git**: `git clone .../jalajogja.git` di `docs/deployment-guide.md`.
- **Historical record yang sengaja mengutip teks salah**: 3 tempat di CLAUDE.md/`arsitektur-domain.md`
  §8.4 yang mendokumentasikan bug lama (`app.jalajogja.com` yang ditemukan+difix) — mengubah kutipan
  "before"-nya akan merusak keakuratan catatan sejarah bug tsb, jadi dibiarkan sebagai string literal
  di dalam backtick.
- `# CLAUDE.md/AGENTS.md — jalajogja Project Brain` (judul dokumen) + baris "Nama platform: Jalakarta
  (folder/repo tetap `jalajogja` — jangan campur)" — ini JUSTRU dokumentasi eksplisit tentang
  konvensi penamaan itu sendiri, bukan pelanggarannya.

**Verifikasi**: `tsc --noEmit` 0 error, `bun run build --filter=@jalajogja/web` sukses. Grep akhir
(`jalajogja` case-insensitive minus known-exception patterns) hanya menyisakan baris yang masuk 3
kategori eksklusi di atas — nol "Jalagon" tersisa di manapun kecuali satu catatan historis yang
sengaja menyebutnya sebagai nama brand yang sudah tidak dipakai.

**Aturan ke depan**: setiap teks baru yang menyebut nama brand platform ke pembaca/user (UI, docs,
komentar kode yang menjelaskan "milik siapa" sesuatu) WAJIB pakai "Jalakarta" — bukan "jalajogja"
atau "jalagon". Pengecualian hanya untuk: import specifier `@jalajogja/*`, path `/var/www/jalajogja`,
proses PM2 `jalajogja`, nama database/user Postgres default, dan git remote/clone URL.

### [2026-07-16] Header Baru "Pill (Modern)" — Alur Kerja Ambil Desain dari Referensi Eksternal

**Konteks**: user diskusi soal keragaman desain antar tenant tanpa mengorbankan performa (lihat
`docs/arsitektur-frontend-publik.md` § 4 untuk hasil diskusi arah "tambah variasi komponen" vs
"theme engine terpisah" — opsi pertama dipilih). User punya 1 desain landing page lengkap yang
dibuat pakai tool AI design terpisah ("Claude design"), minta diambil per-bagian: header dulu, lalu
footer, lalu hero.

**Folder `design-refs/` dibuat** (root repo, di luar `apps/` — Next.js tidak pernah membaca folder
ini, nol dampak build) sebagai tempat parkir file sumber desain + `README.md` yang mendokumentasikan
alur kerja untuk sesi mendatang: satu folder per desain, source file taruh di situ, Claude Code baca
lalu **pecah per bagian** (bukan ambil 1 file jadi 1 "tema" utuh) — konsisten dengan arsitektur kita
yang berbasis komponen lepas (header/footer/section independen, bukan theme monolitik ala WordPress).

**Format file sumber ternyata bukan HTML biasa**: file `.html` yang di-download dari tool AI design
tsb adalah **self-contained "bundle"** — HTML asli + semua asset (font, JS) di-encode base64 di dalam
`<script type="__bundler/manifest">` (JSON per-UUID asset) dan `<script type="__bundler/template">`
(JSON STRING berisi seluruh markup, di-unpack via JS saat file dibuka di browser). Membaca file
mentahnya langsung tidak berguna — markup asli tidak terlihat, ter-escape di dalam JSON string.
**Cara decode**: parse kedua script tag itu sebagai JSON (regex extract by `type` attribute), dump
`template` JSON string apa adanya ke file `.html` baru (sudah unescaped otomatis oleh `JSON.parse`).
Script sekali-pakai ditulis ke `/tmp` (bukan disimpan permanen — bukan bagian dari alur kerja
standar, cukup didokumentasikan di sini kalau pola file sejenis muncul lagi).

**Desain sumber juga bukan React/HTML polos** — pakai sintaks templating kustom milik tool tsb
(`{{ variable }}`, `<sc-if>`, `<sc-for>`, `sc-camel-on-click`, `<image-slot>`, class `Component
extends DCLogic` dengan `state`). **Tidak bisa disalin-tempel jadi kode kita** — yang diambil cuma
struktur DOM, class Tailwind-equivalent, token desain (warna/spacing/radius), dan urutan elemen;
logic interaktif (cart, search, dialog) dibangun ulang pakai infrastruktur kita sendiri (server
action, `authClient`, dst), bukan port logic `DCLogic` sumbernya.

**Header baru: `pill-header.tsx`** (design id `"pill"`, label "Pill (Modern)") — dipasang ke
`lib/header-designs.ts` (tambah ke `HEADER_DESIGN_IDS`) + `public-header.tsx` (tambah `case`), pola
identik dengan cara `flex`/`classic` terdaftar — TIDAK ada perubahan di `website-settings-client.tsx`
karena picker UI sudah generik (map atas `HEADER_DESIGN_IDS`). Detail visual: logo badge kotak
(`rounded-xl`, beda dari 2 desain lain yang lingkaran), nav kapsul, ikon bulat search/cart, search
sebagai **overlay dialog** (bukan input inline seperti FlexHeader), mobile pakai **overlay
full-screen** (bukan bottom-nav/drawer seperti 2 desain lain) — dokumentasi lengkap di
`docs/arsitektur-header-footer-publik.md` § "Desain 3: Pill Header (Modern)".

**Warna/font TIDAK disalin dari sumber** — desain sumber pakai warna aksen merah-oranye hardcoded
(`#ec3013`) dan font "Archivo"; header baru kita 100% pakai `bg-primary`/`text-primary-foreground`
(CSS variable tema tenant) dan warisi `--font-heading`/`--font-body` seperti header lain — supaya
otomatis ikut warna/font organisasi manapun yang memilihnya, bukan terkunci ke tampilan mockup asli.
**Aturan ini berlaku untuk footer dan hero yang menyusul**: ambil struktur/bahasa desain, bukan nilai
warna/font mentahnya.

**`CartButton` diberi prop opsional `className`** (default `"hidden md:flex"`, sama persis perilaku
lama) — perubahan additive supaya header baru bisa override jadi selalu tampil (`className="flex"`)
tanpa mengubah perilaku `FlexHeader`/`ClassicHeader` yang sudah ada dan tidak pass prop ini.

**Verifikasi**: `tsc --noEmit` + `bun run build --filter=@jalajogja/web` — 0 error, build sukses.
**Belum diverifikasi visual di browser** — environment sesi ini tidak punya Docker/Postgres lokal
untuk jalankan dev server penuh + login admin untuk pilih desain baru di `/settings/website`. User
perlu cek tampilan sungguhan di dev machine sendiri sebelum dianggap final secara visual.

**Sisa pekerjaan dari desain yang sama**: footer dan hero section belum diambil — `design-refs/
jalakarta-v2/decoded.html` (hasil decode, sudah plain HTML terbaca) dan `assets-manifest.json`
sengaja DIPERTAHANKAN di repo (bukan dihapus setelah dipakai) supaya sesi berikutnya tidak perlu
decode ulang dari file bundle mentah.

### [2026-07-16] Footer Baru "Modern (Melengkung)" — Bagian ke-2 dari `design-refs/jalakarta-v2/`

Lanjutan langsung dari lesson header "Pill (Modern)" di atas — bagian kedua (footer) dari urutan
header→footer→hero yang diminta user. Sumber desain, alur decode, dan aturan "ambil struktur bukan
warna/font mentah" identik dengan lesson sebelumnya, tidak diulang di sini.

**`footers/modern-footer.tsx`** (design id `"modern"`, label "Modern (Melengkung)") — terdaftar ke
`lib/footer-designs.ts` (`FOOTER_DESIGN_IDS`) + `public-footer.tsx` (`case` baru), pola identik
dengan cara `dark`/`light` terdaftar. Beda utama dari `dark`/`light` yang sudah ada BUKAN cuma warna
(dark vs light itu sendiri sudah cuma beda warna, struktur identik) — `modern` beda **layout**: 1
baris grid 3-kolom (brand+sosmed | nav | kontak) dengan sudut atas melengkung (`rounded-t-[32px]`),
menggantikan pola 2-section-2-baris (identitas+social CTA lalu nav+kontak, dipisah `border-t`) yang
dipakai `dark`/`light`. Ekstraksi data kontak (email/phone/whatsapp/address/socials via
`SocialLinks`) disalin persis dari `DarkFooter` — termasuk duplikasi lokal `normalizePhone()`,
mengikuti pola self-contained yang sudah ada sejak `dark-footer.tsx`/`light-footer.tsx` (setiap file
header/footer independen, tidak saling import helper satu sama lain).

**Header `pill-header.tsx` dan footer `modern-footer.tsx` dirancang match secara visual** (logo mark
kotak `rounded-lg`/`rounded-xl` di keduanya, dari sumber desain yang sama) **tapi technically
independen** — admin boleh pasang header Pill dengan footer Dark, atau header Classic dengan footer
Modern, kombinasi bebas. Ini konsisten dengan prinsip "komponen lepas, campur-cocok" yang sudah
dikunci sejak awal (bukan "tema" berpasangan wajib ala WordPress) — lihat diskusi di
`docs/arsitektur-frontend-publik.md` § 4 soal kenapa pendekatan ini dipilih di atas theme engine.

**Verifikasi**: `tsc --noEmit` + `bun run build --filter=@jalajogja/web` — 0 error, build sukses.
**Belum diverifikasi visual di browser** — sama seperti header, environment sesi ini tidak punya
dev server penuh untuk cek tampilan sungguhan.

**Sisa pekerjaan**: hero section (bagian ke-3 dari desain yang sama) belum diambil.

### [2026-07-16] Hero Section — dari 0 Varian ke Sistem Design Registry (Bagian ke-3 + Perbaikan Gap)

Sebelum bagian ke-3 (hero) dari `design-refs/jalakarta-v2/` diambil, user tanya "kita sudah punya
berapa variasi hero?" — jawabannya **NOL**. Beda dari Posts/Produk/Event/Campaign yang masing-masing
sudah punya registry `lib/{type}-section-designs.ts` + 3-5 pilihan desain sejak awal, `HeroSection`
selama ini **inline langsung di `landing-template.tsx`**, hardcoded satu layout, `HeroEditor` tidak
punya picker desain sama sekali — satu-satunya section type yang belum ikut pola universal
Card+Section (`docs/arsitektur-frontend-publik.md` § 4). User eksplisit minta ini "diperbaiki"
sebelum lanjut ambil desain baru — jadi task ini gabungan **perbaikan gap arsitektur lama** +
**tambah desain baru dari referensi**, bukan cuma yang kedua.

**Refactor (gap lama)**:
- `lib/hero-section-designs.ts` (baru) — registry persis pola `posts-section-designs.ts`:
  `HeroSectionData` (field sama persis dengan yang sudah ada, tidak ada field baru),
  `HERO_SECTION_DESIGN_IDS = ["1","2"]`, `HERO_SECTION_DESIGNS` (label+deskripsi), plus
  `HERO_MODULES` (data strip 4 modul, dipindah dari const lokal di landing-template.tsx supaya bisa
  dipakai bersama oleh kedua desain) dan `HeroCardData`/`HeroDesignProps` types.
- `components/website/public/sections/hero/` (baru, folder mengikuti pola `sections/posts/` dst):
  `hero-section.tsx` (dispatcher async — fetch `heroCard` sekali, dispatch by `variant`),
  `hero-design-1.tsx` (ekstraksi 1:1 dari implementasi lama — **tidak ada perubahan visual/behavior**
  untuk tenant yang sudah pakai hero, murni pemindahan kode), `hero-design-2.tsx` (baru).
- `landing-template.tsx` — inline `HeroSection` (196 baris) dihapus total, diganti import dari lokasi
  baru; dispatch `case "hero"` sekarang pass `variant={(section.variant ?? "1") as
  HeroSectionDesignId}` — pola identik persis dengan `posts`/`products`/`events`/`campaigns` yang
  sudah lebih dulu benar. Import `desc/eq/gt/and` (drizzle-orm) dan 4 ikon lucide yang cuma dipakai
  inline HeroSection lama ikut dihapus (tidak ada lagi pemakai lain di file itu, dicek via grep
  sebelum hapus — bukan asumsi).
- `components/website/section-editors.tsx` — `HeroEditor` sekarang terima `variant, onVariantChange`
  dari `EditorProps` (props ini SUDAH di-passthrough generik dari `SectionEditDialog` ke semua
  editor sejak awal — cuma `HeroEditor` yang belum memanfaatkannya), tambah blok picker desain
  (button list radio-style) — copy persis UI block yang sama dari `PostsEditor`.

**Kenapa aman tanpa migrasi DB**: `createSection()` di `lib/page-templates.ts` SELALU set
`variant: "1"` untuk section baru sejak awal ditulis — termasuk hero, meski field itu selama ini
diabaikan oleh kode render. Jadi semua landing page existing yang sudah punya section hero **sudah**
tersimpan dengan `variant: "1"` di database — begitu kode baru deploy, otomatis ke-resolve sebagai
Desain 1 (Klasik) yang perilakunya identik dengan sebelumnya. Zero data migration, zero breaking
change untuk tenant existing.

**Hero Design 2 (Full-Bleed Modern)** — sumber ide dari `design-refs/jalakarta-v2/`, TIDAK ada field
data baru ditambahkan ke `HeroSectionData` (dipakai bersama persis dengan Desain 1) — cukup dirender
berbeda: gambar `imageUrl` full-bleed sebagai background section (fallback gradasi
`neutral-900→primary/40` kalau kosong, bukan dipaksa selalu ada gambar), scrim gradient gelap untuk
keterbacaan teks putih, CTA sekunder pakai `variant="light"` (PublicButton — literally didesain
untuk "kontras di section gelap/hero" per CLAUDE.md § Public Button System, bukan kebetulan cocok).
**Fitur dari sumber yang SENGAJA tidak diikuti**: tagline slider (prev/next arrow siklus 3 teks) —
data model kita cuma 1 `subtitle` string, bukan array taglines, dan stats bar yang di sumber
overlap di bawah hero — itu section terpisah (`stats` section type SUDAH ada sejak awal), bukan
bagian hero, jadi tidak digabung supaya section boundary tetap bersih.

**`renderAccentTitle()` diekstrak jadi shared helper** (`lib/render-accent-title.tsx`) — sebelumnya
`renderCtaTitle()` cuma fungsi lokal 4 baris di `landing-template.tsx` dipakai `CtaSection` (sintaks
`*teks*` → `<em>`). Dipakai ulang di `hero-design-2.tsx` untuk aksen judul, BUKAN duplikasi —
berbeda dari pola "duplikasi demi isolasi" yang biasa dipakai di project ini (mis. tiap
header/footer file self-contained): helper ini pure string-parsing tanpa efek samping/DB, risiko
share mendekati nol, jadi di-share sesuai akal sehat, bukan default duplikasi.

**Verifikasi**: `tsc --noEmit` (0 error, termasuk setelah penghapusan import besar-besaran di
`landing-template.tsx` — dicek ulang tidak ada pemakai lain sebelum hapus) + `bun run build` sukses.
**Belum diverifikasi visual di browser** — sama seperti header/footer sebelumnya.

**Trilogi selesai**: header (Pill), footer (Modern), hero (Full-Bleed Modern) — ketiganya dari
sumber desain yang sama (`design-refs/jalakarta-v2/`), independen satu sama lain (bisa dikombinasi
bebas dengan desain manapun, bukan 1 paket "tema"). Sisa dari desain sumber ini yang belum diambil
(section Ekosistem/rail horizontal, Berita dual-layout, Toko grid, dll) — lihat isi lengkap di
`design-refs/jalakarta-v2/decoded.html` kalau user minta lanjut lagi nanti.

### [2026-07-16] Evaluasi Desain Trilogi — 4 Fix dari Feedback User Langsung

Setelah header Pill + footer Modern + hero Full-Bleed Modern selesai dibangun, user minta
"evaluasi" — 4 titik feedback konkret, semuanya CSS/markup murni, tidak ada perubahan data model
atau server logic:

**1. Logo vs teks nama tenant — kalau logo ada, teks disembunyikan total** (`pill-header.tsx` +
`modern-footer.tsx`). Sebelumnya logo DAN teks nama tenant selalu tampil berdampingan. Sekarang:
`logoUrl` terisi → cuma logo. `logoUrl` kosong (tenant belum upload) → fallback badge inisial +
teks tetap tampil (satu-satunya cara identitas tenant terbaca tanpa logo). Baris "© {tahun}
{siteName}" di footer TIDAK ikut disembunyikan — itu bukan pasangan logo, beda konteks.

**2. Hero Design 2 kurang tinggi** — `min-h-[480px] sm:min-h-[560px] lg:min-h-[640px]` →
`min-h-[560px] sm:min-h-[680px] lg:min-h-[800px]`. Breakpoint terbesar sekarang tepat di 800px
sesuai angka yang diminta user, breakpoint kecil ikut naik proporsional (bukan cuma ganti angka
terbesar) supaya rasio antar breakpoint tetap masuk akal.

**3. Kartu mengambang hero Design 2 menempel ke ujung** — sebelumnya `right-4 bottom-0
translate-y-1/2` (nempel ke tepi kanan + separuh badan straddle garis batas bawah section, nyaris
menyentuh sudut). Fix: `right-10 lg:right-16 bottom-10 lg:bottom-14` tanpa `translate-y-1/2` —
kartu sekarang benar-benar mengambang di DALAM area gambar hero dengan jarak jelas dari kanan
maupun bawah, bukan nempel ke frame.

**4. Nav mobile Pill Header terlalu besar** (`MobileOverlay` di `pill-header.tsx`) —
`font-bold text-2xl` (24px, tebal) dianggap kasar/berat untuk mobile menu. Fix: `font-normal
text-[17px]` (regular, 17px) + `py-4` (dari `py-3.5`, sedikit lebih lega). Ditambah `border-t
border-border` pada wrapper list (sebelumnya cuma `border-b` per item — list nampak "menggantung"
tanpa batas atas yang jelas) — sekarang list nav punya bingkai atas+bawah yang rapi, tiap item
tetap dipisah `border-b` seperti sebelumnya.

**Alur kerja sesi ini beda dari biasanya**: user eksplisit minta "edit dulu, jangan di-push" untuk
titik feedback #1 (logo/teks) — dieksekusi + `tsc` dicek, TAPI TIDAK di-commit/push saat itu,
menunggu review user. Baru setelah user lanjut kasih 3 feedback lagi (hero height, kartu
mengambang, nav mobile) dan bilang "cek error, dokumentasi, dan commit push" — baru semua 4 fix
(termasuk yang tertunda) di-commit+push sekaligus dalam satu commit. **Aturan yang ditegaskan**:
kalau user bilang "jangan di-push" secara eksplisit, itu instruksi SEKALI PAKAI untuk giliran itu
saja — bukan mode permanen sampai instruksi baru "boleh push" diberikan secara eksplisit. Begitu
user memberi sinyal lanjut komit (baik eksplisit "commit push" atau implisit lewat permintaan baru
yang mengasumsikan kerjaan sebelumnya sudah final), commit boleh jalan mencakup SEMUA perubahan
uncommitted yang relevan, bukan cuma yang di request terbaru.

**Verifikasi**: `tsc --noEmit` + `bun run build --filter=@jalajogja/web` — 0 error, build sukses
untuk seluruh 4 fix. Belum diverifikasi visual di browser (keterbatasan environment sesi ini yang
sudah dicatat berulang di lesson-lesson sebelumnya — tidak diulang detailnya di sini).

### [2026-07-16] Strip Modul Jadi Section Independen + Funfact Dinamis di Hero Desain 2

User minta strip 4-modul yang tadinya cuma bisa hidup di dalam hero (`showModuleStrip` boolean,
`HERO_MODULES` hardcoded 4 item) dipisah jadi section landing sendiri yang dinamis (admin pilih
modul dari katalog lebih lengkap — tenant sekarang juga punya direktori Usaha/Profesional/
Pesantren yang tidak pernah bisa ditonjolkan lewat strip lama). User eksplisit koreksi rencana awal
(yang tadinya mau hapus `showModuleStrip` sepenuhnya): **boolean-nya JANGAN dihapus** — tetap ada,
tapi diinterpretasi beda per desain hero: **Desain 1 (Klasik) tidak disentuh sama sekali** (strip
modul lama, perilaku identik); **Desain 2 (Full-Bleed Modern)** — toggle yang SAMA sekarang berarti
"Funfact": statistik dihitung LIVE dari database (bukan diketik manual admin), admin pilih maks 4
dari katalog metrik. Instruksi eksplisit: **abaikan referensi visual `design-refs/jalakarta-v2/`**
untuk fitur ini — gaya visual funfact mengikuti `StatsSection` yang sudah ada di app.

**Alur kerja sesi ini**: karena scope-nya besar (arsitektur baru + banyak file), masuk **Plan Mode**
dulu — 1 Explore agent riset paralel (pattern `stats` section, query cross-schema direktori publik,
konvensi icon), lalu draft plan lengkap, verifikasi manual nama kolom/tabel via grep langsung
(bukan cuma percaya laporan agent), baru `ExitPlanMode` untuk approval user sebelum mulai coding.

**Section "Strip Modul" baru (`modules`)** — independen dari hero, terdaftar sebagai section type
biasa (`lib/page-templates.ts`), sama seperti `posts`/`products`/dst:
- `lib/module-strip-designs.ts` (baru) — `MODULE_CATALOG` 8 modul (Donasi/Toko/Event/Dokumen/
  Anggota/Usaha/Profesional/Pesantren). **Sengaja file TERPISAH dari `HERO_MODULES`** di
  `hero-section-designs.ts` — supaya hero Desain 1 benar-benar nol dependency baru, konsisten
  dengan instruksi "jangan sentuh hero lama". Icon Usaha pakai `Building2` (bukan `Briefcase` yang
  dipakai halaman `/usaha` sendiri) — dua icon beda supaya tidak collide visual dengan Profesional
  dalam satu strip yang sama.
- `sections/modules/modules-section.tsx` (baru) — render markup KARTU YANG SAMA PERSIS dengan strip
  modul lama di hero, disalin sebagai render independen (bukan di-share via import) — alasan sama:
  isolasi total dari hero lama.
- `ModulesEditor` di `section-editors.tsx` — checklist multi-select, tanpa reorder (MVP, urutan
  render ikut urutan tetap `MODULE_CATALOG`).
- `ModulesWireframe` di `section-wireframes.tsx` — wajib ditambahkan karena `WIREFRAME_MAP` dan
  `EDITOR_MAP` bertipe `Record<SectionType, ...>` — TypeScript menolak build kalau lupa (exhaustive
  check otomatis, bukan langkah manual yang bisa kelewat tanpa ketahuan).

**Funfact di Hero Desain 2** — field `funfactItems?: string[]` baru di `HeroSectionData` (field
lama TIDAK dihapus, cuma nambah). `FUNFACT_CATALOG` (10 metrik) di `hero-section-designs.ts`:
- **Bug ditemukan+difix saat implementasi**: deklarasi awal `FUNFACT_CATALOG: Record<string, {label:
  string}>` — anotasi tipe eksplisit ini MENGHILANGKAN literal key inference (`keyof` dari
  `Record<string,...>` = `string`, bukan union 10 key spesifik) → `switch(id)` di resolver TypeScript
  tidak bisa membuktikan exhaustive → error "Function lacks ending return statement". Fix: hapus
  anotasi tipe, pakai `as const` saja (pola sama dengan `HERO_MODULES`/`MODULE_CATALOG`) — biarkan
  TypeScript infer literal type dari object literal. **Aturan digeneralisasi**: kalau butuh
  `keyof typeof X` menghasilkan union literal (bukan `string` polos) untuk exhaustiveness checking
  di switch statement, JANGAN kasih anotasi tipe eksplisit yang lebih lebar (`Record<string,...>`)
  ke `X` — biarkan inferensi TypeScript jalan natural, pakai `as const` kalau perlu.
- `fetchFunfacts()` di `sections/hero/hero-section.tsx` — dipanggil HANYA kalau
  `variant==="2" && showModuleStrip && funfactItems.length`. 4 metrik (anggota/usaha/pesantren/
  profesional) butuh JOIN cross-schema ke `public.tenantMemberships` — pola query disalin PERSIS
  dari `app/(public)/[tenant]/{usaha,pesantren,profesional,anggota}/page.tsx` (verifikasi manual
  nama kolom sebelum coding, bukan asumsi dari research agent). `tenants.id` di-resolve LAZY (cuma
  query kalau ada metrik yang butuh) via `SELECT id FROM tenants WHERE slug=...`. 6 metrik lain
  (campaign/donasi_rp/event/produk/dokumen/post) query tenant-schema langsung, kolom status/
  visibility per tabel: `campaigns.status='active'`, `events.status='published'`,
  `products.status='active'`, `documents.visibility='public'`, `posts.status='published'`.
- `donasi_rp` pakai pattern `sql<string>\`coalesce(sum(...),0)\`` (established lesson lama, PostgreSQL
  aggregate selalu return string) + `formatRp()` dari `lib/campaign-card-templates.ts` — reuse, tidak
  reimplementasi formatter Rupiah baru.
- **Caching**: tidak ada penambahan apapun — homepage tenant sudah ISR-cached (~120 detik) dari
  infrastruktur `[pageSlug]` yang sudah ada, jadi funfact otomatis tidak dihitung ulang tiap request.
- Render funfact di `hero-design-2.tsx`: grid 4 kolom, gaya visual DISAMAKAN dengan `StatsSection`
  yang sudah ada di `landing-template.tsx` (`text-3xl font-bold text-primary` + `text-sm
  text-muted-foreground`) — bukan gaya kartu modul, dan bukan meniru mockup `design-refs/jalakarta-v2/`
  (instruksi eksplisit user untuk mengabaikannya).
- `HeroEditor` di `section-editors.tsx` — field "Strip Modul" sekarang bercabang `activeVariant ===
  "2"` (checklist funfact, maks 4 — checkbox lain di-disable begitu 4 terpilih) vs default (checkbox
  strip modul lama, TIDAK berubah). Pola percabangan-per-variant ini sudah ada presedennya di
  `PostsEditor` (`isHero`/`isTrio` conditional rendering) — bukan pola baru.
- **Drive-by fix**: label checkbox "Strip Modul" Desain 1 sebelumnya salah tulis "Donasi · Event ·
  Toko · Dokumen · Kabar" (isi placeholder lama dari sesi sebelumnya) padahal `HERO_MODULES` yang
  sesungguhnya cuma Donasi/Agenda/Dokumen/Anggota — dikoreksi jadi teks yang cocok dengan strip yang
  benar-benar dirender.

**Verifikasi**: `tsc --noEmit` (0 error, termasuk exhaustiveness check `Record<SectionType,...>` di
2 file registry) + `bun run build` sukses. `git diff --stat hero-design-1.tsx` dikonfirmasi KOSONG
(nol baris berubah) — syarat eksplisit dari user terpenuhi. Belum diverifikasi visual di browser.

### [2026-07-16] Funfact — 2 Posisi Tampilan (`funfactStyle`: inline vs floating)

Lanjutan langsung dari fitur Funfact di atas. User lihat referensi `design-refs/jalakarta-v2/`
punya stat bar yang **menggantung menimpa batas bawah hero** (`margin-top:-40px` di sumber asli —
teknik "kartu mengambang" yang sama dengan kartu event/berita yang sudah ada), beda dari funfact
yang sudah dibangun (mengalir normal di bawah gambar). Diminta jadi 2 opsi posisi yang bisa dipilih
admin, bukan ganti total.

**Field baru** `funfactStyle?: FunfactStyle` (`"inline" | "floating"`) di `HeroSectionData`
(`lib/hero-section-designs.ts`) — default `"inline"` kalau tidak diisi (fallback `??`, tidak perlu
migrasi data existing). `FUNFACT_STYLE_IDS` + `FUNFACT_STYLE_LABELS` di file yang sama.

**Render di `hero-design-2.tsx`** — dua cabang:
- `"inline"` (default, tidak berubah dari sebelumnya) — `max-w-7xl mx-auto px-4 pt-10 pb-2`, grid
  polos, mengalir normal di bawah blok gambar hero.
- `"floating"` (baru) — `relative z-10 -mt-14 md:-mt-20 mx-4 md:mx-auto md:max-w-5xl` lalu kartu
  `bg-background rounded-3xl shadow-2xl` di dalamnya. **Teknik negative margin, BUKAN
  `position: absolute`** — ditanya eksplisit oleh user ("posisinya absolut gitu kan?"), dijelaskan
  trade-off-nya: negative margin tetap ikut alur dokumen normal (lebih aman untuk responsive,
  tidak perlu atur lebar/tinggi manual seperti absolute), tapi menghasilkan visual "menggantung/
  menimpa" yang identik — ini teknik yang sebenarnya dipakai sumber referensi aslinya juga
  (`margin-top:-40px`), bukan `position:absolute`. `overflow-hidden` di `<section>` pembungkus
  tidak masalah karena kartu floating tetap ada DALAM bounds section (overlap ke area hero di
  atasnya, bukan keluar section).

**Editor**: toggle 2-pilihan (button list, pola sama dengan Design Layout picker) muncul di bawah
checklist metrik funfact, HANYA saat Funfact aktif (`d.showModuleStrip === true`) — kalau Funfact
dimatikan, toggle posisi ikut tersembunyi (tidak relevan).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. `hero-design-1.tsx` dikonfirmasi lagi
tetap kosong perubahannya (fitur ini 100% scoped ke Desain 2). Belum diverifikasi visual di browser.

### [2026-07-17] Strip Modul Desain 2 — Kartu Foto Overlay + Fallback Foto Berlapis

User minta Desain 2 untuk section "Strip Modul" (dibangun kemarin, single-design icon-only) — kartu
foto overlay ala rail "Ekosistem" di `design-refs/jalakarta-v2/`. Permintaan berkembang saat diskusi:
bukan cuma upload foto manual, tapi **fallback berlapis** — foto custom → kalau kosong, otomatis
foto dari item TERBARU modul itu (Donasi → cover campaign aktif terbaru, dst) → kalau masih kosong,
gradasi+ikon (dummy yang sudah ada). User tanya duluan "berarti nambah database ya?" — jawaban:
**tidak**, semua tetap JSONB di `pages.body` seperti section lain, cuma struktur `items` berubah
dari `string[]` jadi array object (bawa foto custom opsional).

**Alur kerja**: masuk Plan Mode lagi (2x dalam sesi ini) — 1 Explore agent riset kelayakan foto per
8 modul (cek kolom di 6 tabel berbeda: campaigns, products, events, documents, members,
member_businesses/professionals/owned_pesantren), lalu `AskUserQuestion` untuk 1 keputusan produk
yang genuinely ambigu (foto Anggota — privasi), baru tulis plan lengkap dan `ExitPlanMode`.

**Temuan riset penting — 2 modul TIDAK bisa auto-fallback**:
- **Dokumen**: schema `documents` sama sekali tidak punya kolom foto/thumbnail — cuma referensi
  file PDF (`currentVersionId → document_versions.fileId`). Bukan keputusan desain, murni
  keterbatasan data — tidak ada foto untuk diambil.
- **Anggota**: `members.photoUrl` ADA secara teknis, tapi user (ditanya via `AskUserQuestion`)
  pilih **skip auto-fallback** — foto pribadi satu individu bukan representasi organisasi yang
  pantas untuk kartu promosi, beda konteks dengan foto usaha/event/produk yang memang representatif.
  Kedua modul ini masuk konstanta `MODULES_NO_AUTO_PHOTO` di `lib/module-strip-designs.ts` — admin
  masih bisa upload foto custom untuk keduanya, cuma tidak ada fallback otomatis.

**Field foto per modul TERNYATA tidak seragam** — 3 pola berbeda ditemukan saat riset (bukan
diasumsikan sama semua):
- Campaigns/Events: `coverId` → FK ke `media`, perlu resolve via `getImageUrl()` (helper yang
  sudah ada di `lib/image-url.ts`, reuse langsung — sama persis pola yang dipakai halaman publik
  `/campaign` dan `/agenda`).
- Products: `images` JSONB array, `images[0].variants.large` atau `.url` sudah URL penuh (lesson
  lama: "images JSONB dari MediaPicker sudah URL penuh — jangan `publicUrl()` lagi").
- Usaha/Profesional/Pesantren (public schema, member_businesses/professionals/owned_pesantren):
  `coverUrl` — sudah URL penuh, query cross-schema via JOIN `tenantMemberships` (pola identik
  `fetchFunfacts` di `hero-section.tsx`, termasuk lazy-resolve `tenants.id`, reuse langsung).

**Query "item terbaru" juga beda semantik per tipe** (bukan asal `ORDER BY createdAt DESC` semua):
- Donasi/Toko: `status='active'`, `ORDER BY createdAt DESC` (campaign/produk aktif terbaru dibuat).
- Event: `status='published' AND startsAt > NOW()`, `ORDER BY startsAt ASC` — **event MENDATANG
  terdekat**, bukan "terbaru dibuat" — pola sama persis `heroCard` di hero (konsisten dengan
  keputusan lama: untuk event, "relevan" = akan datang, bukan kapan record dibuat).
- Semua query filter `IS NOT NULL` pada kolom foto SEBELUM `ORDER BY ... LIMIT 1` — supaya yang
  terpilih adalah entri terbaru YANG PUNYA foto, bukan sekadar entri terbaru apa adanya (entri
  terbaru tanpa foto akan terlewat, entri lebih lama tapi punya foto yang dipakai).

**Struktur file** — pola dispatcher yang identik persis dengan Hero (`ModulesSection` sekarang jadi
async dispatcher, bukan komponen presentasional murni seperti sebelumnya):
- `modules-design-1.tsx` (baru) — ekstraksi 1:1 dari `ModulesSection` versi kemarin, zero
  perubahan visual, cuma dipindah lokasi + terima props `title`/`items`/`baseUrl` alih-alih `data`.
- `modules-design-2.tsx` (baru) — `"use client"` (rail scroll perlu ref+onClick tombol prev/next),
  murni presentasional, terima `imageUrl` yang SUDAH resolved dari dispatcher (tidak query DB
  sendiri) — pola sama `HeroDesign2` yang terima `funfacts` sudah jadi.
- `modules-section.tsx` — dispatcher + `resolveModuleImages()`, sekarang butuh `tenantClient`+
  `tenantSlug` (sebelumnya cuma `data`+`baseUrl`) — `landing-template.tsx` diupdate untuk pass itu.

**Editor** (`ModulesEditor` di `section-editors.tsx`) — perubahan terbesar dari semua editor section
sejauh ini: checklist modul sekarang per-item punya tombol "Upload Foto" sendiri (state
`pickerForId: ModuleId | null` — SATU `MediaPicker` dipakai bergantian untuk semua item, bukan satu
picker per item, supaya tidak render N dialog sekaligus), plus keterangan status tiap item ("Foto
custom" / "Otomatis dari item terbaru" / "Tanpa foto — otomatis gradasi+ikon" untuk 2 modul
`MODULES_NO_AUTO_PHOTO`) — supaya admin paham kenapa Dokumen/Anggota beda perlakuan tanpa perlu baca
dokumentasi.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error dari percobaan pertama (semua nama
kolom/tabel sudah diverifikasi manual saat riset+plan, bukan ditebak saat coding). Belum
diverifikasi visual di browser.

### [2026-07-17] Bug Review Pasca-Commit: Backward-Compat `items` string[] → object[]

User minta cek ulang error/bug setelah commit Desain 2 Strip Modul di atas. Re-review manual
(bukan cuma `tsc`) menemukan **1 bug nyata, bukan hipotetis**: sesi ini mengubah bentuk
`ModulesSectionData.items` dari `string[]` jadi `ModuleItemConfig[]` (object, supaya bisa bawa
foto custom). Section "Strip Modul" dibuat SEHARI sebelumnya dan **user sudah sempat mengetes dan
mengonfigurasinya** (percakapan sebelumnya di sesi ini — user tanya kenapa "toko, event" tidak
muncul di list, artinya sempat menambah+centang modul) — jadi ada kemungkinan nyata data tersimpan
di format LAMA (`string[]`) di database tenant testing.

**Efeknya kalau tidak difix**: `item.id` pada elemen string bernilai `undefined` (string tidak
punya properti `.id`) →
- Di `modules-section.tsx`: filter `item.id in MODULE_CATALOG` selalu `false` → SEMUA item
  ter-filter habis → section render `null` (hilang total, tanpa error, silent).
- Di `ModulesEditor`: `selected.some(item => item.id === id)` selalu `false` → checklist yang
  sebelumnya sudah dicentang admin tampil KOSONG semua saat dibuka lagi.

**Fix**: `normalizeModuleItems()` baru di `lib/module-strip-designs.ts` — terima `unknown`, handle
KEDUA bentuk (`string` → `{id: string}`, object valid → pass-through, apapun selain itu →
dibuang). Dipakai di titik baca `data.items` di `modules-section.tsx` DAN `ModulesEditor`. Begitu
admin buka+simpan ulang section manapun yang masih format lama, otomatis ter-normalisasi ke format
baru saat disimpan (self-healing, tanpa migration script terpisah).

**2 fix kecil tambahan dari review yang sama**:
- `modules-design-2.tsx` — rail scroll cuma sembunyi scrollbar di Firefox
  (`style={{scrollbarWidth:"none"}}`), tidak di Chrome/Safari. Ditemukan juga: class `scrollbar-hide`
  yang dipakai di file LAIN (`products-design-3.tsx`) ternyata **tidak pernah didefinisikan di
  manapun** (dead class, no-op) — bukan bug yang saya buat, di luar scope untuk difix sekarang,
  tapi dicatat di sini supaya tidak dikira sengaja ditiru. Fix di file saya sendiri: tambah
  `[&::-webkit-scrollbar]:hidden` (Tailwind arbitrary selector, tidak butuh definisi CSS terpisah).
- `ModulesEditor` — list "Foto per Modul" sekarang filter `item.id in MODULE_CATALOG` sebelum
  render, mencegah crash kalau ada ID modul yang sudah tidak valid di data tersimpan (defensive,
  tidak bisa terjadi lewat alur UI normal saat ini, tapi murah untuk dicegah).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error.

**Pelajaran umum**: saat mengubah bentuk data JSONB untuk section/fitur yang BARU dibuat di sesi
yang sama, jangan asumsikan "belum ada yang pakai" hanya karena fiturnya baru — kalau user sempat
mengetesnya (bahkan cuma centang-centang di editor tanpa publish), data lama sudah tersimpan.
Selalu tambahkan normalisasi baca yang backward-compatible, atau tanya eksplisit ke user apakah
sudah pernah menyimpan data dengan bentuk lama, sebelum menganggap breaking change "aman tanpa
migrasi".

### [2026-07-17] Desain Kartu Campaign — Setting Grid/List/Ringkas + Info Block Polimorfik

> Arsitektur lengkap: **`docs/arsitektur-donasi.md` § 14j–14k**

User minta card donasi bisa "diubah-ubah desainnya" dan dijadikan default tenant-wide via
`/donasi/pengaturan`. Klarifikasi scope penting via `AskUserQuestion`: `CampaignCard` TERNYATA
sudah punya 3 variant layout (`grid`/`list`/`ringkas`, lengkap sejak § 11b) tapi cuma bisa dipilih
per-instance di section builder landing page — dua tempat lain (`/campaign` arsip,
"Campaign Lainnya" di halaman detail) hardcode `variant="grid"` tanpa setting. User pilih opsi
sempit: expose 3 variant yang SUDAH ADA sebagai default, bukan bikin sumbu desain visual baru.

**Putaran kedua — pertanyaan "berapa varian card qurban?"**: dari analogi WordPress user
(`content-donasi.php` yang di-*include* berulang), draf pertama saya membuat `CampaignCardQurban`
sebagai **komponen berdiri sendiri** (dispatch by `campaignType`, bukan by `variant`) — dilempar ke
user, TAPI direvisi lagi setelah user menunjukkan qurban akan terus berkembang (patungan, 1 ekor
penuh, tabungan — makin banyak sub-tipe ke depan). Card terpisah per sub-tipe × 3 layout = ledakan
kombinasi file. User secara eksplisit minta pendapat saya ("menurutmu lebih baik...?") — saya
rekomendasikan dan implementasikan **info block polimorfik**: badan card (cover/badge/judul/CTA)
tetap SATU untuk semua tipe, cuma satu slot kecil di tengah yang polimorfik.

**Arsitektur final — dua sumbu independen**:
```
CampaignCardGrid/List/Ringkas (badan card, tidak pernah berubah struktur):
  [Cover][Badge][Judul] → <CampaignCardInfoBlock info={campaign.infoBlock} layout="..."/> → [hari tersisa]
```
- Sumbu 1 (`variant`, § 14j) — layout: Grid/List/Ringkas, dipilih admin di `/donasi/pengaturan`
- Sumbu 2 (`infoBlock.kind`, § 14k) — isi info: `progress` (donasi umum) | `qurban_tersedia`
  (harga mulai dari + chip hewan + sisa slot) | `qurban_habis`. **Union sengaja dibiarkan terbuka**
  untuk `qurban_patungan`/`qurban_tabungan` nanti — tabungan belum ada schema-nya sama sekali,
  tidak dibangun sekarang, cukup tambah 1 varian union + 1 `case` render nanti, TIDAK perlu
  redesain card lagi.

**`CampaignCardData.infoBlock` dihitung di 3 titik fetch** (bukan di komponen render) — pola batch
query untuk hindari N+1: `resolveQurbanInfoBlocks(tenantClient, qurbanCampaignIds[])` di
`lib/campaign-info-block.ts` — SATU query `inArray(qurbanAnimals.campaignId, ids)` untuk semua
campaign qurban di satu halaman sekaligus, bukan query per-campaign dalam loop.

**Field lama (`progressPercent`/`collectedAmount`/`targetAmount`) SENGAJA dipertahankan** di
`CampaignCardData`, tidak dihapus — dipakai `campaigns-design-2.tsx` (featured-hero block landing
page section) yang me-render manual sendiri di luar `CampaignCard`/3 titik fetch card biasa.
Menghapusnya akan memaksa refactor file itu juga — di luar scope sesi ini, aditif lebih aman.

**`CampaignCardList` butuh wrapper berbeda dari Grid/Ringkas**: `CampaignCardList` didesain untuk
layout vertikal (`border-t first:border-0` antar item) — kalau dipaksa masuk `grid grid-cols-3`
(wrapper yang dipakai Grid/Ringkas), tampilannya rusak (tiap "baris" terjepit ke dalam grid cell).
Fix: wrapper archive/related page jadi kondisional — `variant === "list" ? "flex flex-col" :
"grid grid-cols-..."`. Ini bukan scope creep, tapi syarat KOREKTNES supaya setting Grid/List/Ringkas
benar-benar berfungsi untuk ketiga pilihannya, bukan cuma Grid/Ringkas.

**Aturan yang dikunci untuk fitur "card dengan info bervariasi" ke depan**: kalau sebuah tipe entity
(campaign, nanti mungkin produk/event) butuh menampilkan informasi yang beda-beda tergantung
sub-tipe data (bukan cuma beda layout visual), JANGAN reflex bikin komponen card terpisah per
sub-tipe. Cek dulu apakah cukup satu slot kecil polimorfik (discriminated union + fungsi render
kecil switch-by-kind) di dalam badan card yang sudah ada — jauh lebih murah dirawat kalau sub-tipe
akan terus bertambah, dan tidak mengalikan jumlah file dengan jumlah varian layout yang sudah ada.

### [2026-07-17] Registry Desain Kartu Arsip Bernomor — Salah Baca Instruksi, Dikoreksi 2 Putaran

> Detail lengkap + versi final: **`docs/arsitektur-donasi.md` § 14m** (§ 14j dan § 14l dipertahankan
> sebagai catatan sejarah 2 putaran koreksi, keduanya ditandai SUPERSEDED — jangan diikuti)

**Rangkaian revisi di hari yang sama** (contoh nyata pentingnya baca instruksi kata-per-kata,
bukan menangkap "kira-kira maksudnya"):
1. **§ 14j** — setting admin pilih Grid/List/Ringkas (3 layout primitif yang sudah ada) sebagai
   default arsip. Dibangun lengkap, di-review user.
2. **§ 14l (SALAH BACA)** — user bilang *"design lain di card setting di laman /donasi/pengaturan
   bisa dihapus saja"* + *"grid ketika di desktop, dan list ketika di mobile"*. Saya baca ini
   sebagai "hapus SELURUH setting, hardcode grid-desktop/list-mobile langsung di kode" — dan
   mengeksekusinya (hapus file picker, hapus server action, hapus section di halaman pengaturan).
3. **§ 14m (KOREKSI USER)** — user tegur: *"kamu gk paham berarti maksud saya"*. Maksud
   sebenarnya: setting-nya JANGAN dihapus — yang dihapus cuma pilihan "List"/"Ringkas" SEBAGAI
   OPSI TERPISAH. Reframe: setting tetap ada, tapi isinya bukan "Grid/List/Ringkas" (3 layout
   primitif) melainkan **"Desain 1", "Desain 2", dst** (pola bernomor sama seperti Header/Footer/
   Hero/Strip Modul) — di mana **Desain 1 = apa yang sudah dibangun di langkah 2** (grid desktop/
   list mobile), dan **setiap desain baru yang ditambah nanti WAJIB tetap ikut aturan yang sama**
   (grid di desktop, list di mobile) — itu bukan pilihan admin, itu baseline konstrain untuk
   seluruh keluarga desain ini.

**Kalimat kunci yang saya lewatkan di baca pertama**: *"design default grid sekarang yg ada itu
design 1.. nanti kita mau bikin design grid lain"* — ini eksplisit bilang ada KONSEP "Design 1"
(implikasi: akan ada Design 2, 3, dst — butuh REGISTRY, bukan hardcode tunggal) dan
*"tapi setiap design grid ... sifatnya: grid ketika di desktop, dan list ketika di mobile"* — kata
**"setiap"** di sini adalah kuantor untuk SEMUA desain masa depan, bukan deskripsi satu perilaku
final yang meniadakan kebutuhan pilihan sama sekali.

**Fix final** (§ 14m): registry baru `lib/campaign-archive-card-designs.ts`
(`CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS = ["1"]`, pola sama `HERO_SECTION_DESIGN_IDS`) + dispatcher
`campaign-archive-cards.tsx` + `campaign-archive-cards-design-1.tsx` (isi = grid desktop/list
mobile, sama seperti hasil langkah 2 — TIDAK dibuang, cuma dibungkus jadi "Desain 1") + setting
baru `campaign_archive_design` (ganti nama dari `campaign_card_design` § 14j yang sudah tidak
dipakai) + picker `campaign-archive-design-settings-client.tsx` yang menampilkan "Desain 1 —
Klasik" dengan catatan "belum ada alternatif, akan ditambah nanti" (bukan disembunyikan/dihapus).

**Aturan yang ditegaskan ulang untuk sesi mendatang**: kalau instruksi user menyebut kata
**"desain 1"**, **"nanti kita bikin X lain"**, atau pola serupa yang mengimplikasikan
"ini yang pertama dari beberapa" — itu SELALU sinyal untuk bikin **registry bernomor** (list of
IDs + dispatcher), BUKAN nilai tunggal hardcode. Kalau ada keraguan antara "hapus fitur ini
total" vs "restrukturisasi fitur ini" saat instruksi user memakai frasa yang bisa dibaca dua arah
(seperti "bisa dihapus saja" yang ternyata merujuk ke SEBAGIAN pilihan, bukan keseluruhan sistem),
lebih aman **tanya ulang secara eksplisit** sebelum menghapus file/kode — terutama kalau fitur
yang dihapus baru saja selesai dibangun di sesi yang sama.

### [2026-07-17] Registry Desain Kartu Arsip Diterapkan ke Event + Produk

> Detail lengkap: **`docs/arsitektur-event.md` § "Registry Desain Kartu Arsip"**,
> **`docs/arsitektur-product.md` § "Registry Desain Kartu Arsip"**

Pola yang baru selesai dikunci untuk Donasi (§ 14m di atas) diterapkan ke 2 modul lain yang punya
arsitektur Card+Section identik — Event (`/agenda`) dan Produk/Toko (`/produk`). Post SENGAJA
tidak disentuh (permintaan eksplisit user — beda sistem, 6 variant card + 5 section design, lebih
kompleks, ditangani terpisah nanti).

**Koreksi proses di tengah kerjaan**: user menegur eksplisit ("jangan lupa, selalu cek claude.md
dan pastikan selalu buat dokumentasi sebelum eksekusi, jangan luput itu") saat saya mulai riset
kode Event/Produk tanpa menulis rencana ke `docs/arsitektur-event.md`/`docs/arsitektur-product.md`
dulu — padahal untuk Donasi saya SUDAH konsisten menulis plan-doc dulu sebelum eksekusi. Begitu
pindah modul di sesi yang sama, kebiasaan itu tidak otomatis terbawa. **Fix**: berhenti, tulis
rencana lengkap ke kedua file docs (konsep, gap infrastruktur, file yang akan dibuat/diubah,
urutan implementasi) — BARU lanjut baca kode/eksekusi. Disimpan sebagai memory
`feedback_docs_before_code.md` supaya ini otomatis diingatkan di sesi berikutnya juga.

**Gap yang ditemukan saat riset (dan kenapa 3 modul beda usaha)**:
- **Donasi**: grup setting `"donasi"` sudah ada — 0 migration DB.
- **Toko**: grup setting `"toko"` sudah ada (Sistem Mitra) — 0 migration DB. Tapi halaman
  `/toko/pengaturan` pakai pola form BERBEDA dari Donasi (satu `TokoSettings` object + satu tombol
  simpan untuk semua field, bukan beberapa `<section>` independen) — solusi: TIDAK memaksakan
  section baru masuk ke object yang sudah ada, cukup tambah `<section>` independen baru di bawah
  form yang sudah ada, dengan action+state sendiri. Dua gaya form boleh hidup berdampingan di satu
  halaman pengaturan yang sama.
- **Event**: grup setting `"event"` **belum ada sama sekali** — perlu (1) tambah ke
  `SETTING_GROUPS` const, (2) update DDL CHECK constraint di `create-tenant-schema.ts`, (3)
  migration SQL baru (`0031_settings_group_event.sql`, pola `DO $$ LOOP` per-tenant seperti
  `0020_event_ticket_requires_membership.sql`) — WAJIB dijalankan di VPS sebelum deploy kode yang
  menulis ke grup ini. Event juga belum punya halaman `/event/pengaturan` sama sekali — dibuat
  dari nol (page + actions + nav item baru "Pengaturan" di `event-nav.tsx`).

**Jumlah titik sentuh publik berbeda per modul** (jangan asumsikan seragam):
- Event: **1 titik** — `/agenda` saja. Tidak ada halaman kategori terpisah (filter kategori pakai
  query param `?category=`, bukan sub-route), tidak ada section "Event Lainnya" di halaman detail.
- Donasi: **2 titik** — arsip `/campaign` + "Campaign Lainnya" di detail.
- Produk: **3 titik** — arsip `/produk`, arsip kategori `/produk/kategori/{slug}` (sub-route
  sendiri, beda dari Event), dan "Produk Lainnya" di detail. Semua 3 titik pakai fetch logic
  yang hampir identik (copy-paste query builder) — konsisten dengan pola lama di modul ini.

**`ProductArchiveCards` dispatcher perlu terusin `sessionType`** — satu-satunya dispatcher dari 3
modul ini yang punya prop tambahan (Campaign dan Event tidak punya konsep tier harga per sesi
login). Kalau lupa terusin, `ProductCard` fallback ke `sessionType="none"` (default parameter) →
harga member/publik tidak resolve dengan benar walau user sudah login. Selalu cek signature
`{Type}Card` dispatcher yang di-copy sebelum asumsikan propsnya sama persis dengan Campaign.

**Kolom grid Desain 1 TIDAK diseragamkan ke 3 kolom** — Produk mempertahankan 4 kolom desktop
(sesuai desain existing sebelum fitur ini), Campaign/Event tetap 3. Yang diseragamkan cuma
PERILAKU RESPONSIF-nya (grid desktop/list mobile), bukan kepadatan visualnya — kepadatan grid
adalah keputusan desain per-konteks yang independen dari mekanisme responsifnya.

**Permission guard untuk setting BARU dibedakan dari setting LAMA di modul yang sama**: Toko
punya 2 action sekarang — `saveTokoSettingsAction` (existing, guard `canManageUsers` = owner/ketua
saja, karena berisi komisi mitra yang sensitif finansial) dan `saveProductArchiveDesignAction`
(baru, guard `hasFullAccess(u, "toko")` = siapapun dengan akses penuh modul toko, karena cuma
setting tampilan). Jangan otomatis re-use guard yang paling ketat di file yang sama kalau setting
barunya punya tingkat sensitivitas yang beda — pilih guard sesuai levelnya sendiri.

**Verifikasi**: `tsc --noEmit` dijalankan 2× (setelah Event selesai, sebelum lanjut Produk — sesuai
urutan di dokumen § "Urutan Implementasi" masing-masing modul) + `bun run build` full di akhir.
0 error di kedua titik cek.

### [2026-07-17] Desain 2 "Modern Capsule" — Ambil Visual dari Referensi, Bukan "Mesin"-nya

> Detail lengkap: **`docs/arsitektur-donasi.md` § 14n**

User upload folder desain baru `design-refs/Bantuanku/` (HTML biasa, bukan format bundler seperti
`jalakarta-v2/` sebelumnya — tidak perlu decode) dan minta card dari section "Aksi Prioritas"
diambil sebagai "Desain 2 — Modern Capsule" untuk campaign, dengan syarat: mobile jadi List di
arsip, tapi jadi Slider saat dipakai di section landing page (persis pola Desain 1 sebelumnya).

**Klarifikasi penting sebelum eksekusi**: card sumber punya badge urgensi ("MENDESAK"/"PRIORITAS")
— sistem kita TIDAK punya konsep urgensi campaign. Ditanya via `AskUserQuestion` (opsi: otomatis
dari sisa hari / field admin manual baru / skip total), user jawab lebih tegas dari 3 opsi yang
ditawarkan: *"yg kita ambil design card-nya, bukan mesin-nya... jadi kita ada donasi saja"* —
prinsip pemisahan **visual vs business-logic** dari referensi desain, konsisten dengan
`design-refs/README.md` ("warna/font hardcoded → diganti tema tenant") tapi diperluas ke level
konseptual: fitur yang TIDAK ADA datanya di sistem kita tidak dipaksakan hanya karena ada di
referensi visual — bukan cuma soal warna/font.

**Satu komponen kartu, dua manifestasi** (pola yang sama sudah dipakai Desain 1 sejak awal, tinggal
direplikasi): `CampaignCardCapsule` dipakai bersama oleh registry arsip (`CampaignArchiveCardDesignId
+= "2"`, grid desktop/List mobile — List REUSE `CampaignCardList` yang sudah ada, bukan versi
Capsule yang di-squeeze) DAN registry section landing (`CampaignsSectionDesignId += "4"`, grid
desktop/**Slider** mobile). Dua registry tetap independen (§ 14m) — cuma komponen KARTU-nya yang
dibagi, bukan pilihan desainnya.

**Field data baru `donorCount`** — batch resolver dual-source (`lib/campaign-donor-count.ts`),
pola identik `resolveQurbanInfoBlocks`: source legacy (`donations`+`payments` status paid) +
source cart (`invoiceItems`+`invoices` status paid), dijumlahkan per campaign. Bukan strict
distinct-by-identity — konsisten dengan donor list yang sudah ada di halaman detail (juga tidak
dedup).

**Info block area REUSE `<CampaignCardInfoBlock>` (§ 14k), bukan reimplementasi progress bar
sendiri** — konsekuensi langsung: Desain 2 otomatis dapat dukungan qurban (harga+ketersediaan
hewan, bukan progress bar Rp) tanpa satu baris kode qurban-spesifik ditulis di
`CampaignCardCapsule`. Ini bukti nyata kenapa keputusan "info block polimorfik" (§ 14k, bukan card
terpisah per tipe) terbukti tepat — desain visual baru bisa numpang infrastruktur info yang sudah
ada, alih-alih harus reimplementasi qurban-awareness dari nol setiap kali ada desain kartu baru.

**CTA di dalam card yang sudah `<a>` — precedent baru**: semua card existing di app ini (Campaign/
Produk/Event, ketiga variant masing-masing) adalah SATU `<a>` besar tanpa elemen interaktif di
dalamnya. Card Capsule butuh tombol CTA visual ("Donasi Sekarang") di dalam card yang sama —
nested `<a>`/`<button>` di dalam `<a>` adalah HTML tidak valid. Fix: `<span className="btn
btn-primary btn-md btn-full">` — visual saja (via sistem Public Button "Cara 1 — CSS class
langsung"), klik di mana pun pada card (termasuk area tombol) tetap navigasi lewat `<a>`
pembungkus. **Aturan untuk card baru ke depan**: kalau butuh CTA visual di dalam card-as-link,
selalu pakai `<span className="btn ...">`, jangan `<a>`/`<button>` sungguhan bersarang.

**Bug pre-existing ditemukan+difix sekaligus**: `CampaignsEditor` (section builder editor) tidak
pernah destructure `variant`/`onVariantChange` dari `EditorProps` — beda dari `HeroEditor`/
`PostsEditor`/`ModulesEditor` yang semua punya blok "Design Layout" picker. Artinya SEJAK
`CampaignsSectionDesignId` registry dibuat (3 desain, § 11b, jauh sebelum sesi ini), admin TIDAK
PERNAH bisa memilih desain section Campaign dari UI — selalu diam-diam terkunci ke Desain 1
default. Kalau tidak difix bersamaan, Desain 4 "Modern Capsule" yang baru dibangun juga tidak akan
pernah bisa dipilih dari UI — pekerjaan sia-sia. **Aturan**: sebelum menambah desain baru ke
registry manapun yang sudah ada > 1 pilihan lama, WAJIB verifikasi picker UI-nya benar-benar
berfungsi (bukan asumsi "kalau ada 3 desain terdaftar, berarti sudah bisa dipilih") — cek
`{Type}Editor` di `section-editors.tsx` benar-benar merender blok "Design Layout".

### [2026-07-17] Bug: `updatePageAction` Tidak Pernah Revalidate Halaman Publik

> Detail lengkap: **`docs/arsitektur-donasi.md` § 14n** (bagian "Evaluasi user pasca-implementasi")

User laporkan Desain 4 "Modern Capsule" sudah dipilih+disimpan di section builder landing page,
tapi front-end publik masih tampil desain lama. Diagnosa SEBELUM asumsi bug picker: trace ulang
`landing-builder.tsx` (`handleVariantChange` → `commit` → `onChange`) — plumbing generik ini
identik dengan Hero/Posts/Modules yang sudah terbukti jalan, jadi kemungkinan besar bukan di situ.
Root cause sebenarnya: `updatePageAction` (`website/actions.ts`, dipanggil form builder landing
page) **cuma** `revalidatePath` ke 2 path ADMIN (`/app/{slug}/website/pages*`) — TIDAK PERNAH ke
halaman publik. Beda dengan `saveCampaignArchiveDesignAction` (§ 14m, dibuat sesi sebelumnya) yang
sudah benar eksplisit `revalidatePath(\`/\${slug}/campaign\`)`. Landing page jadi 100% bergantung
ISR `revalidate = 60` — kalau dicek < 60 detik setelah simpan, terasa "tidak update sama sekali".

**Fix**: `updatePageAction` + `updatePageStatusAction` ditambah
`revalidatePath(\`/\${slug}\`)` (cover kasus halaman ini adalah homepage — homepage ditentukan
oleh setting `homepage_slug`, BUKAN slug tetap seperti "beranda") +
`revalidatePath(\`/\${slug}/\${slug_halaman}\`)` (cover kasus halaman biasa via
`[pageSlug]/page.tsx`). Fix ini generik untuk SEMUA section type (Hero/Posts/Modules/Campaigns/
dst) — bukan cuma Modern Capsule, karena gap-nya di level action, bukan di level fitur manapun.

**Belum difix (dicatat, di luar scope)**: `createPageAction`/`createPageDraftAction`/
`createSingletonPageAction`/`deletePageAction` di file yang sama juga tidak revalidate halaman
publik. Dampak lebih kecil (create biasanya draft dulu) tapi `deletePageAction` pada page yang
sudah published tetap kena gap serupa — tunggu instruksi user untuk fase berikutnya.

**Aturan yang ditegaskan**: setiap server action yang mengubah data yang dibaca halaman PUBLIK
(bukan cuma admin) WAJIB `revalidatePath` ke path publiknya juga — jangan cukup revalidate path
admin lalu berasumsi ISR timer akan "menyusul sendiri". Kalau ragu apakah sebuah action
butuh revalidate publik, cek: apakah ada halaman `(public)/[tenant]/...` yang query tabel yang
sama? Kalau ya, wajib direvalidate eksplisit, bukan diserahkan ke ISR.

**Cara mendiagnosis "kelihatannya bug fitur baru" yang ternyata bug lama**: sebelum menyalahkan
kode yang baru saja ditulis, trace ulang plumbing generik yang dipakai bersama fitur lain yang
sudah terbukti berfungsi (di sini: `landing-builder.tsx` dipakai SEMUA section type) — kalau
plumbing itu terbukti benar, root cause pasti ada di tempat lain yang lebih spesifik ke gejala
yang dilaporkan (di sini: satu-satunya perbedaan Campaigns dari fitur lain yang "sudah OK" adalah
archive punya `revalidatePath` eksplisit sementara landing page section builder tidak).

### [2026-07-17] "Desain 4" Landing Section Dihapus — Salah Paham Kedua di Fitur yang Sama

> Detail lengkap: **`docs/arsitektur-donasi.md` § 14o** (§ 14n bagian "dua manifestasi" ditandai
> SUPERSEDED, dipertahankan sebagai catatan sejarah)

Setelah fix `revalidatePath` (entri sebelumnya) di-deploy dan dikonfirmasi user, muncul ronde
klarifikasi KEDUA untuk fitur Modern Capsule yang sama: user sempat menulis penjelasan panjang
lalu salah klik hingga hilang, lalu menulis ulang lebih ringkas — *"design card yang kita buat
untuk arsip itu adalah card design untuk section donasi, sehingga konsisten antara card di
section landingpage dan card ketika menjadi arsip... kecuali nanti kita bikin design section
donasi yang mengharuskan atau membutuhkan card custom."*

**Yang sebenarnya diinginkan sejak awal** (baru jelas di ronde kedua): setting "Desain Kartu
Arsip" (§ 14m, Klasik/Modern Capsule) adalah **satu sumber kebenaran** — section landing "Grid
Donasi" harus OTOMATIS ikut setting itu, BUKAN dapat pilihan "Desain 4" terpisah sendiri di
registry landing section (yang saya bangun sebelumnya, § 14n). Perbedaannya konseptual: "Grid
Donasi" cuma LAYOUT (grid generik) — kartu di dalamnya seharusnya mengikuti keputusan
tampilan-kartu yang sudah ada, bukan jadi keputusan baru yang berdiri sendiri.

**Batas yang dikonfirmasi user sendiri** (bukan saya asumsikan): section landing dengan LAYOUT
custom (Desain 2 "Campaign Unggulan" — 1 featured besar + 2 kecil, markup sendiri bukan reuse
`CampaignCard`) **tetap independen**, tidak ikut aturan ini — persis skenario "card custom" yang
disebut user sendiri sebagai pengecualian. Desain 3 "Daftar Donasi" ternyata SUDAH otomatis
konsisten tanpa perlu diubah — dia pakai `CampaignCardList` yang sudah jadi infrastruktur bersama
sejak § 14n (mobile-fallback archive Klasik MAUPUN Capsule sama-sama reuse komponen List yang
sama).

**Fix**: `CampaignsSectionDesignId` revert ke 3 opsi (`"4"` dihapus dari registry), komponen
`campaigns-design-4.tsx` **dihapus total** (bukan diarsipkan — merepresentasikan pendekatan
salah, bukan cadangan berguna). `CampaignsDesign1` sekarang terima prop `cardDesign` (dari
`CampaignsSection` yang fetch `campaign_archive_design` — persis setting yang sama dipakai
`campaign/page.tsx`) dan dispatch internal `CampaignCardCapsule` vs `CampaignCard variant="grid"`
untuk KEDUA blok (desktop grid dan slider mobile) — bukan cuma desktop. Picker "Design Layout" di
`CampaignsEditor` (bug pre-existing yang difix bersamaan di § 14n) **tetap dipertahankan** — itu
bagian yang benar, cuma sekarang menampilkan 3 opsi lagi.

**Pelajaran tentang fitur "desain kartu" yang mungkin dipakai di banyak tempat**: sebelum
menambahkan pilihan desain baru ke SEBUAH registry, tanya dulu — apakah ini benar-benar pilihan
LAYOUT yang berbeda struktur, atau cuma variasi tampilan KARTU di dalam layout yang sudah ada?
Kalau yang kedua, jangan buat entry registry baru di tempat lain untuk hal yang sama — cari
sumber kebenaran tunggal (di sini: setting arsip) dan hubungkan tempat lain ke situ, seperti yang
akhirnya dilakukan di § 14o. Instruksi awal user ("bikin design card 2... dan pastikan juga...
section landingpage") sebenarnya SUDAH mengisyaratkan "card" (bukan "section design") sebagai
satuan yang dipindah — kata "card" vs "section design" adalah petunjuk yang terlewat di
percobaan pertama.

### [2026-07-17] Prinsip § 14o Diterapkan ke Event + Produk — Plus 2 Drive-By Fix

> Detail lengkap: **`docs/arsitektur-event.md`** § "Coupling ke Landing Section Grid Event",
> **`docs/arsitektur-product.md`** § "Coupling ke Landing Section Grid Produk"

User minta prinsip yang baru dikunci di § 14o (setting Desain Kartu Arsip = satu sumber
kebenaran, landing "Grid X" otomatis ikut) diterapkan ke Event dan Produk juga. Diklarifikasi
lewat `AskUserQuestion` (setelah 2 ronde salah paham sebelumnya di fitur yang sama — kali ini
tanya dulu sebelum eksekusi): mobile treatment landing section BEDA per modul secara sengaja —
**Produk → slider** (sama seperti Campaign), **Event → tetap list** (perilaku existing
`EventsDesign1` sudah dianggap benar, tidak diubah). Bukti bahwa 3 modul boleh punya treatment
berbeda selama masing-masing punya alasan, bukan harus 100% seragam.

**Karena Event dan Produk baru punya 1 desain arsip masing-masing** (`"1"` saja di
`EVENT_ARCHIVE_CARD_DESIGN_IDS`/`PRODUCT_ARCHIVE_CARD_DESIGN_IDS`), coupling-nya untuk SEKARANG
murni plumbing (dispatch selalu jatuh ke 1 cabang, nol perubahan visual) — nilainya baru terasa
nanti kalau Desain 2 ditambah ke salah satu registry arsip itu, otomatis ikut ke landing tanpa
kode tambahan. Pola ini (bangun infrastruktur sebelum ada isinya, karena arsitekturnya sudah
terbukti di modul lain) beda dari biasanya "tunggu sampai benar-benar dibutuhkan" — dibenarkan di
sini karena BIAYA implementasinya kecil (beberapa baris fetch+dispatch) dan MANFAATnya besar
(konsistensi 3 modul, tidak perlu refactor ulang nanti).

**`ProductsDesign1` — bug nyata ditemukan+difix, bukan cuma plumbing**: section ini TIDAK PUNYA
treatment mobile sama sekali sebelum fix ini (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
polos, tanpa breakpoint split) — persis bug "grid sempit di HP" yang dulu dialami Campaign
sebelum § 14l. Ditemukan SAAT mengerjakan permintaan user (bukan dicari-cari), difix sekalian
sesuai jawaban user (slider, sama seperti Campaign).

**2 drive-by fix sekaligus — bug pre-existing IDENTIK dengan `CampaignsEditor` sebelum § 14n**:
`EventsEditor` dan `ProductsEditor` (`section-editors.tsx`) SAMA-SAMA tidak pernah destructure
`variant`/`onVariantChange` — admin tidak pernah bisa memilih "Event Utama"/"Agenda" atau
"Showcase"/"Carousel Produk" dari UI section builder, padahal registry 3-desain masing-masing
sudah lama ada. Difix bersamaan (tambah blok "Design Layout" picker, pola identik). **Pola
berulang**: begitu satu bug ketemu di satu `{Type}Editor`, WAJIB cek apakah `{Type}Editor` lain
yang serupa (Events/Products/Campaigns semua di file yang sama, `section-editors.tsx`) punya bug
kelas yang sama — jangan tunggu laporan terpisah per modul.

**`getSettings`/`TenantDb` — import gabungan value+type dalam satu baris**: pola
`import { getSettings, type TenantDb } from "@jalajogja/db";` dipakai di 3 file fetch-layer
section (`campaigns-section.tsx`, `events-section.tsx`, `products-section.tsx`) — sebelumnya
hanya `import type { TenantDb }`, sekarang perlu `getSettings` (value) juga. TypeScript
mengizinkan mixed value+type import dalam satu statement — tidak perlu 2 baris import terpisah.

### [2026-07-17] Nominal Pembayaran Tidak Pernah Ditanya/Bisa Dikoreksi — Prasyarat Cicilan

> Detail lengkap: **`docs/arsitektur-billing.md` § "Nominal Pembayaran Terlihat + Bisa Diedit"**

User minta rencana fitur Cicilan (installment) — sebelum masuk ke situ, user tanya duluan:
"di konfirmasi pembayaran itu jumlah pembayarannya ditulis gk bro?" — sinyal bagus bahwa mereka
mengecek prasyarat sebelum melangkah, bukan asumsi semuanya sudah beres. Jawabannya memang TIDAK,
dan ini bug nyata (bukan cuma UX kosmetik): `submitPaymentProofAction` (customer submit bukti
transfer) TIDAK PERNAH menerima nominal dari customer — form publik cuma minta nama pengirim,
bank, tanggal, bukti foto. Server SELALU menghitung `payment.amount = remaining` (sisa tagihan)
secara otomatis, mengasumsikan customer transfer PAS sejumlah itu. `verifySubmittedPaymentAction`
(admin verifikasi) juga cuma terima `paymentId` — admin cuma bisa terima nilai asumsi itu mentah2
via tombol "✓ Verifikasi", atau tolak total via "Tolak" (customer submit ulang dari nol) — tidak
ada jalan tengah untuk koreksi.

**Kenapa ini prasyarat wajib untuk Cicilan**: cicilan = customer bayar SEBAGIAN berkali-kali.
Kalau sistem tidak bisa menangkap "customer bilang saya transfer segini" secara akurat dan admin
tidak bisa mengoreksi kalau meleset, riwayat cicilan di invoice akan salah dari transaksi pertama.

**Fix**: nominal jadi **field eksplisit yang terlihat DAN bisa diedit** di dua sisi:
- Customer (`invoice-public-client.tsx`) — input "Nominal Transfer" baru di form submit bukti,
  default = `invoice.remaining`, bisa diubah bebas (mencicil = kurang dari remaining, kelebihan
  bayar = lebih — user eksplisit: "ada yg tf lebih soalnya", jadi TIDAK ada batas atas).
- Admin (`invoice-detail-client.tsx`) — tombol "✓ Verifikasi" yang sebelumnya langsung
  `confirm()` + panggil action, sekarang buka **form inline** (pola sama form "Tolak" yang sudah
  ada di komponen yang sama) dengan nominal ter-prefill dari yang customer submit, admin bisa
  koreksi sambil bandingkan ke foto bukti transfer di bawahnya sebelum klik "Konfirmasi". User
  eksplisit: "kalau tidak [bisa diedit] bahaya meski lebih 100 atau kurang" — makanya validasi
  cuma `> 0`, tidak ada pembulatan atau toleransi yang menyembunyikan selisih kecil.

**Konsistensi data**: `payments.amount` (dikoreksi admin) dan `invoice_payments.amount`
(junction table, diisi saat submit) sekarang SELALU disinkronkan — kalau admin koreksi nominal
saat verifikasi, KEDUA kolom di-update bersamaan, supaya tidak ada dua sumber kebenaran yang
beda untuk payment yang sama.

**Di luar scope, sengaja tidak disentuh**: `confirmInvoicePaymentAction` (admin input pembayaran
MANUAL, bukan dari submission customer) sudah benar sejak awal — sudah punya parameter `amount`
eksplisit dengan validasi. Penanganan refund/kelebihan bayar juga di luar scope — dicatat sebagai
pembahasan terpisah kalau nanti dibutuhkan, tidak diselesaikan sekarang.

**Tambahan kecil setelah review user**: popup `window.confirm()` di `handleSubmitProof`
(`invoice-public-client.tsx`) sebelum submit — *"Pastikan nominal yang Anda tulis (Rp X) sama
persis dengan bukti transfer. Lanjut kirim konfirmasi?"* — Batal = tidak jadi kirim, OK = lanjut
proses seperti biasa. Native `confirm()` dipilih apa adanya (bukan modal custom) — tidak ada
precedent AlertDialog di komponen customer-facing manapun di app ini, dan use-case-nya cuma
gate satu kali sebelum submit, bukan UI persisten.

**Status**: sudah di-commit dan push (user sempat minta tunda push satu putaran untuk review
dulu, sudah dikonfirmasi lanjut).

### [2026-07-18] Halaman Invoice Publik — Tanpa Login by Design + Fix Hydration Mismatch

User tanya dua hal sekaligus: (1) apakah konfirmasi pembayaran wajib login/terikat user tertentu,
(2) React error #418 (hydration mismatch) di console saat testing alur ini.

**Jawaban (1) — dikonfirmasi via baca kode langsung**: `/{slug}/invoice/{id}`
(`app/(public)/[tenant]/invoice/[id]/page.tsx`) dan `submitPaymentProofAction` (`cart/actions.ts`)
**TIDAK ADA pengecekan session/login sama sekali** — akses murni via UUID invoice di URL. Siapa
pun yang punya link bisa lihat invoice DAN submit bukti pembayaran untuk invoice itu. Ini **bukan
bug, tapi keputusan arsitektur yang sudah lama dikunci** — billing universal sengaja mendukung
guest checkout (donasi/beli tanpa akun), konsisten dengan `member_id`/`profile_id` yang nullable
di `invoices` sejak awal. Risiko nyata terbatas karena admin tetap verifikasi manual sebelum
uang dianggap masuk (lihat entri sebelumnya) — worst case orang lain submit bukti palsu untuk
invoice yang bukan miliknya, admin tinggal "Tolak", bukan langsung ke-kredit. Kalau mau diperketat
(mis. rate-limit submission per invoice, atau cocokkan session dengan `memberId`/`profileId` kalau
ada), itu perubahan terpisah yang perlu didiskusikan — belum dieksekusi sesi ini.

**Jawaban (2) — diagnosis dari baca kode, bukan reproduksi live (tidak ada browser di environment
ini)**: React error #418 = hydration text mismatch (konten teks beda antara HTML hasil SSR dan
render pertama di client). Kandidat kuat: `formatDate()` di `invoice-public-client.tsx` DAN
`invoice-detail-client.tsx` (`keuangan/billing/`) — keduanya `"use client"` (di-SSR di server LALU
di-hydrate di browser) tapi `toLocaleDateString("id-ID", {...})` dipanggil **tanpa `timeZone`
eksplisit** — hasilnya bergantung timezone runtime, yang BISA beda antara server (VPS, kemungkinan
UTC) dan browser visitor (WIB, atau timezone lain untuk anggota diaspora). Kalau timestamp jatuh
dekat batas hari dalam salah satu TZ, tanggal yang dirender bisa beda antara SSR dan hydration →
persis error #418. **Fix**: tambah `timeZone: "Asia/Jakarta"` eksplisit di semua pemanggilan
`toLocaleDateString` di kedua file (termasuk yang inline untuk tanggal resi pengiriman) — tanggal
transaksi selalu diinterpretasikan sebagai WIB, konsisten dengan lokasi organisasi, bukan
mengikuti timezone visitor.

**Catatan kejujuran**: fix ini diagnosis terbaik dari review kode (chunk `777e0331-...js` di stack
trace user cocok dengan chunk React runtime, bukan kode aplikasi spesifik — jadi trace-nya sendiri
tidak menunjuk file yang salah, cuma konfirmasi "ada hydration mismatch di suatu tempat"). Bukan
bug baru dari sesi ini — pattern `toLocaleDateString` tanpa `timeZone` ini sudah ada sejak modul
Billing dibangun. Kalau setelah fix ini error masih muncul, perlu info tambahan dari user: URL
persis halaman mana yang error, supaya bisa ditelusuri ke komponen yang benar-benar jadi sumbernya
(bukan asumsi dari stack trace minified saja).

**Aturan yang ditegaskan**: setiap `toLocaleDateString`/`toLocaleTimeString` di komponen
`"use client"` yang menampilkan tanggal transaksi (invoice, payment, resi, dll) WAJIB pakai
`timeZone: "Asia/Jakarta"` eksplisit — jangan andalkan default runtime, karena server dan browser
visitor tidak dijamin timezone yang sama.

### [2026-07-18] Bug: Bukti Transfer Gagal Upload Diam-Diam — HEIC MIME Type Kosong

User laporkan "ada konfirmasi pembayaran, tapi tidak ada bukti transfer dilampirkan". Root cause
ditemukan di `/api/invoice/proof-upload` (`route.ts`): validasi tipe file HANYA mengandalkan
`ALLOWED_TYPES[file.type]` — banyak HP (terutama foto HEIC dari **galeri** iPhone, bukan hasil
jepret kamera langsung) melaporkan `file.type` sebagai **string kosong** ke browser, bukan
`image/heic`. Server menolak upload dengan `{error: "Format tidak didukung..."}`, tapi karena
bukti transfer OPSIONAL, customer tetap bisa lanjut submit form tanpa foto — dan pesan errornya
cuma teks kecil (`text-xs`) di bawah area upload, gampang terlewat terutama di mobile. Hasilnya:
customer MENGIRA sudah upload (mereka lihat preview foto sebelum upload gagal), tapi payment
tersimpan dengan `proofUrl: null`.

**Fix awal (dua lapis, SUPERSEDED — lihat update di bawah)**:
1. Server — fallback ke ekstensi nama file kalau MIME type kosong/tidak dikenali `ALLOWED_TYPES`.
2. Client — pesan error upload di-upgrade dari teks kecil jadi kotak peringatan (⚠) yang jelas.

**UPDATE (lanjutan sesi sama) — diagnosis lebih lengkap, root cause sesungguhnya:**

Laporan susulan user lebih detail: foto "terlihat berhasil upload", WA notifikasi terkirim, TAPI
admin tetap tidak melihat bukti terlampir. Ini tidak cocok dengan diagnosis MIME-kosong (yang akan
menyebabkan upload gagal terlihat oleh customer, bukan "terlihat berhasil"). Diagnosis yang benar:
**foto HEIC BISA berhasil ter-upload (MIME/ekstensi terbaca), tapi HEIC tidak native-viewable di
kebanyakan browser DESKTOP** — `proofUrl` tersimpan valid di `payments.proof_url`, tapi `<img
src="...heic">` di admin dashboard render blank/broken. Customer (biasa buka dari HP, browser HP
sering bisa render HEIC) mengira sukses; admin (buka dari desktop) melihat "tidak ada bukti".

**Fix final — `apps/web/app/api/invoice/proof-upload/route.ts` ditulis ulang total**: pakai `sharp`
(sudah jadi dependency project, dipakai juga di `lib/image-processor.ts`) untuk decode ISI FILE
(bukan tebak dari MIME/ekstensi) lalu **konversi paksa ke WebP** (`.rotate()` auto-orientasi EXIF +
`.resize(1600,1600,{fit:"inside"})` + `.webp({quality:85})`) sebelum upload ke MinIO. Ini
menghapus total ketergantungan pada `file.type`/nama file — Sharp baca byte asli, dan output SELALU
format yang bisa ditampilkan browser manapun (termasuk desktop admin). Kalau Sharp gagal decode
(file corrupt/bukan gambar sama sekali) → pesan jelas: "Foto tidak bisa diproses. Coba screenshot
foto lalu unggah ulang, atau gunakan format JPG/PNG."

**Aturan yang ditegaskan (revisi)**: untuk upload foto dari sumber tak terkontrol (HP customer,
tidak ada jaminan format), JANGAN percaya `file.type` atau ekstensi nama file sama sekali — kalau
ada Sharp/library image-processing di project, selalu decode+convert di server ke format universal
(WebP) sebagai satu-satunya sumber kebenaran format, bukan sekadar validasi MIME yang lebih longgar.
Poin lama soal "kegagalan field opsional harus terlihat jelas ke user" tetap berlaku dan sudah
diterapkan di client (kotak peringatan ⚠), tapi TIDAK CUKUP sendirian — perbedaan render antar
browser (HEIC di desktop vs mobile) adalah kelas bug terpisah yang butuh normalisasi FORMAT di
server, bukan cuma UI yang lebih jelas.

### [2026-07-18] Konfirmasi Pembayaran Publik — `window.confirm()` Diganti AlertDialog + Status "Diverifikasi" Instan

**Koreksi eksplisit user**: dialog konfirmasi sebelum submit bukti transfer sebelumnya pakai
`window.confirm()` (native browser). User menegaskan permintaan awalnya ("popup konfirmasi") berarti
**modal custom yang elegan**, bukan "notifikasi HTML jelek" bawaan browser — dan native confirm juga
dicurigai mengganggu alur redirect/state di beberapa browser mobile.

**Fix — `invoice-public-client.tsx`**: `window.confirm()` diganti `<AlertDialog>` (shadcn/Radix,
`components/ui/alert-dialog.tsx` — sudah ada di codebase, dipakai di tempat lain, sekarang dipakai
juga di halaman publik). `handleSubmitProof` (submit form) sekarang cuma validasi nominal lalu
`setConfirmOpen(true)` — pengiriman sesungguhnya dipindah ke `doSubmitProof()`, dipanggil dari
`AlertDialogAction onClick`. Radix `AlertDialogAction` otomatis menutup dialog saat diklik (tidak
di-`preventDefault`), jadi tidak perlu penanganan close manual selain reset state.

**Fix kedua — status "sedang diverifikasi" tidak terlihat / halaman terkesan diam**: sebelumnya,
setelah submit sukses, satu-satunya sinyal visual adalah banner hijau kecil di atas + menunggu
`router.refresh()` (yang bisa terasa lambat/koneksi jelek) untuk memunculkan panel biru
"Pembayaran sedang diverifikasi" (panel itu dikondisikan `invoice.status === "waiting_verification"`
dari prop server, BUKAN dari state lokal — jadi ada jeda sebelum tampil).

Fix: state baru `justSubmitted` di-set `true` **segera** setelah `submitPaymentProofAction` sukses
(tidak menunggu refresh). Kondisi render panel diubah jadi `showWaitingPanel = invoice.status ===
"waiting_verification" || justSubmitted` — tampil INSTAN. Panel juga diperbesar/dipertegas (ikon
spinner + border lebih tebal + copy lebih jelas: "Konfirmasi pembayaran sudah kami terima... Anda
tidak perlu mengirim ulang"). `canPay` (yang mengontrol tombol "Konfirmasi Pembayaran" + form) juga
ditambah `&& !justSubmitted` — mencegah tombol submit re-muncul sebelum `router.refresh()` landing
mengubah `invoice.status` yang sesungguhnya (pure UX guard; server tetap validator utama).

**Bukti foto di panel waiting**: `invoice.submittedProofUrl ?? proofUrl` — fallback ke state lokal
`proofUrl` (dari upload yang baru saja terjadi) untuk kasus `justSubmitted=true` tapi
`invoice.submittedProofUrl` dari server prop belum ter-refresh.

**Aturan yang ditegaskan**: setiap kali sebuah aksi async sukses dan UI-nya bergantung pada
`router.refresh()` untuk menampilkan status barunya, JANGAN andalkan refresh sebagai satu-satunya
sumber sinyal visual — tambahkan state lokal optimis yang langsung `true` begitu action sukses,
supaya user tidak melihat halaman "diam" selama refresh berlangsung. `router.refresh()` tetap
dipanggil sebagai sumber kebenaran final, state lokal hanya untuk jeda visual.

### [2026-07-18] Root Cause Sesungguhnya React Error #418 — `Intl.NumberFormat({style:"currency"})` ICU/CLDR Version Mismatch

**Laporan susulan**: error #418 tetap muncul, kali ini di halaman ADMIN
(`/finance/billing/invoice/[id]`), bukan halaman publik yang sudah "difix" (timeZone) di lesson
sebelumnya. Ini sinyal kuat bahwa diagnosis timeZone BENAR untuk sebagian kasus tapi BUKAN
satu-satunya penyebab — halaman admin ini sudah punya `timeZone: "Asia/Jakarta"` eksplisit di
semua `toLocaleDateString()`, tapi errornya tetap terjadi.

**Root cause sesungguhnya, dikonfirmasi dengan bukti (bukan tebakan)**: fungsi `formatRp()` di
hampir semua komponen billing/keuangan pakai `new Intl.NumberFormat("id-ID", {style: "currency",
currency: "IDR", maximumFractionDigits: 0}).format(n)`. Dicek langsung: karakter ANTARA "Rp" dan
angka yang dihasilkan `style:"currency"` adalah **U+00A0 (NO-BREAK SPACE)**, bukan spasi ASCII
biasa — dan keberadaan/ketiadaan karakter ini **bergantung versi ICU/CLDR** yang di-bundle di
runtime Node.js. Node.js di VPS production (kemungkinan versi LTS yang lebih lama, `node:20-slim`
per `apps/web/Dockerfile` meski app jalan via PM2 bukan Docker — versi Node host bisa beda lagi)
punya snapshot ICU/CLDR yang di-pin saat build Node itu sendiri, sedangkan browser (Chrome/Firefox)
meng-update data CLDR-nya sendiri secara independen dan hampir selalu lebih baru. Kalau versi ICU
antara server-render dan client-hydrate berbeda cukup jauh, `Intl.NumberFormat({style:"currency"})`
bisa menghasilkan teks yang berbeda persis (ada/tidaknya NBSP, atau posisi simbol mata uang) —
setiap kemunculan `formatRp(...)` di JSX sebagai text node langsung memicu React error #418.

**Kenapa ini BUKAN penyebab bukti transfer hilang**: error ini murni soal *rendering teks di
browser* setelah hydration — tidak menyentuh data yang tersimpan di DB atau file di MinIO sama
sekali. `proofUrl`/`payments.proof_url` tetap tersimpan benar terlepas dari bug ini. Dua masalah
ini kebetulan muncul berdekatan tapi independen; sudah dikonfirmasi ke user bahwa fix bukti
transfer (Sharp/WebP) tidak berkaitan dengan fix ini.

**Fix**: 14 komponen `"use client"` yang punya fungsi `formatRp`/`formatRupiah`/`fmt`-sejenis
diubah dari `Intl.NumberFormat({style:"currency", currency:"IDR", ...}).format(n)` menjadi
`"Rp " + Intl.NumberFormat({maximumFractionDigits/minimumFractionDigits: 0}).format(n)` —
literal `"Rp "` pakai spasi ASCII biasa (U+0020, TIDAK locale-dependent), dan `Intl.NumberFormat`
hanya dipakai untuk grouping digit (`style:"decimal"`, default) yang jauh lebih stabil lintas versi
ICU dibanding aturan penempatan+spasi simbol mata uang di `style:"currency"` (yang CLDR ubah-ubah
antar versi). File yang diubah: `invoice-detail-client.tsx`, `invoice-list-client.tsx`,
`invoice-public-client.tsx`, `cart-client.tsx`, `checkout-form.tsx`, `laporan-client.tsx`,
`fulfillment-client.tsx`, `order-create-client.tsx`, `campaign-list-client.tsx`,
`event-register-form.tsx`, `event-registration-list.tsx`, `income-expense-chart.tsx`,
`akun/mitra/pesanan/pesanan-client.tsx`, `akun/transaksi/page.tsx` (yang terakhir ini "use client"
meski namanya `page.tsx`).

**8 file lain dengan pattern sama SENGAJA TIDAK disentuh** — semuanya pure Server Component (tidak
ada `"use client"`, contoh: `dashboard/page.tsx`, `accounts/[id]/page.tsx`,
`donasi/transaksi/[id]/page.tsx`, `toko/pesanan/page.tsx`, dll). Server Component murni tidak
pernah di-hydrate ulang di client — HTML dari server itu yang tampil apa adanya, tidak ada proses
"pencocokan" dengan render kedua di browser, jadi tidak mungkin kena #418 untuk teks yang benar-benar
hanya dirender di server. Mengubahnya tidak salah tapi tidak perlu — dibiarkan scoped ke yang
benar-benar berisiko.

**Aturan yang dikunci**: `Intl.NumberFormat(locale, {style:"currency", currency:...})` **TIDAK
BOLEH** dipakai di komponen `"use client"` mana pun di project ini — hasil formatnya tidak stabil
lintas versi ICU/CLDR server vs browser. Selalu bangun manual: literal simbol mata uang + spasi
ASCII + `Intl.NumberFormat(locale, {style:"decimal", ...})` (atau tanpa `style` sama sekali, default
sudah `decimal`) untuk grouping digit saja. Ini melengkapi (bukan menggantikan) aturan
`timeZone: "Asia/Jakarta"` eksplisit dari lesson sebelumnya — keduanya sama-sama kelas "SSR/CSR
formatting yang environment-dependent", dan keduanya harus dicek setiap kali komponen client baru
menampilkan tanggal ATAU uang.

### [2026-07-18] Admin Edit Bukti Transfer + Metadata Payment — Nominal Diblok Kalau Sudah `paid`

User minta jalan recovery: kalau insiden bukti-transfer-hilang (lesson HEIC di atas) terulang,
admin harus bisa tambah/ganti bukti dan koreksi data pengirim langsung dari halaman invoice tanpa
minta customer submit ulang. Diminta juga bisa edit nominal.

**Keputusan yang dikunci**: nominal payment yang statusnya sudah `"paid"` **TIDAK BOLEH diedit**
lewat fitur ini — payment itu sudah tercatat di `invoice.paidAmount` DAN jurnal double-entry
(`recordIncome` dipanggil dengan `invoice.total` saat invoice lunas, bukan `payment.amount` per
baris — lihat `docs/arsitektur-keuangan.md`). Mengizinkan edit nominal setelah itu akan membuat
`sum(payments.amount)` menyimpang dari `invoice.paidAmount`/jurnal tanpa mekanisme koreksi apapun
— kelas bug yang sama dengan prinsip "kolom yang sudah jadi bagian catatan resmi (signed_at,
confirmed_at, dst) tidak boleh diubah diam-diam dari jalur lain" yang sudah berulang kali dikunci
di project ini. Untuk status lain (`submitted`, `rejected` — belum pernah masuk
`invoice.paidAmount`/jurnal), nominal AMAN diedit.

**Action baru**: `updatePaymentEvidenceAction(slug, paymentId, {amount?, proofUrl?, payerName?,
payerBank?, transferDate?, payerNote?})` — semua field opsional, cuma yang diisi yang di-UPDATE.
Server validasi ulang guard `paid` (bukan cuma disable di client) — pertahanan sesungguhnya ada
di action, UI disable cuma UX.

**UI** (`invoice-detail-client.tsx`): tombol "✎ Edit" di SETIAP baris riwayat pembayaran (tidak
digate status, beda dari "✓ Verifikasi"/"Tolak" yang cuma untuk `submitted`) — form inline reuse
endpoint upload yang sama (`/api/invoice/proof-upload`, termasuk konversi Sharp/WebP dari fix
sebelumnya). Baris tanpa `proofUrl` dapat hint kuning "⚠ Belum ada bukti transfer terlampir" —
supaya kasus yang memicu fitur ini (bukti hilang, admin tidak sadar) langsung kelihatan tanpa
harus scroll/cek satu-satu.

**Aturan yang ditegaskan**: setiap fitur "edit data yang sudah dikonfirmasi" WAJIB dipilah per
field — field yang murni evidentiary (foto, nama, catatan) selalu aman diedit kapan saja; field
yang sudah dipakai untuk KALKULASI di tempat lain (nominal → paidAmount → jurnal) hanya boleh
diedit selama belum ada downstream effect yang sudah terjadi. Jangan buat satu tombol "Edit" yang
mengizinkan semua field tanpa pembedaan ini.

### [2026-07-18] Audit Proaktif — 4 Race Condition Ditemukan di `verifySubmittedPaymentAction`/`rejectPaymentAction`/`cancelInvoiceAction`/`updatePaymentEvidenceAction`

User minta review menyeluruh arsitektur konfirmasi pembayaran sebelum lanjut fitur lain — bukan
laporan bug dari user, murni audit proaktif. Ditemukan 4 celah race condition yang SEMUANYA
mengikuti kelas bug yang sama persis dengan yang sudah berulang kali dikunci sebelumnya di
project ini (checkoutAction, event registration, submitPaymentProofAction — lihat lesson
"Bug Kritis: `checkoutAction` Bisa Buat Invoice Duplikat" dan "Double Konfirmasi Pembayaran"):
**SELECT check di luar transaction cuma early-exit UX, bukan jaminan korektnes — guard WAJIB
diulang di dalam transaction SETELAH lock `FOR UPDATE` diperoleh.** Dua fungsi (`confirmInvoicePaymentAction`,
`submitPaymentProofAction`) SUDAH benar sejak sesi-sesi sebelumnya; empat fungsi lain TERNYATA
belum pernah dapat perlakuan sama — celah ini sudah ada sejak fungsi-fungsi itu dibuat, bukan
regresi dari perubahan sesi ini (kecuali `updatePaymentEvidenceAction`, yang memang baru dibuat
sesi ini dan langsung kena kelas bug yang sama).

**1. `verifySubmittedPaymentAction` — TIDAK ADA lock sama sekali (celah paling serius).**
Payment DAN invoice dibaca dengan `SELECT` biasa SEBELUM `db.transaction()` dimulai, lalu
`paidSoFar`/`newPaid`/`newStatus` dihitung dari nilai yang dibaca sebelum lock apapun diperoleh —
transaction di dalamnya cuma melakukan UPDATE tanpa pernah re-lock/re-verify. Race nyata:
(a) dua submitted payment untuk invoice yang sama diverifikasi hampir bersamaan (dua admin/dua
tab) → keduanya baca `paidAmount` lama yang sama → yang commit belakangan MENIMPA (lost update)
kontribusi payment yang commit duluan, `invoice.paidAmount` jadi kurang dari seharusnya meski
KEDUA payment tercatat `status=paid`; (b) race dengan `confirmInvoicePaymentAction`/
`checkoutAction` lain di invoice yang sama, kelas masalah sama.
**Fix**: restrukturisasi — payment DAN invoice di-lock `FOR UPDATE` DI DALAM transaction,
`paidSoFar`/`total`/`uniqueCode` dihitung dari baris yang sudah dikunci (bukan dari read sebelum
tx). Guard re-check: `lockedPayment.status !== "submitted"` → throw pesan spesifik "Pembayaran
sudah diproses sebelumnya".

**2. `rejectPaymentAction` — sama, tidak ada lock pada payment sebelum UPDATE.**
Race dengan `verifySubmittedPaymentAction` pada PAYMENT YANG SAMA: kalau dua admin klik
"✓ Verifikasi" dan "Tolak" nyaris bersamaan pada satu submitted payment yang sama, keduanya baca
`status="submitted"` yang masih valid → keduanya proses → last-write-wins pada kolom
`payments.status` bisa menghasilkan payment yang **sudah terjurnal (income tercatat, invoice
paidAmount ter-update) TAPI statusnya "rejected"** — audit trail rusak, dan invoice bisa
ter-revert ke "pending"/"partial" padahal jurnal sudah membukukan pelunasan. **Fix**: lock
payment `FOR UPDATE` + re-check status di dalam transaction sebelum update ke "rejected".

**Bug kedua di fungsi yang sama, ditemukan sekalian (bukan race condition, murni logic salah)**:
invoice yang direject submission-nya SELALU di-revert ke status `"pending"`, tanpa mempedulikan
apakah invoice itu sebenarnya sudah punya `paidAmount > 0` dari pembayaran PARTIAL sebelumnya
(skenario: invoice partial-paid → customer submit LAGI untuk sisa tagihan → admin tolak submission
kedua ini → invoice seharusnya balik ke `"partial"`, bukan `"pending"` — kalau `"pending"`, badge
UI jadi salah/menyesatkan meski `remaining` tetap terhitung benar dari `paidAmount`). **Fix**:
`revertStatus = paidAmount > 0 ? "partial" : "pending"` — dan `paidAmount` dibaca ULANG di dalam
transaction (bukan pakai snapshot sebelum tx) supaya tidak stale kalau ada
`confirmInvoicePaymentAction` lain yang mengubah `paidAmount` konkuren dengan reject ini.

**3. `cancelInvoiceAction` — dua celah sekaligus.**
(a) Guard status HANYA blok `"paid"` dan `paidAmount > 0` — TIDAK blok status
`"waiting_verification"`. Invoice dengan bukti pembayaran yang sedang menunggu verifikasi
(`paidAmount` masih 0, submission pertama belum pernah diverifikasi) bisa dibatalkan admin tanpa
peringatan apapun — bukti transfer customer jadi "hilang secara efektif" (invoice cancelled,
payment submission tetap ada tapi tidak pernah ada yang memprosesnya, customer tidak tahu). **Fix**:
tambah guard `status === "waiting_verification"` → tolak dengan pesan eksplisit "Ada bukti
pembayaran yang sedang menunggu verifikasi — verifikasi atau tolak dulu". (b) Race: SELECT-check
lalu UPDATE tanpa transaction/lock sama sekali — customer bisa submit bukti PERSIS di antara
SELECT dan UPDATE cancel, invoice ter-cancel meski submission barusan masuk. **Fix**: bungkus
seluruh alur (SELECT + validasi + UPDATE) dalam satu transaction dengan `FOR UPDATE` lock +
re-check status di dalamnya — pola sama dengan 2 fix di atas.

**4. `updatePaymentEvidenceAction` (baru dibuat sesi ini, di turn sebelumnya) — kena kelas bug
sama persis, ditemukan+difix di turn yang sama saat ditulis ulang untuk audit ini.** Guard
`payment.status === "paid"` (blokir edit nominal) dibaca SEBELUM transaction — race window: admin
buka form Edit saat payment masih "submitted", admin lain memverifikasi (→"paid") SEBELUM form
pertama disimpan → guard di client lolos (baca status lama), server juga lolos (baca status lama
di luar tx) → nominal bisa ter-update padahal payment-nya sudah "paid" dan sudah terjurnal — persis
skenario yang coba dicegah fitur ini. **Fix**: kalau `data.amount !== undefined`, lock payment
`FOR UPDATE` DI DALAM transaction dan re-check `status !== "paid"` sebelum UPDATE. Field lain
(proofUrl/metadata) tetap tanpa lock — aman di status manapun, tidak ada race yang berarti.

**Observasi TIDAK difix (dicatat, bukan diabaikan begitu saja):**
- `confirmInvoicePaymentAction` (admin input manual langsung, mis. cash) MEMBLOKIR
  `data.amount > remaining` — sementara `submitPaymentProofAction` (customer submit) SENGAJA
  TIDAK punya batas atas (user eksplisit: "ada yg tf lebih soalnya"). Inkonsistensi ini
  KEMUNGKINAN disengaja (admin entry manual = nominal yang benar-benar diterima admin, tidak
  masuk akal dicatat lebih dari yang ditagih; beda dengan transfer bank customer yang bisa salah
  kirim lebih) — dibiarkan apa adanya, bukan dianggap bug tanpa konfirmasi user.
- Kalau invoice punya submitted payment yang MASIH menunggu verifikasi (`status=waiting_verification`,
  `paidAmount=0`), lalu admin melakukan `confirmInvoicePaymentAction` (entry manual terpisah, mis.
  customer bayar cash padahal sudah submit bukti transfer) yang membawa invoice ke `"partial"`/
  `"paid"` — status invoice akan berubah dari `"waiting_verification"` tanpa payment submission
  yang menunggu itu pernah diproses (tidak diverifikasi maupun ditolak). Panel "Menunggu
  Verifikasi" di halaman publik customer akan hilang (karena bergantung `invoice.status`), padahal
  masih ada 1 payment row berstatus `submitted` yang mengambang tanpa resolusi. Edge case gabungan
  dua alur pembayaran berbeda di invoice yang sama — jarang terjadi, TIDAK difix di sesi ini
  (butuh keputusan produk: apakah manual entry harus auto-reject submission yang menggantung, atau
  diblokir sampai submission diproses dulu — mirip pola guard baru di `cancelInvoiceAction`).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error setelah keempat fix. Tidak ada
migration DB — murni penambahan lock+guard di level aplikasi.

### [2026-07-18] Mobile Single-Page Shell — Post+Event+Campaign+Page Generik SELESAI, Produk Menyusul (WIP)

> **Status: 4 dari 5 selesai.** Post, Event (agenda), Campaign (donasi), dan halaman generik
> (`[pageSlug]` template default) SUDAH diwire. **Produk BELUM** — sengaja diminta terakhir oleh
> user ("gass bro.. event, page, dan donasi campaign" — produk tidak disebut, menyusul terpisah).

User eksplisit tidak suka tampilan mobile saat ini — "tidak aplikasi banget", cuma responsif
(reflow CSS), bukan genuinely berbeda dari desktop. Rencana lengkap (breakpoint, 2 putaran
klarifikasi UX, pathname-matcher exclusion-list) ada di
`/Users/webane/.claude/plans/polished-moseying-shell.md` — baca itu dulu sebelum lanjut kalau
sesi berikutnya mau meneruskan pekerjaan ini.

**Breakpoint: `md:hidden`/`hidden md:block` (768px)** — SAMA dengan breakpoint switch mobile/
desktop yang sudah dipakai ketiga header (Flex/Classic/Pill), BUKAN `lg:` yang dipakai untuk
collapse sidebar/grid dua-kolom di halaman-halaman single ini. Desktop/tablet ≥768px di halaman
yang sudah dikerjakan **tidak diubah sama sekali** — JSX lama dibungkus `hidden md:block` apa
adanya, blok mobile baru ditambahkan sebagai `md:hidden`.

**Komponen baru** (`components/website/public/single/`):
- `single-mobile-topbar.tsx` — overlay back(chevron bulat)+menu(bulat solid primary+putih),
  `position:fixed`, scroll-direction listener (`useEffect`+`requestAnimationFrame` throttle):
  hide saat scroll-down, **reveal lagi saat scroll-up sedikit (~8px)** — dikonfirmasi user via
  2 putaran `AskUserQuestion` (awalnya dikira cukup "absolute scroll away", ternyata user mau
  pola hide-on-down/reveal-on-up seperti banyak app). Transparan (bg hitam/30 blur di tombol
  back) saat masih di atas gambar (`scrolledPastTop=false`), dapat backdrop
  `bg-background/95 backdrop-blur-md` begitu discroll (`scrolledPastTop=true`, supaya kontras
  di atas teks body bukan gambar). Tombol menu buka drawer nav MANDIRI (bukan reuse state
  internal header — header punya drawer sendiri per desain, tidak bisa di-trigger dari luar).
- `single-feature-image.tsx` — wrapper full-bleed (TANPA `px-4`, satu-satunya elemen tanpa
  padding standar), terima `src` (post/event/campaign/page) ATAU `children` (produk — gallery
  `ProductImageViewer` menggantikan `<img>` polos).
- `category-pill.tsx` — capsule kecil `bg-primary text-white` (SENGAJA beda dari pill kategori
  desktop yang subtle `bg-primary/10 text-primary` — permintaan eksplisit user untuk mobile).
- `social-share-card.tsx` — WhatsApp/Facebook/X (icon dari `react-icons/fa6`, pola sama
  `<SocialLinks>`)/Salin Link (pola sama `CopyButton` di `invoice-public-client.tsx`). **Baru
  dibuat dari nol** — sebelumnya TIDAK ADA komponen share sama sekali di codebase.
- **Zero custom CSS ditambahkan ke `globals.css`** — semua Tailwind utility class, konsisten
  dengan pola styling project (dicek eksplisit atas permintaan user: "pastikan minim css, pake
  reused css class").

**Header situs disembunyikan otomatis di mobile untuk 5 pola URL single-page** — BUKAN dengan
menghapus/tidak-merender header (tetap ada di DOM, cuma `hidden md:block`), lewat wrapper baru
`components/website/public/layout/header-visibility.tsx` (`"use client"`, `usePathname()`).
Deteksi "apakah rute ini single-page" via exclusion-list nama folder static di
`app/(public)/[tenant]/` (bukan whitelist single-page — supaya generic `[pageSlug]` otomatis
kebaca tanpa perlu tahu semua slug halaman yang mungkin ada):
```
agenda, akun, akun-error, anggota, campaign, cart, checkout, dokumen, event, forgot-password,
invite, invoice, keranjang, login, pesantren, post, produk, profesional, register,
reset-password, sign, statistik, usaha, verify
```
**PENTING**: kalau ada folder route STATIC baru ditambah ke `app/(public)/[tenant]/` nanti,
WAJIB update list ini juga di `header-visibility.tsx` — kalau lupa, halaman baru itu akan
salah-kena treatment "single-page" (header hilang di mobile) padahal seharusnya bukan.

**`lib/nav-menu.ts` vs `lib/get-public-nav-menu.ts` — kenapa dipisah (bug ditemukan+difix saat
build pertama)**: `nav-menu.ts` diimpor JUGA oleh client component
(`website-settings-client.tsx`, admin nav menu builder). Sempat ditambah
`import { getSettings, type TenantDb } from "@jalajogja/db"` LANGSUNG di `nav-menu.ts` untuk
fungsi baru `getPublicNavMenu` — build production GAGAL (`Module not found: fs`/`perf_hooks`)
karena `@jalajogja/db` menarik postgres client (Node-only) ke CLIENT bundle. **Fix**: fungsi
`getPublicNavMenu` (butuh DB) dipindah ke file BARU `lib/get-public-nav-menu.ts` (`import
"server-only"` di baris pertama), `nav-menu.ts` tetap murni types + pure function
(`parseNavMenu`, client-safe). **Aturan yang ditegaskan**: setiap kali sebuah `lib/*.ts` file
dipakai BAIK oleh server component MAUPUN client component, jangan pernah tambah import value
dari `@jalajogja/db` (atau package server-only lain) langsung ke file itu — pisahkan fungsi yang
butuh DB ke file baru bertanda `import "server-only"`. `tsc --noEmit` TIDAK menangkap bug ini
(cuma type-check, tidak tahu soal client/server bundle boundary) — cuma `next build` yang
mendeteksinya. **Jangan cuma andalkan `tsc` untuk perubahan yang menyentuh file lintas client/
server** — selalu `bun run build` juga sebelum menganggap selesai.

**Post** (`post/[slug]/page.tsx`) — SELESAI, pola referensi untuk 4 halaman berikutnya: body
artikel (excerpt+content+footer+related+"Kembali") diekstrak jadi 1 variable JSX
(`articleBody`) dipakai identik di kedua blok desktop & mobile — supaya prose/tiptap rendering
logic tidak terduplikasi, cuma bagian ATAS (cover/kategori/judul/meta/author) yang beda urutan
per breakpoint. `pageUrl` untuk share pakai `getTenantSeoBase(slug).baseUrl` (ABSOLUTE URL,
`https://...`) — beda dari `resolveBaseUrl(slug)` (RELATIVE, `""`/`/{slug}`, dipakai untuk
internal href/backHref) — dua "baseUrl" berbeda konsep di codebase ini, jangan tertukar.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error (setelah fix client/server boundary
di atas). Belum diverifikasi visual di browser — user diminta cek langsung di dev machine
sendiri, plus interaksi scroll hide/reveal butuh dirasakan langsung, tidak bisa dicek dari kode.

**Event (`agenda/[slug]/page.tsx`, 895 baris, paling kompleks dari kelimanya)**: berbeda dari
Post — `EventDetailTabs`/form registrasi/kartu tiket QR (kolom kanan sticky) **TIDAK
diduplikasi** ke blok mobile, tetap SATU render yang dipakai bersama kedua breakpoint (grid
`lg:grid-cols-[1fr_360px]` sudah collapse 1 kolom otomatis di bawah `lg`). Yang di-duplikasi
HANYA "cover+judul+meta" — porsi itu di dalam `detailSlot` (prop `EventDetailTabs`) dibungkus
`hidden md:block`, mobile dapat versi barunya sendiri di luar grid. Baris meta (penyelenggara/
waktu/lokasi/online/maps) diekstrak jadi variable `metaRows` dipakai identik di kedua tempat —
pola sama `articleBody` di Post. Tidak ada category pill (event belum fetch data kategori sama
sekali di halaman ini, di luar scope untuk ditambah sekarang — desktop juga tidak menampilkannya).
Bug kecil ditemukan+difix saat wiring: `const { db: tenantDb, schema } = createTenantDb(slug)`
langsung destructure tanpa simpan objek utuh — `getPublicNavMenu` butuh `TenantDb` lengkap
(`{db,schema}`), bukan cuma `db` — diubah jadi `const tenantClient = createTenantDb(slug); const
{db:tenantDb,schema} = tenantClient;` (persis lesson lama "getSettings butuh TenantDb lengkap").

**Campaign (`campaign/[slug]/page.tsx`)**: sama pola — progress bar/`CampaignDetailTabs`/form
donasi (`CampaignDetailClient`)/related campaigns TIDAK diduplikasi (grid `lg:grid-cols-5` sudah
collapse 1 kolom di bawah `lg`), hanya cover+badge+judul yang dibungkus `hidden md:block` +
diduplikasi ke mobile head. Category pill mobile pakai `CategoryPill` generik (SATU style
`bg-primary` solid) — BUKAN `CAMPAIGN_TYPE_COLORS` per-tipe yang dipakai versi desktop (donasi/
zakat/wakaf/qurban beda warna) — keputusan disengaja untuk konsistensi visual lintas 5 halaman
(prioritas "satu pola dipakai bersama" di atas mempertahankan distingsi warna per-tipe di mobile).

**Halaman generik (`[pageSlug]/page.tsx` → `DefaultTemplate`)**: keempat prop baru
(`backHref`/`navMenu`/`siteName`/`pageUrl`) dibuat **OPSIONAL**, bukan wajib — alasan: komponen
yang sama JUGA dipanggil dari `app/(public)/[tenant]/page.tsx` (root homepage, kalau tenant
kebetulan set homepage-nya pakai template "default" bukan "landing"). Homepage `/{slug}` TIDAK
pernah match `isSingleMobileRoute` (0 segmen setelah strip baseUrl) — header situs SELALU tetap
tampil di sana. Kalau shell mobile baru DIPAKSA aktif juga di homepage, overlay
back+menu (`position:fixed top:0`) akan tumpang-tindih dengan header asli yang tetap dirender
(dua elemen berebut posisi top:0, salah satu ketutupan). **Fix**: `showMobileShell = navMenu !==
undefined` — homepage (`page.tsx`) TIDAK mengirim prop-prop baru sama sekali → `DefaultTemplate`
fallback ke rendering LAMA (satu blok, tanpa split breakpoint, sama seperti sebelum sesi ini).
Hanya `[pageSlug]/page.tsx` (halaman single generik sungguhan) yang mengirim prop lengkap → dapat
shell mobile baru. **Aturan**: kalau komponen shared dipakai dari lebih dari satu route dengan
kebutuhan chrome yang beda, JANGAN paksa satu perilaku — pakai optional props + flag turunan
(`props !== undefined`) untuk percabangan eksplisit, bukan asumsi semua caller ingin hal yang sama.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error untuk ketiga halaman tambahan ini.

### [2026-07-18] Event Mobile — Kolom Tiket Jadi Bottom Sheet (Expand/Collapse)

User minta lebih jauh dari sekadar shell mobile generik: kolom "Kanan" event (form
pendaftaran / kartu tiket QR — sebelumnya sticky sidebar desktop yang collapse jadi block
biasa di mobile) diubah jadi **bottom sheet** — bar ringkas nempel di bawah layar, tap untuk
expand jadi panel penuh. Diminta eksplisit: "jadikan tiket ... static dibawah", border-radius
proporsional di atas, kalau sudah terdaftar QR kecil kiri+info kanan, kalau belum terdaftar
CTA yang bisa "naik atau melebar" saat di-tap.

**Komponen baru**: `components/event/event-mobile-ticket-bar.tsx` (`"use client"`,
`EventMobileTicketBar`) — HANYA di-pakai di Event untuk saat ini (donasi/produk konsepnya
serupa, menyusul terpisah, belum dikerjakan).

**Desain interaksi yang dikunci:**
- Bar collapsed: `fixed bottom-0 z-[71]`, `rounded-t-2xl`, tinggi `max-h-24`. Sudah terdaftar
  → QR mini (`w-12 h-12`) kiri + status/no.registrasi kanan. Belum terdaftar → label harga
  termurah ("Gratis"/"Mulai Rp X", dihitung server-side dari `tickets` array) + badge
  "Daftar". Tap di mana saja pada bar (bukan cuma tombol) untuk toggle expand.
- Expand: `max-h-[85vh]`, animasi `transition-[max-height] duration-300` — TEKNIK KUNCI:
  karena elemen tetap `bottom:0` sementara `max-height` tumbuh, sisi ATAS sheet yang bergerak
  naik (bukan geser dari luar layar) — inilah yang menghasilkan efek "naik/melebar" yang
  diminta user, tanpa perlu portal atau ukur tinggi konten via JS.
- **Konten TIDAK di-unmount saat collapse** — cuma di-clip via `overflow-hidden` pada wrapper
  luar, `EventRegisterForm` (dan semua state form di dalamnya: pilihan tiket, data peserta,
  dll) tetap hidup di DOM meski bar sedang collapsed. Kalau di-unmount setiap toggle, user
  yang sudah mulai isi form lalu tidak sengaja collapse-lalu-expand lagi akan kehilangan
  semua isian — bug UX yang harus dicegah dari awal desain, bukan ditambal belakangan.
- Backdrop `bg-black/40` (pola REUSE dari `flex-header.tsx`'s drawer "Lainnya" — bukan
  komponen baru dari nol) muncul saat expanded, tap backdrop = collapse lagi.
- Safe-area iPhone: `pb-[max(1rem,env(safe-area-inset-bottom))]` di area scroll konten
  (bukan `pb-safe` — class itu ADA di `flex-header.tsx` tapi TERNYATA dead/no-op, tidak ada
  definisi CSS untuk `pb-safe` di manapun di project, Tailwind v4 tidak generate utility itu
  secara default. Tidak diperbaiki di file asalnya — di luar scope sesi ini — tapi di
  komponen BARU ini dipakai teknik yang benar-benar berfungsi: `env(safe-area-inset-bottom)`
  arbitrary value).

**Refactor pendukung** (`agenda/[slug]/page.tsx`): konten kolom kanan (kartu QR ATAU form
pendaftaran+info kuota — ~140 baris JSX) diekstrak jadi SATU variable `ticketPanelContent`,
dipakai identik di DUA tempat: kolom sticky desktop (`hidden md:block`, tidak berubah) DAN
sebagai `children` dari `EventMobileTicketBar` (mobile) — pola sama `articleBody`/`metaRows`
dari halaman-halaman sebelumnya, sekali lagi mencegah duplikasi logic form/QR yang kompleks.

**Edge case dijaga eksplisit**: kalau `tickets.length === 0` (pendaftaran belum dibuka) DAN
belum terdaftar, `EventMobileTicketBar` (dengan badge "Daftar") **tidak dirender** — diganti
`ticketPanelContent` inline biasa (cukup notice "Pendaftaran belum dibuka") tanpa bottom
sheet. Alasan: CTA "Daftar" pada bar yang selalu tampil akan menjanjikan aksi yang sebenarnya
tidak ada — user tap, expand, ternyata cuma pesan "belum dibuka". Diputuskan skip bottom
sheet sama sekali untuk kasus ini alih-alih mengubah teks CTA-nya (lebih jujur ke user).

**Ekstraksi dengan script Python, bukan Edit manual**: JSX yang dipindah (~140 baris ternary
3-cabang) terlalu besar+kompleks untuk direplikasi manual dengan aman (risiko salah ketik saat
menyalin ulang isi form yang panjang). Dipakai script Python sekali-pakai yang baca file,
potong-tempel berdasarkan nomor baris presisi (sudah diverifikasi via `grep -n` dulu), tulis
ulang file — lalu HASIL akhirnya tetap diverifikasi `tsc`+`build` seperti biasa. **Pola untuk
sesi mendatang**: kalau butuh "pindahkan blok JSX besar dari lokasi A ke variable B" dan
blok itu terlalu panjang untuk ditranskrip ulang dengan tangan tanpa risiko, script sekali-
pakai (Python/bash) yang operasi di level baris file lebih aman daripada Edit tool manual.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. Belum diverifikasi visual/interaksi
nyata di browser (sentuhan expand/collapse harus dirasakan langsung) — user diminta cek di
device/browser sendiri.

### [2026-07-18] Bottom Sheet Digeneralisasi ke Campaign + Produk — `MobileActionSheet` Primitif Baru

User eksplisit senang dengan bottom sheet tiket Event, minta pola sama untuk Donasi dan Produk
("gass bro"). Sebelum menduplikasi ~70 baris mekanisme sheet 2× lagi, `EventMobileTicketBar`
diekstrak jadi 2 layer: primitif generik `components/website/public/single/mobile-action-sheet.tsx`
(`MobileActionSheet` — posisi/animasi/backdrop/spacer, terima `collapsedBar` + `children`) +
`EventMobileTicketBar` jadi thin wrapper di atasnya (bangun `collapsedBar` QR/status ATAU
harga/CTA, delegasikan sisanya). Beda dari chrome (topbar/gambar/kategori/share) yang TIDAK
bisa disatukan karena data tiap tipe beda jauh — mekanisme SHEET-nya sendiri (expand/collapse,
posisi, animasi) memang identik lintas 3 modul, jadi kali ini benar-benar reuse penuh, bukan
duplikasi yang disamarkan.

**Campaign** (`campaign/[slug]/page.tsx` + `components/donasi/public/campaign-mobile-donation-bar.tsx`):
Konten kolom kanan (`<h2>...</h2><CampaignDetailClient .../>`, ~20 baris tapi `CampaignDetailClient`
sendiri 486 baris dengan phone-lookup + popup state machine) diekstrak jadi variable
`donationPanelContent`, dipakai identik di desktop (sticky, tidak berubah) dan
`CampaignMobileDonationBar` (mobile). **Collapsed bar TIDAK live** (beda dari Produk di bawah) —
selalu CTA statis "Donasi Sekarang"/"Pesan Qurban", karena state nominal-terpilih hidup di
DALAM `CampaignDetailClient` dan sengaja TIDAK diangkat naik ke parent (hindari refactor invasif
ke komponen kompleks yang sudah berfungsi) — trade-off disadari, bukan keterbatasan yang
tidak disengaja.

**Produk** (`produk/[productSlug]/page.tsx` + `components/toko/public/product-detail-client.tsx`) —
INI beda dari Event/Campaign: produk BELUM PERNAH dapat mobile shell sama sekali (dilewati di
Fase 2 atas permintaan user). Jadi sekaligus dikerjakan: (a) shell mobile dasar (gallery
full-bleed pengganti gambar tunggal, kategori, judul, share) DAN (b) bottom sheet beli.

**Kenapa `ProductDetailClient` di-refactor IN-PLACE (bukan dipecah jadi komponen gallery +
komponen buy-panel terpisah)**: gallery (`ProductImageViewer`) butuh `displayImages` yang
bereaksi ke `activeVariation` (state `selected` di parent) — state SAMA dipakai untuk harga,
stok, dan disabled-state tombol beli. Memecah jadi 2 komponen terpisah berarti harus
"mengangkat" state itu ke parent baru (page.tsx, Server Component — tidak bisa punya state) atau
context — jauh lebih invasif daripada mempertahankan SATU component dengan 2 blok JSX (`hidden
md:grid` desktop lama tidak berubah + `md:hidden` shell mobile baru) yang SAMA-SAMA membaca
state yang sama. Pola ini persis `articleBody`/`ticketPanelContent` — ekstrak JSX ke variable,
bukan pecah komponen, kalau yang dibagi cuma TAMPILAN sementara STATE-nya harus tetap satu
sumber.

**Konsekuensi bagus dari desain ini**: collapsed bar Produk **live** mengikuti `activeVariation` —
begitu user pilih varian di dalam sheet yang sedang expanded, harga di collapsed bar (begitu
di-collapse lagi) otomatis ikut update, TANPA kerja tambahan — murni karena baik collapsed bar
maupun sheet content membaca `displayPrice` yang sama dari satu component. Ini beda sengaja dari
Event/Campaign (collapsed bar statis) — bukan inkonsistensi, tapi konsekuensi alami dari siapa
yang "memegang" state di masing-masing kasus.

**5 prop baru wajib di `ProductDetailClient`** (`backHref`/`navMenu`/`siteName`/`pageUrl`) — TIDAK
dibuat opsional (beda dari `DefaultTemplate`) karena cuma ADA SATU caller
(`produk/[productSlug]/page.tsx`, dicek via grep sebelum ubah signature) — tidak ada risiko
memaksa breaking change ke caller lain yang tidak siap.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error untuk ketiga perubahan (extract
primitif, Campaign, Produk). Belum diverifikasi visual/interaksi nyata di browser.

### [2026-07-18] Fitur Cicilan — Fase A Selesai (Fondasi Admin CRUD), Fase B+C Menyusul

> Rencana lengkap 3 fase + riset + keputusan desain: `/Users/webane/.claude/plans/polished-moseying-shell.md`
> (baca dulu sebelum lanjut Fase B/C di sesi berikutnya).

Skema `installment_plans`/`installment_schedules` sudah ADA sejak awal modul Billing (tabel +
DDL lengkap), tapi nol kode aplikasi pernah menyentuhnya — user minta dimatangkan. Dua
klarifikasi scope dari user (bukan asumsi saya): **(1) BUKAN donasi** — "Donasi gk ada
cicilan dong.. event dulu aja.. nanti bisa dipakai di tempat lain.. bisa di qurban" — jadi
scope Fase A/B: **tiket event saja**; qurban (nanti dipakai lagi dengan pola sama) eksplisit
DI LUAR SCOPE sesi ini. **(2) Admin tentukan total pasti** — bukan customer pilih nominal
bebas.

**Temuan riset penting yang mengubah rencana**: sempat dikira perlu migrasi
`sourceType='installment'` baru di `invoices` — TERNYATA TIDAK PERLU. Invoice hasil enroll
cicilan tetap `sourceType='event_registration'` (sama seperti tiket biasa), cukup
`invoices.installmentPlanId` (kolom yang SUDAH ADA) yang membedakan — artinya hook existing
di `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` ("kalau sourceType event_reg
DAN invoice lunas → confirm eventRegistrations") **otomatis berlaku untuk cicilan tanpa
disentuh sama sekali**. **Nol migrasi DB untuk Fase A dan Fase B** — murni kode aplikasi di
atas skema yang sudah lengkap.

**Keputusan desain yang saya kunci (bukan di skema, saya tetapkan eksplisit)**:
`installment_plans.sourceId` untuk `sourceType='event'` = **ID tiket** (`event_tickets.id`),
BUKAN ID event — supaya satu event dengan banyak tiket beda harga bisa punya program cicilan
berbeda per tiket, dan supaya bisa reuse pola lock-kuota `FOR UPDATE` yang sudah ada di
`registerForEventAction` saat Fase B nanti.

**Fase A (selesai, murni admin — belum ada apa pun di front-end publik)**:
- `finance/billing/actions.ts` — tambah `getEventTicketOptionsAction` (list tiket aktif utk
  picker), `getInstallmentPlanListAction`/`Detail`, `createInstallmentPlanAction`,
  `updateInstallmentPlanAction` (siap dipakai, belum ada UI edit — hemat scope Fase A),
  `toggleInstallmentPlanAction(planId, "isActive"|"isPublished")`. Validasi wajib:
  `totalAmount>0`, `installmentCount>=2`, `intervalDays>=1`.
- `finance/billing/cicilan/` — 3 halaman baru: list (toggle langsung di tabel), `new/` (form:
  Combobox pilih event+tiket — label gabungan `"{event} — {tiket} (Rp X)"` — + total + jumlah
  termin + interval, preview kira-kira per-termin live di form), `[id]/` (detail: info program
  + toggle + tabel invoice terdaftar dengan progres "3/10 termin").
- **`BillingTabs`** komponen baru (`components/keuangan/billing/billing-tabs.tsx`) —
  penghubung Invoice↔Cicilan. Ditemukan saat riset: dokumen lama mensketsakan `BillingNav`
  sub-shell terpisah untuk billing, TERNYATA struktur aktual flat (`billing/page.tsx` cuma
  redirect ke `/invoice`, tidak ada nav shell) — jadi dibuat tab ringan 2 pilihan, bukan
  layout baru, menyesuaikan yang benar-benar ada di kode (bukan dokumen lama yang basi).

**Fase B (BELUM dikerjakan)** — enrollment publik (`enrollInstallmentPlanAction` di
`event/actions.ts`, reuse `createLinkedInvoice` + insert `installment_schedules`), settlement
waterfall FIFO di confirm/verify payment action, UI "Tersedia Cicilan" di halaman event
publik, section "Jadwal Cicilan" di invoice detail admin+publik.

**Fase C (BELUM dikerjakan)** — cron reminder H-1 jatuh tempo termin (clone
`invoice-reminder`), `WaNotifKey` baru `installment_reminder`.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error, 3 rute baru terkonfirmasi muncul
di output build (`/finance/billing/cicilan`, `/cicilan/[id]`, `/cicilan/new`). Belum bisa
dites nyata (butuh setidaknya 1 event dengan tiket aktif di data lokal/production untuk coba
buat program) — user diminta cek tampilan admin dulu sebelum saya lanjut Fase B.

**Gap discoverability ditemukan saat user testing**: user mencari pengaturan cicilan DI DALAM
halaman edit event (sejajar dengan "Donation Prompt"/"Produk Terkait" yang memang ada di
sana) — padahal cicilan sengaja dibuat modul TERPISAH di Finance → Billing → Cicilan. Wajar
membingungkan karena semua pengaturan tiket lain (kuota, wajib anggota, custom form) memang
menyatu di form event. User diberi 2 opsi (tambah link pintasan dari edit event, atau
biarkan) — **memilih dibiarkan seperti sekarang** (opsi B), jadi TIDAK ada shortcut yang
ditambahkan. Dicatat supaya sesi mendatang tidak mengira ini "belum sempat dikerjakan" —
ini keputusan sadar user.

**2 perbaikan admin diminta user setelah testing, dikerjakan sebelum lanjut Fase B:**
1. **Edit program cicilan** — `updateInstallmentPlanAction` sudah ada sejak Fase A tapi
   TIDAK ADA UI-nya. Ditambahkan: `finance/billing/cicilan/[id]/edit/page.tsx` + tombol
   "Edit" di halaman detail. `InstallmentPlanForm` diperluas jadi dual-mode (create/edit)
   via prop opsional `planId`+`initialValues` — bukan bikin komponen form terpisah.
2. **Total Nominal auto-terisi dari harga tiket** — sebelumnya admin harus ketik ulang angka
   yang sebenarnya sudah ada di data tiket (`event_tickets.price`). Fix: `handleTicketChange`
   di form — begitu tiket dipilih di combobox, `totalAmount` langsung di-set dari
   `ticket.price` (TIDAK di-lock, tetap bisa diedit manual sesudahnya kalau admin mau tambah
   biaya admin dll). Berlaku sama di create maupun edit (satu handler dipakai bersama).

**Bug TypeScript ditemukan+difix saat edit-mode**: `createInstallmentPlanAction` return
`ActionResult<{id:string}>`, `updateInstallmentPlanAction` return `ActionResult<void>` — kalau
hasil kedua dipilih via satu ternary lalu di-assign ke `res` yang sama
(`const res = isEdit ? await update(...) : await create(...)`), TypeScript melebarkan tipe
`res.data` jadi union `void | {id:string}` dan `res.data.id` gagal type-check meski di
runtime aman (branch `isEdit` tidak pernah butuh `.id`). **Fix**: pecah jadi 2 blok `if/else`
terpisah (bukan satu variable `res` dari ternary) — masing-masing branch punya tipe `res`
sendiri yang benar. **Aturan**: kalau dua Server Action punya bentuk `ActionResult<T>` yang
beda (satu `void`, satu ada payload), JANGAN satukan pemanggilannya dalam satu ternary
lalu simpan ke variable bersama — pecah jadi branch terpisah supaya TypeScript bisa narrow
dengan benar.

### [2026-07-18] Fitur Cicilan — Fase B Versi 1 (SUPERSEDED, lihat lesson di bawah)

> **DITOLAK user setelah review, JANGAN DIIKUTI** — digantikan total oleh
> "Fase B Revisi — Cicilan Sebagai Metode Pembayaran" di bawah. Dipertahankan di sini
> hanya sebagai catatan sejarah (kenapa desain awal salah, apa yang tetap dipakai ulang).
> Fase A (admin CRUD) TIDAK terpengaruh, tetap valid.

**`enrollInstallmentPlanAction`** (`event/actions.ts`, publik, tanpa `getTenantAccess` — pola
sama `registerForEventAction`): terima `planId` (bukan `ticketId` — resolve tiket dari
`plan.sourceId`), validasi `plan.isActive && plan.isPublished`, lock tiket `FOR UPDATE` +
cek kuota (REUSE pola exact dari `registerForEventAction`, dicopy bukan di-refactor jadi
helper bersama — kelas duplikasi "demi isolasi" yang sudah berulang di project ini), insert
`event_registrations` status **selalu "pending"** (bukan "confirmed" — sesuai Keputusan Desain
#2 di plan), `createLinkedInvoice` dengan `installmentPlanId` (field baru, aditif, di
`packages/db/src/helpers/billing.ts` — `CreateLinkedInvoiceInput.installmentPlanId?`), lalu
insert N baris `installment_schedules` (`term 1` jatuh tempo HARI INI, term berikutnya
`+intervalDays×i`, **termin terakhir menyerap sisa pembulatan** — `lastTerm = total - perTerm
× (count-1)`, bukan `perTerm` biasa, supaya jumlah seluruh termin PERSIS sama dengan
`totalAmount`).

**Settlement waterfall FIFO** ditambahkan ke KEDUA `confirmInvoicePaymentAction` DAN
`verifySubmittedPaymentAction` — SETELAH `invoices.paidAmount` di-update, DI DALAM transaction
yang SUDAH mengunci invoice (tidak perlu lock tambahan): `if (lockedInv.installmentPlanId)` →
`SELECT installment_schedules ORDER BY term_number` → loop, `cumulative += term.amount`, skip
kalau sudah `status='paid'`, `break` begitu `newPaidAmount < cumulative` (belum cukup untuk
termin ini), else UPDATE `status='paid', paymentId, paidAt=now()`. Logic DIDUPLIKASI di kedua
fungsi (bukan diekstrak ke helper bersama) — konsisten dengan pola yang SUDAH ada di kedua
fungsi ini untuk campaign-sync dan event-registration-confirm (dua action ini memang sengaja
independen sejak awal, lihat lesson race-condition audit sebelumnya).

**UI enrollment** (`components/event/event-installment-enroll.tsx`, baru) — card "Tersedia
Cicilan: {nama program}" muncul di `agenda/[slug]/page.tsx` HANYA kalau `!alreadyRegistered
&& installmentPlan` (installmentPlan di-resolve server-side: cari plan `isActive+isPublished`
yang `sourceId`-nya cocok salah satu tiket event ini). Card collapsed by default (cuma judul +
ringkasan + tombol "Daftar"), expand jadi form kecil (nama/HP/email) saat diklik — POLA
BERBEDA dari bottom sheet Fase sebelumnya (bukan `MobileActionSheet`, cuma toggle
show/hide biasa, karena ini bukan panel "beli utama" event, cuma opsi ALTERNATIF di samping
form tiket normal yang sudah ada bottom sheet-nya sendiri).

**Jadwal Cicilan ditampilkan di invoice detail — admin DAN publik**: `getInvoiceDetailAction`
+ query halaman invoice publik SAMA-SAMA ditambah fetch `installment_schedules` (hanya kalau
`invoice.installmentPlanId` ada — pakai ternary `cond ? db.select(...) : Promise.resolve([])`
di dalam `Promise.all`, TypeScript otomatis infer union `never[] | RowType[]` yang aman
dipakai). Status "Terlambat" dihitung ON-THE-FLY di kedua tempat (`status==='pending' &&
dueDate < today`) — TIDAK ada cron yang menulis ulang kolom `status` (Keputusan Desain #5).

**Belum dikerjakan**: Fase C (cron reminder H-1 + WA template baru). User diminta coba alur
penuh (daftar cicilan → lihat invoice dengan jadwal termin → admin konfirmasi pembayaran →
termin ke-1 otomatis "Lunas") di browser dulu sebelum lanjut Fase C — mekanisme settlement
khususnya TIDAK BISA diverifikasi dari kode saja, perlu transaksi nyata.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. Nol migrasi DB (semua tabel/kolom
sudah ada sejak awal modul Billing, persis seperti Fase A).

### [2026-07-19] Fitur Cicilan — Fase B Revisi: Cicilan Sebagai Metode Pembayaran (bukan Jalur Pendaftaran)

> Menggantikan TOTAL versi Fase B pertama (lesson di atas, ditandai SUPERSEDED). Fase A
> (admin CRUD program) tidak berubah. Rencana lengkap: `/Users/webane/.claude/plans/
> polished-moseying-shell.md`.

**Kenapa versi 1 ditolak**: user review hasil deploy Fase B v1 dan menegur eksplisit — cicilan
tampil sebagai card pendaftaran TERPISAH dari form tiket reguler di halaman event publik,
padahal maksudnya cicilan setara diskon/kupon: **"cicilan itu sama alurnya dengan discount
maupun coupon, jadi cicilan bagian dari metode pembayaran, bukan bagian dari metode
pendaftaran."** Instruksi eksplisit "jangan eksekusi apapun, kita diskusi dulu" sebelum
redesign dimulai — didiskusikan lewat 2 `AskUserQuestion` sebelum kode ditulis ulang.

**Prinsip baru yang dikunci**: pendaftaran/checkout SELALU menghasilkan invoice normal seperti
biasa — TIDAK ADA cabang cicilan sama sekali di titik pendaftaran (event registration flow,
cart checkout — nol perubahan). Cicilan baru masuk gambar SETELAH invoice sudah ada: customer
yang sudah punya invoice bisa klik "Ubah jadi Cicilan" di halaman invoice publik, mengubah
invoice YANG SAMA jadi berjadwal termin. Konsisten dengan prinsip Billing Universal yang sudah
dikunci sejak awal project ("satu infrastruktur invoice, banyak pintu masuk") — cicilan adalah
transformasi pada invoice yang sudah ada, bukan infrastruktur pendaftaran baru.

**2 klarifikasi lanjutan yang dikunci via AskUserQuestion:**
1. **Kapan invoice masih boleh diubah jadi cicilan?** → "Boleh kapan saja selama belum lunas" —
   TERMASUK setelah sudah ada partial payment. Konsekuensi teknis: jadwal termin selalu
   dibangun dari TOTAL invoice UTUH (bukan sisa), lalu `settleInstallmentSchedules` dijalankan
   SEKALI langsung setelah insert jadwal, memakai `paidAmount` invoice SAAT ITU — otomatis
   menandai berapa pun termin awal yang sudah "lunas" dari histori pembayaran sebelum konversi.
   Pattern ini elegan karena REUSE PERSIS fungsi settlement yang sama dipakai confirm/verify
   payment, tidak perlu logic terpisah untuk "invoice yang sudah separuh dibayar".
2. **Total mana yang dipecah — `invoice.total` atau `plan.totalAmount`?** → "Selalu pakai
   total invoice yang sebenarnya" — `plan.totalAmount` (diisi admin saat program dibuat)
   HANYA jadi saran/default tampilan, TIDAK PERNAH otoritatif saat konversi sungguhan.
   Ini sekaligus menghapus seluruh skenario "harga tiket berubah sejak program dibuat →
   invoice ditolak" yang sempat saya pertimbangkan — konversi TIDAK PERNAH gagal karena
   mismatch, karena tidak ada perbandingan sama sekali.

**Isu baru yang muncul di tengah diskusi — kode unik PER TERMIN (usul user, bukan saya)**:
User bertanya kritis: "kalau kita punya 10 orang dengan cicilan dan transfer di waktu yg
sama [nominal termin identik], bagaimana admin bisa identifikasi tanpa payment gateway?"
`invoices.uniqueCode` (kode existing) cuma SEKALI per invoice — didesain untuk skenario
"bayar lunas sekali transfer", tidak menolong sama sekali untuk termin ke-2 dst pada satu
invoice yang sama. Usul user (disepakati + diperjelas jadi desain konkret via
`AskUserQuestion`, scope dikonfirmasi "cicilan saja" bukan semua partial payment):
- Kolom baru `installment_schedules.unique_code INTEGER` (nullable) — SATU kode PER TERMIN,
  di-generate sekali saat termin dibuat (saat konversi), permanen.
- Customer diberi tahu nominal transfer = `amount + kode` (mis. "Termin 3 — Rp 35.000 —
  transfer Rp 35.347").
- **Kode TIDAK PERNAH dihitung sebagai bagian dari cicilan** — `installment_schedules.amount`
  selalu angka bersih, waterfall settlement & jurnal selalu pakai angka bersih itu. Kode murni
  alat bantu identifikasi manual admin di mutasi rekening — begitu admin cocokkan mutasi
  Rp 35.347 dengan termin 3, saat konfirmasi di sistem admin input **Rp 35.000** (bukan
  35.347) — selisih receh TIDAK PERNAH masuk ke sistem pembukuan. Beda filosofi dari
  `invoices.uniqueCode` lama (yang memang ikut jadi bagian `amountDue`/`paidAmount` riil) —
  DISENGAJA beda, karena cicilan butuh total N-termin PERSIS sama dengan total invoice
  (kalau kode ikut terhitung di tiap termin, total akan meleset dari `invoice.total`).
- Namespace kode TERPISAH dari `invoices.uniqueCode` (kolom beda tabel) — generator baru
  `generateInstallmentScheduleCode(tenantDb, extraExclude?)` di `packages/db/src/helpers/
  billing.ts`, meniru pola query `generateUniqueCode()` tapi target `installment_schedules`
  filter `status='pending'`. Parameter `extraExclude` WAJIB dipakai saat generate BANYAK kode
  sekaligus dalam satu loop (N termin dalam satu konversi) — DB query saja tidak cukup karena
  kode-kode itu belum ter-INSERT saat generator dipanggil lagi untuk termin berikutnya
  (risiko 2 termin di invoice yang sama dapat kode identik). Migration:
  `0033_installment_schedule_unique_code.sql`.

**`settleInstallmentSchedules` diekstrak jadi 1 fungsi shared** (`packages/db/src/helpers/
billing.ts`) — SATU-SATUNYA refactor terhadap kode existing Fase B v1 (waterbfall logic-nya
sendiri TIDAK berubah sama sekali, cuma dipindah dari 2 salinan duplikat di
`finance/billing/actions.ts` jadi 1 fungsi dipanggil 3 tempat: `confirmInvoicePaymentAction`,
`verifySubmittedPaymentAction`, dan action konversi baru). **Alasan kali ini BEDA dari pola
"duplicate for isolation" yang biasa dipakai project ini**: fungsi ini perlu dipanggil dari
FILE KETIGA (`cart/actions.ts`, beda dari 2 file asal duplikasi) — menambah salinan ketiga
lebih berisiko drift daripada 1 fungsi shared yang benar-benar identik perilakunya di semua
titik pemanggilan (bukan "hampir sama tapi sengaja independen" seperti campaign-sync/event-
confirm yang memang didesain untuk boleh berbeda evolusinya).

**Bug tipe TypeScript saat ekstraksi — `tx` (transaction callback param) TIDAK
structurally-assignable ke `TenantDb["db"]` penuh**: `db.transaction(async (tx) => {...})`
menghasilkan `PgTransaction<...>`, BUKAN `PostgresJsDatabase<...>` biasa — beda karena
`PostgresJsDatabase` (tipe `TenantDb["db"]`) mensyaratkan property `$client` yang tidak ada
di `PgTransaction`. Solusi PERTAMA (conditional type `TenantDb["db"]["transaction"]` dengan
`infer T`) GAGAL — resolve jadi `never` karena `.transaction()` overloaded, TypeScript tidak
bisa infer dari signature majemuk. **Fix yang benar**: import tipe `PgTransaction` langsung
dari `drizzle-orm/pg-core` + `PostgresJsQueryResultHKT` dari `drizzle-orm/postgres-js` +
`ExtractTablesWithRelations` dari `drizzle-orm`, susun manual persis seperti pesan error
TypeScript menunjukkan tipe aktualnya. **Aturan untuk helper serupa ke depan**: kalau
sebuah fungsi HARUS menerima `tx` dari `db.transaction()` yang sudah berjalan (bukan buka
transaction sendiri), JANGAN coba derive tipenya dari `TenantDb["db"]` via conditional type —
langsung import tipe `PgTransaction` drizzle asli dan susun manual. Ini preseden PERTAMA di
project untuk pola "pass tx ke helper lintas file" — sebelumnya nol contoh serupa.

**File yang DIHAPUS total (bukan dikomentari) dari Fase B v1**:
- `enrollInstallmentPlanAction` di `event/actions.ts` (~160 baris, termasuk type
  `EnrollInstallmentData`) — import `waRupiah` ikut dihapus (jadi dead import setelah fungsi
  dihapus, `notifyWa`/`waAppUrl` tetap dipakai fungsi lain di file yang sama, TIDAK dihapus).
- `components/event/event-installment-enroll.tsx` — file dihapus total, satu-satunya importer.
- Blok query `installmentPlan` (deteksi program cicilan aktif utk tiket event ini) + blok
  render `<EventInstallmentEnroll>` di `agenda/[slug]/page.tsx` — dihapus, halaman event
  publik kembali TIDAK tahu-menahu soal cicilan sama sekali (persis sebelum Fase B v1 ada).

**File/fungsi baru (arsitektur final)**:
- `findEligibleInstallmentPlan(tenantDb, invoiceId)` (`billing.ts`) — cek apakah invoice bisa
  dikonversi: belum `installmentPlanId`, belum lunas/dibatalkan, item tiketnya cocok
  `installment_plans.sourceId` yang aktif+published. Dipanggil di 2 tempat: halaman invoice
  publik (render prompt) DAN diulang lagi eksplisit di dalam lock transaction saat konversi
  sungguhan (pola lock+guard berulang — jangan percaya hasil eligibility-check di luar
  transaction sebagai jaminan korektnes, cuma early-exit UX).
- `convertInvoiceToInstallmentAction(slug, invoiceId, planId)` (`cart/actions.ts`, public,
  co-located dengan `submitPaymentProofAction`/`checkoutAction` — pola lock `FOR UPDATE` yang
  sama): lock invoice → validasi status+belum-cicilan+plan aktif+eligibility re-check → hitung
  N termin dari `invoice.total` ASLI → generate kode unik per termin (skip kalau
  `unique_code_enabled` mati) → insert `installment_schedules` → `UPDATE invoices SET
  installmentPlanId` → jalankan `settleInstallmentSchedules` pakai `paidAmount` saat ini
  (auto-lunas termin awal kalau sudah ada partial payment sebelum konversi).
- UI publik (`invoice-public-client.tsx`): card "Tersedia Cicilan: {nama program}" + tombol
  "Ubah jadi Cicilan" (muncul HANYA kalau `eligibleInstallmentPlan` ada DAN invoice belum
  cicilan DAN masih `canPay`) → `AlertDialog` konfirmasi (pola sama dialog submit bukti
  sebelumnya) → `convertInvoiceToInstallmentAction` → `router.refresh()`. Section "Jadwal
  Cicilan" (sudah ada dari v1, TIDAK dihapus) diperluas: highlight termin belum-lunas
  PALING AWAL dengan instruksi "Transfer: Rp {amount+kode} (termasuk kode unik {kode} — untuk
  identifikasi, bukan tambahan tagihan)". Field "Nominal Transfer" default berubah KONDISIONAL:
  invoice cicilan → default termin berikutnya (`amount+kode`); invoice biasa → default
  `invoice.remaining` seperti sebelumnya (TIDAK berubah).
- UI admin (`invoice-detail-client.tsx`): kolom kode unik ditambah di tabel Jadwal Cicilan
  (`kode {N}` mono kecil di sebelah nomor termin) + highlight termin berikutnya. Tombol
  "✓ Verifikasi" sekarang prefill nominal dari `nextUnpaidTerm.amount` (angka BERSIH tanpa
  kode) untuk invoice cicilan — SEBELUMNYA prefill dari `payment.amount` mentah (yang untuk
  cicilan kemungkinan berisi kode di dalamnya, resiko admin salah catat). Invoice non-cicilan
  TIDAK berubah (tetap prefill dari `payment.amount`).

**Yang TETAP DIPAKAI tanpa perubahan dari Fase A**: seluruh admin CRUD program cicilan
(`finance/billing/cicilan/*`) — nol sentuhan. `CreateLinkedInvoiceInput.installmentPlanId`
(field aditif di `createLinkedInvoice`) dibiarkan ada meski tidak dipakai alur manapun saat
ini (tidak breaking untuk dihapus, tidak mengganggu, kandidat cleanup terpisah kalau
benar-benar dipastikan mati permanen).

**Verifikasi**: `tsc --noEmit` (2 putaran — putaran pertama gagal di 3 titik pemanggilan
`settleInstallmentSchedules` karena bug tipe `tx` di atas, putaran kedua 0 error) + `bun run
build --filter=@jalajogja/web` — sukses. **1 migration DB baru** (`unique_code` kolom) —
WAJIB dijalankan di VPS SEBELUM deploy kode (pola migrate-dulu-baru-restart yang sudah
dikunci sepanjang project). Belum bisa dites end-to-end browser di environment ini — alur
penuh (checkout normal → buka invoice → klik "Ubah jadi Cicilan" → lihat Jadwal Cicilan+kode
unik → submit bukti termin 1 → admin verifikasi → termin auto-lunas) perlu dicoba user di dev
machine sendiri. **Fase C (cron reminder H-1) tetap DEFERRED**, rencana lama masih relevan
apa adanya (tidak terpengaruh perubahan arsitektur ini).

### [2026-07-19] Fitur Cicilan — 4 Bug Ditemukan Saat Testing Manual Lokal (Semua Difix)

> Ditemukan user langsung dari testing manual di dev machine (bukan dari audit kode) —
> begitu Fase B Revisi "selesai" secara implementasi, jalan sungguhan langsung memunculkan
> 4 bug nyata + 1 masalah data lokal (bukan bug kode). Detail teknis: `docs/arsitektur-billing.md`
> § "4 Bug Ditemukan Saat Testing Manual".

**Bug 1 — Termin 1 langsung "Terlambat" begitu invoice baru dikonversi jadi cicilan**:
`convertInvoiceToInstallmentAction` hitung "hari ini" via `new Date().toISOString().slice(0,10)`
— murni UTC. Server dev berjalan di WIB (UTC+7); jam 05:04 WIB = 22:04 UTC HARI SEBELUMNYA.
Setiap konversi yang terjadi jam 00:00–06:59 WIB menghasilkan termin 1 dengan `due_date`
kemarin → langsung overdue. **Fix**: anchor "hari ini" ke kalender WIB dulu
(`new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Jakarta"})` → parse jadi
`Date.UTC(y,m-1,d)`), baru hitung offset termin berikutnya via `setUTCDate` dari anchor itu
— aman karena Indonesia tidak punya DST.

**Bug 2 — Badge "Terlambat" bisa salah tergantung timezone browser/server (turunan Bug 1)**:
`new Date(s.dueDate) < new Date(new Date().toDateString())` mencampur Date object dari dua
sumber timezone berbeda (dueDate string diparse sebagai UTC-midnight; `toDateString()` pakai
timezone LOKAL browser/server). **Fix**: bandingkan string `"YYYY-MM-DD"` langsung
(`s.dueDate < todayWib`), bukan Date object — dua tempat (`invoice-public-client.tsx` DAN
`invoice-detail-client.tsx`).

**Bug 3 — QRIS dinamis terkunci ke `invoice.remaining` (sisa SELURUH invoice), bukan
nominal termin**: customer scan QRIS untuk bayar 1 termin (mis. Rp 50.000) malah dikunci ke
total semua termin belum lunas (mis. Rp 500.000) — kelewat saat update field "Nominal
Transfer" sebelumnya, prop QRIS-nya tidak ikut disentuh. **Fix**: `PaymentMethodCard` terima
prop `payAmount` eksplisit (`amountNum > 0 ? amountNum : Number(defaultPayAmount)` — ikut
apa yang sedang diketik di form), diteruskan ke `QrisDisplay`, bukan hardcode
`invoice.remaining`.

**Bug 4 — Field "Nominal Transfer" (dan akibatnya QRIS Bug 3) nyangkut ke nominal LAMA
setelah invoice baru saja dikonversi**: `payAmount` di-`useState(defaultPayAmount)` HANYA
dihitung sekali saat komponen mount. `convertInvoiceToInstallmentAction` sukses →
`router.refresh()` → Next.js kirim `invoice` prop BARU ke komponen client yang SAMA (tidak
remount) → state `payAmount` lama (dihitung sebelum invoice jadi cicilan) tetap nyangkut.
**Fix**: `useEffect` + `prevDefaultRef` — sync `payAmount` ke `defaultPayAmount` terbaru
HANYA kalau `payAmount` saat ini masih PERSIS SAMA dengan default sebelumnya (bukan
`payAmount` vs `defaultPayAmount` langsung — itu akan clobber edit manual customer):
```typescript
const prevDefaultRef = useRef(defaultPayAmount);
useEffect(() => {
  if (defaultPayAmount !== prevDefaultRef.current) {
    if (payAmount === prevDefaultRef.current) setPayAmount(defaultPayAmount);
    prevDefaultRef.current = defaultPayAmount;
  }
}, [defaultPayAmount, payAmount]);
```

**Aturan digeneralisasi dari Bug 1+2**: setiap kali kode MENGHITUNG (bukan cuma
menampilkan) tanggal "hari ini" atau membandingkan tanggal untuk LOGIC BISNIS (bukan display
biasa yang sudah punya aturan `timeZone` eksplisit sejak lama), WAJIB anchor ke kalender WIB
dulu — `new Date().toISOString()` mentah SELALU salah pada jam 00:00–06:59 WIB. **Bug ini
kemungkinan besar berulang di tempat lain** — grep `toISOString().slice(0, 10)` menemukan
~12 titik lain di codebase yang menghitung "hari ini"/offset tanggal untuk keperluan non-
display (default `dueDate` invoice +3 hari di `createLinkedInvoice`, tanggal jurnal
keuangan di berbagai `actions.ts`, cron `event-reminder`/`invoice-reminder`) — **BELUM
diaudit/difix**, di luar scope sesi ini, dicatat sebagai technical debt yang perlu
diperhatikan kalau ada laporan bug tanggal serupa di modul lain.

**Aturan digeneralisasi dari Bug 4**: komponen client dengan state yang di-inisialisasi dari
props via `useState(propDerivedValue)` TIDAK OTOMATIS ikut berubah kalau prop berubah tanpa
remount — `router.refresh()` mengirim prop baru ke instance komponen yang SAMA, bukan
memaksa remount. Kalau state semacam ini harus selalu mencerminkan prop terbaru (kecuali
user sudah mengedit manual), WAJIB sync via `useEffect` yang membandingkan terhadap nilai
DEFAULT SEBELUMNYA (via `useRef`) — bukan `state !== newDefault` langsung, yang akan
menimpa edit manual user setiap render.

**Bug 5 (bukan bug kode) — DB lokal `installment_plans`/`installment_schedules` berstruktur
SANGAT LAMA/legacy**: kolom `down_payment_pct`, `installment_number`, `paid_amount` per-baris
— sama sekali beda dari skema yang dipakai kode saat ini (`source_id`, `total_amount`,
`term_number`, `payment_id`). DB lokal dibuat dari versi `create-tenant-schema.ts` yang jauh
lebih lama dan tidak pernah di-refresh; tidak ada migration yang men-transform struktur lama
(migration 0033 cuma `ADD COLUMN IF NOT EXISTS unique_code`, tidak menyentuh base structure).
Fix: kedua tabel (kosong, aman) di-`DROP`+`CREATE ULANG` manual sesuai DDL current. **Aturan
untuk sesi mendatang**: kalau error `column X does not exist` muncul di tabel yang
"harusnya" sudah lama ada, jangan asumsikan cuma kurang 1 migration `ADD COLUMN` — cek dulu
`\d tablename` di DB lokal, bandingkan strukturnya PENUH terhadap Drizzle schema/DDL saat
ini, karena bisa jadi base structure-nya sendiri sudah legacy total.

**Deploy note**: keempat bug (1-4) sudah ter-fix di kode sebelum sempat di-deploy ke VPS —
kemungkinan besar VPS TIDAK PERNAH mengalami Bug 1/2/3/4 dalam bentuk yang terlihat user
(karena baru dites di lokal sebelum push), tapi tetap berpotensi kena Bug 1/2 kalau VPS juga
UTC dan konversi terjadi jam 00:00-06:59 WIB — fix sudah ikut dalam commit yang sama,
otomatis aman begitu VPS deploy versi terbaru.

### [2026-07-19] Arsitektur Timezone Tenant — Akhirnya Benar-Benar Dipakai (Modul Event + Invoice/Billing)

> Kelanjutan langsung dari 4 bug cicilan di atas — user minta audit lebih luas: "cek arsitektur
> timezone kita... focus pada modul event dan invoice dulu... kayanya timezone ada settingnya,
> jadi harus diterapkan dengan benar." Rencana lengkap:
> `/Users/webane/.claude/plans/polished-moseying-shell.md`.

**Temuan kunci sebelum eksekusi**: setting timezone per-tenant (`/settings/general`, combobox
WIB/WITA/WIT/UTC, key `"timezone"` group `"general"`) **sudah ada infrastrukturnya sejak lama**
tapi **hampir sepenuhnya dead** — cuma SATU pemakai nyata di seluruh codebase
(`post/[slug]/page.tsx`, halaman detail artikel publik). Semua tempat lain (event, invoice,
cron) hardcode `"Asia/Jakarta"` secara langsung, tidak pernah membaca setting yang tersimpan.

**Bug jauh lebih parah ditemukan di modul Event yang TIDAK terkait fitur cicilan sama
sekali**: form admin (`EventForm`) mengirim string `datetime-local` MENTAH (mis.
`"2026-07-19T19:00"`, wall-clock tanpa offset) ke server action, yang langsung
`new Date(data.startsAt)`. Karena action ini `"use server"` (jalan di SERVER, bukan browser),
Node.js men-parse string tanpa offset itu sebagai LOCAL TIME SERVER (biasanya UTC di VPS) —
"jam 19:00" yang dimaksud admin bisa tersimpan sebagai 02:00 WIB KEESOKAN HARINYA. **Ini bukan
geser 1 hari seperti bug tanggal cicilan — ini geser 7+ JAM**, dan berlaku untuk SEMUA field
waktu event (`starts_at`, `ends_at`, `sale_starts_at`, `sale_ends_at`). Polanya SUDAH pernah
di-fix untuk field lain (custom `publishedAt` post, lihat lesson "[2026-07-09] Timezone fix
publishedAt post") — tapi generalisasinya ke modul Event terlewat sampai sesi ini.

**Keputusan dikunci via `AskUserQuestion`**: input jam di form (misal "19:00") diinterpretasikan
sebagai jam tsb di **timezone yang di-setting TENANT** (`/settings/general`) — BUKAN timezone
browser admin. Kalau tenant set Jakarta, "19:00" selalu berarti 19:00 WIB, terlepas dari
lokasi fisik admin yang mengetik (relevan untuk admin yang kerja remote dari luar zona tenant).

**Solusi: fixed-offset math, BUKAN parsing timezone-aware generik** — karena Indonesia
**TIDAK PUNYA DST** (WIB/WITA/WIT = offset TETAP +7/+8/+9 sepanjang tahun), cukup lookup table
statis. `Intl.DateTimeFormat` BISA format instant→wall-clock-string di timezone manapun
(dipakai untuk SEMUA display), tapi TIDAK punya cara native mengonversi wall-clock-string+nama-
zona → instant UTC (`Temporal` API belum stabil) — makanya untuk PARSING input datetime-local,
dipakai fixed-offset arithmetic manual, bukan `Intl` trick.

**Helper terpusat baru** — `packages/db/src/helpers/tenant-timezone.ts` (BUKAN di
`apps/web/lib/`, meski dipakai luas di apps/web — alasan: `createLinkedInvoice`
`packages/db/src/helpers/billing.ts` JUGA butuh fungsi ini untuk default `dueDate`, dan
`packages/db` tidak boleh depend ke `apps/web`). `apps/web/lib/tenant-timezone.ts` jadi
thin re-export shim dari `@jalajogja/db` supaya import path `@/lib/tenant-timezone` yang
sudah dipakai di puluhan file tidak perlu diubah:
```typescript
export async function getTenantTimezone(tenantDb: TenantDb): Promise<string>   // baca setting, fallback WIB
export function tzLabel(timezone: string): string                              // "Asia/Jakarta" → "WIB"
export function todayInTz(timezone: string): string                            // "hari ini" YYYY-MM-DD, utk LOGIC
export function anchorTodayUtc(timezone: string): Date                         // UTC-midnight anchor, utk +N hari
export function localDatetimeToUtcIso(localValue: string, timezone: string): string  // input form → UTC ISO
export function utcIsoToLocalDatetime(isoValue: string, timezone: string): string    // UTC → prefill form
export function formatInTz(date, timezone: string, opts): string               // display, timezone dinamis
```

**Pola thread prop ke Client Component** — Client Component (`EventForm`,
`InvoicePublicClient`, `InvoiceDetailClient`, semua card component publik, dll) TIDAK bisa
`await getTenantTimezone()` sendiri (butuh DB, server-only). Server Component pemanggil
WAJIB fetch `tenantTimezone` sekali via `getTenantTimezone(tenantClient)` — **ingat lesson
lama "getSettings butuh TenantDb lengkap, bukan raw db"**: simpan `const tenantClient =
createTenantDb(slug)` dulu SEBELUM destructure `{db, schema}` — lalu teruskan sebagai prop
`timezone`/`tenantTimezone` ke Client Component. Pola ini di-thread SANGAT DALAM di beberapa
tempat — contoh ekstrem: `agenda/page.tsx` (arsip, fetch) → `EventArchiveCards` → `EventArchiveCardsDesign1`
→ `EventCard` (dispatcher variant) → `EventCardGrid`/`List`/`Ringkas` → `formatEventDate` — 5
lapis komponen, `timezone` di-thread di setiap lapis sebagai prop biasa (bukan Context, demi
konsistensi dengan pola prop-threading yang sudah established di seluruh codebase ini).

**Cakupan fix — semua titik yang MENGHITUNG (bukan cuma menampilkan) "hari ini" untuk logic
bisnis** (pola sama bug cicilan, `new Date().toISOString().slice(0,10)` = UTC mentah):
`createLinkedInvoice` (`packages/db/src/helpers/billing.ts`), `checkoutAction`
(`cart/actions.ts`), `createInvoiceAction` (`finance/billing/actions.ts`) — 3 default `dueDate`
+3 hari duplikat; `confirmInvoicePaymentAction` + `verifySubmittedPaymentAction`
(`finance/billing/actions.ts`) + `confirmRegistrationPaymentAction` +
`confirmEventInvoicePaymentAction` (`event/actions.ts`) — 4 tanggal jurnal `recordIncome`;
`convertInvoiceToInstallmentAction` (`cart/actions.ts`) — generalisasi hardcode WIB yang
baru dibuat sesi sebelumnya jadi dinamis; **`event-reminder/route.ts` + `invoice-reminder/route.ts`**
— PALING KRITIS karena cron loop SEMUA tenant aktif: `tomorrowStr` sekarang dihitung DI DALAM
loop per-tenant (bukan sekali di luar loop) karena tiap tenant bisa beda timezone.

**Cakupan fix — semua titik DISPLAY tanpa `timeZone` eksplisit atau hardcode**:
`formatEventDateWib` (duplikat di `event/actions.ts` + `finance/billing/actions.ts`, pola
duplikasi yang SUDAH didokumentasikan sebelumnya — "billing tidak bergantung ke modul event"
— dipertahankan, cuma parameternya jadi dinamis), `event-card-templates.ts` (`formatEventDate`,
dipakai SSR arsip DAN landing section, 2 rantai component terpisah: `EventArchiveCards` untuk
`/agenda`, `EventsSection`+`EventsDesign1/2/3` untuk landing), `agenda/[slug]/page.tsx`
(`TZ` const → dinamis), `event/acara/[id]/page.tsx` + `checkin/page.tsx` (server component),
`api/events/[id]/certificate/[regId]/route.ts` (sertifikat PDF), plus 3 client component
lebih rendah prioritas (`event-list-client.tsx`, `event-registration-list.tsx`,
`event-checkin-client.tsx`) — tetap dirapikan untuk konsistensi meski risikonya lebih kecil
(browser admin Indonesia kemungkinan besar WIB juga).

**`invoice-public-client.tsx` + `invoice-detail-client.tsx`** — `formatDate`/`isOverdue`/
`todayWib` (termasuk bagian Jadwal Cicilan yang baru dibuat sesi sebelumnya) semua diubah dari
hardcode `"Asia/Jakarta"` jadi terima `timezone` sebagai prop baru. Page pemanggil
(`invoice/[id]/page.tsx` publik, `finance/billing/invoice/[id]/page.tsx` admin) fetch
`getTenantTimezone` dan teruskan.

**Verifikasi**: `tsc --noEmit` dicek berkali-kali per sub-fase (bukan sekali di akhir) — total
zero error di setiap checkpoint, di KEDUA package (`apps/web` dan `packages/db` terpisah,
karena helper baru ditempatkan di `packages/db`). Grep akhir memastikan **nol** sisa hardcode
`"Asia/Jakarta"` di kedua modul, dan setiap `toISOString().slice(0,10)` yang masih ada
dikonfirmasi SATU PER SATU adalah konversi akhir dari Date yang SUDAH di-anchor via
`anchorTodayUtc()` (aman), bukan `new Date()` mentah (yang buggy). Tidak ada migrasi DB baru —
infrastruktur setting timezone sudah lengkap sejak awal, sesi ini murni membuatnya benar-benar
dipakai. **Tidak bisa dites otomatis end-to-end** (perlu ganti jam sistem / timezone tenant
sungguhan) — user diminta uji manual: buat event jam 19:00 → cek DB tersimpan sebagai jam yang
benar, buka form edit → field jam harus tampil 19:00 lagi (bukan geser), ganti setting tenant
ke WITA → event baru jam 19:00 harus tersimpan sebagai 11:00 UTC (19:00 WITA = UTC+8).

**Technical debt yang TETAP di luar scope** (dicatat eksplisit, jangan dikira "lupa"): modul
Surat/Letters dan modul lain di luar Event+Invoice belum diaudit sama sekali untuk pola bug
yang sama — kandidat sesi terpisah kalau ada laporan bug tanggal/jam serupa di sana.

### [2026-07-19] Bug Deploy VPS: `apps/web/lib/tenant-timezone.ts` Menarik Postgres Client ke Client Bundle

> Ditemukan user langsung dari log build VPS setelah commit timezone di atas — `tsc --noEmit`
> lolos bersih (dicek berkali-kali sepanjang sesi), tapi `next build` sungguhan di VPS gagal
> total: `Module not found: Can't resolve 'net'/'tls'/'perf_hooks'/'fs'`.

**Root cause — PERSIS lesson lama** ("Bug: Browser Ter-Cache Redirect..." bukan ini, yang
relevan: pola client/server boundary dari `nav-menu.ts`/`get-public-nav-menu.ts`): `apps/web/lib/
tenant-timezone.ts` awalnya cuma re-export SEMUA dari `@jalajogja/db` (termasuk
`getTenantTimezone` yang butuh `getSetting`/DB). `event-form.tsx` ("use client", butuh
`localDatetimeToUtcIso`+`tzLabel` untuk konversi input datetime-local di browser) import dari
file itu — begitu SATU client component import APA PUN dari file yang re-export
`@jalajogja/db`, seluruh package ikut tertarik ke bundle browser, termasuk `postgres-client.ts`
yang butuh Node built-in modules. **Ini TIDAK bisa di-tree-shake** karena `@jalajogja/db`'s
`index.ts` punya top-level side-effect import (`./client.ts` membuat koneksi Postgres
instance saat module di-load) — bukan soal named-export mana yang dipakai, tapi package
ENTRY POINT-nya sendiri yang tidak aman diimpor dari client sama sekali.

**Kenapa `tsc --noEmit` tidak menangkap ini**: TypeScript cuma cek TIPE, tidak tahu soal
bundler boundary (client vs server bundle di Next.js App Router). Bug ini HANYA muncul saat
`next build` sungguhan (webpack/turbopack production bundling) — `tsc` bersih sama sekali
tidak menjamin build produksi aman kalau ada file yang dipakai lintas client/server boundary.

**Fix — split file jadi 2, ulangi pola `nav-menu.ts`/`get-public-nav-menu.ts` persis**:
- `apps/web/lib/tenant-timezone.ts` — HANYA fungsi pure (`tzLabel`, `todayInTz`,
  `anchorTodayUtc`, `localDatetimeToUtcIso`, `utcIsoToLocalDatetime`, `formatInTz`) —
  diimplementasikan LANGSUNG di sini (duplikat dari `packages/db/src/helpers/tenant-
  timezone.ts`, bukan re-export), **ZERO import dari `@jalajogja/db`**. Aman dipakai client
  maupun server.
- `apps/web/lib/tenant-timezone.server.ts` (baru) — `import "server-only";` di baris pertama
  + `export { getTenantTimezone } from "@jalajogja/db";` + re-export ulang fungsi pure (supaya
  file server cukup 1 import line). `"server-only"` package memaksa build ERROR EKSPLISIT
  (bukan silent module-not-found yang membingungkan) kalau ada client component yang nekat
  import dari file ini di masa depan.
- **16 file server** (semua Server Component/Server Action/API route/cron yang butuh
  `getTenantTimezone`) diubah import path dari `"@/lib/tenant-timezone"` →
  `"@/lib/tenant-timezone.server"` — mekanis via `sed` (pola replace identik di semua file,
  diverifikasi ulang dengan grep sebelum+sesudah). `event-form.tsx` (satu-satunya client
  component pemakai) TETAP `"@/lib/tenant-timezone"` tanpa `.server` — sekarang aman karena
  file itu sudah zero-dependency ke `@jalajogja/db`.

**Verifikasi ketat**: setelah fix, `bun run build --filter=@jalajogja/web` (build PRODUKSI
sungguhan, bukan cuma `tsc`) dijalankan lokal untuk konfirmasi — sukses. **Aturan mutlak**:
build produksi WAJIB dimatikan dev server dulu (`.next` cache konflik, lesson lama juga) —
matikan proses port 6202, `rm -rf apps/web/.next`, baru `bun run build`, baru nyalakan lagi
`bun run dev` setelah build selesai diverifikasi.

**Aturan digeneralisasi (PENGULANGAN dari lesson `nav-menu.ts`, ditegaskan lagi karena
terulang)**: SETIAP kali membuat file `lib/*.ts` BARU yang akan dipakai lintas client DAN
server component, WAJIB cek dari awal: apakah file itu (atau apa pun yang di-`export ... from`
di dalamnya) mengimpor `@jalajogja/db` secara langsung ATAU transitif? Kalau ya, split dari
awal jadi `nama.ts` (pure, client-safe) + `nama.server.ts` (`import "server-only"`, DB-
touching) — JANGAN tunggu sampai ketahuan lewat build gagal di VPS. `tsc --noEmit` TIDAK
CUKUP untuk memverifikasi ini — kalau ragu, jalankan `bun run build` sungguhan (dengan dev
server dimatikan dulu) sebelum push perubahan yang menyentuh `lib/*.ts` baru yang dipakai
client component.

### [2026-07-19] Notifikasi WhatsApp untuk Program Cicilan — 5 Event Baru

> Arsitektur lengkap notifikasi WA: lihat § "Arsitektur Add-on System → WhatsApp Gateway" di atas.
> Plan lengkap sesi ini disimpan di `/Users/webane/.claude/plans/polished-moseying-shell.md`.

Fitur cicilan (konversi invoice, settlement waterfall FIFO, kode unik per termin) sudah
berjalan sejak Fase A+B, tapi **belum punya satu pun notifikasi WA khusus** — customer
mengonversi invoice jadi cicilan tanpa pemberitahuan detail (durasi, nominal per-termin, sisa
tagihan), dan progres pembayaran per-termin tidak diberi tahu sama sekali. User eksplisit
minta 5 titik notifikasi TAPI dengan satu batas jelas: **pelunasan penuh cicilan memakai
notifikasi STANDAR yang sudah ada, bukan notifikasi baru** — "kalau lunas ya notifikasi
standar seperti biasa, jangan bikin notif khusus baru".

**5 event baru** (`WaNotifKey` di `lib/whatsapp.ts` + template di `lib/wa-templates.ts` grup
`// ── Cicilan ──` + toggle UI grup baru "Cicilan" di `whatsapp-setup-client.tsx`) — pola SOP
3-lapis yang sudah established, **nol migrasi DB** (semua JSONB di `tenant.settings`):
- `installment_converted` — sekali, saat invoice berhasil dikonversi jadi cicilan. Kirim
  durasi (`installmentCount`×`intervalDays`), nominal per-termin, sisa tagihan (formula
  KHUSUS, lihat di bawah), tanggal jatuh tempo termin pertama, URL invoice.
- `installment_payment_submitted` — **tambahan**, dikirim SETELAH `payment_submitted`
  generik yang tidak diubah, hanya kalau `invoices.installmentPlanId` terisi.
- `installment_payment_confirmed` — **tambahan**, dikirim SETELAH `payment_confirmed`
  generik, **HANYA jika `newStatus !== "paid"`** (masih ada termin tersisa). Progres
  (`termsPaid`/`installmentCount`), sisa tagihan, termin berikutnya (tanggal+nominal).
- `installment_reminder` (H-1) / `installment_due_today` (hari-H) — dikirim cron baru,
  placeholder identik keduanya (cuma judul beda).

**Kenapa "pelunasan penuh = notifikasi standar" TIDAK butuh kode tambahan sama sekali** —
diverifikasi dari kode aktual sebelum coding, bukan diasumsikan:
1. `payment_confirmed` generik SUDAH dikirim tanpa syarat status (partial maupun paid) — jadi
   pelunasan penuh otomatis dapat notif ini.
2. Blok auto-create `event_registrations` (dan `notifyWa event_registered` di dalamnya) untuk
   tiket event SUDAH dibungkus `if (newStatus === "paid")` — begitu termin TERAKHIR cicilan
   membuat status jadi `"paid"`, blok ini jalan PERSIS seperti invoice tiket non-cicilan yang
   lunas sekali bayar. Tidak ada percabangan `installmentPlanId` yang perlu ditambah di sini.

**Formula "sisa pembayaran" KHUSUS konteks cicilan — beda dari invoice biasa**:
`remaining = total - paidAmount` (murni, TANPA `invoices.uniqueCode` level-invoice). Beda dari
formula invoice biasa (`(total + uniqueCode) - paidAmount`) karena begitu cicilan aktif, tidak
ada lagi skenario "bayar sekali lunas total+kode" — kode unik yang relevan cuma kode PER
TERMIN (`installment_schedules.uniqueCode`), yang juga tidak dihitung sebagai bagian nominal
cicilan (`amount` di tabel schedule selalu angka bersih, lihat komentar di
`packages/db/src/schema/tenant/billing.ts`). "Yang harus dibayarkan" (nominal satu termin
spesifik, di reminder/due-today/converted) = `term.amount + (term.uniqueCode ?? 0)`.

**`settleInstallmentSchedules` return `void`** — tidak expose termin mana yang baru lunas.
Daripada ubah signature fungsi shared yang dipakai 3 tempat, `confirmInvoicePaymentAction` dan
`verifySubmittedPaymentAction` **re-query `installment_schedules` SETELAH transaction commit**
(pakai `db` biasa, bukan `tx` — pola sama semua `notifyWa` lain di kedua fungsi ini) untuk
hitung `termsPaid` dan cari termin berikutnya yang belum lunas.

**Bug TypeScript: `let x: T | null = null` yang di-reassign HANYA di dalam closure async
`db.transaction()` dinarrow jadi `never` oleh TypeScript saat diakses SETELAH transaction**
(bukan `T | null` seperti yang diharapkan dari deklarasi eksplisit). Terjadi 2× di sesi ini
(`confirmInvoicePaymentAction` dan `verifySubmittedPaymentAction`). **Fix**: ganti pola dari
`let` union-reassignment ke **object holder dengan default value** (bukan `null`) yang
di-mutate property-nya di dalam closure — persis pola `newEventRegs.push(...)` (array) yang
SUDAH established dan aman di kode yang sama, cuma diperluas ke object:
```typescript
// SALAH — let dengan union type, reassign di dalam tx callback → never saat dipakai di luar
let installmentInfo: { installmentPlanId: string; ... } | null = null;
await db.transaction(async (tx) => { installmentInfo = { ... }; });
if (installmentInfo && installmentInfo.newStatus !== "paid") { ... } // TS2339: never

// BENAR — object holder dengan default sentinel, MUTASI property (bukan reassignment variable)
const installmentInfo: { installmentPlanId: string | null; newStatus: string } =
  { installmentPlanId: null, newStatus: "" };
await db.transaction(async (tx) => {
  installmentInfo.installmentPlanId = lockedInv.installmentPlanId;
  installmentInfo.newStatus         = newStatus;
});
if (installmentInfo.installmentPlanId && installmentInfo.newStatus !== "paid") { ... } // OK
```
**Aturan digeneralisasi**: setiap kali butuh "keluarkan data dari dalam `db.transaction(async
(tx) => {...})` untuk dipakai setelah commit" (pola side-effect yang SUDAH berulang di project
— `newEventRegs`, `firstDueDate`, dst), JANGAN pakai `let variable: T | null = null` yang
di-reassign di dalam closure. Selalu pakai array (`.push()`) untuk daftar, atau object holder
dengan default sentinel value (mutasi property, bukan reassign variable) untuk single value.

**Cron baru `app/api/cron/installment-reminder/route.ts`** — TERPISAH dari `invoice-reminder`
yang sudah ada, karena `invoices.dueDate` di-freeze ke tanggal termin PERTAMA saja saat
konversi (`convertInvoiceToInstallmentAction` set sekali, tidak pernah diupdate lagi) — termin
ke-2 dst hanya terdeteksi dari `installment_schedules.due_date`. Query: JOIN
`installment_schedules` + `invoices` + `installment_plans` (untuk `installmentCount`), filter
`status != 'paid'` AND `due_date IN (todayStr, tomorrowStr)`, `todayStr`/`tomorrowStr` dihitung
DI DALAM loop per-tenant via `getTenantTimezone`+`anchorTodayUtc` (pola sama
`event-reminder`/`invoice-reminder` — cron loop SEMUA tenant aktif, tiap tenant bisa beda
timezone). Efek samping yang diterima (tidak di-dedup, di luar scope): untuk termin PERTAMA,
`invoice-reminder` (baca dari `invoices.dueDate`) dan `installment-reminder` (baca dari
`installment_schedules.due_date`) bisa SAMA-SAMA match H-1 termin 1 → customer terima 2 WA
mirip (generic + cicilan) hari itu. Diterima karena kedua invoice-reminder maupun
installment-reminder sama-sama "tambahan info", tidak salah data — cuma redundan sekali di
awal siklus cicilan.

**Verifikasi**: `tsc --noEmit` bersih di setiap sub-fase. **`bun run build --filter=@jalajogja/web`
PENUH dijalankan di akhir** (dev server dimatikan dulu, `.next` dibersihkan) — sesuai aturan
baru dari lesson bug deploy VPS sebelumnya, meski sesi ini tidak menambah `lib/*.ts` baru yang
dipakai client (semua perubahan di server actions + 1 cron route baru) — build sukses,
`/api/cron/installment-reminder` terkonfirmasi muncul di output build. Tidak ada migrasi DB
baru. **Tidak bisa dites otomatis end-to-end** (butuh WA gateway aktif + nomor real) — belum
diverifikasi manual oleh user. **Cron baru belum dijadwalkan di crontab VPS** — perlu
ditambahkan manual setelah deploy: `curl -H "x-cron-secret: ..." https://jalakarta.com/api/cron/installment-reminder`,
pola sama cron lain.

### [2026-07-19] Bug Ditemukan Saat Audit Pra-Commit: `invoices.uniqueCode` Tidak Pernah Di-nolkan Saat Konversi ke Cicilan

> Ditemukan lewat instruksi eksplisit user "recheck antara arsitektur dan aktual implemented
> code, apakah ada bug atau gap antar keduanya" — SEBELUM commit fitur notifikasi WA cicilan di
> atas. Bukan laporan user, murni audit silang docs vs kode.

**Root cause**: `confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`,
`getInvoiceDetailAction`, dan halaman invoice publik SEMUA menghitung `amountDue = total +
invoices.uniqueCode` untuk menentukan kapan invoice benar-benar lunas (`newStatus = "paid"`).
Tapi `convertInvoiceToInstallmentAction` (Fase B) tidak pernah menyentuh `invoices.uniqueCode`
— kode itu sudah ter-generate saat invoice PERTAMA dibuat via checkout normal (sebelum tahu-
menahu soal cicilan, `checkoutAction` nol awareness terhadap installment plan). Jumlah SELURUH
termin cicilan by design PERSIS sama dengan `total` saja (kode per-termin sengaja TIDAK dihitung
sebagai bagian nominal, lihat § "Kode Unik PER TERMIN" di `docs/arsitektur-billing.md`) — jadi
kalau `unique_code_enabled` aktif saat invoice pertama dibuat, `amountDue` (`total + kode lama`)
SELALU lebih besar dari jumlah maksimum yang bisa dicapai lewat pembayaran cicilan murni.

**Konsekuensi runtime**: invoice cicilan **tidak pernah** bisa mencapai status `"paid"` meski
SEMUA termin sudah `status='paid'` — event registration tidak pernah `confirmed`, campaign
`collected_amount` tidak pernah sync, dan (temuan yang langsung relevan ke fitur sesi ini)
notifikasi `installment_payment_confirmed` yang baru dibuat akan **terkirim berulang tanpa
henti** setiap kali admin konfirmasi termin — karena guard `newStatus !== "paid"` tidak pernah
`false`, bahkan setelah termin terakhir lunas. Ini bertentangan langsung dengan requirement user
"kalau lunas ya notifikasi standar seperti biasa, jangan bikin notif khusus baru" — tanpa fix
ini, invoice cicilan TIDAK PERNAH benar-benar "lunas" dari sudut pandang sistem.

**Fix**: `convertInvoiceToInstallmentAction` sekarang set `uniqueCode: 0` di UPDATE invoice yang
sama dengan `installmentPlanId` — konsisten dengan prinsip yang sudah dikunci sebelumnya (kode
invoice-level tidak relevan lagi begitu cicilan aktif, digantikan sepenuhnya oleh kode per
termin). Kolom `invoices.uniqueCode` adalah `integer NOT NULL DEFAULT 0` — set ke `0` valid
tanpa perlu migrasi apapun.

**Data lama berpotensi masih rusak**: invoice cicilan yang sudah dikonversi SEBELUM fix ini
(kalau ada di production/lokal) mungkin masih punya `uniqueCode` tersisa dan "stuck" di status
partial walau semua termin lunas. Perlu `UPDATE invoices SET unique_code = 0 WHERE
installment_plan_id IS NOT NULL` manual per tenant kalau ditemukan laporan invoice cicilan yang
tidak kunjung "lunas".

**Aturan digeneralisasi**: setiap kali sebuah invoice bertransformasi dari SATU model pembayaran
ke model LAIN (di sini: "bayar sekali lunas + kode invoice-level" → "bayar N kali + kode per
termin"), field/kolom yang jadi bagian formula "amountDue"/"lunas" di model LAMA WAJIB
di-reset/dinetralkan eksplisit di titik transformasi — jangan asumsikan field itu otomatis
"tidak relevan lagi" hanya karena logic BARU tidak membacanya. Field lama tetap dibaca oleh
SEMUA titik yang menghitung status invoice (confirm, verify, display admin, display publik) —
kalau tidak dinetralkan, field itu jadi residual yang diam-diam merusak transisi status di
model baru.

### [2026-07-19] Audit Keamanan Pasca-Deploy: 4 Server Action Billing Tanpa `hasReadAccess` Guard

> Diminta user setelah fitur cicilan live di production: "cek antara implemented code dan
> arsitektur keduanya harus singkron... cek juga jika ada bug... atau celah keamanan... khusus
> di bagian ini saja terlebih dahulu." Detail lengkap: `docs/arsitektur-billing.md` §
> "Keamanan — Audit Server Action Permission Guard".

**Temuan**: `getInvoiceListAction`, `getInvoiceDetailAction`, `getInstallmentPlanListAction`,
`getInstallmentPlanDetailAction` (semua di `finance/billing/actions.ts`) hanya cek
`getTenantAccess(slug)` (user valid di tenant, role apapun) — TIDAK cek
`hasReadAccess(access.tenantUser, "keuangan")`. SEMUA mutation action di file yang sama
(`confirmInvoicePaymentAction`, `createInstallmentPlanAction`, dst) konsisten pakai
`hasFullAccess(...,"keuangan")` — read actions-nya yang jadi outlier.

**Kenapa ini nyata, bukan cuma teoretis**: `finance/layout.tsx` (membungkus semua halaman
`/finance/*`) SUDAH benar redirect kalau `!hasReadAccess(...,"keuangan")` — tapi guard di
layout HANYA menutup jalur navigasi UI. Next.js Server Action adalah endpoint POST yang bisa
dipanggil LANGSUNG (curl/devtools dengan cookie sesi valid) tanpa pernah membuka halaman yang
memanggilnya — guard layout tidak melindungi pemanggilan langsung ke action. 4 role SISTEM
(owner/ketua/sekretaris/bendahara) semua sudah punya `keuangan` minimal `"read"` jadi TIDAK ada
user existing yang berubah aksesnya — tapi **custom role** (fitur Role System, admin bisa set
`keuangan: "none"` untuk staf yang sengaja dibatasi) benar-benar bisa bypass batasan itu dan
baca nama+HP+email customer, nominal transaksi, URL bukti transfer, progres cicilan — data yang
admin sudah eksplisit putuskan TIDAK boleh mereka lihat.

**Fix**: tambah `if (!hasReadAccess(access.tenantUser, "keuangan")) return {success:false,
error:"Akses ditolak."}` ke keempat action, pola identik guard mutasi yang sudah ada.
`getEventTicketOptionsAction` SENGAJA tidak disentuh (nama tiket+harga sudah publik di halaman
event manapun, tidak ada kebocoran baru).

**Ditemukan tapi TIDAK difix (di luar scope "khusus di bagian ini")**: 2 mutation action di
file yang sama, `updateAdminShippingTrackingAction` dan `updateFulfillmentStatusAction`
(fulfillment/resi toko), sama sekali tanpa guard permission apapun selain `getTenantAccess` —
technical debt terpisah, dicatat untuk audit lanjutan.

**Aturan digeneralisasi**: guard permission di LAYOUT/PAGE level (yang mengontrol apa yang
ter-render ke browser) TIDAK PERNAH cukup sebagai satu-satunya lapis pertahanan untuk Server
Action — Server Action adalah endpoint jaringan tersendiri yang bisa dipanggil independen dari
halaman manapun. Setiap Server Action yang mengembalikan data sensitif (finansial, PII, bukti
pembayaran) WAJIB punya guard permission sendiri di dalam fungsinya, sama ketatnya dengan
action mutasi di modul yang sama — jangan asumsikan "kalau halamannya sudah dilindungi, action
di baliknya otomatis aman". Pola audit yang berguna: dalam satu file actions.ts, bandingkan
guard di action MUTASI vs action READ — kalau MUTASI konsisten pakai `hasFullAccess(...)` tapi
READ cuma `getTenantAccess(...)` tanpa level check, itu sinyal kuat ada gap yang sama.

### [2026-07-19] Bug Dilaporkan User: Nominal & Kode Unik Salah di Form Konfirmasi Admin (2 Bug Terpisah)

> Laporan user pertama: "konfirmasi tertulis sesuai cicilan dan kode unik sudah benar, tetapi
> nominal yang terkirim dan tertulis di laman admin adalah nominal full paid." Laporan kedua
> (setelah fix pertama, user eksplisit minta dipastikan lebih jauh): "harus dipastikan apakah
> itu juga terjadi di konfirmasi lain (overpayment)... kode unik yang terkirim ke admin adalah
> kode unik ketika full paid, bukan kode unik cicilannya." Detail lengkap:
> `docs/arsitektur-billing.md` § "Bug Ditemukan Dari Laporan User — Nominal & Kode Unik Salah
> di Form Konfirmasi Admin".

**Bug #1 — form "Konfirmasi Pembayaran" manual (untuk tunai dll, TANPA submission customer)**:
`payAmount` HANYA `useState(String(Math.round(invoice.remaining)))`, TIDAK PERNAH
mempertimbangkan `nextUnpaidTerm` — default-nya SELALU sisa tagihan TOTAL lintas semua termin,
bukan nominal satu termin. Admin yang mencatat SATU termin bisa tanpa sadar mengonfirmasi
seluruh sisa tagihan → `settleInstallmentSchedules` menandai LUNAS semua termin sekaligus,
padahal uang yang diterima cuma untuk termin pertama. **Over-credit** customer.
Fix: `togglePayForm()` — reset `payAmount` ke `nextUnpaidTerm.amount` SETIAP kali form dibuka.

**Bug #2 (lebih halus, ditemukan di putaran audit KEDUA) — form "✓ Verifikasi" SENDIRI**: kode
lama `toggleVerifyForm(paymentId, nextUnpaidTerm ? nextUnpaidTerm.amount : p.amount)` — untuk
invoice cicilan, default SELALU `nextUnpaidTerm.amount` (nominal SATU termin blind), MENGABAIKAN
`p.amount` (nominal yang CUSTOMER SESUNGGUHNYA submit). Kalau customer overpay (mis. sengaja
transfer untuk 2 termin sekaligus, Rp 70.000 alih-alih Rp 33.334), form tetap default ke
Rp 33.334 — kalau admin tidak sadar dan langsung konfirmasi, customer **under-credit** diam-diam:
hanya 1 termin tercatat lunas meski sudah bayar untuk 2. **Ini kebalikan dari Bug #1** (under-
credit, bukan over-credit) — sama-sama berakar dari default yang tidak mencerminkan realita
transaksi, di form yang SEBELUMNYA dikira sudah benar sejak awal (justru bug ini yang paling
gampang lolos audit pertama, karena permukaannya "terlihat" sudah cicilan-aware).

Fix: `verifyDefaultFor(payment)` — default sekarang `payment.amount - (nextUnpaidTerm.uniqueCode
?? 0)` (nominal SUNGGUHAN yang customer submit, dikurangi kode unik termin) — BUKAN
`nextUnpaidTerm.amount` yang blind mengasumsikan tepat satu termin. Kasus normal: hasil identik
dengan sebelumnya (zero regresi). Kasus overpay: hasil otomatis ikut lebih besar dan benar.

**Kode unik "salah" — root cause TERNYATA sama dengan bug `uniqueCode` yang sudah difix di
sesi sebelumnya, dikonfirmasi via data lokal**: invoice cicilan test lokal
(`620-INV-202607-00002`) masih punya `invoices.unique_code = 106` (kode invoice-level LAMA dari
SEBELUM invoice ini dikonversi, sebelum fix `uniqueCode: 0` di
`convertInvoiceToInstallmentAction` diterapkan) — sementara kode PER TERMIN sesungguhnya di
`installment_schedules` sama sekali berbeda (termin 1=260, 2=545, 3=905, dst). Card ringkasan
"Kode Unik" di ATAS halaman admin (`invoice.uniqueCode`) sempat menampilkan 106 — PERSIS gejala
yang dilaporkan. **Bukan bug kode baru** — murni DATA LAMA yang belum ter-backfill (fix
`uniqueCode: 0` sebelumnya hanya berlaku untuk konversi BARU, tidak retroaktif). Sudah
dibackfill manual di lokal (`UPDATE invoices SET unique_code = 0 WHERE installment_plan_id IS
NOT NULL AND unique_code > 0`) — setelah backfill, card itu otomatis hilang. Production dicek
ulang — tetap 0 invoice cicilan, tidak perlu backfill.

**Aturan digeneralisasi (diperkuat, karena bug #2 lolos dari audit PERTAMA)**: kalau sebuah
fitur punya DUA ATAU LEBIH jalur UI yang secara konseptual melakukan hal yang sama tapi via
komponen/handler BERBEDA, dan salah satu jalur SUDAH terlihat "benar" (sudah menyebut variabel
cicilan yang tepat), JANGAN berhenti di situ — verifikasi FORMULA-nya, bukan cuma keberadaan
kesadaran cicilan-nya. `nextUnpaidTerm.amount` (blind, asumsi selalu 1 termin) TERLIHAT seperti
fix yang benar tapi sebenarnya mengabaikan input real (`p.amount`) — persis kelas bug yang lolos
audit sekali jalan. Kalau user memberi sinyal "pastikan lebih jauh" setelah fix pertama, itu
bukan basa-basi — audit ulang dengan asumsi "mungkin masih ada yang lain", bukan berhenti di
temuan pertama.

**Data production**: dicek ulang di kedua putaran — masih 0 invoice cicilan di kedua tenant,
belum ada kerusakan data nyata.

### [2026-07-19] Keputusan Produk: Overpayment Selalu Diizinkan + Peringatan Non-Blocking (Bukan Ditolak)

Menjawab pertanyaan terbuka di lesson sebelumnya (`confirmInvoicePaymentAction` sebelumnya
MENOLAK nominal yang melebihi sisa tagihan), user memutuskan aturan baru: **kurang dari nominal
seharusnya → tampil peringatan; lebih dari nominal seharusnya → tetap boleh dicatat, tapi
tampil peringatan "Kelebihan nominal di luar tanggung jawab kami."** Berlaku di kedua form admin
(Konfirmasi Pembayaran manual + Verifikasi), field tetap bebas diedit di kedua kondisi.

**Implementasi**: guard `if (data.amount > remaining) throw ...` di `confirmInvoicePaymentAction`
**dihapus total** (server sekarang izinkan overpayment, matching `verifySubmittedPaymentAction`
yang sudah lama begitu). Jurnal TETAP membukukan `total` invoice saja (bukan nominal aktual yang
lebih besar) — kelebihan tercatat di `payments.amount` sebagai jejak audit, tapi tidak diakui
sebagai pendapatan melebihi nilai invoice. `amountWarning(entered, expected)` — helper baru
client-side murni, di `invoice-detail-client.tsx`, live re-render setiap admin mengetik, TIDAK
PERNAH memblokir submit. Detail lengkap: `docs/arsitektur-billing.md` § "Keputusan Produk:
Overpayment Selalu Diizinkan".

**Scope**: HANYA form admin — form submit bukti customer (`invoice-public-client.tsx`) tidak
disentuh (sudah punya UX beda, AlertDialog konfirmasi, sudah lama tanpa batas atas).

### [2026-07-19] Prinsip Terkunci: Fidelitas ke Nominal Customer — Nol Perhitungan Otomatis di Default Field

> User menegaskan eksplisit: "Apa yang tertulis di konfirmasi pembayaran, nominal itulah yang
> harus dikirim ke admin, jangan sampai ada gap nominal dibuat otomatis dan tidak sesuai dengan
> yang user kirim via konfirmasi form. itu bahaya." Detail lengkap: `docs/arsitektur-billing.md`
> § "Prinsip Terkunci: Fidelitas ke Nominal yang Customer Submit".

**Audit ulang menemukan fix SEBELUMNYA sendiri (`verifyDefaultFor`, lesson di atas) MELANGGAR
prinsip ini** — default form "✓ Verifikasi" diam-diam MENGURANGI `payment.amount` (nominal yang
customer sungguhan submit & konfirmasi via dialog "Pastikan nominal Anda sama persis dengan
bukti transfer") dengan kode unik termin, menghasilkan angka BERBEDA dari yang customer kirim.
Kalau admin tidak sadar dan langsung konfirmasi, yang tercatat BUKAN nominal yang customer
benar-benar kirim — persis gap berbahaya yang dimaksud user, dan IRONISNYA diperkenalkan oleh
fix cicilan-awareness SAYA SENDIRI di putaran audit sebelumnya.

**Fix**: `verifyDefaultFor` dihapus total, diganti default = `payment.amount` PERSIS (nol
pengurangan). Referensi "nominal seharusnya" dipindah ke fungsi terpisah `verifyExpected()` —
HANYA dipakai sebagai pembanding di `amountWarning()`, TIDAK PERNAH menyentuh nilai yang
sungguhan dikirim ke server.

**Prinsip permanen yang sekarang berlaku untuk SEMUA form nominal admin**:
1. DEFAULT field = selalu nilai sumber paling dekat kebenaran (nominal yang customer submit,
   kalau ada). Sistem TIDAK PERNAH "membetulkan" nominal atas nama admin secara diam-diam.
2. Peringatan (`amountWarning`) = satu-satunya mekanisme yang boleh membandingkan nominal
   terhadap ekspektasi sistem dan memberi tahu admin — tidak pernah mengubah nilai field.
3. Admin selalu punya kendali penuh untuk koreksi manual berdasar informasi yang benar.

**Aturan digeneralisasi (kelas bug KETIGA di area yang sama, semuanya soal nominal form
admin)**: "membersihkan"/"membetulkan" data secara otomatis sebelum ditampilkan ke pengguna
yang akan mengonfirmasinya adalah anti-pattern berbahaya di alur finansial — bahkan kalau
tujuannya baik (memastikan angka "bersih" untuk pembukuan). Selalu tampilkan SUMBER ASLI apa
adanya sebagai default, dan pakai lapisan peringatan terpisah untuk menyampaikan
penyimpangan dari ekspektasi — jangan gabungkan "menampilkan default" dengan "membetulkan
data" dalam satu langkah, karena begitu digabung, pengguna (di sini: admin) tidak lagi tahu
apakah yang mereka lihat itu FAKTA (apa yang dikirim) atau OPINI SISTEM (apa yang seharusnya).

### [2026-07-19] Overpayment Juga Dijurnal — Audit Menyeluruh 6 Titik Konfirmasi Invoice di Seluruh Aplikasi

> User menegaskan tata kelola administrasi: "jangan sampai terjadi perbedaan antara jumlah
> dalam rekening, dan jumlah dalam laporan di aplikasi admin... jika user menulis konfirmasi
> dengan nominal lebih atau kurang itu harus benar-benar tercatat dalam billing di admin
> dashboard yang sesuai." Ditanya spesifik lewat AskUserQuestion apakah kelebihan bayar (yang
> sudah akurat di Billing dashboard) juga perlu masuk laporan keuangan FORMAL (Buku Besar/
> Neraca/Laba Rugi) — user pilih: **ya, harus masuk juga**. Detail lengkap:
> `docs/arsitektur-billing.md` § "Overpayment Juga Dijurnal".

**Root cause**: `recordIncome(tenantDb, {amount: total, ...})` di 2 fungsi
(`confirmInvoicePaymentAction`, `verifySubmittedPaymentAction`) SELALU membukukan nilai NOMINAL
invoice, bukan yang sungguhan diterima — untuk overpayment (baru diizinkan penuh di keputusan
sebelumnya), kelebihan bayar tidak pernah sampai ke jurnal formal. Fix: formula baru
`journalAmount = Math.max(0, newPaidAmount - uniqueCode)` — `uniqueCode` HANYA kode invoice-
level (identifier sistem, bukan pendapatan; untuk cicilan sudah 0 sejak konversi). Kasus normal
(pembayaran pas) hasilnya IDENTIK dengan sebelumnya (`= total`) — nol regresi, hanya skenario
overpay yang berubah (sekarang ikut terjurnal, bukan diam-diam terpotong).

**Audit menyeluruh (grep `recordIncome` di SELURUH app, 6 titik) menemukan bug KETIGA yang
SAMA SEKALI TIDAK terkait sesi cicilan** — `confirmEventInvoicePaymentAction` (`event/actions.ts`),
jalur konfirmasi invoice tiket event dari tab "Peserta" (`event-registration-list.tsx`, PARALEL
dengan `finance/billing/actions.ts` tapi kodenya duplikat sendiri, tidak reuse) — punya bug
IDENTIK (`amount: total` fixed) DAN gap tambahan: **tidak pernah mengunci baris invoice (`FOR
UPDATE`) sama sekali** — race-condition risk yang sudah dipatch di semua titik konfirmasi lain
sejak sesi-sesi sebelumnya, tapi terlewat di fungsi ini. Kedua gap difix bersamaan.

**3 titik lain (`confirmRegistrationPaymentAction` alur event langsung, + fungsi sejenis di
`toko/actions.ts`/`donasi/actions.ts`/`finance/actions.ts`) TERNYATA SUDAH BENAR sejak awal**
— semuanya menjurnal `amount = parseFloat(payment.amount)` langsung (bukan `total` tetap).
TAPI ditemukan gap KEEMPAT di jalur yang SAMA: ketiganya memanggil `syncInvoicePayment()`
(`packages/db/src/helpers/billing.ts`) untuk sinkron `invoices.paidAmount` — fungsi ini
TERNYATA meng-cap `newPaidAmount` via `Math.min(total, ...)`, DAN tidak pernah locking baris
invoice sama sekali. Efeknya gap ARAH BERLAWANAN dari yang lain: jurnal & `payments.amount`
sudah akurat (termasuk overpay), tapi `invoices.paidAmount` (yang dipakai Billing dashboard)
bisa UNDER-report untuk overpayment via jalur ini. Fix: `Math.min()` dihapus + `.for("update")`
lock ditambahkan.

**Total 4 gap ditemukan dan difix dalam SATU audit menyeluruh** (bukan cuma yang diminta user
secara eksplisit) — semuanya kelas yang sama: "nominal sesungguhnya vs nominal yang tercatat/
terjurnal bisa berbeda", tapi di 4 lapisan/arah berbeda (jurnal formal 2×, race-condition
locking 2×). Setelah fix: `payments.amount`, `invoice_payments.amount`, `invoices.paidAmount`,
dan jurnal double-entry SEKARANG konsisten di SEMUA 6 jalur konfirmasi invoice di aplikasi —
rekening bank = Billing dashboard = laporan keuangan formal.

**Aturan digeneralisasi**: ketika user meminta audit "menyeluruh" pada suatu KELAS masalah
(di sini: akurasi nominal pembayaran), JANGAN batasi pencarian ke file/fungsi yang sedang aktif
dikerjakan sesi ini — grep pola/fungsi kunci (`recordIncome`, `syncInvoicePayment`) di
SELURUH codebase untuk menemukan jalur PARALEL/DUPLIKAT yang mungkin punya bug kelas sama tapi
luput dari perhatian karena hidup di modul lain. Di project ini, pola "satu konsep dikerjakan
ulang secara independen di beberapa modul" (billing invoice vs event registration langsung vs
toko/donasi legacy) sudah berulang kali jadi sumber inkonsistensi — audit menyeluruh HARUS
melintasi batas modul, bukan berhenti di modul yang sedang menjadi fokus kerja.

### [2026-07-19] Diskon & Voucher (Fase 1) — Perencanaan Matang Dulu, Baru Eksekusi 6 Fase

> Arsitektur lengkap: **`docs/arsitektur-voucher.md`**. Konteks: langsung menyusul rangkaian
> audit akurasi nominal cicilan (lesson-lesson di atas) — user eksplisit minta perencanaan
> matang ditulis dulu ("jangan eksekusi apapun sebelum punya perencanaan yang matang") sebelum
> satu baris kode pun ditulis, plus minta arsitekturnya "dikembangkan lebih kritis" bukan cuma
> diimplementasi literal dari instruksi awal.

**Dua prinsip non-negotiable yang dikunci user dari awal**:
1. Diskon/voucher memotong harga ITEM SPESIFIK (produk/tiket/donasi/qurban) yang ditarget, bukan
   pernah invoice secara keseluruhan — beli kaos+ikut event, hanya kaos yang terpotong.
2. Voucher 100% harus bisa membuat tagihan Rp 0, DAN pada kondisi itu kode unik transaksi
   (`docs/arsitektur-kode-unik.md`) tidak boleh muncul sama sekali — "jangan sampai ada gap kode
   unik tetap muncul" meski tagihan nol.

**Riset SEBELUM menulis rencana menemukan 2 celah keamanan harga pre-existing yang TIDAK
diperkenalkan fitur ini, sengaja dicatat lalu di-scope-out**: (a) produk variable mengirim
`itemId = product_variations.id` ke cart, tapi `checkoutAction` re-fetch harga dengan
`WHERE products.id = itemId` — tidak pernah match, diam-diam jatuh balik ke snapshot harga cart
yang tidak tervalidasi; (b) item donasi/qurban tidak pernah di-re-fetch harga sama sekali. Kedua
celah ini murni ditemukan sebagai efek samping riset arsitektur voucher (yang butuh paham betul
titik resolusi harga existing) — direkomendasikan sebagai audit terpisah, TIDAK dikerjakan sesi
ini (di luar topik yang diminta).

**Dua keputusan scope dikunci via `AskUserQuestion` sebelum kode ditulis** (user pilih opsi
"Recommended" di kedua pertanyaan): Fase 1 hanya target produk **milik tenant** (mitra
dikecualikan — sistem komisi mitra untuk alur invoice/cart universal belum dibangun sama sekali,
memotong harga produk mitra tanpa mekanisme kompensasi = memotong pendapatan mereka sepihak);
Fase 1 hanya voucher **berkode** (diskon otomatis tanpa kode = Fase 2, menyusul).

**Reuse resolusi harga, bukan reimplement**: resolver voucher (`packages/db/src/helpers/
voucher.ts`) beroperasi SETELAH `unitPrice` final sudah di-resolve oleh loop existing
`checkoutAction` — tidak punya jalur "cari harga dari DB" sendiri. Dipecah 3 fungsi murni
(`findVoucherByCode`, `countCustomerRedemptions`, `computeVoucherDiscount`) supaya bisa dipakai
identik oleh preview (baca saja, tanpa lock) maupun checkout sungguhan (dengan lock `FOR UPDATE`,
di dalam transaction) — pola pemisahan read-vs-write yang sama sekali tidak duplikasi logic.

**Rp 0 auto-lunas mewarisi PERSIS pola `if (newStatus==="paid")` yang sudah established** di
`confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` — sync campaign `collectedAmount`,
auto-create `event_registrations` dari tiket cart, notifikasi WA — TAPI tanpa `recordIncome`
sama sekali (guard eksplisit `total > 0` sebelum jurnal, karena nominal 0 = tidak ada uang masuk
untuk dicatat). Ini jadi salinan KETIGA dari blok efek-samping-invoice-lunas — didokumentasikan
eksplisit sebagai duplikasi yang disengaja (pola sama `generateEventRegNumber`), bukan lupa
refactor; salinan KEEMPAT nanti baru jadi sinyal untuk ekstraksi ke helper bersama.

**Deviasi dari rencana awal, ditemukan+diputuskan SAAT eksekusi (bukan direncanakan)**: rencana
awal menaruh input kode voucher di halaman **keranjang** (`/keranjang`). Saat baca kode
`cart-client.tsx` dan `checkout-form.tsx`, ternyata arsitektur publik memisahkan dua halaman —
keranjang cuma daftar item + link `<a>` ke `/checkout`, TIDAK PERNAH memanggil `checkoutAction`;
`checkout-form.tsx` (di halaman **checkout**) satu-satunya yang memanggilnya, dan SUDAH
mengumpulkan `phone`/`email` di Step 1 (berguna untuk validasi voucher personal). Menaruh input
voucher di keranjang akan butuh mekanisme tambahan bawa kode lintas-navigasi (cookie/query param)
yang sama sekali tidak perlu kalau ditaruh langsung di checkout. **Aturan yang ditegaskan (lagi)**:
sebelum menulis komponen UI sesuai rencana yang ditulis di awal sesi Plan Mode, verifikasi dulu
struktur file aktualnya — rencana yang ditulis sebelum membaca detail implementasi existing bisa
saja mengasumsikan struktur yang ternyata berbeda; pragmatisme saat eksekusi (menaruh fitur di
tempat yang secara arsitektur lebih tepat) lebih penting daripada kepatuhan literal ke rencana.

**Kode unik per invoice vs kelas bug yang sama sekali baru**: syarat `total > 0` sebelum
`generateUniqueCode()` dipanggil (§ langkah 6 alur checkout) adalah SATU-SATUNYA perubahan yang
dibutuhkan untuk menutup permintaan eksplisit user soal "kode unik tidak boleh muncul di tagihan
Rp 0" — tidak perlu percabangan lain di manapun, karena seluruh sistem kode unik SUDAH murni
kondisional terhadap variabel `uniqueCode` (0 = tidak ada kode, sistem lama sudah menghormati
ini di semua titik display).

**Target picker untuk `targetType='donation'` — semantik itemId qurban vs campaign biasa,
BUKAN diasumsikan sama**: donasi biasa punya `invoice_items.itemId = campaigns.id`, tapi qurban
punya `itemId = qurban_animals.id` (varian per-hewan, bukan campaign-nya langsung — lihat
`docs/arsitektur-donasi.md`). Kalau admin men-target ID campaign qurban (bukan ID hewan
individualnya), voucher TIDAK AKAN PERNAH match item di cart manapun (silent no-op). Fix: picker
target untuk tipe donasi menampilkan DUA sumber sekaligus — campaign biasa DAN varian qurban per-
hewan dengan label eksplisit ("Donasi: X" vs "Qurban: X — kambing") — supaya admin men-target ID
yang benar-benar dipakai sebagai `itemId` di cart, bukan ID yang terlihat masuk akal secara
konseptual tapi tidak pernah cocok secara teknis.

**Pembatalan invoice — voucher usedCount WAJIB "dikembalikan", bukan permanen ter-pakai**:
`cancelInvoiceAction` (yang sudah punya lock `FOR UPDATE` + re-check status dari audit sesi
sebelumnya) ditambah blok voucher: `GREATEST(usedCount - 1, 0)` (jaga-jaga tidak pernah minus)
+ tandai `voucher_redemptions.cancelledAt` (BUKAN dihapus — audit trail tetap utuh, cuma tidak
dihitung lagi ke `usageLimitPerCustomer` via filter `cancelledAt IS NULL` di
`countCustomerRedemptions`). Tanpa ini, customer yang batal transaksi kehilangan kuota voucher
mereka selamanya meski transaksinya tidak pernah benar-benar terjadi.

**Alur kerja 6 fase, verifikasi bertahap** (pola SOP project yang sudah established, ditegaskan
lagi): Fase A (schema+helper) → B (integrasi checkoutAction) → C (UI checkout) → D (admin CRUD)
→ E (rollback pembatalan) → F (dokumentasi) — `tsc --noEmit` di KEDUA package
(`apps/web`+`packages/db`) dicek di setiap fase, `bun run build` penuh (dev server dimatikan
dulu, `.next` dibersihkan) dijalankan setelah UI selesai (Fase D) dan lagi di akhir — bukan
ditunda sampai semuanya "selesai" baru dicek sekali.

**Status akhir sesi**: kode SELESAI (nol error `tsc`, build produksi sukses, 4 route admin baru
terkonfirmasi muncul di build output). **Migration `0034_vouchers.sql` BELUM dijalankan di VPS**
dan **belum ada satu pun skenario diverifikasi manual di browser** (§ 9 `docs/arsitektur-
voucher.md` — 7 skenario tercantum, semua masih checklist kosong) — murni verifikasi statis
sejauh ini, konsisten dengan keterbatasan environment sesi ini yang sudah dicatat berulang di
lesson-lesson lain (tidak ada Docker/Postgres/browser lokal untuk uji end-to-end).

### [2026-07-19] Audit Voucher Pasca-Deploy — 4 Bug/Gap Ditemukan+Difix Sebelum Lanjut Modul Baru

> Detail lengkap: **`docs/arsitektur-voucher.md` § 11**. User eksplisit minta re-check docs vs
> kode aktual + cari bug/gap sebelum lanjut fitur berikutnya — pola yang sudah berulang di
> project ini (bandingkan lesson cicilan "4 Bug Ditemukan Saat Testing Manual" dan audit
> `recordIncome`/`syncInvoicePayment" sebelumnya): fitur yang "selesai secara implementasi" belum
> tentu bebas bug sampai benar-benar diaudit ulang sebagai satu kesatuan.

**1. Bug — `restrictEmail` dibandingkan case-sensitive padahal disimpan lowercase.** Server
action simpan `.toLowerCase()`, tapi resolver (`computeVoucherDiscount`/`countCustomerRedemptions`
di `voucher.ts`) membandingkan terhadap `customer.email` yang cuma di-`.trim()` di KEDUA caller
(`checkoutAction` dan `previewVoucherAction`). Customer ketik email beda casing dari yang
tersimpan → voucher personal ditolak keliru; dua submission beda casing bisa lolos sebagai "orang
berbeda" → bypass `usageLimitPerCustomer`. **Fix**: normalisasi HANYA di titik banding (bukan di
titik simpan `customerEmail`, casing asli tetap dipertahankan untuk display) — satu fix di
`voucher.ts` otomatis berlaku ke preview MAUPUN checkout karena keduanya reuse fungsi yang sama.

**2. Gap — invoice detail (admin & publik) tidak pernah menampilkan kode voucher/potongan**
meski datanya lengkap tersimpan (`invoices.voucherCode`/`voucherDiscountTotal`,
`invoice_items.discountAmount`) — `getInvoiceDetailAction`/`InvoiceDetail` type dan halaman
publik `/invoice/[id]`/`PublicInvoiceData` cuma baca `invoices.discount` (field legacy invoice
manual admin). **Bug turunan ditemukan SAAT mengerjakan fix ini**: draf pertama menampilkan
`Subtotal: invoice.subtotal` lalu `Diskon Voucher: -voucherDiscountTotal` berjajar — TAPI
`invoices.subtotal` untuk invoice hasil checkout SUDAH net-of-voucher (beda dari `invoices.discount`
legacy yang dipotong dari subtotal gross) — kalau ditampilkan apa adanya, diskon terpotong DUA
KALI secara visual, angka tidak akan pernah cocok ke `invoice.total`. **Fix**: rekonstruksi
subtotal gross untuk tampilan (`invoice.subtotal + invoice.voucherDiscountTotal`) SEBELUM
menampilkan baris diskon — untuk invoice tanpa voucher formula ini otomatis kembali ke
`invoice.subtotal` apa adanya (zero regresi ke invoice manual admin).

**Aturan digeneralisasi dari bug turunan #2**: kalau sebuah invoice bisa punya DUA field diskon
independen dengan semantik BEDA terhadap `subtotal` (satu dipotong dari gross, satu sudah baked-in
sebagai net) — SELALU rekonstruksi basis yang konsisten (gross) sebelum menampilkan keduanya
berjajar di satu tabel. Jangan asumsikan semua kolom "subtotal" di sistem yang sama berarti hal
yang sama, terutama kalau kolom itu dipakai dua alur berbeda (admin-manual vs cart-checkout) yang
dibangun di waktu berbeda.

**3. Gap — `validFrom`/`validUntil` di-parse UTC mentah, bukan dianchor ke timezone tenant.**
`new Date("2026-07-19")` = tengah malam UTC = jam 07:00 WIB — voucher "berlaku sampai 19 Juli"
expire jam 7 pagi WIB, bukan akhir hari. Ini PERSIS aturan yang sudah dikunci sesi-sesi
sebelumnya untuk modul Event dan Invoice/Billing ("setiap kode yang menghitung/membandingkan
tanggal untuk LOGIC BISNIS wajib anchor ke kalender timezone tenant") — terlewat di Voucher
karena dibangun setelah aturan itu dikunci tapi sebelum diaudit silang. **Fix**: helper
`resolveVoucherDateRange()` — `validFrom` → `00:00` tenant-local, `validUntil` → `23:59`
tenant-local, via `localDatetimeToUtcIso()` yang sudah ada (tidak perlu helper baru).

**4. Defensif — `usageLimit`/`usageLimitPerCustomer` tidak divalidasi terhadap `NaN`**
(`parseInt("abc",10)=NaN`, dan `NaN < 1` evaluasi `false` di JS, lolos validasi lama). Fix murah:
`Number.isNaN(...) || ... < 1`.

**Yang dicek dan dikonfirmasi AMAN**: DDL vs migration vs Drizzle schema (kolom/tipe/FK/urutan
tabel semua konsisten), `restrictPhone` (tidak kena bug sejenis — `normalizePhone()` E.164 tidak
punya masalah casing), interaksi cicilan (`convertInvoiceToInstallmentAction` selalu pakai
`invoice.total` net-of-voucher, tidak butuh perubahan), kode unik (`total > 0` guard sudah benar
sejak Fase B).

**Yang dicatat tapi TIDAK difix (severity rendah, di luar scope)**: `VoucherTargetPicker` fetch
opsi HANYA item aktif/published — item yang jadi non-aktif setelah ditarget "menghilang" dari
tampilan form edit meski datanya utuh (kosmetik). Duplikat-tiket detection di `checkoutAction`
jalan SEBELUM resolusi voucher — kalau customer kena redirect-ke-invoice-lama sambil bawa kode
voucher valid, kode itu diam-diam tidak pernah divalidasi/dipakai (skenario sangat jarang,
mengubah urutan deteksi berisiko melemahkan proteksi anti-duplikat yang sudah terbukti berfungsi).

**Pola audit yang terbukti berguna (generalisasi proses, bukan cuma temuan)**: baca ulang setiap
titik yang MEMBANDINGKAN dua nilai yang datang dari sumber berbeda (di sini: email tersimpan vs
email input customer) dan setiap titik yang MENGHITUNG tanggal/waktu untuk logic bisnis —
keduanya kelas bug yang sudah berulang kali muncul terpisah-pisah di project ini sepanjang
sejarah (bug tanggal WIB/UTC di cicilan, bug format Rupiah ICU/CLDR, sekarang bug casing email)
— begitu satu instance ditemukan di modul manapun, worth grep pola serupa di fitur BARU yang baru
saja dibangun sebelum dianggap selesai, bukan hanya menunggu laporan bug user.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Migration `0034_vouchers.sql` tetap
belum dijalankan di VPS — audit ini murni perbaikan kode aplikasi, tidak mengubah skema.

### [2026-07-19] Migrasi Lokal + Bug UX Nyata: Input Voucher Tersembunyi di Bawah Tombol Submit

> Detail lengkap: **`docs/arsitektur-voucher.md` § 12**

Setelah migration `0034_vouchers.sql` dijalankan manual di lokal (`psql` langsung ke
`postgres://webane@localhost/jalajogja` — DB dev bukan Docker, beda dari VPS), user buat voucher
lalu coba checkout sungguhan → melapor tidak pernah menemukan tempat input kode voucher sampai
invoice terbentuk.

**Root cause**: input voucher ditaruh di kolom KANAN (`checkout-form.tsx`, panel "Ringkasan
Pesanan", `grid lg:grid-cols-[1fr_360px]`). Tanpa `order` eksplisit, grid mempertahankan urutan
DOM saat stack jadi 1 kolom di mobile — form+tombol submit (kolom kiri) render duluan, ringkasan+
voucher (kolom kanan) baru MENYUSUL di bawahnya. Customer wajar berhenti begitu melihat tombol
"Buat Invoice", tidak pernah scroll melewatinya.

**Fix**: pindahkan widget INTERAKTIF (input+tombol Terapkan+badge applied+error) ke kolom KIRI,
diletakkan di luar kondisi `step === X` manapun (tetap tampil di semua step, persis sebelumnya)
tepat sebelum blok "Tombol navigasi" — dijamin muncul SEBELUM tombol submit di urutan baca apa
pun. Kolom kanan hanya menyisakan baris "Diskon Voucher: -Rp X" sebagai DISPLAY read-only.

**Aturan digeneralisasi**: form checkout 2-kolom (form kiri + ringkasan kanan) yang collapse ke
1 kolom di mobile — elemen INTERAKTIF yang wajib ditemukan sebelum submit (kode voucher, metode
bayar, dll) tidak boleh ditaruh di kolom ringkasan/kanan, karena kolom itu SELALU jatuh setelah
kolom kiri (termasuk tombolnya) begitu di-stack mobile. Kolom kanan aman hanya untuk elemen
display-only yang tidak butuh aksi user sebelum submit. Ini sinyal juga bahwa layout 2-kolom yang
dibangun SEBELUM sebuah elemen interaktif baru ditambahkan (di sini: checkout-form.tsx sudah ada
sebelum voucher) rawan menyembunyikan elemen baru itu di kolom yang salah — cek urutan visual
mobile SETIAP kali menambah elemen interaktif baru ke layout 2-kolom existing, jangan asumsikan
"ditaruh di panel yang secara konsep paling related" otomatis berarti "terlihat di urutan yang
benar".

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses. Belum
diverifikasi visual di browser oleh Claude — user diminta konfirmasi setelah reload.

### [2026-07-19] Sticky Bottom Bar Mobile — Keranjang + Checkout, dan Konflik dengan BottomNav FlexHeader

User minta `/keranjang` (Total + "Lanjut ke Checkout") dan `/checkout` (voucher + "Buat Invoice")
konsisten dengan pola sticky-bottom-bar yang sudah dipakai di halaman single event/donasi/produk
— tapi eksplisit **hanya untuk mobile**, desktop tidak berubah.

**Dua pendekatan berbeda dipakai, sengaja, tergantung apakah kontennya interaktif:**
- `checkout-form.tsx` (voucher input + tombol submit multi-step, PUNYA state) — SATU set elemen,
  posisi ditoggle via Tailwind responsive classes (`fixed inset-x-0 bottom-0 ... md:static
  md:inset-auto ...`) pada wrapper yang sama. TIDAK diduplikasi — kalau dibungkus
  `hidden md:block` + `md:hidden` seperti pola single-page shell, akan menghasilkan 2 `<input>`
  independen terikat ke state yang sama (fragile: autofill, focus, aksesibilitas).
- `cart-client.tsx` (Total + link statis, TIDAK PUNYA state selain angka) — diduplikasi murni
  (`hidden md:block` desktop asli tidak disentuh + `md:hidden` versi sticky mobile terpisah) —
  aman karena kontennya cuma teks + `<a>` tanpa interaksi kompleks, dan mengikuti pola
  duplikasi-chrome yang sudah established di modul lain (Event/Campaign/Produk header chrome).

**Aturan untuk elemen sticky-bottom baru ke depan**: kalau elemen berisi INPUT/FORM STATE, pakai
teknik reposisi CSS pada satu set elemen (seperti checkout-form). Kalau elemen murni DISPLAY +
link/tombol tanpa state, duplikasi per breakpoint boleh (lebih mudah dibaca, tidak ada state
sharing issue).

**Bug ditemukan SEBELUM sempat jadi bug nyata** (dicek proaktif, bukan dilaporkan user): FlexHeader
(salah satu dari 3 desain header) punya `BottomNav` — tab navigasi situs yang FIXED di
`bottom-0 z-50` di SEMUA halaman mobile kecuali yang di-treat sebagai "single mobile route" (lihat
`header-visibility.tsx`, `STATIC_TOP_SEGMENTS`). `/keranjang` dan `/checkout` SENGAJA ADA di
`STATIC_TOP_SEGMENTS` (bukan halaman single-item, header harus tetap terlihat penuh) — artinya
BottomNav TIDAK disembunyikan di kedua halaman itu, dan akan rebutan ruang `bottom-0` dengan bar
aksi baru yang baru saja dibangun (sticky Total+Checkout, sticky Voucher+Buat Invoice).

**Fix — BUKAN menyembunyikan seluruh header** (itu akan menghilangkan topbar/logo/keranjang-icon/
user-menu, kemunduran navigasi tanpa penggantinya seperti `SingleMobileTopBar` di halaman single):
`flex-header.tsx` sekarang deteksi `pathname` (via `usePathname()`, dengan strip `baseUrl` sama
seperti `header-visibility.tsx`) — kalau segmen tunggal path adalah `"keranjang"` atau
`"checkout"` (`PAGES_WITH_OWN_MOBILE_ACTION_BAR`), `<BottomNav>` (DAN spacer `h-14`-nya) TIDAK
dirender sama sekali. Header (topbar/logo/cart-icon/user-menu) tetap tampil normal — hanya tab
navigasi generik di bawah yang digantikan bar aksi milik halaman itu sendiri.

**Kenapa baru ketahuan sekarang, bukan sejak Mobile Single-Page Shell dibangun**: sepanjang fitur
shell mobile sebelumnya (Event/Campaign/Produk detail), SEMUA halaman yang dapat bottom sheet
JUGA masuk kategori "single mobile route" yang menyembunyikan SELURUH header (termasuk
BottomNav-nya) — jadi konflik ini tidak pernah muncul karena BottomNav memang selalu absen di
halaman-halaman itu. `/keranjang`/`/checkout` adalah kasus PERTAMA di project ini yang butuh
sticky bottom bar SENDIRI sambil header tetap harus terlihat penuh — pola baru, bukan cuma reuse.

**Aturan digeneralisasi**: setiap kali menambah elemen `fixed bottom-0` baru ke halaman publik
manapun, WAJIB grep `fixed.*bottom-0` di `components/website/public/` dulu untuk cek elemen
fixed-bottom lain yang mungkin masih aktif di halaman itu (di project ini per sesi ini: hanya
`flex-header.tsx` BottomNav dan `mobile-action-sheet.tsx` yang relevan) — jangan asumsikan
`bottom-0` selalu kosong hanya karena testing di header design lain (Classic/Pill) tidak
menunjukkan masalah.

**Bug susulan ditemukan user sendiri (via pertanyaan, bukan laporan bug langsung)**: user tanya
"`h-24 md:hidden` itu artinya `display:none` di mobile?" — jawaban sebenarnya kebalikannya:
`md:hidden` berarti "hidden MULAI breakpoint `md` KE ATAS" (hidden di desktop), BUKAN "hidden di
mobile". Di bawah `md`, class itu tidak berlaku sama sekali → div spacer render normal
(`display:block` default), menempati `h-24`/`h-44` (96px/176px) sebagai ruang kosong — ini
MEMANG disengaja (mencegah konten terakhir ketutupan bar sticky), tapi user benar bahwa jaraknya
terasa lebih lebar dari seharusnya. **Root cause nyata**: spacer & bar sticky ditaruh SEBAGAI
CHILD dari container `space-y-4`/`space-y-5` (cart-client.tsx / checkout-form.tsx) — Tailwind
`space-y-*` menambah `margin-top` ke SEMUA child kecuali yang pertama (dan child terakhir untuk
margin-bottom versi lama, tapi versi baru pakai `:not(:last-child)` untuk margin-bottom — intinya
spacer BUKAN child pertama, jadi kena `margin-top` tambahan 16-20px yang TIDAK diperhitungkan
saat menentukan tinggi spacer) — jarak kosong jadi lebih lebar dari `h-24`/`h-44` itu sendiri.

**Fix beda pendekatan tergantung struktur DOM sekitarnya**:
- `cart-client.tsx` — tidak ada grid, jadi spacer+bar dipindah TOTAL keluar dari `<div
  className="space-y-4">` (jadi sibling-nya via React Fragment `<>...</>`), aman karena flow
  linear biasa. Height spacer disesuaikan lebih presisi: `h-24`→`h-20` (dihitung ulang dari
  tinggi konten bar sesungguhnya: padding+baris teks+tombol ≈ 77-80px).
- `checkout-form.tsx` — spacer+bar ada DI DALAM grid track kolom kiri (`grid
  lg:grid-cols-[1fr_360px]`) — TIDAK bisa dipindah keluar dari `<div className="space-y-5">`
  begitu saja karena akan lepas dari track grid kolom kiri (auto-placement grid akan
  menempatkannya di baris baru merentangi kedua kolom, merusak layout desktop). Fix pakai teknik
  berbeda: tambah `mt-0` eksplisit pada spacer & bar (menimpa margin dari `space-y-5`) +
  `md:mt-5` pada bar (mengembalikan gap yang benar saat kembali ke `md:static` di desktop).
  Height spacer disesuaikan: `h-44`→`h-48` (192px, dihitung ulang dari tinggi voucher-card +
  gap + button-row + padding).

**Kenapa `mt-0` DIJAMIN menang lawan `space-y-5`, bukan soal urutan CSS**: dicek langsung di CSS
hasil build — Tailwind v4 membungkus rule `space-y-*` dengan `:where(...)` (spesifisitas 0),
sementara `.mt-0{margin-top:0}` adalah class selector biasa (spesifisitas normal). `:where()`
SELALU kalah dari selector non-`:where()` manapun terlepas urutan di stylesheet — inilah alasan
resmi Tailwind membungkus utility `space-y`/`space-x` dengan `:where()` sejak v3.3, supaya utility
margin/padding lain SELALU bisa menimpanya tanpa perlu `!important`. Aturan untuk kasus serupa ke
depan: kalau sebuah elemen anak dari container `space-y-*`/`space-x-*` butuh margin yang beda dari
default gap kontainer (termasuk 0), cukup tambah `mt-0`/`ml-0` dst secara eksplisit — TIDAK perlu
restrukturisasi DOM kalau elemen itu terikat pada grid/flex track tertentu yang tidak boleh
dipindah.

**Bug KEDUA di gap yang sama, ditemukan setelah user tes ulang mengira fix `mt-0` sudah cukup**:
gap MASIH lebar di `/keranjang`, tapi kali ini di lokasi yang salah — di ANTARA daftar belanjaan
dan section "ingin ikut donasi" (`DonationBannerCart`), BUKAN di paling bawah halaman tempat bar
sticky berada. Root cause: `keranjang/page.tsx` merender `<CartClient>` LALU
`<DonationBannerCart>` SETELAHNYA (kondisional, kalau ada campaign/produk terkait tiket di cart).
Spacer `h-20` yang saya taruh sebagai elemen TERAKHIR di dalam `CartClient` sendiri hanya jadi
elemen terakhir MILIK KOMPONEN itu — bukan elemen terakhir di HALAMAN, karena
`DonationBannerCart` masih dirender SETELAH `<CartClient>` oleh page-nya. Spacer + bar sticky
akhirnya nyangkut di TENGAH alur halaman (sebelum banner donasi), meninggalkan gap kosong besar
di tempat yang salah, sementara bar sticky sungguhan tetap `fixed` benar di viewport bottom
(independen dari DOM position) — tapi TIDAK ADA spacer sungguhan menjaga bagian PALING BAWAH
halaman (banner donasi) supaya tidak ketutupan bar.

**Fix**: spacer + bar sticky DIKELUARKAN TOTAL dari `CartClient` jadi komponen berdiri sendiri
`cart-mobile-bar.tsx` (`CartMobileBar`, murni display + link, tanpa state → tidak perlu
`"use client"`), dirender oleh `keranjang/page.tsx` sebagai elemen PALING TERAKHIR di halaman —
SETELAH blok `DonationBannerCart`, bukan cuma setelah `CartClient`. `CartClient` sendiri kembali
ke bentuk semula (Total+CTA `hidden md:block`, desktop-only, TIDAK ADA logic mobile sticky sama
sekali di dalamnya).

**Aturan digeneralisasi (pelajaran paling penting dari kedua bug gap ini)**: elemen "spacer +
sticky bar" WAJIB ditaruh sebagai anak PALING TERAKHIR dari SELURUH HALAMAN (page.tsx), BUKAN
sekadar anak terakhir dari SATU KOMPONEN yang kebetulan dirender di tengah halaman. Sebelum
menaruh spacer+bar sticky di dalam sebuah komponen, WAJIB cek page.tsx pemanggilnya: apakah
komponen itu benar-benar elemen TERAKHIR yang dirender di halaman, atau apakah masih ada konten
lain (banner, related items, dst) yang dirender SETELAHNYA? Kalau ada, spacer+bar HARUS
diekstrak ke komponen terpisah dan dirender ulang oleh page.tsx di titik yang benar-benar
terakhir — jangan asumsikan "komponen utama halaman" = "konten terakhir di halaman".

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses, dicek langsung di
CSS hasil build bahwa `.mt-0` benar-benar ter-generate sebagai class biasa (bukan `:where()`).
Belum diverifikasi visual di browser (termasuk belum dicoba dengan tenant yang benar-benar pakai
FlexHeader — perlu dicek tenant mana yang pakai desain apa sebelum klaim "sudah pasti tidak
konflik" secara visual, bukan cuma secara logic kode). **User minta jangan push dulu** — sudah
dikerjakan tapi TIDAK di-commit/push, menunggu user coba di browser dan konfirmasi.

### [2026-07-20] Audit Menyeluruh Spacer `md:hidden` — Bug GLOBAL di Header + 2 Halaman Detail Lain

User tanya balik setelah fix `/keranjang`: "berarti kita mau cek halaman perhalaman atau kamu
bisa cari masing2 halaman?" — sinyal untuk audit SISTEMATIS (grep seluruh codebase), bukan
menunggu laporan satu-satu. Ditemukan 2 kelas masalah tambahan, satu di antaranya GLOBAL
(berdampak ke SEMUA halaman publik, bukan cuma billing).

**Bug GLOBAL — `<div className="h-14 md:hidden" />` (spacer BottomNav FlexHeader) nempel di
BAWAH HEADER di SEMUA halaman, bukan di paling bawah halaman.** `flex-header.tsx` sebelumnya
membundel `<header>`, `<BottomNav>` (tab navigasi situs, `fixed bottom-0 z-50`), DAN spacer-nya
dalam SATU return — dan `FlexHeader` (via `HeaderVisibility`) dirender oleh `PublicLayout`
SEBELUM `<main>{children}</main>` DAN sebelum `<PublicFooter>`. Spacer yang seharusnya reserve
ruang di PALING BAWAH halaman (tempat `BottomNav` sungguhan berada secara visual) malah nempel
tepat di bawah `<header>` — di ATAS seluruh konten halaman — karena itu posisinya di DOM.
Ini bug PRA-EXISTING (bukan diperkenalkan sesi cart/checkout), berdampak ke SEMUA halaman
publik tenant manapun yang memakai desain header "Flex" — tidak pernah ketahuan sebelumnya
karena secara visual terlihat "cuma jarak antara header dan konten", mudah disalahartikan
sebagai spacing desain yang disengaja alih-alih bug.

**Fix**: `BottomNav` diekspor dari `flex-header.tsx` (bukan lagi private function), TIDAK
dirender di dalam `FlexHeader` sama sekali. Komponen baru `footer-bottom-nav.tsx`
(`FooterBottomNav`) — client component pakai `usePathname()`, replikasi 2 kondisi hiding yang
sebelumnya court hidup terpisah (`isSingleMobileRoute` dari `header-visibility.tsx` +
`hasOwnMobileActionBar` yang baru ditambah sesi sticky-bar sebelumnya) — DIEKSTRAK ke file
shared baru `lib/mobile-route-checks.ts` supaya kedua kondisi ini tidak drift antara
`header-visibility.tsx` (kontrol visibility SELURUH header) dan `footer-bottom-nav.tsx` (kontrol
visibility BottomNav+spacer saja). `PublicLayout` (`app/(public)/[tenant]/layout.tsx`) sekarang
render `<FooterBottomNav>` SETELAH `<PublicFooter>` — spacer akhirnya benar-benar jadi elemen
PALING TERAKHIR di setiap halaman, terlepas panjang konten halaman itu.

**2 bug tambahan ditemukan via subagent riset (dibaca, bukan diedit, sebelum saya putuskan fix)**
— pola SAMA PERSIS dengan bug `/keranjang` sebelumnya (spacer jadi anak terakhir KOMPONEN, bukan
anak terakhir HALAMAN), pada 2 dari 3 halaman yang pakai `MobileActionSheet`
(event/campaign/produk detail):
- **`/agenda/[slug]` (event) — DIKONFIRMASI AMAN**, tidak ada bug. `EventMobileTicketBar` memang
  betul-betul elemen terakhir di halaman itu.
- **`/campaign/[slug]` — BUG**. `CampaignMobileDonationBar` ada di dalam kolom "Kanan: form"
  (grid), tapi section "Campaign Lainnya" (related campaigns) render SETELAH grid itu ditutup.
- **`/produk/[productSlug]` — BUG**. `ProductDetailClient` (berisi `MobileActionSheet` di
  dalamnya) diikuti section "Deskripsi Produk" DAN "Produk Lainnya" (related products).

**Fix untuk kedua halaman**: BUKAN memodifikasi `MobileActionSheet` (komponen dipakai 3 fitur,
salah satu — Event — sudah terbukti benar, riskan diutak-atik) — cukup tambah
`<div className="h-24 md:hidden" />` (menyamai tinggi collapsed bar `MobileActionSheet`, lihat
`mobile-action-sheet.tsx`) sebagai elemen PALING TERAKHIR di masing-masing halaman (setelah
section related items), memastikan konten "Campaign Lainnya"/"Deskripsi Produk & Produk
Lainnya" juga terlindung dari ketutupan bar sticky. **Trade-off yang diterima, tidak dibenahi**:
`MobileActionSheet` tetap punya spacer LOKALNYA sendiri (h-24) tertanam di tengah halaman (di
dalam kolom form) — jadi sekarang ada DUA blank spacer di halaman campaign/produk (satu di
tengah dari MobileActionSheet, satu di ujung dari fix baru ini). Redundan tapi tidak salah
secara visual (malah bisa dibaca sebagai jeda alami antara form dan "X Lainnya") — dianggap
lebih aman daripada refactor `MobileActionSheet` yang berisiko merusak kasus Event yang sudah
benar.

**Aturan digeneralisasi (final, gabungan dari SEMUA bug spacer sesi ini)**: setiap kali sebuah
komponen berisi pasangan "spacer blank + elemen fixed", WAJIB tanya dua hal sebelum menaruhnya:
(1) apakah komponen ini benar-benar elemen TERAKHIR di halaman/layout yang memanggilnya (bukan
cuma "komponen utama"nya)? (2) apakah komponen ini anak dari sebuah container `space-y-*` yang
akan menambah margin tak terduga? Kalau jawaban (1) tidak pasti "ya", JANGAN taruh spacer di
dalam komponen — render spacer terpisah di titik yang benar-benar terakhir (page.tsx atau
layout.tsx), meski itu berarti mengekstrak komponen kecil terpisah seperti `CartMobileBar`/
`FooterBottomNav`.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses (3 putaran
build terpisah — global header fix, lalu campaign/produk fix). Belum diverifikasi visual di
browser untuk KEEMPAT halaman (keranjang sudah dikonfirmasi user placement-nya benar sebelum
sesi ini berlanjut ke temuan baru; checkout, campaign, produk BELUM dicoba user). **User minta
jangan push dulu** — semua perubahan (termasuk sesi-sesi sebelumnya di topik yang sama) masih
di working tree, belum commit/push.

### [2026-07-20] FlexHeader Mobile — Search/Cart Hilang di Topbar, 2 Putaran Desain

**Gejala**: di desain header "Flex" (2 baris), mobile TIDAK punya akses search maupun cart di
topbar — `SearchBar` outer div `hidden md:block` (search TIDAK PERNAH render di mobile sama
sekali), `CartButton` default `className="hidden md:flex"`. Yang tersisa di topbar mobile HANYA
logo + `UserButton` (avatar/login-daftar). Menu navigasi TETAP ada di mobile — via `BottomNav`
(tab bar di footer, lihat lesson global-header-spacer sebelumnya) — jadi bukan "menu hilang",
cuma search+cart yang benar-benar tidak ada aksesnya sama sekali di mobile.

**Putaran 1 (DITOLAK user, jangan diulang)**: kapsul (`rounded-full bg-primary`) berisi 3 ikon
(search+cart+menu), menu sebagai tombol paling menonjol (lingkaran putih solid), search+cart
lingkaran putih transparan ("kaca"). User: *"hahaha sepertinya tidak menarik haha... kayanya di
atas memang yang tepat memang flat aja, cukup 2 aja bro.. keranjang belanja dan search saja,
menu kita tetap di bawah"* — lalu diperjelas lagi: *"flat yang saya maksud hitam putih saja..
kasih border tipis saja warna grey atau apa gitu.."*. Pelajaran: instruksi desain awal user
("bisa tuh dibikin jadi misal...") bersifat EKSPLORATIF ("misal" = "for example"), bukan
spesifikasi final — jangan investasi berlebihan (3 komponen: capsule+overlay+drawer) sebelum
konfirmasi arah visual, terutama untuk permintaan UI yang dijelaskan lewat deskripsi teks
panjang tanpa mockup/referensi visual konkret.

**Putaran 2 (FINAL, diimplementasikan)**: HANYA 2 ikon (search, cart) — flat, hitam-putih,
border tipis abu-abu (`border border-border`), TANPA warna primary sama sekali. Menu navigasi
TIDAK ditambah ke header — tetap di `BottomNav` (footer) seperti sebelumnya, di luar scope
(user eksplisit: *"menu kita tetap di bawah"*, dan sebelumnya sudah bilang footer nav
"kita blm bahas itu" saat putaran 1). Style disalin PERSIS dari `IconButton` yang SUDAH ADA di
`pill-header.tsx` (`h-9 w-9 rounded-full border border-border text-muted-foreground
hover:text-foreground hover:bg-muted/60`) — bukan desain baru, REUSE pola yang sudah established
dan terbukti di desain header lain.

**Implementasi final** (`flex-header.tsx`, komponen tetap DI FILE INI — pola self-contained per
header design, sama seperti `pill-header.tsx` yang juga self-contained):
- `MobileHeaderIcons` — `flex md:hidden items-center gap-2`, 2 tombol lingkaran `h-8 w-8 border
  border-border text-muted-foreground hover:bg-muted/60`: search (buka `MobileSearchOverlay`),
  cart (REUSE `<CartButton>` existing, `className` di-override match style search).
- `MobileSearchOverlay` — dialog terpusat (fetch `/api/search`) — DIDUPLIKASI dari
  `SearchOverlay` di `pill-header.tsx`, konsisten konvensi "tiap file header self-contained".
- `MobileMenuDrawer` (putaran 1) — **DIHAPUS TOTAL**, bukan disembunyikan/dikomentari — kode
  mati tidak dipertahankan begitu jelas tidak dipakai.
- `cart-button.tsx`'s `badgeClassName` prop (ditambah putaran 1 untuk kontras badge di atas
  capsule primary) — **DIREVERT** ke hardcode original `bg-primary text-primary-foreground`,
  karena badge sekarang di atas tombol flat/bordered (bukan bg-primary lagi) jadi kontrasnya
  otomatis aman tanpa perlu override. Prop yang jadi tidak terpakai dihapus, bukan dibiarkan
  sebagai fleksibilitas spekulatif (prinsip project: jangan tambah abstraksi di luar kebutuhan).

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses (2 build
terpisah — putaran 1 lalu putaran 2/final). Belum diverifikasi visual di browser. **User minta
jangan push dulu** (masih berlaku dari sesi sebelumnya) — semua perubahan topik
header/cart/checkout sesi ini masih di working tree.

### [2026-07-20] Invoice Publik — Konfirmasi Pembayaran: Dialog (Desktop) + Bottom Sheet (Mobile)

**Masalah**: tombol "Konfirmasi Pembayaran" di `/invoice/[id]` sebelumnya toggle inline (form
muncul/hilang di bawah tombol, `showPayForm` state) — user: kurang ada "trigger" yang jelas,
baik di mobile (harus scroll cari tombolnya) maupun desktop (form muncul diam-diam di tengah
halaman tanpa penekanan visual, gampang tidak disadari user).

**Fix — dua treatment beda per breakpoint, SATU konten form yang sama** (`paymentFormFields`,
JSX di-assign ke variable di dalam IIFE `{canPay && (() => {...})()}` supaya form fields —
lengkap dengan semua state/handler yang sudah ada, tidak ditulis ulang — bisa dipakai identik
oleh Dialog maupun MobileActionSheet tanpa duplikasi logic):
- **Desktop** (`hidden md:block`): tombol biasa → buka **Dialog** (shadcn `dialog.tsx`, BEDA
  dari `AlertDialog` yang sudah dipakai untuk konfirmasi "Ya, Kirim" — `Dialog` untuk form
  input, `AlertDialog` tetap untuk konfirmasi ya/tidak setelah submit, keduanya hidup
  berdampingan di file yang sama untuk tujuan berbeda).
- **Mobile**: `MobileActionSheet` (komponen yang SUDAH ADA, dipakai Event/Campaign/Produk) —
  bar collapsed "Konfirmasi Pembayaran" (teks primary, bold) selalu nempel di bawah layar
  selama `canPay`, tap → naik/expand jadi form penuh. Field yang sama, state yang sama.
- **Notifikasi baru** (diminta eksplisit): banner `bg-primary text-primary-foreground` di
  BAGIAN PALING ATAS form (baik di Dialog maupun sheet) — "Pastikan pembayaran Anda sesuai
  dengan jumlah invoice sebelum mengirim konfirmasi."

**`showPayForm` dihapus total, diganti `payDialogOpen`** (desktop-only, kontrol `Dialog`).
Mobile TIDAK butuh state eksternal — `MobileActionSheet` sudah py `expanded` state sendiri,
mandiri. Ditemukan+dihapus SAAT refactor: `doSubmitProof()` (handler sukses submit) punya
`setShowPayForm(false)` yang jadi orphan reference — TIDAK diganti `setPayDialogOpen(false)`,
karena `justSubmitted=true` (baris setelahnya) sudah membuat `canPay` jadi `false`, dan SELURUH
blok `{canPay && (...)}` (termasuk Dialog dan MobileActionSheet di dalamnya) otomatis unmount —
menutup keduanya tanpa kode tambahan.

**Bug kelas yang SAMA ditemukan LAGI (4× dalam sesi ini — keranjang, campaign, produk, sekarang
invoice) — `MobileActionSheet` bukan elemen terakhir di halaman.** Setelah blok konfirmasi
pembayaran, halaman masih render "Bukti ditolak" (kalau ada) / "Status final" (paid/cancelled) /
"Menunggu Verifikasi" (`showWaitingPanel`) — semua BISA render SETELAH `MobileActionSheet` dalam
DOM. Spacer lokal sheet sendiri (`h-24` di dalam `mobile-action-sheet.tsx`) tidak melindungi
panel-panel itu. Fix: pola established — tambah `{canPay && <div className="h-24 md:hidden" />}`
sebagai elemen PALING TERAKHIR sebelum `</div>` penutup component, TIDAK memodifikasi
`MobileActionSheet` bersama (dipakai 3 fitur lain yang sudah terbukti benar).

**Aturan digeneralisasi (final, setelah 4× kejadian)**: `MobileActionSheet` HAMPIR SELALU butuh
spacer pengaman TAMBAHAN di titik yang benar-benar terakhir pada halaman yang memakainya —
JANGAN PERNAH asumsikan sheet ini "aman dipakai di mana saja" tanpa mengecek dulu apakah ada
konten LAIN yang render setelah titik penempatannya. Ini sekarang pola default yang harus dicek
setiap kali `MobileActionSheet` dipakai di halaman baru, bukan exception.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses. Belum
diverifikasi visual di browser. **User minta jangan push dulu** (masih berlaku) — belum
commit/push.

### [2026-07-20] Bug: "Kirim Konfirmasi" Tidak Merespons — Dua Radix Dialog Terbuka Bersamaan

User tes di lokal SEGERA setelah refactor Dialog+MobileActionSheet di atas: klik "Kirim
Konfirmasi" (submit form) tidak terjadi apa-apa — persis akibat langsung dari refactor barusan,
bukan bug lama.

**Root cause**: `handleSubmitProof` (submit form pembayaran) membuka `AlertDialog` konfirmasi
("Kirim Konfirmasi Pembayaran?") — TAPI form itu sendiri sekarang hidup DI DALAM `Dialog` (desktop)
atau `MobileActionSheet` (mobile) yang MASIH TERBUKA saat AlertDialog dibuka. Dua masalah beda
per platform:
- **Desktop**: `Dialog` (form) dan `AlertDialog` (konfirmasi) SAMA-SAMA `z-50` — dua Radix root
  terpisah aktif bersamaan biasa bentrok soal focus-trap/pointer-events, AlertDialog jadi
  terkesan tidak merespons klik meski secara teknis "terbuka".
- **Mobile**: `MobileActionSheet` pakai `z-[71]` (LEBIH TINGGI dari `z-50` AlertDialog) —
  AlertDialog benar-benar RENDER TERSEMBUNYI TOTAL di belakang sheet yang masih expanded, user
  klik "Ya, Kirim Konfirmasi" tapi sebenarnya mengklik AREA SHEET yang masih terbuka di atasnya.

**Fix**:
- `handleSubmitProof`: `setPayDialogOpen(false)` DULU sebelum `setConfirmOpen(true)` — desktop
  Dialog form tertutup dulu, giliran AlertDialog satu-satunya modal aktif.
- `mobile-action-sheet.tsx`: prop baru opsional `collapseSignal?: boolean` — `useEffect` yang
  collapse sheet begitu `collapseSignal` jadi `true`. Opsional/backward-compatible — pemakai
  lain (`EventMobileTicketBar`/`CampaignMobileDonationBar`/produk) yang tidak passing prop ini
  sama sekali tidak terpengaruh.
- `invoice-public-client.tsx`: `<MobileActionSheet collapseSignal={confirmOpen}>` — begitu
  `confirmOpen` jadi `true` (AlertDialog mau dibuka), sheet otomatis collapse duluan.

**Aturan digeneralisasi**: kalau sebuah form/panel yang hidup DI DALAM satu overlay (Dialog/
Sheet/Drawer) perlu memicu overlay KEDUA (konfirmasi, dst) saat submit — overlay PERTAMA WAJIB
ditutup dulu (atau dipaksa collapse) SEBELUM overlay kedua dibuka. Jangan biarkan dua overlay
Radix aktif bersamaan tanpa pertimbangan z-index/focus-trap eksplisit — gejalanya SERING berupa
"klik tidak merespons" (bukan crash/error yang mudah didiagnosis dari console), gampang disangka
bug lain yang tidak berhubungan.

**Sekalian ditingkatkan** (diminta user): notifikasi sukses submit — teks diubah jadi lebih
personal ("Terima kasih! Konfirmasi pembayaran Anda telah dikirim dan sedang menunggu
verifikasi.") + `window.scrollTo({top:0, behavior:"smooth"})` dipanggil begitu sukses, supaya
banner hijau (yang render dekat header invoice, di ATAS halaman) pasti terlihat customer
meski mereka submit dari Dialog/sheet yang posisinya di tengah/bawah layar.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses. Belum
diverifikasi visual di browser oleh Claude (dilaporkan user dari testing lokal mereka sendiri,
fix berdasarkan diagnosis kode + pemahaman perilaku Radix, BUKAN reproduksi visual langsung —
user diminta konfirmasi ulang setelah reload).

### [2026-07-20] Dokumentasi Mobile Shell Dikonsolidasi — `docs/arsitektur-mobile-shell.md`

Setelah 4× bug spacer identik (§ lesson-lesson di atas: keranjang, checkout, campaign, produk,
invoice) + 1 bug global (`BottomNav` FlexHeader) dalam SATU sesi, user eksplisit minta seluruh
pelajaran ini didokumentasikan dengan benar SEBELUM commit — bukan cukup ditinggal sebagai log
kronologis CLAUDE.md (yang memang berguna untuk riwayat, tapi bukan referensi operasional yang
gampang ditemukan saat mengerjakan fitur baru).

**Dibuat**: `docs/arsitektur-mobile-shell.md` — dokumen baru, konsolidasi PENUH dari nol (bukan
cuma link balik ke CLAUDE.md): klarifikasi semantik `md:hidden`, dua skema header mobile
(`isSingleMobileRoute` vs `hasOwnMobileActionBar`), arsitektur `BottomNav`/`FooterBottomNav`,
primitif `MobileActionSheet` + `collapseSignal`, **aturan inti** "spacer wajib jadi elemen
PALING TERAKHIR di HALAMAN, bukan di komponen" dengan 3 pola fix (A/B/C) + tabel kapan pakai
yang mana, teknik `mt-0` vs `space-y-*` (`:where()` spesifisitas 0), z-index nested Radix
overlay, riwayat bug (§ 8, ringkas — pointer ke CLAUDE.md untuk detail penuh), **checklist wajib**
sebelum menambah elemen `fixed bottom-0` baru, dan tabel inventaris spacer saat ini per halaman.

**Ditemukan sekalian saat audit**: 4 komentar kode (`post/[slug]/page.tsx`,
`single-mobile-topbar.tsx`, `mobile-route-checks.ts`) mereferensikan
`docs/arsitektur-frontend-publik.md § "Mobile Single-Page Shell"` — section itu **TIDAK PERNAH
ADA** di dokumen tsb (dicek via grep, nol match) sejak komentar itu ditulis di sesi-sesi
sebelumnya — pointer ke tempat yang tidak eksis. Difix: 3 komentar diarahkan ulang ke
`docs/arsitektur-mobile-shell.md` (dokumen baru yang sekarang benar-benar berisi kontennya), dan
`docs/arsitektur-frontend-publik.md` § 2 + § 12 ditambah bullet pointer eksplisit ke dokumen
baru — supaya siapa pun yang mulai dari index utama front-end publik (§ 2/12) langsung
diarahkan ke tempat yang benar, bukan cuma yang baca komentar kode.

**Aturan yang ditegaskan untuk sesi mendatang**: dokumen index (`arsitektur-frontend-publik.md`)
BOLEH menyebut nama section di dokumen detail dalam komentar kode SEBAGAI REFERENSI, tapi kalau
dokumen detailnya belum benar-benar ditulis (baru rencana/niat), JANGAN tulis referensi eksplisit
seolah-olah section itu sudah ada — tulis dulu isinya (atau minimal placeholder yang jujur), baru
referensikan dari kode. Referensi ke tempat yang tidak ada lebih buruk daripada tidak ada
referensi sama sekali, karena terlihat meyakinkan padahal menyesatkan.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan, sesuai SOP). Commit+push dieksekusi
setelah dokumentasi ini — instruksi awal "jangan push dulu" (berlaku di 4 lesson sebelumnya)
**dicabut eksplisit oleh user** di pesan yang sama dengan permintaan dokumentasi ini.

### [2026-07-20] Bug: Combobox Generik Cari Berdasar UUID, Bukan Label — Pencarian Selalu Gagal

User laporkan search PC IKPM Cabang di `/akun/lengkapi` tidak menemukan hasil meski datanya ada.
Root cause: `components/ui/combobox.tsx` — `<CommandItem value={opt.value}>` mengisi `value` cmdk
(dasar filter bawaan `cmdk`) dengan **UUID** opsi (`opt.value`, mis. ID cabang), bukan
**label**-nya (`opt.label`, nama cabang). `cmdk` mencocokkan teks yang diketik terhadap `value`
itu — ketik "Yogyakarta" dibandingkan ke string UUID acak → tidak pernah match, meski
`shouldFilter` aktif dan datanya benar-benar ada. Bug ini bukan cuma di 1 field — berlaku untuk
SEMUA pemakai `Combobox` generik (Settings timezone/font, form usaha/pesantren, dll) di mana
`value !== label`.

**Fix**: `value={opt.label}` (untuk filtering) + `onSelect={() => onValueChange(opt.value)}`
(ambil ID via closure, bukan dari parameter `onSelect` cmdk) — pola yang PERSIS sudah dipakai
benar di 2 implementasi combobox LAIN yang sudah lama ada (`SimpleCombobox` di
`members/wizard/step1-identity.tsx`, dan Combobox lokal di `wilayah-select.tsx`) — keduanya tidak
pernah kena bug ini karena sudah benar sejak awal. Fix di SATU file (`combobox.tsx`) otomatis
memperbaiki semua 10+ pemakainya sekaligus.

**Aturan digeneralisasi**: setiap kali membuat/mereview Combobox berbasis `cmdk`
(`CommandItem value=...`), `value` WAJIB berisi teks yang ingin dicocokkan pencarian (label),
BUKAN identifier internal (ID/UUID/enum-code) — resolve ID sesungguhnya via closure di
`onSelect`, jangan andalkan parameter yang dikirim balik oleh `cmdk`. `PublicLinkPicker`
(`components/ui/public-link-picker.tsx`) TIDAK kena bug ini — desainnya dari awal pakai
`shouldFilter={false}` + pencarian server-side, jadi nilai `CommandItem.value` (diisi `link.url`)
tidak pernah dipakai untuk filtering sama sekali.

### [2026-07-20] Public Link Picker — Semua Modul Terakomodir + Fix Arsitektur URL Custom Domain

> Arsitektur lengkap (setelah refactor ini): **`docs/arsitektur-public-link-picker.md`** — ditulis
> ulang total, dokumen versi lama basi (checklist § 8 semua `[ ]` padahal Fase 1-3 nav menu sudah
> lama selesai, field `types`/`total` di API diklaim ada padahal tidak pernah diimplementasikan).

User minta audit sebelum refactor lebih jauh: "cek dulu aja apakah ada informasi arsitektur",
lalu "cek juga apakah semua modul sudah terakomodir? donasi, event, product, dokumen, category
post, pages, dll", lalu "ok mari kita refactoring... pastikan semua modul terakomodir.. cek juga
arsitektur url agar support custom domain dengan perfect."

**Gap modul ditemukan (audit sebelum eksekusi, bandingkan registry vs seluruh folder
`app/(public)/[tenant]/`)**: 3 modul TIDAK terakomodir sama sekali di
`lib/public-url-registry.ts`/`api/ref/public-links`:
1. **Event/Agenda** — detail individual (`/agenda/{slug}`) sama sekali tidak ada tipe-nya di
   registry, padahal Post/Produk/Campaign semua sudah punya. (`/event/{slug}` yang sempat
   dikira rute aktif ternyata cuma redirect lama ke `/agenda/{slug}`.)
2. **Campaign** — kategori (`/campaign?category={slug}`) belum ada, meski detail campaign
   individual sudah lama ada.
3. **Dokumen** — modul ini TOTAL tidak terakomodir, bahkan arsip statisnya (`/dokumen`) tidak
   terdaftar sebagai rute statis sama sekali, apalagi detail (`/dokumen/view/{id}`) dan kategori.

**Kuirk ditemukan saat riset**: `document_categories` punya kolom `slug`, TAPI
`dokumen/page.tsx` filter kategorinya `eq(documents.categoryId, category)` — pakai **UUID id**
langsung dari query param, BUKAN resolve slug→id seperti pola post/event/campaign yang
konsisten. `buildDocumentCategoryUrl()` dibuat mengikuti perilaku NYATA halaman itu (pakai id),
dicatat eksplisit di dokumen supaya kalau nanti `dokumen/page.tsx` diseragamkan ke pola slug,
builder-nya diupdate bersamaan — jangan biarkan drift.

**Fix — 5 tipe baru + 1 rute statis baru** ditambah ke `lib/public-url-registry.ts` +
`app/api/ref/public-links/route.ts` (5 query paralel baru, total sekarang 12 query) +
`components/ui/public-link-picker.tsx` (ikon baru): `event`, `event-category`, `campaign-category`,
`document`, `document-category`, plus static route "Arsip Dokumen" (`/dokumen`).

**Bug arsitektur custom domain ditemukan+difix — bagian TERPENTING dari sesi ini**: setelah
memutuskan sekalian menuntaskan Fase 3 lama (field CTA Hero + CTA section masih `<Input>` teks
bebas, belum pakai `PublicLinkPicker`), ditemukan gap nyata: `PublicLinkPicker` SELALU
mengembalikan URL berprefix `/{slug}/...` (karena admin selalu edit dari `jalakarta.com/app/
{slug}/...`, tidak pernah dari custom domain — sudah diisolasi sejak lama). Nav menu SUDAH benar
menangani ini (`layout.tsx` strip prefix `/{slug}` sebelum render kalau `isCustomDomain`) — TAPI
`HeroSection`/`CtaSection` (dua-duanya merender `d.ctaUrl`/`d.ctaSecondaryUrl` mentah ke
`<PublicButton href=...>`) **TIDAK PERNAH melakukan stripping serupa** — `baseUrl` sudah jadi
prop di `HeroSection` tapi cuma dipakai untuk href kartu "Agenda Terbaru"/"Berita Terbaru", tidak
pernah untuk CTA button. Selama field itu masih `<Input>` bebas ini "aman" secara kebetulan
(kalaupun admin ngetik manual, kemungkinan besar dia tidak tahu soal konvensi prefix slug) — tapi
begitu diganti `PublicLinkPicker` yang SELALU mengembalikan `/{slug}/...`, bug ini akan langsung
nyata: di custom domain, tombol CTA akan mengarah ke `visikita.com/visikita/campaign/...`
(dobel-slug, 404) — persis kelas bug yang sudah berulang kali muncul & difix di sepanjang
riwayat project ini untuk hardcoded link lain.

**Fix**: helper murni baru `lib/strip-tenant-prefix.ts` (`stripTenantPrefix(href, slug)`, zero
dependency, aman client maupun server — cukup string match `/{slug}` / `/{slug}/...`, selain itu
dikembalikan apa adanya sehingga anchor `#section` dan URL eksternal tidak pernah tersentuh).
Diterapkan di 3 titik render (daftar kanonik disimpan di dokumen arsitektur § 9, WAJIB diupdate
kalau ada integrasi `PublicLinkPicker` baru ke depan):
1. `layout.tsx` (nav menu) — direfactor pakai helper shared ini (DRY, perilaku identik, sebelumnya
   logic inline sendiri).
2. `hero-section.tsx` — strip `data.ctaUrl`/`data.ctaSecondaryUrl` SEKALI di dispatcher (sebelum
   diteruskan ke `HeroDesign1`/`HeroDesign2`), bukan diulang di masing-masing file desain.
3. `landing-template.tsx` (`CtaSection`) — ditambah prop `baseUrl`+`tenantSlug` (sebelumnya cuma
   terima `data`), strip `ctaUrl` sebelum dirender.

**Aturan digeneralisasi**: `PublicLinkPicker` HANYA menjamin URL yang dikembalikannya benar untuk
PATH MODE (`jalakarta.com/{slug}/...`) — TIDAK PERNAH menjamin kebenarannya di custom domain.
Setiap kali field baru diintegrasikan ke picker ini (widget area, dst — belum ada field href
sama sekali di sana saat ini, tapi akan ada suatu saat), titik RENDER-nya di sisi publik WAJIB
memanggil `stripTenantPrefix()` — jangan asumsikan "URL dari picker pasti sudah benar", karena
justru sumber string-nya (konsisten `/{slug}/...`) itulah yang butuh transformasi tambahan di
custom domain, sama seperti nav menu selama ini.

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Belum diverifikasi visual di browser
(khususnya: coba search Event/Dokumen/kategori Campaign di picker, dan coba render Hero/CTA
section di tenant dengan custom domain aktif) — direkomendasikan dicoba user sebelum dianggap
100% final, terutama bagian custom domain karena area ini historically rawan regresi diam-diam.

### [2026-07-20] Public Link Picker — "Browsable" vs "Wajib Dicari", 2 Putaran Koreksi User

Setelah refactor picker (lesson di atas) di-deploy ke dev, user coba langsung dan bilang search
kategori/tag tidak ketemu — TERNYATA bukan bug: mereka mengetik "kategori"/"tag" (nama TIPE
konten), sedangkan pencarian mencocokkan `q` terhadap NAMA SEBENARNYA kategori/tag ("Berita",
"Olahraga", dikonfirmasi via query langsung ke DB lokal). Tapi user menegaskan lebih jauh: **mau
kategori (dan tag) BENAR-BENAR ADA** begitu popover dibuka, tanpa perlu ketik apa pun dulu —
sama seperti rute statis.

**Fix (putaran 1)**: pisahkan konten dinamis jadi 2 kelas query di `/api/ref/public-links`:
- **Selalu di-fetch** (kategori/tag lintas 5 modul: post/produk/event/campaign/dokumen) — kalau
  `q` kosong, `.where()` diskip sepenuhnya (`qLike ? ilike(...) : undefined`), ambil SEMUA baris
  sampai `BROWSE_LIMIT=50` (bukan cuma limit pencarian 6).
- **Wajib `q` dulu** (post/produk/event/campaign/dokumen INDIVIDUAL + pesantren/usaha/profesional)
  — tetap gated `!qLike ? Promise.resolve([]) : tdb.select(...)`, karena listnya bisa panjang.

**Putaran 2 (koreksi susulan)**: user tanya lagi "halaman yang sudah dibuat juga tidak ada?" —
gap yang SAMA PERSIS, cuma belum kepikiran untuk `pages` di putaran pertama. Root cause pola
pikir yang salah: saya sempat mengelompokkan berdasarkan "ini taksonomi atau konten individual?"
— padahal kriteria yang benar adalah **"realistis berapa banyak per tenant?"**. Halaman CMS
(seperti kategori/tag) jumlahnya KECIL dan admin-curated (beberapa sampai puluhan halaman: Tentang,
Kontak, FAQ, dst) — BUKAN taksonomi, tapi tetap masuk akal di-browse semua. Fix: pindahkan `pages`
dari grup "wajib q" ke grup "selalu fetch", rename konstanta `TAXONOMY_LIMIT` → `BROWSE_LIMIT`
(supaya namanya tidak lagi menyiratkan "cuma untuk taksonomi").

**Aturan digeneralisasi**: kriteria "browsable vs wajib dicari" untuk field autocomplete
BUKAN "apa jenis kontennya" (taksonomi/halaman/produk/dst) — tapi **"kalau tenant ini eksis
bertahun-tahun, realistis list ini tetap puluhan (aman di-browse semua) atau bisa jadi ratusan
(wajib dicari)?"**. Setiap kali menambah tipe konten baru ke picker manapun di aplikasi ini, tanya
pertanyaan itu dulu — jangan asumsikan berdasarkan kategori konseptual semata, karena halaman CMS
membuktikan sebuah "konten individual" (bukan taksonomi) bisa tetap browsable kalau jumlahnya
realistis kecil.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error di kedua putaran fix. Doc
`docs/arsitektur-public-link-picker.md` § 3/3a ditulis ulang untuk mencerminkan kriteria yang
benar (bukan cuma "taksonomi"), termasuk halaman CMS di grup browsable.

### [2026-07-20] BottomNav — Ikon Generik `Link2` Diganti Resolusi Per-Href + Redesain Floating Home

User minta 2 hal sekaligus: (1) ikon per item BottomNav (tab nav situs di footer mobile, desain
"Flex") harus SAMA dengan ikon yang dipakai `PublicLinkPicker` — sebelumnya SEMUA item render ikon
generik `Link2`, terlepas link-nya menunjuk ke apa; (2) redesain visual — tombol Beranda melayang
di tengah (floating action button style), bar melengkung, primary color + ikon putih.

**Root cause ikon generik**: `NavItem` (`lib/nav-menu.ts`) cuma simpan `{id, label, href,
external, order}` — TIDAK ADA field `type`, sejak migrasi dari model lama berbasis `type` (yang
didokumentasikan di `docs/arsitektur-header-footer-publik.md` sebagai `NAV_TYPE_ICONS` — ternyata
dokumen itu SUDAH LAMA STALE, kode aslinya sudah tidak eksis, ditemukan+dikoreksi sekalian). Tanpa
`type`, `BottomNav` tidak pernah bisa lookup ikon secara langsung seperti `PublicLinkPicker` yang
punya `PublicLink.type` pasti dari API.

**Fix — modul ikon bersama baru**: `components/ui/public-link-icon.tsx` — SATU sumber kebenaran
tabel ikon-per-tipe (dipindah dari duplikasi lokal di `public-link-picker.tsx`), dengan DUA fungsi
resolve:
- `iconForType(type, group)` — dipakai `PublicLinkPicker`, `type` sudah pasti dari API.
- `iconForHref(href, baseUrl)` — dipakai `BottomNav`, infer tipe dari SEGMEN PERTAMA path
  (`/post`→Newspaper, `/agenda`→Calendar, dst — mengikuti pola builder `public-url-registry.ts`
  secara terbalik). Bekerja untuk nav item hasil pilih picker MAUPUN item lama/manual — TIDAK
  butuh migrasi data, karena inferensi murni dari string href yang sudah tersimpan.

**Redesain visual**: tombol Beranda SELALU tampil sebagai floating button di tengah bar
(`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2`, `bg-primary text-white`,
`ring-[6px] ring-white` sebagai halo pemisah dari bar) — TIDAK diambil dari `nav_menu` (item yang
kebetulan juga menunjuk beranda otomatis difilter via `isHomeHref()`, cegah duplikat). Item
`nav_menu` lain dibagi 2 kiri + 2 kanan (celah tengah `w-16` untuk ruang tombol), sisanya tetap ke
drawer "Lainnya" (ikonnya juga di-resolve sekarang, sebelumnya generik).

**Koreksi putaran 2 (user coba langsung, 2 masukan)**:
1. **Kiri 2 vs kanan 3 tidak seimbang** — implementasi awal: `left = items.slice(0,2)`,
   `right = rest.slice(0,2)` (2 item), lalu tombol "Lainnya" DITAMBAHKAN lagi setelah `right` di
   baris flex yang sama → kalau item > 4, kanan jadi 3 ikon (2 nav + Lainnya) vs kiri 2 — bukan
   bug logic, murni salah hitung slot saat desain awal. Fix: cap `mainItems = items.slice(0,3)`
   (maks 3 item nav ASLI, bukan 4), `left = mainItems.slice(0,2)`, `right = mainItems.slice(2,3)`
   (0 atau 1 item) — tombol "Lainnya" (kalau ada overflow) mengisi slot ke-2 kanan, sehingga
   kanan selalu ≤2 sama seperti kiri.
2. **Floating button menonjol 50%, diminta 15-20%** — `-translate-y-1/2` (persentase CSS
   transform relatif ke tinggi elemen ITU SENDIRI, bukan ke parent) menempatkan PUSAT tombol
   persis di garis atas bar → separuh tinggi (50%) selalu di atas garis, separuh di bawah. Fix:
   `-translate-y-[15%]` — geser naik cuma 15% dari tinggi elemen, sehingga cuma "puncak kecil"
   yang menonjol di atas bar, sisanya (85%) visually duduk DI DALAM area bar (tetap kelihatan
   penuh karena elemen `absolute` selalu dicat di atas sibling `static` terlepas urutan DOM —
   bukan ketutup). Tambah `z-10` eksplisit + `ring-4` (dari `ring-[6px]`) untuk proporsi yang
   lebih pas di ukuran tonjolan baru yang lebih kecil.

Ini kelas kesalahan desain "pilih pola CSS yang GAMPANG ditulis (`-translate-y-1/2` = simetris,
`slice(0,2)+slice(0,2)` = simetris terlihat) tapi TIDAK memverifikasi hasil visualnya sesuai
spesifikasi user yang sebenarnya" — perlu diingat: tidak ada browser di environment ini untuk
verifikasi visual sebelum user coba sendiri, jadi WAJIB baca ulang spesifikasi user kata-per-kata
(bukan menerka pola "yang biasanya begini") saat tidak bisa verifikasi visual langsung.

**Koreksi putaran 3 — ikon Halaman (Page) masih fallback ke ikon rantai `Link2`**: `iconForHref`
punya `SEGMENT_TYPE` (post/agenda/produk/campaign/pesantren/usaha/profesional, masing-masing
punya prefix segmen path TETAP) dan `SEGMENT_STATIC_ICON` (anggota/statistik/keranjang/login/
register/akun) — tapi halaman CMS (`buildPageUrl` = `/{slug}/{pageSlug}`) TIDAK PUNYA prefix
segmen tetap sama sekali, jadi tidak pernah match salah satu dari dua tabel itu, selalu jatuh ke
fallback generik `Link2`. **Fix**: karena `/{slug}/{pageSlug}` adalah SATU-SATUNYA rute wildcard
1-segmen di seluruh registry (semua rute lain yang dikenal sudah eksplisit dicek di atas), setiap
href 1-segmen yang tidak match apa pun di atas HAMPIR PASTI halaman CMS — default-kan ke ikon
`FileText` (sama seperti `LINK_TYPE_ICONS.page`), bukan `Link2`. Href >1 segmen yang tidak dikenal,
anchor `#...`, atau URL eksternal tetap fallback `Link2` (kasus itu memang ambigu, tidak bisa
di-infer dengan percaya diri).

**Bug yang diantisipasi dari lesson sesi ini sendiri**: bar jadi lebih tinggi (`h-16`+`pt-3`=76px,
sebelumnya `h-14`=56px) — spacer di `footer-bottom-nav.tsx` WAJIB ikut naik (`h-14`→`h-20`),
kalau tidak persis mengulang bug "spacer tidak match tinggi elemen fixed" yang sudah ditemukan
4× di sesi-sesi sebelumnya (§ `docs/arsitektur-mobile-shell.md`). Dicek dan difix BERSAMAAN,
bukan menunggu laporan bug lagi.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. Doc `docs/arsitektur-header-footer-
publik.md` bagian "Icons per NavItemType"/wireframe lama (stale, dari model `type`-based) ditulis
ulang total. `docs/arsitektur-mobile-shell.md` § 3 ditambah catatan perubahan tinggi spacer. Belum
diverifikasi visual di browser — desain floating button perlu dicoba langsung untuk konfirmasi
proporsi (ukuran 64px, overlap, halo ring) terasa pas di device sungguhan, bukan cuma dari kode.

### [2026-07-20] Refactor Login/Register — Wording + Cegah Kirim OTP ke Nomor Tak Terdaftar

User minta 4 perbaikan sekaligus di alur register/login berbasis WA OTP:

1. **Wording stambuk tidak ketemu** (`register-form.tsx`) — "Data belum ditemukan. Anda akan
   didaftarkan sebagai anggota IKPM baru." dianggap rancu (menyiratkan pendaftaran OTOMATIS
   terjadi, padahal ini cuma info status lookup, bukan aksi). Diganti: "Anda dapat menggunakan
   Nomor induk ini untuk pendaftaran."
2. **Label field** — "No. HP / WhatsApp" → "Nomor WhatsApp" (`register-form.tsx`; `login-form.tsx`
   dan `forgot-password/page.tsx` SUDAH benar sejak awal, cuma register yang ketinggalan).
3. **Notifikasi "sudah terdaftar" bocorkan nama** — blok `lookup.hasAccount===true` sebelumnya
   "Akun untuk **{nama}** sudah terdaftar..." — diganti "Nomor sudah terdaftar. Masuk atau lupa
   password." (nama dihapus, murni privasi — tidak ada alasan bagi siapa pun yang iseng mencoba-
   coba nomor untuk tahu nama pemiliknya).
4. **Login WA OTP kirim ke nomor manapun tanpa cek dulu** — `send-otp` (type=login) sebelumnya
   SELALU generate+kirim OTP terlepas nomor terdaftar atau tidak; baru ditolak belakangan di
   `login-via-otp` (setelah OTP diverifikasi) — artinya OTP TERLANJUR terkirim (biaya WA + user
   bingung "kok dapat kode tapi gak bisa login"). Fix: `send-otp` sekarang cek registrasi
   SEBELUM generate/kirim, kalau tidak ketemu → 404 tanpa kirim apa pun. Client (`login-form.tsx`)
   deteksi status 404 → tampilkan "Nomor Anda belum terdaftar, silakan mendaftar melalui
   [tautan ini]" dengan LINK sungguhan ke `${baseUrl}/register` (bukan teks polos — perlu state
   terpisah `notRegistered` karena pesan generik `{error}` di JSX cuma render string, tidak bisa
   sisipi `<a>`).

**Dedup ditemukan sekaligus (bukan diminta, tapi jelas perlu)**: "cari akun by nomor HP"
(`public.profiles` dulu, lalu `public.contacts→public.members`) ternyata SUDAH terduplikasi
PERSIS identik 2× (`login-via-otp/route.ts` dan `verify-otp/route.ts`) sebelum perubahan ini —
dan feature #4 di atas butuh logic yang SAMA PERSIS lagi (kali ke-3). Diekstrak ke
`lib/find-user-by-phone.ts`, dipakai oleh SEMUA TIGA route (`send-otp` baru, `login-via-otp` dan
`verify-otp` dua-duanya direfactor pakai helper ini, duplikat lokal dihapus). File ini aman tanpa
guard `"server-only"` — cuma pernah diimpor dari `route.ts` (server-only secara struktural by
Next.js convention), beda dari kasus `nav-menu.ts`/`tenant-timezone.ts` yang butuh split karena
DIPAKAI JUGA oleh client component.

**Bug ditemukan+difix sekaligus saat investigasi (bukan diminta eksplisit, tapi langsung relevan
ke ask #3)**: `GET /api/akun/lookup-member?phone=` — cabang `profileFound` (match ke akun publik
`public.profiles`, BUKAN member IKPM) TIDAK PERNAH menyertakan field `hasAccount` sama sekali di
response — client `MemberLookup` type mendeklarasikannya WAJIB ada (`hasAccount: boolean`), jadi
di runtime nilainya `undefined` (falsy). Akibatnya `isClaiming = lookup?.found && !lookup.
hasAccount` salah anggap nomor yang SUDAH terdaftar sebagai akun publik sebagai "member belum
diklaim" — form menampilkan alur klaim yang salah, bukan "sudah terdaftar". Fix: cabang
`profileFound` sekarang eksplisit `hasAccount: true` (profil publik SELALU berarti akun sudah
ada, beda dari `members` yang bisa eksis tanpa `betterAuthUserId`). Client type disesuaikan
(`memberId`/`type` jadi optional, `hasAccount` tetap wajib pada `found:true`).

**Keputusan scope yang SENGAJA tidak diperluas** (dicatat, bukan lupa): pengecekan duplikat
nomor WA saat register HANYA aktif di jalur "member" (IKPM) — jalur "public" (bukan anggota)
masih belum ada live-check nomor duplikat sama sekali, karena `handlePhoneChange` sejak awal
di-gate `accountPath === "member"`. Memperluas ke jalur public butuh koordinasi tambahan
(`isClaiming` HARUS ikut di-gate `accountPath==="member"` juga, kalau tidak jalur public bisa
salah masuk mode "klaim member" kalau nomornya kebetulan cocok member belum-terklaim) — di luar
scope literal yang diminta, belum dieksekusi, dicatat sebagai follow-up kalau diminta.

**Susulan (giliran sama, user tanya balik)**: cek registrasi sebelum kirim OTP TADINYA hanya
diterapkan untuk `type==="login"` — sengaja tidak diperluas ke `type==="reset_password"`
(`forgot-password/page.tsx`) karena "di luar scope literal" permintaan pertama. User langsung
tanya balik: apakah forgot-password juga sudah dijaga sama? Jawabannya belum — root cause dan
solusinya PERSIS SAMA (OTP terlanjur terkirim ke nomor tak terdaftar, baru ditolak belakangan di
`verify-otp`), jadi cukup perluas kondisi guard di `send-otp` (`validType === "login" ||
validType === "reset_password"`) — TIDAK perlu helper/logic baru, sudah pakai `findUserByPhone`
yang sama. `forgot-password/page.tsx` dapat pola UI identik `login-form.tsx`: state
`notRegistered` + blok pesan bertaut ke `/register` (bukan teks polos digabung ke `{error}` biasa,
karena butuh elemen `<a>` sungguhan). `verify-otp/route.ts`'s cek `reset_password` yang sudah ada
sejak awal TIDAK dihapus — tetap jadi lapis pertahanan kedua (defense-in-depth) kalau
`verify-otp` dipanggil langsung tanpa lewat `send-otp` dulu.

**Pelajaran**: kalau instruksi awal user eksplisit membatasi scope ke SATU flow ("masuk/login")
padahal root cause-nya generik dan ada flow LAIN yang identik persis (reset_password sama-sama
"kirim OTP by phone, verified belakangan"), catat eksplisit sebagai keputusan sengaja (sudah
dilakukan) — TAPI juga wajar untuk user menanyakan balik apakah flow serupa lain sudah ikut
terlindungi. Pola ini (fix di 1 tempat → user tanya "yang lain juga?") sudah berulang beberapa
kali di sesi-sesi sebelumnya (bug spacer mobile, `DndContext`, dll) — kalau root cause SUDAH
diidentifikasi generik, pertimbangkan menyebutkan proaktif tempat lain yang secara struktural
identik saat melaporkan hasil, bukan menunggu ditanya balik.

**Verifikasi**: `tsc --noEmit` bersih di apps/web + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan) — dijalankan 2× (fix awal + fix susulan
forgot-password). Belum diverifikasi visual/end-to-end di browser (perlu WA gateway aktif untuk
benar-benar kirim OTP) — user diminta coba alur penuh: register dengan stambuk kosong/isi,
register dengan nomor yang sudah terdaftar, login WA OTP ke nomor terdaftar vs tidak terdaftar,
DAN forgot-password ke nomor tidak terdaftar.

### [2026-07-20] PC IKPM Cabang Diwajibkan di `/akun/lengkapi`

User: "ikpm cabang itu diwajibkan, karena dia muara ikpm-nya" — lalu klarifikasi "maksud saya
dalam form lengkapi profil" (bukan form admin `members/new`/`edit`, meski field yang sama juga
ada di sana sejak lesson "[2026-07-13] PC IKPM Cabang — 3 Bug Sekaligus"). Field `primaryCabangRefId`
di `/akun/lengkapi` Step 1 sebelumnya opsional (tidak ada asterisk, tidak masuk kondisi `disabled`
tombol, tidak ada `setError` check) — sekarang wajib, mengikuti pola PERSIS yang sudah dikunci di
lesson "[2026-07-13] Bug: Field Wajib Tanpa Indikator Visual": (1) asterisk merah di label, (2)
masuk kondisi `disabled` tombol "Simpan & Lanjutkan", (3) `setError("PC IKPM Cabang wajib
dipilih.")` eksplisit di `saveStep1()` sebelum submit — tiga lapis yang sama dengan semua field
wajib lain di step ini (nama/gender/tanggal lahir/tahun lulus/profesi/wali santri).

**Scope sengaja TIDAK diperluas ke form admin** (`members/new`/`members/[id]/edit`) — user
eksplisit bilang "form lengkapi profil" saja. Form admin biarkan tetap opsional untuk sekarang
(masuk akal: admin kadang input data awal anggota sebelum tahu cabangnya, self-service adalah
titik di mana data ini SEHARUSNYA sudah lengkap).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error.

### [2026-07-20] Bug: QR WhatsApp Tidak Muncul — GOWA `/statics/qrcode/*` Butuh Auth yang Browser Tidak Bisa Kirim

User laporkan 2 masalah berurutan pada tenant `pc-ikpm-jogjakarta`:

**Masalah 1 — device WA "hilang" setelah nonaktif+aktifkan ulang**: didiagnosis via SSH+curl
langsung ke GOWA (`gowa.jalakarta.com`) — `GET /app/devices` (dengan `X-Device-Id` header)
awalnya cuma menampilkan `visikita`, TIDAK ADA `pc-ikpm-jogjakarta`, meski DB tenant sudah
punya `whatsapp_config.device_id` tersimpan (bukti `connectWhatsAppAction` sempat berjalan
"sukses" tanpa error). Root cause: GOWA sempat punya sisa state device yang tidak konsisten
setelah dihapus (`POST /devices` merespons seolah "already exists" — kondisi yang KODE KITA
sengaja anggap aman/lanjut, sesuai dokumentasi GOWA yang memang return 500 utk device yang
sudah ada — tapi device itu ternyata tidak benar-benar usable/listed). **Fix darurat**:
memanggil ulang `POST /devices` secara manual via curl langsung ke GOWA berhasil membuat device
fresh (`state: "disconnected"`) — device sekarang ada dan siap di-pairing.

**Masalah 2 (root cause SEBENARNYA dari "QR tidak muncul", ditemukan setelah Masalah 1 selesai)**:
user laporkan Mixed Content warning — `qr_link` dari GOWA mengembalikan `http://
gowa.jalakarta.com/statics/qrcode/scan-qr-{uuid}.png` (scheme HTTP, bukan HTTPS) padahal
endpoint publik GOWA sesungguhnya HTTPS (GOWA di belakang reverse proxy tidak tahu skema
eksternal yang dipakai). `app/api/wa/qr/route.ts` SEBELUMNYA cuma sanitasi kasus
`startsWith("/")` (relatif) atau `includes("localhost"/"127.0.0.1")` — TIDAK menangkap kasus
absolute URL dengan hostname BENAR tapi scheme salah, jadi `http://` mentah lolos apa adanya
ke client, yang di-embed sebagai `<img src={qrLink}>`.

**Investigasi lanjutan (curl langsung, BUKAN cuma baca kode) mengungkap masalah yang JAUH lebih
dalam dari sekadar scheme**: `/statics/qrcode/*.png` di GOWA **selalu** butuh header
`Authorization: Basic ...` DAN `X-Device-Id` — dikonfirmasi via 4 percobaan curl berurutan
(tanpa auth → 401; dengan auth tapi tanpa X-Device-Id → 400 "DEVICE_ID_REQUIRED"; fresh QR +
kedua header sekaligus, immediate → 200 PNG asli). **Ini artinya URL mentah dari GOWA TIDAK
PERNAH bisa langsung di-embed sebagai `<img src>` di browser SAMA SEKALI** — bukan cuma soal
http vs https — karena tag `<img>` tidak bisa mengirim header custom. Mixed-content warning yang
user lihat di console cuma GEJALA SEKUNDER (Chrome upgrade otomatis ke https, request tetap
gagal 401 setelahnya) — bukan akar masalah sesungguhnya.

**Fix**: `app/api/wa/qr/route.ts` sekarang FETCH bytes gambar QR di SERVER (dengan
`Authorization`+`X-Device-Id` yang benar, path di-resolve ulang terhadap `baseUrl` kita sendiri
— bukan percaya origin dari GOWA sama sekali), konversi ke base64 data URL, kembalikan
`qrDataUrl` (ganti nama dari `qrLink`) ke client. `WhatsAppSetupClient`'s `QrModal` sekarang
baca `data.qrDataUrl` — `<img src={qrUrl}>` tidak berubah sama sekali (data URL bekerja
identik dengan URL eksternal untuk elemen `<img>`, tidak ada request browser terpisah lagi).

**Pola diagnosis yang terbukti krusial**: `tsc`/baca-kode saja TIDAK CUKUP untuk bug integrasi
eksternal seperti ini — root cause sesungguhnya (auth requirement, bukan cuma scheme) hanya
ketahuan setelah SSH ke VPS dan curl LANGSUNG ke GOWA dengan berbagai kombinasi header/query,
membandingkan status code persis (401 vs 400 vs 200) untuk mempersempit penyebab. Diagnosis dari
membaca kode saja akan berhenti di "oh, cuma perlu fix scheme http→https" — yang TIDAK akan
memperbaiki bug sama sekali karena akar masalahnya adalah auth, bukan scheme.

**Aturan digeneralisasi**: kalau ada field `url`/`link` yang datang dari SERVICE EKSTERNAL
(GOWA, RajaOngkir, dst) dan akan di-embed LANGSUNG di browser (`<img src>`, `<a href>`, iframe),
JANGAN asumsikan URL itu publicly-fetchable tanpa kredensial — verifikasi dengan curl langsung
apakah endpoint itu genuinely bisa diakses TANPA header/auth khusus yang browser tidak bisa
kirim. Kalau butuh auth, satu-satunya cara aman adalah proxy/fetch di server kita sendiri
(dengan kredensial yang kita simpan), lalu kirim hasil akhirnya (bytes/data URL) ke client —
JANGAN PERNAH meneruskan URL mentah dari service eksternal yang butuh auth ke browser.

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. Device `pc-ikpm-jogjakarta` sudah
dipastikan ada di GOWA (via curl manual selama investigasi) dan QR image sudah dikonfirmasi
bisa di-fetch dengan header yang benar (PNG 512×512 asli) — TAPI alur end-to-end lewat browser
sungguhan (buka `/app/pc-ikpm-jogjakarta/settings/notifications` → klik Scan QR → lihat gambar
muncul → scan pakai HP) belum diverifikasi visual, perlu dicoba user setelah deploy.

## Context Sesi Terakhir
- Terakhir dikerjakan: **Fix QR WhatsApp tidak muncul — proxy gambar di server, bukan URL
  mentah dari GOWA** (lihat lesson di atas) — `api/wa/qr/route.ts` sekarang fetch bytes QR
  server-side (dengan auth yang benar) dan kembalikan base64 data URL, bukan meneruskan URL
  eksternal GOWA yang butuh Basic Auth+X-Device-Id (tidak bisa dikirim browser via `<img>`).
  Sekalian ditemukan+difix device `pc-ikpm-jogjakarta` yang sempat hilang dari GOWA (dibuat
  ulang manual via curl saat investigasi). `tsc`+build bersih. Belum di-commit/push, belum
  di-deploy ke VPS — ini bug PRODUCTION AKTIF, prioritas tinggi untuk deploy segera.
- Sesi sebelumnya: **PC IKPM Cabang diwajibkan di `/akun/lengkapi`** (lihat lesson di atas)
  — asterisk + disabled-guard + `setError` eksplisit, mengikuti pola field wajib yang sudah ada.
  Scope sengaja tidak diperluas ke form admin (user eksplisit minta "form lengkapi profil" saja).
  `tsc`+build bersih. Belum di-commit/push.
- Sesi sebelumnya: **Perluas guard OTP ke forgot-password** (lihat lesson di atas) — `send-otp`
  sekarang cek registrasi untuk `login` MAUPUN `reset_password`, tidak cuma login.
  `forgot-password/page.tsx` dapat UI "Nomor Anda belum terdaftar, silakan mendaftar melalui
  tautan ini" identik `login-form.tsx`. Sudah di-commit dan di-push (`1b8ba22`).
- Sesi sebelumnya: **Refactor login/register — wording + cegah kirim OTP ke nomor tak
  terdaftar** (lihat lesson di atas) — 4 perbaikan: wording stambuk-tidak-ketemu, label "Nomor
  WhatsApp", pesan "sudah terdaftar" tanpa nama, dan `send-otp` (login) sekarang cek registrasi
- Sesi sebelumnya: **Refactor login/register — wording + cegah kirim OTP ke nomor tak
  terdaftar** (lihat lesson di atas) — 4 perbaikan: wording stambuk-tidak-ketemu, label "Nomor
  WhatsApp", pesan "sudah terdaftar" tanpa nama, dan `send-otp` (login) sekarang cek registrasi
  SEBELUM kirim (bukan setelah). Sekalian dedup 2 salinan identik "cari akun by phone" jadi
  `lib/find-user-by-phone.ts` + fix bug `hasAccount` hilang untuk match akun publik. Sudah
  di-commit dan di-push (`09ffe48`).
- Sesi sebelumnya: **Fix ikon Halaman (Page) di BottomNav — fallback ke `FileText` bukan
  `Link2`** (lihat lesson di atas) — sudah di-commit dan di-push.
- Sesi sebelumnya: **Koreksi proporsi BottomNav** (lihat lesson "Koreksi putaran 2" di atas)
  — user coba desain floating-home pertama, minta 2 perbaikan: kiri/kanan diseimbangkan jadi
  maks 2-2 (sebelumnya bisa 2 vs 3 kalau item > 4), dan tonjolan tombol Beranda dikecilkan dari
  50% jadi 15% tinggi elemen.
- Sesi sebelumnya: **BottomNav redesain awal (floating Beranda + ikon per-href) + Public Link
  Picker jadi browsable untuk kategori/tag/halaman** (lihat lesson di atas) — proporsi awalnya
  ternyata belum pas (lihat entri di atas untuk koreksinya).
- Sesi sebelumnya: **Fix bug Combobox generik (cari-berdasar-UUID) + refactor Public Link
  Picker** (lihat lesson di atas) — belum di-commit/push, menunggu user coba di browser dulu
  (search PC IKPM di `/akun/lengkapi`, search Event/Dokumen/kategori Campaign di nav menu builder,
  dan CTA Hero/CTA section di tenant custom domain).
- Sesi sebelumnya: **Dokumentasi mobile shell dikonsolidasi ke `docs/arsitektur-mobile-
  shell.md`** (lihat lesson di atas) — SEMUA pekerjaan mobile UI sesi itu (sticky bar keranjang/
  checkout, fix BottomNav global, header icon search+cart, Dialog+MobileActionSheet invoice, dan
  4× fix bug spacer) sudah **di-commit dan di-push**. `tsc`+build bersih di titik commit.
- Sesi sebelumnya: **Fix "Kirim Konfirmasi" tidak merespons** (lihat lesson di atas) —
  bug LANGSUNG dari refactor Dialog+MobileActionSheet sebelumnya: dua Radix overlay (form
  Dialog/Sheet + AlertDialog konfirmasi) aktif bersamaan, saling ganggu (desktop: z-50 vs z-50
  focus-trap konflik; mobile: z-71 sheet MENUTUPI z-50 AlertDialog total). Fix: `setPayDialogOpen
  (false)` sebelum buka AlertDialog (desktop) + prop baru `collapseSignal` di
  `mobile-action-sheet.tsx` (opsional, backward-compatible) yang dipakai `invoice-public-
  client.tsx` untuk paksa collapse sheet begitu AlertDialog mau dibuka. Sekalian: notifikasi
  sukses diperjelas teksnya + auto-scroll ke atas supaya pasti terlihat. `tsc`+build bersih.
  **User minta jangan push dulu** (masih berlaku) — belum commit/push.
- Sesi sebelumnya: **Konfirmasi Pembayaran invoice publik — Dialog (desktop) + bottom sheet
  (mobile)** (lihat lesson di atas) — `showPayForm` toggle inline diganti `Dialog` shadcn
  (desktop) + `MobileActionSheet` existing (mobile), konten form sama (`paymentFormFields`
  di-share via IIFE, tidak dobel logic). Banner baru `bg-primary text-primary-foreground` di
  atas form. Bug kelas KE-4 (sama dengan keranjang/campaign/produk sebelumnya) — spacer
  `MobileActionSheet` tidak melindungi "Bukti ditolak"/"Status final"/"Menunggu Verifikasi" yang
  render setelahnya — difix dengan trailing spacer `h-24 md:hidden`, pola SEKARANG DIANGGAP
  DEFAULT wajib dicek tiap kali `MobileActionSheet` dipakai di halaman baru. `tsc`+build bersih.
  **User minta jangan push dulu** (masih berlaku) — belum commit/push.
- Sesi sebelumnya: **Ikon search+cart mobile di FlexHeader, 2 putaran desain** (lihat lesson
  di atas) — search & cart sebelumnya sama sekali tidak ada di topbar mobile "Flex" (hanya
  logo+avatar). Putaran 1: kapsul bulat bg-primary + 3 ikon (search/cart/menu) — DITOLAK user
  ("tidak menarik", "flat aja"). Putaran 2 (final): HANYA 2 ikon (search+cart), flat hitam-putih
  border tipis abu-abu — style disalin dari `IconButton` yang sudah ada di `pill-header.tsx`.
  Menu navigasi TIDAK ditambah ke header (tetap di `BottomNav`/footer, di luar scope — user
  eksplisit). `MobileMenuDrawer` (putaran 1) dihapus total, `cart-button.tsx`'s
  `badgeClassName` prop (putaran 1, untuk kontras di atas capsule primary) di-revert karena
  tidak relevan lagi di desain flat. `tsc`+build bersih (2×, satu per putaran). **User minta
  jangan push dulu** (masih berlaku) — belum commit/push.
- Sesi sebelumnya: **Sticky bottom bar mobile untuk `/keranjang` + `/checkout`** (lihat
  lesson di atas) — Total+"Lanjut ke Checkout" (cart) dan Voucher+"Buat Invoice" (checkout)
  sekarang nempel di bawah layar saat mobile, konsisten dengan pola single-page shell
  event/donasi/produk, TIDAK berubah di desktop. Sekalian ditemukan+difix konflik laten:
  `BottomNav` FlexHeader (fixed bottom-0 z-50, tab navigasi situs) tidak pernah disembunyikan di
  `/keranjang`/`/checkout` (dua halaman itu sengaja TIDAK termasuk "single mobile route" yang
  menyembunyikan header) — akan rebutan ruang dengan bar aksi baru. Fix: `flex-header.tsx`
  sembunyikan `BottomNav` SAJA (bukan seluruh header) khusus di dua halaman itu. Susulan: user
  tanya soal `h-24 md:hidden` (dikira `display:none` di mobile, sebenarnya kebalikannya — hidden
  di DESKTOP) yang mengarah ke bug nyata: spacer+bar sticky kena `margin-top` tambahan dari
  `space-y-4`/`space-y-5` parent (bukan child pertama) → jarak kosong lebih lebar dari
  diniatkan. Fix beda per file: cart (tanpa grid) → spacer+bar dipindah keluar via Fragment;
  checkout (di dalam grid track kolom kiri, tidak bisa dipindah) → `mt-0` eksplisit menimpa
  `space-y-5` (Tailwind v4 space-y pakai `:where()` spesifisitas 0, dicek langsung di CSS hasil
  build — `mt-0` dijamin menang). Susulan KEDUA: user tes ulang, gap MASIH lebar tapi di lokasi
  salah — antara cart items dan `DonationBannerCart`, bukan di paling bawah. Root cause: spacer
  di dalam `CartClient` cuma jadi elemen terakhir MILIK KOMPONEN, bukan elemen terakhir di
  HALAMAN (`keranjang/page.tsx` render `DonationBannerCart` SETELAH `CartClient`). Fix: spacer+
  bar sticky diekstrak jadi komponen berdiri sendiri `CartMobileBar`, dirender page.tsx sebagai
  elemen PALING TERAKHIR (setelah banner donasi, bukan cuma setelah CartClient). Susulan KETIGA
  (lihat lesson lengkap di atas): user minta audit SISTEMATIS, bukan tunggu laporan satu-satu.
  Ditemukan+difix bug GLOBAL — spacer BottomNav `h-14` FlexHeader dibundel dengan `<header>`,
  nempel di bawah header di SEMUA halaman publik (bukan di paling bawah tempat BottomNav
  sungguhan berada). Fix: `BottomNav` diekstrak dari `flex-header.tsx`, dirender via komponen
  baru `FooterBottomNav` yang dipanggil `layout.tsx` SETELAH `<PublicFooter>`; logic hiding
  (`isSingleMobileRoute`+`hasOwnMobileActionBar`) diekstrak ke `lib/mobile-route-checks.ts`
  supaya tidak drift antar 2 file. Plus 2 bug SAMA di halaman lain (ditemukan via subagent
  riset): `/campaign/[slug]` dan `/produk/[productSlug]` — section "X Lainnya" render setelah
  kolom `MobileActionSheet`, jadi spacer lokalnya tidak melindungi konten itu. Fix: tambah
  spacer `h-24 md:hidden` sebagai elemen PALING TERAKHIR di kedua halaman (bukan modif
  `MobileActionSheet` yang dipakai 3 fitur, salah satu — Event — sudah terbukti benar). `tsc`+
  build bersih (4 kali build terpisah sepanjang sesi ini). **User minta jangan push dulu** —
  SEMUA perubahan (cart+checkout+header+campaign+produk) masih di working tree, belum
  commit/push, menunggu user coba di browser dan konfirmasi.
- Sesi sebelumnya: **Migrasi voucher di lokal + fix bug UX input tersembunyi** — migration
  `0034_vouchers.sql` dijalankan manual via `psql` ke DB lokal (native Postgres, bukan Docker —
  `postgres://webane@localhost/jalajogja`), dikonfirmasi tabel+kolom baru ada. User laporkan bug
  nyata dari testing langsung: input kode voucher tidak pernah ditemukan sampai invoice terbentuk
  — root cause layout 2-kolom `checkout-form.tsx` (input di kolom kanan, jatuh di bawah tombol
  submit saat mobile stack). Fix: widget interaktif dipindah ke kolom kiri sebelum tombol
  navigasi, kolom kanan sisakan baris display "Diskon Voucher" saja. **Sudah di-commit+push**
  (commit `2533e0b`).
- Sesi sebelumnya: **Audit voucher pasca-deploy** — 4 bug/gap ditemukan+difix: email
  case-sensitivity di resolver, invoice detail (admin+publik+list) yang tidak pernah menampilkan
  info voucher (plus bug turunan subtotal dobel-potong saat memperbaikinya), validFrom/validUntil
  UTC-mentah, NaN guard limit pemakaian. Lihat lesson di atas + `docs/arsitektur-voucher.md` § 11.
- Sesi sebelumnya: **Diskon & Voucher (Fase 1 — berkode)** — perencanaan matang (Plan Mode +
  2× `AskUserQuestion`) lalu eksekusi 6 fase penuh: schema+helper murni, integrasi
  `checkoutAction` (potongan per-item, Rp 0 auto-lunas, kode unik di-skip saat total=0), UI
  preview+input kode voucher (ditaruh di `checkout-form.tsx`, BUKAN halaman keranjang seperti
  rencana awal — lihat lesson di atas untuk alasan), admin CRUD `/finance/billing/voucher/*`
  lengkap (list/new/edit/detail + target picker multi-select), dan rollback `usedCount`+
  redemption saat invoice dibatalkan. Dokumentasi baru `docs/arsitektur-voucher.md` + update
  `docs/arsitektur-billing.md` (skema `invoice_items`/`invoices` + Q&A) + lesson CLAUDE.md di
  atas.
- Sesi sebelumnya: **Notifikasi WhatsApp untuk Program Cicilan — 5 event baru** (sesi
  2026-07-19), lalu 7 putaran audit pasca-deploy: **fix bug `invoices.uniqueCode` tidak
  di-nolkan saat konversi cicilan**, **fix 4 Server Action billing tanpa `hasReadAccess`
  guard**, **fix form "Konfirmasi Pembayaran" manual admin default ke sisa tagihan penuh**,
  **fix form "✓ Verifikasi" sendiri yang blind ke satu termin (abaikan overpayment)**,
  **keputusan produk: overpayment selalu diizinkan + peringatan non-blocking**, **fix
  prinsip fidelitas — hapus pengurangan kode unik otomatis dari default Verifikasi**, dan
  **overpayment juga dijurnal + audit menyeluruh 6 titik konfirmasi invoice (ditemukan+difix
  4 gap, termasuk 2 di luar sesi cicilan sama sekali: `confirmEventInvoicePaymentAction` +
  `syncInvoicePayment`)**. Lihat 7 lesson di atas untuk detail lengkap. Fitur inti (notifikasi
  WA 5 event + cron) sudah live di production sejak komit pertama sesi ini: migration 0033
  jalan, cron `installment-reminder` terjadwal jam 08:15 (diverifikasi respons `{"notified":0}`),
  toggle notifikasi sudah diaktifkan admin di tenant `visikita`. **Rangkaian fix akurasi
  nominal (overpayment-allowed, fidelitas nominal, jurnal overpayment, syncInvoicePayment,
  confirmEventInvoicePaymentAction) BELUM di-deploy ke VPS** — cek `git status`/`git log`
  sebelum lanjut untuk pastikan semua sudah commit+push+deploy. Belum ada uji nyata end-to-end
  (menunggu invoice cicilan pertama beneran).
- Sesi sebelumnya: **WhatsApp Notification Fase 3 (Billing) + teks notifikasi editable per tenant** (sesi 2026-07-13).
- Sesi ini (2026-07-13, lanjutan — WA Notification):
  - **Riset arsitektur sebelum eksekusi**: baca ulang `docs/arsitektur-whatsapp.md`, `-billing.md`,
    `-event.md`, `-product.md`, `-donasi-alur.md` + verifikasi kode aktual (bukan cuma dokumen, karena
    dokumen bisa basi — `grep sendWaNotification` ketemu 0 caller bisnis, cron `invoice-reminder`/
    `event-reminder` yang disebut docs ternyata tidak pernah dibuat). Temuan: 3 pertanyaan user
    (invoice-on-checkout WA, payment reminder, donasi/merchandise di event checkout) — jawaban:
    WA checkout belum ada sama sekali, reminder belum ada sama sekali, donasi/merchandise event
    (E10) SUDAH ada (1 campaign + 1 produk tetap per event, routing ke cart, banner di `/keranjang`).
  - **Fase A — Notifikasi Billing SELESAI**: helper baru `lib/wa-notify.ts` (`notifyWa`, `waAppUrl`,
    `waRupiah`, `resolveOrgName`) — satu titik untuk resolve orgName + format URL absolut + format
    Rupiah, supaya tidak reimplementasi beda-beda di tiap action (root cause bug custom-domain lama).
    5 titik notifikasi dipasang: `checkoutAction`→`invoice_created`, `submitPaymentProofAction`→
    `payment_submitted`, `confirmInvoicePaymentAction`+`verifySubmittedPaymentAction`→
    `payment_confirmed`, `rejectPaymentAction`→`payment_rejected`. Semua fire-and-forget
    (`void notifyWa(...)`), tidak pernah menggagalkan transaksi utama.
  - **Teks notifikasi WA — editable per tenant (fitur baru, atas permintaan user)**: refactor
    `lib/wa-templates.ts` dari fungsi JS (`${v.name}`) ke string dengan placeholder `{{var}}`
    (`WA_TEMPLATE_DEFAULTS` + `renderTemplateString()` — string replace murni, bukan eval JS).
    Override tersimpan di `tenant.settings` (group="notif", key="wa_message_templates") — tanpa
    migration, pakai infrastruktur settings JSONB yang sudah ada. `resolveWaTemplateText()` di
    `wa-notify.ts`: custom tenant → fallback default kode. Dipakai baik oleh `notifyWa()` maupun
    endpoint OTP (`send-otp/route.ts`) — teks OTP pun ikut editable. UI: tombol "Edit Teks" per
    notifikasi di `/settings/notifications` → `WhatsAppSetupClient` (komponen baru `NotifItemRow`)
    → `saveWaTemplateAction`/`resetWaTemplateAction` di `settings/actions.ts`. Badge "kustom" +
    tombol "Reset ke Default" muncul saat sudah dikustomisasi.
  - **Catatan minor**: 2 template lama (`order_shipped`, `letter_sign_request`) sebelumnya punya
    baris kondisional (mis. resi hanya muncul kalau ada). Sintaks `{{var}}` baru tidak support
    kondisional — baris itu akan selalu tampil (kosong jika var tidak diisi). Belum berdampak
    karena kedua notifikasi itu belum ada caller-nya (masuk Fase 4/6 mendatang) — perlu diperhatikan
    saat wiring nanti agar caller selalu isi variabel dengan nilai wajar.
  - TypeScript 0 errors, full production build sukses di setiap tahap.
  - **Fase B (cron `invoice-reminder` + `event-reminder`) dan Fase 4-6 (event/donasi/fulfillment/surat
    notif) BELUM dikerjakan** — menyusul sesi berikutnya. Pola cron sudah dikonfirmasi: HTTP GET +
    header `x-cron-secret`/`Authorization: Bearer` dicek `CRON_SECRET`, dipicu crontab VPS via `curl`
    (sama seperti `cleanup-images`/`verify-domains` yang sudah ada).
- Sesi sebelumnya (2026-07-13):
  - **Fitur Direktori Profesional — implementasi penuh 8 step** sesuai `docs/arsitektur-profesional.md`
    (perencanaan dari sesi sebelumnya): schema `member_professionals` + migration `0027`, curated list
    `lib/professional-types.ts` + `ProfessionTypeCombobox`, API self-service, halaman `/akun/profesional`
    (three-view), card menu di `/akun`, direktori publik `/profesional` + `/profesional/[id]`,
    Public Link Picker, breakdown statistik. TypeScript 0 errors, build production sukses. Commit `2a3aa64`.
  - **Fix bug field wajib tanpa asterisk** di `/akun/lengkapi` Step 1 (Jenis Kelamin, Tanggal Lahir,
    Tahun Lulus KMI, Profesi) — tombol "Simpan & Lanjutkan" disabled tanpa penjelasan visual.
  - **Fix 3 bug PC IKPM Cabang**: cache RSC basi di `/akun` (`router.push`→`window.location.href`),
    field PC IKPM sama sekali tidak ada di form admin `members/new`+`members/[id]/edit` (ditambahkan),
    `<select>` 136 opsi tanpa search (diganti `<Combobox>`). Commit `9faab81`.
  - **Card "Keanggotaan" di `/anggota/[id]` direstrukturisasi** — PC IKPM (dari `primaryCabangRefId`,
    selalu tampil) + Marhalah/Forum (dari `tenant_memberships`, kondisional tenant eksis) menggantikan
    row "Cabang" tunggal yang cuma nampilkan tenant di URL. Drive-by fix: query Status/Bergabung
    sebelumnya tidak filter `tenantId`. Commit `9faab81`.
  - **Audit `/anggota/[id]` ketemu 2 gap**: Wali Santri tidak pernah ditampilkan (dipindah ke Data
    Pribadi), section Profesional belum terintegrasi (ditambahkan). Fix Tanggal Bergabung hilang
    (fallback ke `tenantMemberships.createdAt` saat `joinedAt` null). Commit `b2f9770`.
  - **Komponen baru `<SocialLinks>`** (`components/ui/social-links.tsx`) — install `react-icons` untuk
    brand icon asli (lucide-react tidak punya sama sekali). Diterapkan di `/anggota/[id]` (3 lokasi)
    sebagai piloting, belum digeneralisasi ke halaman publik lain (nunggu konfirmasi user). Commit `b2f9770`.
  - Semua TypeScript 0 errors, full production build sukses di tiap tahap. Semua sudah push ke GitHub;
    deploy VPS terakhir butuh `bun install` juga (dependency baru `react-icons`), bukan cuma build.
- Sesi sebelumnya (2026-07-12):
  - **Fix root cause bug ganda (kode unik hilang + peserta event tidak masuk)** — `submitPaymentProofAction` tidak include `uniqueCode` saat hitung `remaining` → payment tercatat selalu kurang, invoice nyangkut "partial" → auto-create `event_registrations` (di-gate `newStatus==="paid"`) tidak pernah jalan untuk tiket via cart. Detail lengkap: `docs/arsitektur-kode-unik.md` § 12. Commit `64eeea5`.
  - **Fix bug turunan**: loop auto-create tiket sekarang guard `sourceType==="cart"` (cegah duplikat nama=nama tiket untuk alur lama) + `confirmInvoicePaymentAction` update status `event_registrations` untuk alur lama (sebelumnya cuma ada di `verifySubmittedPaymentAction`). Commit `64eeea5`.
  - **Fix race condition double-payment** — `confirmInvoicePaymentAction` sekarang `SELECT ... FOR UPDATE` lock invoice row di dalam transaction sebelum insert payment. Data invoice `620-INV-202607-00014` (tenant visikita) yang sempat ke-double-confirm dikoreksi manual via `docs/diagnosa-double-payment.sql`. Commit `141776e`.
  - **Fix UI**: item invoice tiket tampil JSON mentah → sekarang di-parse jadi nama/HP/email/custom field rapi (`parseTicketAttendee` di `lib/event-custom-form.ts`), dipakai di invoice admin + publik. Commit `e80d73d`.
  - **Feat**: icon rantai (invoice publik) + mata (detail) di list `/finance/billing/invoice`, icon-only tanpa label. Commit `d595b28`.
  - **Fix SEO event**: `generateMetadata` halaman `/agenda/{slug}` slice() Tiptap JSON mentah jadi meta description → ditambah `tiptapToPlainText()` di `lib/seo.ts` + pakai field `metaTitle`/`metaDesc`/`ogTitle`/`ogDescription`/cover event yang sebelumnya tidak dipakai sama sekali. Halaman single lain (post/produk/campaign/page/pesantren/usaha) sudah dicek, semua benar. Commit `e20321c`.
  - **Feat**: tab Peserta event publik jadi tabel No/Nama/Provinsi responsif (desktop tabel, mobile card). Provinsi resolve dari `memberId → homeAddressId → provinceId` (pattern sama dengan tab Statistik). Commit `8586942`.
  - **Feat**: label organisasi dinamis di halaman register (`resolveOrgLabels()` di `lib/tenant-org-label.ts`) — cabang/marhalah/forum dapat teks "Anggota ..." yang sesuai, bukan hardcode "Anggota IKPM Gontor". Commit `aaa215f`.
  - Semua TypeScript 0 errors. Semua sudah push ke GitHub; deploy VPS: `git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env` (tidak ada migration DB baru).
- Sesi sebelumnya (2026-07-10, lanjutan 3):
  - **Migrasi admin order → invoice-only flow** — `createOrderAction` tidak lagi insert ke `schema.orders`/`schema.orderItems`. Pakai `createLinkedInvoice` dengan `sourceType: "order"`. `shippingAddress` digabung ke `notes` sebelum dikirim (karena `CreateLinkedInvoiceInput` tidak punya field `shippingAddress`). `pesanan/[id]/page.tsx` diubah jadi redirect ke list. `pesanan/page.tsx` semua link menuju `pesanan/invoice/${id}`. TypeScript 0 errors. Commit `5f04c48`.
  - **Auto-create `event_registrations` saat invoice paid** (E10 cart flow) — `confirmInvoicePaymentAction` dan `verifySubmittedPaymentAction` di `billing/actions.ts` sekarang membuat `event_registrations` otomatis untuk tiket event yang ada di invoice. Idempotent via `customFields->>'sourceInvoiceId'`. TypeScript 0 errors.
  - **Dokumentasi kode unik transaksi** — `docs/arsitektur-kode-unik.md` dibuat. `docs/arsitektur-billing.md` dan `CLAUDE.md` diupdate untuk referensi. Implementasi belum dilakukan.
  - **Implementasi belum dilakukan**: schema `unique_code`, helper `generateUniqueCode`, integrasi `createLinkedInvoice`, display invoice, settings UI.
- Sesi sebelumnya (2026-07-10, lanjutan 2):
- Sesi ini (2026-07-10, lanjutan 2):
  - **Feat: `rejectPaymentAction` universal untuk semua tipe invoice** — TypeScript 0 errors.
    - **`billing/actions.ts`**: tambah `rejectPaymentAction` (dengan invoice reset + UUID fix), update `getInvoiceDetailAction` sertakan `rejectionNote` di payment data, update `InvoiceDetail.payments` type.
    - **`finance/actions.ts`**: fix bug `rejectedBy: access.userId` → `access.tenantUser.id` (nanoid → UUID, lesson CLAUDE.md).
    - **`invoice-detail-client.tsx`**: tombol "Tolak" di samping "✓ Verifikasi" untuk payment berstatus `submitted`, inline form textarea alasan, tampilkan alasan jika sudah ditolak.
    - **`invoice/[id]/page.tsx`**: query `status` + `rejectionNote` dari payments, hitung `rejectedPaymentNote` (payment rejected terakhir).
    - **`invoice-public-client.tsx`**: field `rejectedPaymentNote` di `PublicInvoiceData`, blok oranye "Bukti pembayaran sebelumnya ditolak: [alasan]" muncul saat invoice kembali ke `pending`/`partial`/`overdue`.
  - **Alur dikunci:**
    - Customer upload bukti → `submitPaymentProofAction` → payment `submitted`, invoice `waiting_verification`
    - Admin verifikasi → `verifySubmittedPaymentAction` → payment `paid`, invoice `paid/partial`
    - Admin tolak → `rejectPaymentAction` → payment `rejected`, invoice kembali ke `pending` (jika tidak ada submitted lain)
    - Customer melihat alasan penolakan di halaman invoice → upload ulang bukti baru
  - **Tidak ada perubahan DB** — kolom `rejected_by`, `rejected_at`, `rejection_note` sudah ada di schema.
  - Deploy: `git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env`
- Sesi ini (2026-07-10, lanjutan):
- Sesi ini (2026-07-10, lanjutan):
  - **Step E10 — Donation Prompt UI SELESAI** — Routing kondisional cart vs direct flow untuk event. TypeScript 0 errors.
    - Schema: `linked_product_id UUID` ditambah ke `events` + DDL + migration `0025_event_linked_product.sql`
    - Baru: `addEventTicketToCartAction(slug, data)` di `event/actions.ts` — add tiket ke cart universal, simpan attendee data di `cart_items.notes` sebagai JSON
    - `EventForm`: tambah `activeProducts` prop + product picker `<select>` di bagian Donation Prompt
    - `EventRegisterForm`: `hasLinkedItems = !!(donationPrompt || linkedProductId)` → cart mode → `window.location.href = baseUrl/keranjang`; old mode → `registerForEventAction`
    - `agenda/[slug]/page.tsx`: fetch `linkedProductTitle` dari DB, pass `linkedProductId` + `linkedProductTitle` ke form
    - `DonationBannerCart`: tambah `linkedProduct` prop → bagian Produk Terkait (ShoppingBag icon + tombol outline)
    - `keranjang/page.tsx`: fetch `linkedProductId` dari events di cart, cek sudah di cart, pass `linkedProductBanner` ke `DonationBannerCart`
  - **Migrations yang perlu dijalankan sebelum deploy**:
    ```bash
    docker compose exec -T postgres psql -U jalakarta -d jalakarta \
      < packages/db/migrations/0024_event_donation_prompt.sql
    docker compose exec -T postgres psql -U jalakarta -d jalakarta \
      < packages/db/migrations/0025_event_linked_product.sql
    git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
    ```
  - **Catatan belum selesai**: `event_registrations` dari `cart_items.notes` belum dibuat otomatis saat invoice dikonfirmasi — ini Phase berikutnya (trigger di payment confirmation).
- Sesi ini (2026-07-10):
  - **Fix: Tanggal Pembayaran tidak muncul saat QRIS** — `invoice-public-client.tsx`: field
    "Tanggal Transfer/Pembayaran" sebelumnya hanya tampil saat `payMethod === "transfer"`.
    Dipisah: Bank Pengirim tetap transfer-only; Tanggal Pembayaran muncul untuk transfer maupun
    QRIS (label dinamis, col-span-2 saat QRIS). Label bukti upload ikut menyesuaikan. Commit `eb5cf7f`.
  - **Feat: Tab Peserta & Statistik di halaman event publik** — Migration 0023. Commit `9cf2b12`.
    - Schema: `show_attendee_stats BOOLEAN` + `attendee_stats_by JSONB` di tabel events
    - Event form: toggle "Tampilkan statistik peserta" + checkboxes (Angkatan/Kabupaten/Provinsi/Profesi)
    - `EventDetailTabs` client component (`components/event/event-detail-tabs.tsx`): 3 tab
      - Tab **Detail**: konten existing (deskripsi, lokasi, waktu)
      - Tab **Peserta**: card ringkasan kuota (Target/Terdaftar/Sisa), tabel per tiket, daftar nama
      - Tab **Statistik**: bar chart horizontal per breakdown (cross-schema query ke public.members)
    - Jika hanya 1 tab aktif → tab bar tidak ditampilkan, konten langsung render (backward compat)
  - **Migration baru**: `0023_event_attendee_stats.sql` — jalankan di VPS sebelum deploy
  - **Deploy ke VPS**:
    ```bash
    docker compose exec -T postgres psql -U jalakarta -d jalakarta \
      < packages/db/migrations/0023_event_attendee_stats.sql
    git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
    ```
- Sesi ini (2026-07-09, lanjutan 6):
  - **Dynamic Custom Fields untuk form pendaftaran event** — Refactor dari 2 field hardcoded
    (estimasi kedatangan + rombongan) menjadi sistem field dinamis. Admin bisa tambah/hapus/edit
    field bebas: tipe text/angka/pilihan/datetime, label, required, opsi pilihan (untuk type select).
    Field disimpan di `events.custom_form_fields JSONB[]`. Jawaban disimpan di `event_registrations.custom_fields JSONB`.
  - **10 file diubah**:
    - `lib/event-custom-form.ts` (NEW) — type `CustomFormField` + `labelToKey()` + `FIELD_TYPE_LABELS`
    - `packages/db/src/schema/tenant/events.ts` — kolom `customFormFields JSONB`
    - `packages/db/src/helpers/create-tenant-schema.ts` — DDL kolom `custom_form_fields`
    - `packages/db/migrations/0022_event_dynamic_custom_fields.sql` (NEW) — migration
    - `actions.ts` — `EventData.customFormFields`, `RegisterData.customFieldAnswers`, update kedua action
    - `event-form.tsx` — komponen `CustomFieldBuilder` baru + state + buildData
    - `event-register-form.tsx` — render dinamis dari customFormFields, validasi required
    - `agenda/[slug]/page.tsx` — pass `customFormFields` prop
    - `acara/[id]/edit/page.tsx` — load customFormFields dari DB
    - `acara/new/page.tsx` — default `customFormFields: []`
  - TypeScript 0 errors.
  - **Migration baru**: `0022_event_dynamic_custom_fields.sql` — jalankan di VPS sebelum deploy
  - **Deploy ke VPS**:
    ```bash
    docker compose exec -T postgres psql -U jalakarta -d jalakarta \
      < packages/db/migrations/0022_event_dynamic_custom_fields.sql
    git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
    ```
- Sesi ini (2026-07-09, lanjutan 4):
  - **Timezone fix publishedAt post** — tiga bug sekaligus difix:
    1. `buildPayload()` kirim `new Date(publishedAt).toISOString()` (UTC unambiguous) bukan raw
       datetime-local string → server tidak salah parse (sebelumnya: `"2026-07-09T10:00"` tanpa tz
       → Node.js parse sebagai UTC → selisih 7 jam di WIB)
    2. `useState` init: konversi ISO UTC dari server ke local datetime-local format via `d.getFullYear()/
       getMonth()/getDate()/getHours()/getMinutes()` (local methods) bukan `toISOString().slice(0,16)`
       yang UTC → input kini tampil jam lokal yang benar
    3. Auto-default saat ganti ke Terbit: sama — gunakan local Date methods, bukan `toISOString()`
    4. `edit/page.tsx`: kirim full UTC ISO string ke client bukan `.slice(0,16)` (client yang konversi)
    - Tidak ada library tambahan, tidak ada perubahan schema DB / actions.ts. TypeScript 0 errors.
- Sesi ini (2026-07-09, lanjutan 3):
  - **Custom publish date untuk post** — field "Tanggal Terbit" (`datetime-local`) di sidebar editor
    post, tampil hanya saat status = Terbit. Default ke waktu sekarang saat pertama ganti status ke
    Terbit, tapi bisa diubah mundur (berita lama) atau maju (jadwal). Perubahan di 4 file:
    `post-form.tsx` (state + UI + buildPayload), `posts/[id]/edit/page.tsx` (teruskan publishedAt dari DB),
    `posts/new/page.tsx` (publishedAt: null di initialData), `actions.ts` createPostAction ikuti
    logika updatePostAction. TypeScript 0 errors.
- Sesi ini (2026-07-09, lanjutan 2):
  - **Fix form event: Data Peserta + Metode Pembayaran + Submit disembunyikan saat tiket locked** —
    `selectedTicketLocked = selectedTicket?.requiresMembership && !currentUserIsEnrolled`. Semua section
    form dibungkus `{!selectedTicketLocked && ...}`. CTA amber "Lengkapi Keanggotaan" muncul untuk
    multi-tiket locked. Auto-fill nama/HP bekerja dari session (`defaultAttendeeName`/`defaultAttendeePhone`).
  - **Fix layout mobile single event** — wrapper `<div className="min-h-screen bg-background">` ekstra
    menyebabkan overflow di mobile ("terlalu ke kanan frame"). Dihapus. Struktur sekarang identik
    dengan `post/[slug]`: `<div className="max-w-7xl mx-auto px-4 py-8">` langsung. Tambah `min-w-0`
    ke kolom kiri. TypeScript 0 errors.
  - **Belum di-deploy ke VPS** — migration 0020 perlu dijalankan manual sebelum deploy:
    ```bash
    docker compose exec -T postgres psql -U jalakarta -d jalakarta \
      < packages/db/migrations/0020_event_ticket_requires_membership.sql
    git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
    ```
- Sesi ini (2026-07-09):
  - **Fix `/akun` baseUrl di custom domain** — Commit `80a5e3e`.
  - **Fitur tiket wajib anggota** (`requires_membership`) — Migration 0020. Commit `4f3c185`.
- Sesi sebelumnya (lanjutan 2 2026-07-08): **Fix security custom domain — cross-tenant access**.
- Sesi ini (lanjutan 2 2026-07-08):
  - **Bug kritis ditemukan: custom domain bisa akses admin dashboard tenant manapun** —
    `visikita.com/app/pc-ikpm-jogjakarta/dashboard` terbuka karena middleware mengecualikan `/app/*`
    dari pemeriksaan custom domain → lolos ke admin auth guard → session ada → masuk.
  - **Root cause middleware**: `!pathname.startsWith("/app/")` di baris kondisi custom domain
    berarti semua path `/app/*` di custom domain tidak pernah diperiksa validitas tenantnya.
  - **Fix middleware**: path `/app/*` dan `/platform/*` di custom domain di-redirect ke
    `jalakarta.com/app/...` (URL kanonik). Commit `7718a36`.
  - **Fix flex-header**: Dashboard Admin link pakai URL absolut (`NEXT_PUBLIC_APP_URL/app/slug/dashboard`)
    bukan relatif — sebelumnya jadi `visikita.com/app/pc-ikpm-jogjakarta/dashboard`.
  - **Fix 4 file lain**: semua `redirect()` dan link `/app/...` di area publik
    (akun/layout, akun/event/page, invite/page, invite-accept-client) diubah ke URL absolut.
  - **TypeScript 0 errors**. Push: commit `7718a36`.
  - **Lessons Learned ditambahkan** di CLAUDE.md.
- Deploy ke VPS:
  ```bash
  cd /var/www/jalajogja && git pull
  bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
  ```
  Tidak ada migration DB baru.
- Sesi sebelumnya (lanjutan 2026-07-08):
  - **Fix koreksi instruksi custom domain UI** — `/settings/domain` menampilkan Cloudflare proxy sebagai WAJIB (salah kaprah). Arsitektur aktual: Let's Encrypt langsung di VPS, Cloudflare DNS-only (grey cloud). Instruksi UI dikoreksi. Commit `6437437`.
  - **Setup `visikita.com` sebagai custom domain** — DNS propagasi ✓ → certbot cert issued ✓ → nginx config dibuat manual ✓ → DB `custom_domain_status = 'active'` ✓.
  - **Bug teridentifikasi: login gagal di `visikita.com`** — Dua root cause:
    1. Better Auth CSRF check menolak Origin `https://visikita.com` (tidak di trustedOrigins)
    2. Link `forgot-password` dan `register` hardcode `/${slug}/` → URL salah di custom domain
  - **Fix dinamis auth route** — `app/api/auth/[...all]/route.ts` diubah: intercept POST, cek custom domain aktif di DB, spoof Origin ke BETTER_AUTH_URL. Domain baru otomatis diizinkan tanpa restart. Commit `b1f017b`.
  - **Fix link URL di login form** — Prop `baseUrl` ditambah ke `LoginForm`. Custom domain → `baseUrl = ""`. Commit `b1f017b`.
- Sesi sebelumnya (2026-07-08):
  - **Backbone IKPM selesai** — tiga tipe tenant (cabang/marhalah/forum), `ref_ikpm_cabang` 136 cabang PP IKPM, `primary_cabang_ref_id` di members, auto-populate memberships. Commit `b739b47` + `4443d21`.
  - **Platform admin cabang** — `/platform/cabang` CRUD 136 PC IKPM resmi. Platform tenant management diupdate: list dengan filter tipe, form dinamis buat tenant baru.
  - **Register anggota → auto-set primary_cabang_ref_id** — daftar di tenant cabang → cabang terisi otomatis.
  - **TENANT_SLUG regex fix** — `(?!platform$)` → `(?!platform(?:/|$))`. Platform login tidak lagi di-redirect ke `/app/login`. Commit `7870195`.
  - **Platform login `router.push` → `window.location.href`** — full page reload agar tidak kena next.config.ts redirect rules. Commit `7870195`.
  - **Buat owner pertama dari platform admin** — banner "Belum Ada Pengurus" di detail tenant + form nama/email/password → `createFirstOwnerAction` buat 3 record sekaligus (Better Auth + members + tenant.users). Commit `b863116`.
  - **TypeScript 0 errors** di semua perubahan.
  - **Migrations yang perlu dijalankan di VPS**: `0018_backbone_tenant_types.sql` + `0019_ref_ikpm_cabang.sql` (sudah ada di `packages/db/migrations/`).
- Sesi sebelumnya (2026-07-02, lanjutan 2): **Fix register flow atomic + dokumentasi**.
- Sesi ini (lanjutan 2 2026-07-02):
  - **Root cause orphan account teridentifikasi**: register tidak atomic — `signUpEmail` berhasil tapi `db.insert` bisa gagal → user bisa login tapi `getAkunIdentity()` null.
  - **Fix register route**: `cleanupAuthUser()` helper + wrap ketiga jalur (klaim/member-baru/publik) dengan try/catch + cleanup.
  - **Fix SQL diagnosa**: Step 2 di `docs/fix-akun-tidak-terhubung.sql` diperbaiki — `m.email` tidak ada, harus JOIN via `public.contacts`. Step 4 ditambahkan untuk cleanup orphan yang tidak bisa di-backfill.
  - **Untuk akun wasugi@gmail.com (Wawan Sugianto)**: login dengan email berbeda dari yang terdaftar di contacts (`wawan.sugianto@gmail.com`). Setelah deploy, `/akun-error` akan tampil → sign out → daftar ulang / login dengan email yang benar.
- Sesi sebelumnya (lanjutan 2026-07-02):
  - **Diagnosa loop baru setelah fix sebelumnya**: user anggota biasa (bukan pengurus) yang `members.betterAuthUserId` null → `getAkunIdentity()` null → `akun/layout.tsx` redirect ke `/login` → `login/page.tsx` session ada → redirect balik ke `/akun` → LOOP.
  - **Fix**: Buat halaman `/akun-error` di luar route `/akun/*` (tidak kena layout check). Redirect dari `akun/layout.tsx` dan `akun/page.tsx` ke sini, bukan ke `/login`. Halaman ini tampilkan pesan + tombol sign-out + instruksi daftar ulang. Commit `6061e04`.
  - **SQL diagnosa + backfill**: `docs/fix-akun-tidak-terhubung.sql` — diagnosa, backfill via email/HP/tenant.users, instruksi manual.
  - **Deploy ke VPS**: `git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env`; jalankan SQL sesuai kondisi data.
- Sesi ini (2026-07-02):
  - **Auth flows WA OTP selesai** — login dua tab (email + WA OTP), register OTP wajib, forgot-password WA only.
  - **Fix cookie signing** — `encodeURIComponent()` wajib di `login-via-otp/route.ts` untuk match format Better Auth.
  - **Fix redirect loop awal** — `window.location.href` menggantikan `router.push` di login; `akun/layout.tsx` cek `tenant.users` sebelum redirect.
  - **Migration 0017** wajib dijalankan di VPS: tambah `"login"` ke CHECK constraint `otp_tokens.type`.
  - **Dokumentasi diupdate**: `docs/arsitektur-login-universal.md` (rewrite flow baru), `docs/arsitektur-akun.md` (tambah bug fixes + backfill SQL), `CLAUDE.md` (3 lessons learned baru).
  - **GOWA self-hosted** (sesi sebelumnya, 2026-07-02): device `pc-ikpm-jogjakarta` terhubung ke +6282233322202. Fix endpoint API versi `latest`.
- Sesi sebelumnya (2026-07-02):
  - **GOWA self-hosted berhasil diaktifkan** — device `pc-ikpm-jogjakarta` terhubung ke +6282233322202.
  - **Fix endpoint GOWA versi `latest`** — API berubah dari versi lama:
    - Create device: `POST /devices` + JSON body (bukan `POST /api/devices`)
    - QR: `GET /app/login` + `X-Device-Id` header (bukan `GET /devices/{id}/login`)
    - Status: `GET /app/devices` → cek `jid` field (bukan `GET /devices/{id}/status`)
    - Send: `POST /send/message` — sama, tidak berubah
    - Logout: `GET /app/logout` + `X-Device-Id` (bukan `POST /devices/{id}/logout`)
    - GOWA return HTTP 500 (bukan 409) untuk device yang sudah ada → `text.includes("already exists")`
  - **File yang diubah**: `app/api/wa/qr/route.ts`, `app/api/wa/status/route.ts`, `settings/actions.ts`
  - **End-to-end confirmed**: QR scan → terhubung → send message via curl → SUCCESS
  - **Dokumentasi diupdate**: `docs/arsitektur-whatsapp.md` § status, § 2.3 topologi, § 2.4 endpoint baru, § 7.1 alur setup, § 12 fase, § 13 keputusan, § 14 risiko. CLAUDE.md diupdate.
  - **Fase 3–6 belum**: trigger notifikasi otomatis di event bisnis masih 0 caller.
- Sesi sebelumnya (2026-06-30): **OTP via WA (Fase 7) SELESAI + Arsitektur GOWA self-hosted terdokumentasi**.
  - `packages/db/migrations/0016_otp_tokens.sql`, send-otp + verify-otp endpoints, register + forgot-password terintegrasi.
  - `docker-compose.yml` diupdate (service `gowa`), `docs/arsitektur-gowa-deployment.md` dibuat.
- Sesi sebelumnya: **PDF surat — design fix + urutan TTD** (sesi 2026-05-27).
- Sesi ini (2026-05-27):
  - **Fix `/pengurus/new` — "Password minimal 8 karakter" meski member sudah punya akun**: validasi email+password dipindah ke dalam cabang `else` (hanya jika belum ada akun). Commit `0df7cef`.
  - **Fix "Gagal menyimpan pengurus." — UUID vs nanoid**: variabel dipisah (`authUserId` nanoid vs `tenantUserId` UUID), UUID diambil via `.returning({ id: schema.users.id })`. Commit `80d0ed2`.
  - **Halaman TTD `/sign/{token}` — auth + identitas wajib**:
    - `signByTokenAction`: hapus `signingToken: null` + tambah session/identity/canSign check
    - `sign/[token]/page.tsx`: rewrite — inline login form jika belum login, error identitas jika bukan pemilik, signing UI jika authorized
    - `sign/[token]/sign-login-form.tsx`: komponen login kompak baru
    - `docs/arsitektur-tandatangan.md`: update keputusan "Identifikasi via link"
  - **Fix font PDF** — Google Fonts CDN map diperluas: tambah `Lora` dan `Open Sans`. Daftar font di `letter-config-client.tsx` ganti Calibri/Helvetica ke Lora/Open Sans. Commit `9debd7e`.
  - **Fix design PDF surat** (commit `71c85a5` + sesi ini):
    - Garis pemisah (`kop-garis`) dihapus saat ada header image — hanya tampil pada mode teks
    - Duplikasi nama organisasi di blok "Kepada Yth." difix: skip `orgLine` jika sama dengan `recipientName` (case-insensitive)
    - Nama penerima pertama di-bold: `<strong>` pada index 1 di `lines` array
  - **Fix urutan slot TTD di PDF** — posisi kiri/kanan mengikuti `slotOrder` dari DB, bukan urutan signing:
    - Root cause: `slotOrder` dan `slotSection` dari `letter_signatures` tidak diteruskan ke builder HTML; `order` di-hardcode sebagai array index `i + 1`, dan `section` selalu `"main"`
    - Fix: tambah `slotOrder` + `slotSection` ke tipe `SignerInfo`; route sort `rawSigs` by `slotOrder` sebelum map; `letter-html.ts` pakai `s.slotOrder` dan `s.slotSection` saat membangun `signatureSlots`
  - **Debug format tanggal** — root cause bukan bug kode: jenis surat "Undangan" punya `date_format = "masehi"` eksplisit yang override setting global `masehi_hijri`. Fix: ubah format tanggal jenis surat ke "Default" di `/letters/template`.
- Sesi sebelumnya (2026-05-26–27):
  - **Custom domain routing** — fix variasi URL ikpmjogja.com (www/http/https), docs di `docs/arsitektur-domain.md` dan `docs/panduan-custom-domain.md`.
  - **Media upload error** di `/app/{slug}/letters/pengaturan`:
    - Root cause 1: `migration-member-media.sql` belum dijalankan di production → `member_id` column missing → 500
    - Root cause 2: Browser ter-cache redirect 301 lama → request ke `/app/api/media/*` bukan `/api/media/*`
    - Fix: `beforeFiles` rewrite di `next.config.ts` + try/catch di `media-picker.tsx` error handler
  - **Letters image processor** — module `letters` sekarang hanya generate variant `original` (convert WebP saja, tanpa resize/crop)
- Sebelumnya (2026-05-21):
  - **4 jenis error dari PM2 log difix:**
    - `generateMetadata` di `layout.tsx` → tambah cek tenant exists sebelum query schema
    - `getTenantSeoBase` di `lib/tenant-seo.ts` → tambah guard `!tenant?.isActive` → return fallback
    - `akun/mitra/page.tsx` → internal fetch hanya forward `cookie` header, bukan semua headers
    - `member-public/[id]` API → validasi UUID format sebelum query DB
  - **"Failed to find Server Action"** — bukan bug, normal post-deploy (user perlu refresh browser)
- Sesi sebelumnya:
  - **Pendaftaran tenant dinonaktifkan** — `(auth)/register/page.tsx` flag `REGISTRATION_OPEN = false`. Link "Daftar" di login disembunyikan (dalam komentar). Aktifkan kembali: ubah `false → true` + uncomment link.
  - **Migrasi URL Fase 1–4 selesai, di-deploy ke production:**
    - **Fase 1:** Pindah `(dashboard)/[tenant]/*` → `(dashboard)/app/[tenant]/*`. Admin dashboard sekarang di `/app/{slug}/*`. Login admin: `/app/login`. Middleware ganti `PROTECTED_PATTERN` dengan `startsWith("/app/")`.
    - **Fase 2:** 127 `redirect()` + 131 `revalidatePath()` di semua actions.ts diupdate ke `/app/` prefix.
    - **Fase 3:** Semua `href` dan `router.push` di 9 nav components + 50+ page files + 10 admin component dirs diupdate.
    - **Fase 4:** Redirect 301 via `next.config.ts` dari path lama ke `/app/`. Hapus `evaluasi-arsitektur-url.md`. Update CLAUDE.md + rencana-migrasi-url.md.
    - **Fix build:** 87 import paths `@/app/(dashboard)/[tenant]/...` → `@/app/(dashboard)/app/[tenant]/...` (terlewat di Fase 3).
    - **Fix build:** `useSearchParams()` di `/app/login` dibungkus `<Suspense>` (Next.js 15 requirement).
  - **Fase 5 ditunda** — admin subdomain (`admin.ikpmjogja.com`) setelah 2 minggu observasi production.
- URL admin baru: `jalakarta.com/app/{slug}/dashboard`
- URL publik: tidak berubah (`jalakarta.com/{slug}/post`, dll)
- Ditunda: sertifikat PDF donasi, V8 (stok check), Donasi Rutin (R1–R7), Fase 5 URL.

### Pattern `baseUrl` (Custom Domain)
```typescript
// Di layout.tsx — computed server-side
const isCustomDomain = !isOwnHost(host);
const baseUrl = isCustomDomain ? "" : `/${slug}`;

// Di header/footer component
<a href={baseUrl || "/"}>Logo</a>      // homepage
<a href={`${baseUrl}/post`}>Artikel</a> // halaman konten

// navMenu — slug di-strip di layout sebelum dikirim ke component
const navMenu = isCustomDomain
  ? rawNavMenu.map(item => ({ ...item,
      href: item.href.startsWith(`/${slug}/`) ? item.href.slice(`/${slug}`.length)
          : item.href === `/${slug}` ? "/"
          : item.href }))
  : rawNavMenu;
```

**Aturan**: Jangan pernah hardcode `/${tenantSlug}/...` di header/footer/cart component. Selalu pakai `${baseUrl}/...`. Ini memastikan white-label bersih di custom domain.

### Status Halaman Publik

| Fitur | URL | Status |
|-------|-----|--------|
| Transaksi anggota | `/{slug}/akun/transaksi` | ✅ Ada |
| Arsip donasi/qurban | `/{slug}/campaign` | ✅ Ada |
| Detail campaign + form | `/{slug}/campaign/{slug}` | ✅ Ada |
| Arsip produk | `/{slug}/produk` | ✅ Ada |
| Detail produk | `/{slug}/produk/{slug}` | ✅ Ada |
| Agenda / Event listing | `/{slug}/agenda` | ✅ Ada |
| Keranjang | `/{slug}/keranjang` | ✅ Ada |
| Checkout | `/{slug}/checkout` | ✅ Ada |
| Invoice detail | `/{slug}/invoice/[id]` | ✅ Ada |
| Subscriptions donasi rutin | `/{slug}/akun/subscriptions` | ⬜ Belum (Phase R) |
| **Direktori Anggota** | `/{slug}/anggota` | ✅ Ada |
| **Direktori Pesantren** | `/{slug}/pesantren` + `/[id]` | ✅ Ada |
| **Direktori Usaha** | `/{slug}/usaha` + `/[id]` | ✅ Ada |
| **Statistik** | `/{slug}/statistik` | ✅ Ada |

### [2026-05] Direktori Publik — 4 Halaman Selesai

**Arsitektur lengkap di `docs/arsitektur-direktori-publik.md`.**

**File yang dibuat:**
```
app/(public)/[tenant]/anggota/page.tsx             → server: fetch + pass rows ke CC
app/(public)/[tenant]/pesantren/page.tsx            → list pesantren
app/(public)/[tenant]/pesantren/[id]/page.tsx       → detail pesantren
app/(public)/[tenant]/usaha/page.tsx                → list usaha
app/(public)/[tenant]/usaha/[id]/page.tsx           → detail usaha
app/(public)/[tenant]/statistik/page.tsx            → statistik 3 seksi
app/api/member-public/[id]/route.ts                 → API publik profil anggota
components/anggota/anggota-directory-client.tsx     → tabel (desktop) + card (mobile) + popup
components/anggota/anggota-filters-client.tsx       → filter bar dengan onChange handlers
```

**Pattern yang BENAR untuk split server/client — kirim data, bukan fungsi:**
Halaman anggota butuh data DB (server) + state popup (client). Solusi: kirim `rows` (data serializable)
sebagai prop, dan pindahkan seluruh rendering grid ke dalam Client Component.

```tsx
// Server page — kirim data, bukan fungsi
<AnggotaDirectoryClient slug={slug} rows={rows} hasFilter={hasFilter} />

// Client component — render grid + popup sendiri
export function AnggotaDirectoryClient({ slug, rows, hasFilter }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <>
      {rows.map(m => <button onClick={() => setSelectedId(m.id)}>...</button>)}
      {/* popup overlay */}
    </>
  );
}
```

**JANGAN: render prop (fungsi sebagai children) dari Server Component ke Client Component**
```tsx
// SALAH — error: "Functions are not valid as a child of Client Components"
<AnggotaDirectoryClient>
  {(onSelect) => rows.map(m => <button onClick={() => onSelect(m.id)}>...</button>)}
</AnggotaDirectoryClient>
```
Fungsi tidak serializable → Next.js App Router tidak bisa meneruskannya lintas SC→CC boundary.
Error: `Functions are not valid as a child of Client Components. <... children={function children}>`

**Event handler (`onChange`, `onClick`, dll.) TIDAK boleh ada di Server Component:**
Setiap elemen yang butuh event handler harus ada di dalam Client Component (`"use client"`).
Jika hanya sebagian kecil dari halaman yang interaktif, buat komponen client terpisah — jangan
jadikan seluruh page client hanya karena satu `<select onChange>`.

```tsx
// SALAH — error: "Event handlers cannot be passed to Client Component props"
// app/(public)/[tenant]/anggota/page.tsx (Server Component)
<select onChange={e => window.location.href = buildUrl(...)}>...</select>

// BENAR — ekstrak ke Client Component tersendiri
// components/anggota/anggota-filters-client.tsx
"use client";
export function AnggotaFiltersClient({ ... }) {
  return <select onChange={e => window.location.href = buildUrl(...)}>...</select>;
}

// Server page hanya kirim data serializable sebagai props
<AnggotaFiltersClient provinsiList={provinsiList} currentProvinsi={provinsi} ... />
```

**Dua error Server Component yang sering terjadi dan perbedaannya:**
| Error | Penyebab | Fix |
|-------|----------|-----|
| `Functions are not valid as a child of Client Components` | Render prop / fungsi sebagai `children` dari SC ke CC | Kirim data (array/object) sebagai prop, render di dalam CC |
| `Event handlers cannot be passed to Client Component props` | `onChange`, `onClick`, dll. di SC | Ekstrak elemen interaktif ke CC terpisah |

**`sql<number>\`count(*)\`` — WAJIB, bukan `count()` dari drizzle-orm:**
`count()` dari drizzle-orm menyebabkan TypeScript error saat dipakai dengan Promise.all destructuring.
Gunakan `sql<number>\`count(*)\`` secara konsisten. Return type: `number`.
Berlaku di semua query count di seluruh aplikasi.

**`sql<string>\`coalesce(sum(...),0)\`` untuk aggregate nullable:**
`sum()` pada kolom nullable mengembalikan `null` jika semua row null. `coalesce(...,0)` memaksa return 0.
Return type yang benar: `sql<string>` (PostgreSQL aggregate selalu string) → parse ke `Number()` saat display.

**Scope query direktori: SELALU JOIN `tenant_memberships`:**
```typescript
.innerJoin(tenantMemberships, and(
  eq(tenantMemberships.memberId, members.id),
  eq(tenantMemberships.tenantId, tenant.id),
  inArray(tenantMemberships.status, ["active", "alumni"]),
))
```
Direktori publik HANYA tampilkan anggota cabang ini — bukan semua anggota IKPM lintas cabang.
Tanpa JOIN ini → data bocor lintas tenant.

**`lucide-react` tidak punya icon brand sosial media — SUPERSEDED, lihat lesson [2026-07-13]:**
Solusi lama "pakai `Globe` sebagai pengganti universal" sudah digantikan komponen
`<SocialLinks>` + `react-icons` (icon brand asli per platform). Lihat lesson
"Komponen SocialLinks — react-icons untuk brand icon" di bawah.

**Statistik — sequential query, bukan Promise.all destructuring:**
Promise.all dengan destructuring array membuat TypeScript kehilangan inference tipe per-index.
Sequential await lebih verbose tapi TypeScript tidak error dan kode lebih mudah di-debug.

### [2026-05] Statistik — Pola Angkatan dengan Sub-periode (1999 Awal/Akhir)

Kolom `graduationYear` + `graduationPeriod` harus selalu di-group bersama di query statistik:
```typescript
.select({ year: members.graduationYear, period: members.graduationPeriod, total: sql<number>`count(*)` })
.groupBy(members.graduationYear, members.graduationPeriod)
```

Label display — tiga kemungkinan untuk tahun 1999:
```typescript
if (r.year === 1999) {
  label = r.period === "awal" ? "1999 (Awal)"
        : r.period === "akhir" ? "1999 (Akhir)"
        : "1999 (Belum ditentukan)";  // data lama sebelum kolom period ditambahkan
}
```

**"Belum ditentukan" bukan error** — ini sinyal data lama yang perlu di-update oleh anggota via `/akun/lengkapi`. Jangan sembunyikan atau gabungkan dengan row lain.

**Aturan validasi form untuk kolom sub-periode:**
```typescript
// Di saveStep1() / handleSubmit()
if (Number(graduationYear) === 1999 && !graduationPeriod) {
  setError("Angkatan 1999 wajib memilih periode: Awal atau Akhir.");
  return;
}
// Tombol disabled juga harus ikut:
disabled={... || (Number(graduationYear) === 1999 && !graduationPeriod) || ...}
```

Berlaku di: `app/(public)/[tenant]/akun/lengkapi/page.tsx` + `components/members/wizard/step1-identity.tsx`.
Pattern ini bisa dipakai untuk kolom apapun yang punya sub-nilai kondisional.

### [2026-05] Statistik — Kabupaten vs Provinsi

Gunakan kabupaten (`refRegencies`) bukan provinsi (`refProvinces`) untuk granularitas yang lebih berguna di statistik domisili anggota dan lokasi usaha/pesantren.

```typescript
.leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
.where(sql`${refRegencies.id} IS NOT NULL`)   // filter agar anggota tanpa alamat tidak masuk
.groupBy(refRegencies.name)
.limit(10)
```

`WHERE refRegencies.id IS NOT NULL` penting — tanpa ini, anggota yang belum isi alamat masuk dengan `regencyName = null` dan merusak label di BarList.

**Filter NULL untuk semua kolom opsional di statistik:**
Setiap kolom yang nullable (waliSantri, domicileStatus, employees, branches, graduationYear, dll) wajib filter `IS NOT NULL` di query statistik — jangan tampilkan "Tidak diketahui" sebagai bar yang besar hanya karena banyak anggota belum isi.

### [2026-05] Prinsip Billing Universal — Jangan Pernah Split List per Jalur Masuk

> **ATURAN: Semua transaksi dari jalur manapun (admin/front-end/API) HARUS tampil dalam SATU list bersama — tidak pernah dua section terpisah.**

`invoices` adalah satu-satunya catatan transaksi universal. Admin buat pesanan → `createLinkedInvoice` → invoice. Front-end cart checkout → invoice. Keduanya menghasilkan invoice yang identik secara struktur.

**Yang salah** (pernah dilakukan, sudah difix):
- `/donasi/transaksi` punya dua section: "Donasi Langsung" (dari `donations` table) + "Donasi via Keranjang" (dari `invoices`)
- `/toko/pesanan` punya dua section: tabel `orders` (admin) + "Pesanan via Keranjang" (dari `invoices`)

**Yang benar**:
- Query dari `invoices` sebagai sumber utama — filter berdasarkan `sourceType` atau `item_type`
- Satu tabel, semua jalur, badge `sourceType` jika perlu dibedakan secara visual
- Detail page boleh berbeda per source (admin order vs cart order pakai halaman berbeda) — yang penting LIST-nya satu

**Kenapa ini penting**: Pemisahan list membuat admin harus memeriksa dua tempat untuk hal yang sama, menyembunyikan data dari front-end, dan bertentangan dengan alasan kita membangun billing universal.

### [2026-05] UUID vs nanoid — Bug Kritis di Finance Actions

> **ATURAN: `confirmedBy`, `rejectedBy`, `createdBy` di tabel finance WAJIB `access.tenantUser.id` — bukan `access.userId`**

`access.userId` = `session.user.id` dari Better Auth = **nanoid** (contoh: `"1bbNUBnobqznt8AZX7LqiSW92l"`).
Column `confirmed_by`/`created_by` di `payments`, `transactions`, `disbursements` = **uuid** PostgreSQL.
Mengisi uuid column dengan nanoid → `PostgresError: invalid input syntax for type uuid`.

`access.tenantUser.id` = UUID dari tabel `tenant.users` (primaryKey defaultRandom) — ini yang benar.

**Berlaku di semua server actions finance dan billing.** Cek setiap kali ada `confirmedBy`/`createdBy`.

### [2026-05] Bukti Transfer + Verifikasi Dua Tahap

Alur pembayaran invoice punya dua jalur berbeda yang penting dibedakan:

**Jalur 1 — Admin Manual (langsung terkonfirmasi):**
`confirmInvoicePaymentAction` → buat payment baru, `status: "paid"`, langsung update `paid_amount` + jurnal

**Jalur 2 — Customer Submit + Admin Verify (dua tahap):**
1. Customer: `submitPaymentProofAction` → buat payment `status: "submitted"`, invoice → `waiting_verification`
2. Admin: `verifySubmittedPaymentAction(paymentId)` → update payment `submitted → paid`, update `paid_amount`, jurnal

Jangan campur dua jalur ini. `verifySubmittedPaymentAction` menerima `paymentId` (bukan `invoiceId`) karena ia memverifikasi payment yang sudah ada — bukan membuat baru.

**Bukti transfer (`proof_url`):**
- Upload via `POST /api/invoice/proof-upload?tenant=&invoiceId=` — publik, tidak butuh auth
- Simpan ke MinIO `payments/{invoiceId}/{uuid}.{ext}` — tidak ada image processing, tidak ada record di `media` table
- URL disimpan di `payments.proof_url` saat `submitPaymentProofAction` dipanggil
- Upload via `POST /api/invoice/proof-upload?tenant=&invoiceId=` — publik, tidak butuh auth
- Simpan ke MinIO `payments/{invoiceId}/{uuid}.{ext}` — tidak ada image processing, tidak ada record di `media` table
- URL disimpan di `payments.proof_url` saat `submitPaymentProofAction` dipanggil
- Tampil sebagai thumbnail di admin + publik — **klik = lightbox popup** (bukan buka tab baru)

Lightbox: `useState<string | null>` + `fixed inset-0 z-50 bg-black/85`. Klik background = tutup. Gambar: `onClick={(e) => e.stopPropagation()}`.

### [2026-05] RajaOngkir v1 → v2 Migration

v1 (`api.rajaongkir.com`) mati total. v2 (`rajaongkir.komerce.id/api/v1`) adalah pengganti.

**Perbedaan penting:**
- v2 tidak ada bulk city list endpoint → pakai search realtime, tidak perlu tabel `ref_rajaongkir_cities`
- v2 level kota = kelurahan (subdistrict), bukan kota/kabupaten
- v2 return HTTP 404 (bukan `{data:[]}`) saat pencarian tidak menemukan hasil — WAJIB handle ini di route handler sebagai array kosong, bukan error 502
- v2 cost endpoint: FormData `POST /calculate/domestic-cost`, courier sebagai colon-separated string (`"jne:tiki"`), response flat (tidak nested)
- API key sekarang platform-level di ENV `RAJAONGKIR_PLATFORM_KEY` — tidak per-tenant

**Aturan: `cache: "no-store"` di route handler** — jangan pakai `next: { revalidate }` di API Route Handler (itu hanya valid di Server Component fetch). Gunakan `cache: "no-store"` untuk search realtime.

### [2026-05] Order Fulfillment — Pisahkan Payment dari Fulfillment

**Dua halaman, dua tujuan berbeda:**
- `/finance/billing/invoice/[id]` → untuk urusan **pembayaran** (verifikasi bukti, konfirmasi, riwayat payment)
- `/toko/pesanan/invoice/[invoiceId]` → untuk urusan **pengiriman** (stage timeline, input resi, konfirmasi terima)

Keduanya punya link ke satu sama lain. Jangan campur logika ini dalam satu halaman — membingungkan admin.

**`resolveIdentity` wajib terima `betterAuthUserId` dari session:**
Bug: di `checkoutAction`, `resolveIdentity` dipanggil hanya dengan `phone`/`email` tanpa session. Dua user dengan nomor HP yang sama → invoice di-assign ke user yang salah.
Fix: `const session = await auth.api.getSession(...)` di `checkoutAction`, kirim `betterAuthUserId: session?.user?.id` ke `resolveIdentity`. Session selalu menang atas lookup HP/email.
**Aturan**: setiap action yang melibatkan transaksi user wajib cek session dulu.

**5-stage status — transisi linear ketat:**
Status fulfillment hanya boleh maju satu langkah (`currentOrder + 1`). Tidak ada skip, tidak ada mundur.
Ini memaksa admin mengikuti alur yang benar: proses → kemas → kirim → terima.
`FULFILLMENT_ORDER: Record<string, number> = { pending:0, processing:1, packed:2, shipped:3, delivered:4 }`
Pattern ini berlaku untuk semua alur multi-step yang membutuhkan audit trail terurut.

**Jangan beri DEFAULT NOW() pada timestamp konfirmasi:**
> Lihat bug kritis `signed_at DEFAULT NOW()` di lessons Modul Surat — aturan yang sama berlaku.
`shippedAt`, `deliveredAt`, `confirmedAt`, `paidAt` TIDAK BOLEH punya `DEFAULT` di DDL.
Selalu null saat row dibuat, diisi eksplisit oleh kode saat event terjadi.

**`FulfillmentTimeline` — pure presentational, tidak ada async:**
Timeline component hanya menerima `status` string dan render stage circles berdasarkan index.
Tidak perlu fetch, tidak perlu context, tidak perlu useState.
Pattern: komponen visual linear selalu bisa jadi pure function dari satu nilai enum.

### [2026-05] Sistem Tema Tenant — CSS Variables + Google Fonts

**Pendekatan: inject CSS di server component, bukan prop drilling**

Sebelumnya `primaryColor` di-prop-drill dari layout → header → footer → setiap komponen. Ini tidak scalable — menambah warna kedua berarti update 30+ komponen.

**Fix yang benar**: inject `<style>` tag di `PublicLayout` dengan CSS variables:
```css
.public-layout {
  --primary: #2563eb;
  --secondary: #64748b;
  font-family: "Poppins", sans-serif;
}
.public-layout h1, h2, h3, h4 {
  font-family: "Philosopher", serif;
}
```

Semua komponen di bawah `.public-layout` otomatis pakai warna dan font yang benar via CSS cascade. Tidak perlu sentuh satu komponen pun.

**`lib/theme-palette.ts`** — konversi hex → palette:
- Luminance WCAG untuk hitung foreground kontras (putih/hitam otomatis)
- `tint(hex, ratio)` → mix dengan putih; `shade(hex, ratio)` → mix dengan hitam
- `getGoogleFontsUrl(fonts[])` → URL Google Fonts yang di-dedupe
- Hanya font yang ada di `GOOGLE_FONT_SPEC` yang di-load (Inter/Geist = sistem, skip)

**Google Fonts di server component**: `<link rel="stylesheet" href="...">` di server component Next.js App Router → Next.js hoist otomatis ke `<head>`. Tidak perlu `next/font` untuk font yang dipilih dinamis dari DB.

**`<style dangerouslySetInnerHTML>` di server component**: aman karena nilai berasal dari DB (hex color + font name dari whitelist) — bukan user input arbitrary. Tidak ada XSS risk.

**Aturan**: Jangan pernah kembalikan ke prop drilling `primaryColor`. Tambah variabel baru? Tambah di `buildTenantThemeCss()` + `globals.css` → selesai.

### [2026-05] Public Button System — CSS Utilities + Component

**Prinsip: CSS utility class + thin React component di atasnya**

Jangan buat button dengan Tailwind classes manual. CSS utility class:
1. Tidak repeat — satu definisi, dipakai di mana saja
2. Tidak ada import — cukup class name di HTML/JSX
3. Pakai CSS variables → warna otomatis ikut tema tenant
4. Bisa dipakai di email template, PDF HTML, atau konteks non-React

Pattern: `globals.css` definisikan `.btn`, `.btn-primary`, `.btn-sm`, dll. via `@layer utilities`. React component `PublicButton` hanya compose nama class + handle ikon + polymorphism.

**Polimorfik tanpa library**: `if ("href" in props && props.href !== undefined)` → render `<a>`, else `<button>`. Tidak butuh Radix atau `@radix-ui/react-slot`.

**Ikon default per variant** — bukan dekoratif, tapi semantik:
- `primary` → ArrowRight (action/lanjut)
- `secondary` → Zap (alternatif cepat)
- `dark` → ArrowUpRight (buka/navigasi)
- `outline-primary/dark` → Chevron/Move (navigasi ringan)
- `ghost` → ChevronRight (link navigasi)
- `danger` → Trash2 (destruktif)

**`iconLeft` prop untuk ← Kembali pattern**:
```tsx
<PublicButton iconLeft="chevron" icon="none">Kembali</PublicButton>
```

**Aturan**: Jangan ada `<a class="px-4 py-2 rounded-full bg-primary...">` baru di front-end publik. Selalu `btn btn-primary` atau `<PublicButton>`.

### Known TODO
- Role System: email SMTP otomatis untuk invite (saat ini link di-copy manual), update role UI untuk pengguna aktif, notifikasi login pertama
- Modul Dokumen: uploader name di version history (perlu cross-schema join tenant.users → public.user)
- Fitur surat belum: inter-tenant letters, attachment MediaPicker
- **Keuangan** — sisa: Budget UI, export PDF laporan — lihat `docs/arsitektur-keuangan.md`
- **Billing** — Phase 2: public cart/checkout. Phase 3: integrasi modul existing.
- **View Counter** — Step 10: tampil di detail publik (≥50). Detail: `docs/arsitektur-views-count.md`
- **Widget Area System** — ✅ SELESAI
- **Member Media Library** — Phase 1–4 (upload foto sendiri, lihat file sendiri, MemberMediaPicker). Arsitektur: `docs/arsitektur-medialibrary.md`
- **WhatsApp Gateway** — Fase 1+2 SELESAI (koneksi + dashboard setup) + Fase 7 SELESAI (OTP register + reset password) + Fase 3 SELESAI (notifikasi billing: invoice_created, payment_submitted, payment_confirmed, payment_rejected). Teks semua notifikasi editable per tenant via `/settings/notifications`. Fase 4–6 belum (fulfillment, event, surat) — lihat `docs/arsitektur-whatsapp.md` § 12. Cron reminder (`invoice_reminder`, `event_reminder`) belum dibuat. Quota enforcement/addon billing belum diimplementasikan — lihat `docs/arsitektur-whatsapp.md` § 16.

### [2026-05] Custom Role — Permission Enforcement + Dialog Fix

**Arsitektur lengkap di `docs/arsitektur-role-user.md`.**

**Tiga bug yang difix:**

**1. Custom role tidak pernah diterapkan** — `SidebarNav` tampilkan semua menu tanpa filter. Semua module layout/page tidak ada guard permission. Akibatnya user dengan custom role apapun bisa akses semua modul.
**Fix:** sidebar filter via `canAccess()` per modul; 10 modul dapat guard server-side (redirect ke `/dashboard` jika tidak punya akses).

**2. Dialog edit tidak reset state** — `useState(() => {...})` dipakai sebagai side effect (salah) — hanya run sekali saat mount. Edit role B setelah edit role A → form masih tampil data A.
**Fix:** `key={editingRole?.id ?? "new"}` di `<RoleDialog>` → React remount komponen saat berganti role.

**3. `createCustomRoleAction` tidak return ID** — client pakai `crypto.randomUUID()` sebagai placeholder → edit langsung setelah create gagal (ID tidak ada di DB).
**Fix:** tambah `.returning({ id })`, return `{ success: true, id }`, client pakai ID asli.

**Aturan yang dikunci:**
- Sidebar filtering + server guard HARUS dikerjakan bersamaan — sidebar filter saja tidak cukup karena URL langsung bisa bypass
- Guard surat pakai `canAccess("surat","own")` bukan `hasReadAccess` — agar bendahara (level `own`) tetap bisa akses modul surat
- `createCustomRoleAction` harus return `id` karena optimistic update client butuh ID asli
- Setiap perubahan alur aktivasi pengurus cek dua tempat: `settings/users` DAN `pengurus/`

### [2026-05] Login Universal Phase 2 — Self-Service Member Profile Completion

**Self-service ≠ admin wizard: jangan pakai action yang sama**
Admin actions (`updateMemberAction`, `upsertMemberContactAction`) pakai `getTenantAccess(slug)` → tenant dashboard access check. Public profile holders TIDAK punya akses ini. Buat API routes terpisah (`/api/akun/member-data`, `/api/akun/member-contact`) yang auth via `auth.api.getSession() → profiles.betterAuthUserId → profiles.memberId`.

**Batas field self-service vs admin-only**
Self-service boleh edit: nama, NIK, stambuk, gender, tgl lahir, tempat lahir, tahun lulus, profesi, kontak, alamat, sosmed.
Admin-only (TIDAK boleh diubah self-service): `status`, `joinedAt`, `memberNumber`.
Aturan: field yang menentukan hak anggota (status) harus tetap di tangan admin.

**Completeness check: cek `birthDate` + `contactId` sebagai proxy**
Daripada cek semua field satu per satu, dua kolom ini cukup representatif:
- `birthDate = null` → belum isi data identitas dasar
- `contactId = null` → belum isi kontak
Jika salah satu null → tampilkan banner di dashboard. Ini bisa diperketat nanti tanpa ubah arsitektur.

**Singleton page enforcement di action level (bukan DB constraint)**
Untuk template "terms" dan "privacy": `createSingletonPageAction` cek existing sebelum insert, return existing ID jika sudah ada. Template dropdown dikunci di editor. Tidak perlu `UNIQUE` constraint di DB karena slug sudah unique.

**`WilayahSelect` tidak punya prop `level` atau `placeholder`**
Props yang valid: `defaultValue`, `onChange`, `namePrefix`, `disabled`, `requiredLevel`, `labels`, `className`.
Untuk birth place (butuh province + regency saja), gunakan prop `labels` untuk rename label level — komponen tetap tampil 4 level tapi user cukup pilih 2 level pertama.

### [2026-05] Modul Akun Front-end + Admin — Konsistensi Form

**Prinsip: perubahan form harus berlaku di dua tempat sekaligus**
Form anggota ada di dua tempat:
1. Front-end publik: `app/(public)/[tenant]/akun/lengkapi/page.tsx` (self-service anggota IKPM)
2. Admin dashboard: `components/members/wizard/step1-identity.tsx` + `step2-contact.tsx` (admin input manual)

Setiap perubahan field (wajib/opsional, komponen, validasi) **harus diterapkan ke kedua tempat sekaligus**.
Jangan edit satu tempat saja — inconsistency antar form = pengalaman yang membingungkan.

**`RegencyCombobox` — search kabupaten langsung tanpa pilih provinsi dulu**
- `components/ui/regency-combobox.tsx` — debounce 300ms, min 2 karakter, max 15 hasil
- `/api/ref/regencies?search=` — mode search baru (alongside `?province_id=` yang lama)
- Tampil: nama kabupaten + provinsi (untuk disambiguasi nama sama antar provinsi)
- Nama di DB sudah include prefix "Kabupaten/Kota" — tidak perlu tambah lagi di UI
- Pakai di: tempat lahir (front-end `lengkapi` + admin `step1-identity`)

**`ProfessionCombobox` inline di `lengkapi` — fix bug professions selalu kosong**
API `/api/ref/professions` return plain array `[...]`, tapi kode lama baca `.data` → undefined → fallback `[]`.
Fix: `Array.isArray(profData) ? profData : (profData.data ?? [])`.
Pattern: selalu verifikasi struktur response API sebelum akses `.data` — jangan assume semua API wrap dalam `{ data: [...] }`.

**4 field wajib di form anggota IKPM (kedua tempat)**
- Jenis kelamin, tanggal lahir, tahun lulus KMI, profesi
- Di front-end: validasi di `saveStep1()` + tombol disabled
- Di admin: `required` prop + validasi HTML native

**Angkatan 1999 — dua periode dalam satu tahun**
Gontor punya dua angkatan di tahun 1999. Solusi:
- Kolom baru `graduation_period TEXT CHECK (graduation_period IN ('awal', 'akhir'))` di `public.members`
- UI: saat `graduationYear = 1999`, muncul radio **1999 Awal** / **1999 Akhir**
- Saat tahun bukan 1999, nilai di-reset ke null — tidak ada awal/akhir untuk tahun lain
- Berlaku di: front-end `lengkapi` + admin `step1-identity` + `actions.ts`

**Phone Number — E.164 dengan country code selector (SELESAI)**
Format: `+628xxxxxxxx` — universal, kompatibel WhatsApp API dan SMS gateway.
Komponen: `components/ui/phone-input.tsx` — country flag + dial code selector + input nomor.
- 57 negara, Indonesia (+62) sebagai default
- Auto-parse format lama `08xxx` → Indonesia saat load data existing
- Sinkronisasi WA ← HP via checkbox "Sama dengan nomor HP"
- Berlaku di Step 2 front-end (`/akun/lengkapi`) + Step 2 admin wizard (`step2-contact.tsx`)

**Visibilitas kontak — `public.contacts` tiga kolom boolean (SELESAI)**
```sql
is_phone_public    BOOLEAN DEFAULT false
is_whatsapp_public BOOLEAN DEFAULT false
is_email_public    BOOLEAN DEFAULT false
```
- Default: privat (false) — user harus aktif centang untuk publish
- Checkbox "Publik" di bawah tiap field HP, WA, Email
- Berlaku di kedua form (front-end + admin)
- Tersimpan via `upsertMemberContactAction` + `PATCH /api/akun/member-contact`

**Visibilitas alamat — aturan fixed (bukan toggle)**
| Field | Visibilitas |
|-------|-------------|
| Provinsi, Kabupaten/Kota | Publik |
| Kecamatan, Desa/Kelurahan | Tidak ditampilkan ke publik |
| Kode Pos, Alamat Detail | Tidak ditampilkan ke publik |

Implementasi: prop `hints` di `WilayahSelect` — teks keterangan muncul langsung di bawah tiap input.
`hints={{ province: "Publik", regency: "Publik", district: "Tidak ditampilkan...", village: "..." }}`
Tidak perlu kolom DB — ini aturan display tetap, bukan pilihan user.

**Field wajib Step 2 (kontak + domisili) — kedua form**
- Nomor HP: wajib
- Nomor WhatsApp: wajib
- Email: wajib
- Status Domisili: wajib
Validasi dilakukan sebelum submit di `saveStep2()` (front-end) dan `handleSubmit()` (admin).

**Sosial media — semua opsional, semua publik jika diisi**
Tidak ada toggle per-platform. Yang diisi otomatis tampil di profil publik.
Info text "Semua opsional. Yang diisi akan ditampilkan ke publik." di header section.

**`WilayahSelect` — prop `hints` baru (non-breaking)**
Tambah prop opsional `hints?: { province?, regency?, district?, village? }`.
Hint text muncul langsung di bawah tiap Combobox via `hint` prop di inner `Combobox` component.
Tidak mengubah interface yang sudah ada — backward compatible.

### [2026-05] Dashboard Akun Anggota — Lengkapi Data Step 3 + Pesantren + Usaha + Profil

**File baru:**

| File | Fungsi |
|------|--------|
| `app/api/akun/member-education/route.ts` | GET + POST riwayat pendidikan (auth via `members.betterAuthUserId`) |
| `app/api/akun/member-pesantren/route.ts` | GET + POST data pesantren (replace-all) |
| `app/api/akun/member-business/route.ts`  | GET + POST data usaha + helper tables (contacts/addresses/socials per usaha) |
| `app/(public)/[tenant]/akun/pesantren/page.tsx` | Halaman pesantren: multi-entry, search async |
| `app/(public)/[tenant]/akun/usaha/page.tsx`     | Halaman usaha: multi-entry, kategori/sektor/skala |
| `app/(public)/[tenant]/anggota/[id]/page.tsx`   | Profil lengkap anggota: auth-protected (owner only) |

**`/akun/lengkapi` → 3 step:**
1. Data Identitas
2. Kontak & Alamat
3. Riwayat Pendidikan (multi-entry, Gontor checkbox + kampus)

**Dashboard `/akun` tambahan (member only):**
- Card "Data Pesantren" → `/akun/pesantren`
- Card "Data Usaha" → `/akun/usaha`
- Tombol "Lihat Detail Profil →" di bawah Status keanggotaan → `/anggota/{memberId}`

**Halaman `/anggota/[id]` — profil pribadi lengkap:**
- Auth required: `session.user.id === member.betterAuthUserId` → jika bukan pemilik, redirect ke `/akun`
- Tampilkan SEMUA data: identitas, No. Anggota, No. Induk Gontor (stambuk), NIK, kontak (all), alamat lengkap, sosmed, pendidikan, pesantren, usaha
- Link edit ke masing-masing halaman

**No. Anggota vs No. Induk Gontor — BEDA:**
- `member_number` = **No. Anggota IKPM** — auto-generated via PostgreSQL SEQUENCE
  Format: `{tahun_daftar}{DDMMYYYY_lahir}{5-digit-urutan}` — misal `20262610198100007`
- `stambuk_number` = **No. Induk Gontor** — nomor santri di PM Gontor, diisi manual

**Auto-generate No. Anggota di `PATCH /api/akun/member-data`:**
Sebelumnya hanya di-generate oleh `createMemberAction` (admin). Sekarang:
- Jika `member.memberNumber IS NULL` saat PATCH → `generateMemberNumber(db, birthDate)` → simpan
- Anggota self-register → nomor ter-generate otomatis saat pertama kali simpan Step 1
- Menggunakan `public.member_number_seq` yang sama — atomic, tidak ada duplikat

**Backfill anggota existing:**
Anggota lama yang `member_number IS NULL` di-backfill via SQL langsung menggunakan `nextval('public.member_number_seq')` — tidak perlu API call.

**Aturan: jangan tampilkan "Belum diterbitkan" untuk `member_number`**
Gunakan `Row` component yang otomatis hide jika value null. Nomor selalu ada setelah PATCH pertama.

**API routes self-service anggota (pattern umum):**
Auth: `members.betterAuthUserId = session.user.id` — tidak butuh tenant access.
Replace-all pattern: DELETE all + INSERT batch — untuk pendidikan dan pesantren.
Per-entry helper tables: untuk usaha (contacts + addresses + socials per business entry).

**Label keanggotaan yang benar:**
- `member_number` → **"No. ID IKPM Gontor"** (nomor anggota IKPM, auto-generated)
- `stambuk_number` → **"No. Stambuk Gontor"** (nomor santri PM Gontor, bukan nomor anggota)
Konsisten di semua halaman: profil `/anggota/[id]` dan dashboard `/akun`.

**Urutan tampil alamat — standar Indonesia:**
```
Alamat (detail/jalan)
Desa / Kelurahan
Kecamatan
Kabupaten / Kota
Provinsi
Kode Pos
```
Jangan tampilkan alamat dari bawah ke atas (provinsi → desa). Urutkan dari spesifik ke umum.
`refVillages` wajib di-fetch untuk melengkapi alamat — jangan skip level manapun.

### [2026-05] Akun/Usaha — Three-View Pattern + SocialMediaInput + Wilayah Names

**Three-view UX pattern untuk form multi-field kompleks:**
Halaman data usaha menggunakan pola state-driven tiga tampilan tanpa navigasi router:
- **List view** (default): tabel ringkas (nama, kategori, sektor) + aksi [Detail] [Edit] [Hapus]
- **Detail view**: dialog popup modal di atas list — tampilkan SEMUA informasi lengkap
- **Edit view**: form penuh menggantikan seluruh halaman, breadcrumb "← Data Usaha / Nama"

Pattern ini cocok untuk entity yang punya banyak field tapi sehari-hari hanya perlu lihat ringkasan.
Batal pada entry baru → hapus dari list (tidak simpan). Batal pada entry existing → kembalikan ke list tanpa perubahan.

**Wilayah ID wajib di-resolve ke nama di API layer — bukan di client:**
API route yang mengembalikan data dengan wilayah (provinsi/kabupaten/kecamatan/desa) HARUS LEFT JOIN ke `refProvinces/Regencies/Districts/Villages` dan sertakan nama dalam response. Jangan hanya kirim ID — client tidak tahu cara lookup nama dari ID tanpa request tambahan.

```typescript
// BENAR: resolve di API
.leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
// SELECT: addressProvinceName: refProvinces.name

// SALAH: hanya kirim ID, display hardcode "Indonesia" di client
// addressProvinceName tidak ada → detail popup hanya tampil "Indonesia"
```

Response harus sertakan **kedua versi**: ID (untuk form edit/WilayahSelect) + nama (untuk display).

**`SocialMediaInput` — komponen universal:**
- Lokasi: `components/ui/social-media-input.tsx`
- Export: `SocialMediaValue`, `SOCIAL_MEDIA_EMPTY`, `SocialMediaInput`
- 7 platform: instagram, facebook, twitter, tiktok, linkedin, youtube, website
- Dipakai di: contact-settings-form, step2-contact (wizard), step4-business (wizard), akun/lengkapi, akun/usaha
- Jangan duplikasi logika per platform di masing-masing form — selalu import dari sini

**`null`-safe helper wajib sebelum `.trim()` pada data API:**
Data dari API response bisa `undefined` meski TypeScript type bilang `string` (edge case runtime).
Selalu gunakan helper: `function trim(s: string | undefined | null) { return (s ?? "").trim(); }`
Berlaku untuk semua field social media, alamat, dan field opsional lainnya yang berasal dari DB join.

**Aturan konsistensi admin form + front-end form:**
Setiap fix atau penambahan field di form anggota HARUS diterapkan ke dua tempat sekaligus:
- Admin: `components/members/wizard/step4-business.tsx` (wizard Step 4)
- Front-end: `app/(public)/[tenant]/akun/usaha/usaha-client.tsx`
Termasuk komponen input yang dipakai — `PhoneInput` wajib di keduanya, bukan hanya salah satu.

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

Login, registrasi, lupa password, dan dashboard akun publik — berlaku seragam untuk semua tenant.

**Satu sistem, dua tier:**
- `member` = alumni IKPM, auto-link saat daftar jika email/HP cocok data di `public.contacts → public.members`
- `akun` = publik umum, daftar mandiri tanpa validasi admin

**Schema change yang dikunci:**
- `public.profiles` ditambah kolom `whatsapp TEXT UNIQUE` (nullable) — khusus untuk OTP WA (Fase 2)
- `phone` tetap sebagai nomor HP biasa; `whatsapp` bisa beda atau sama

**Route publik:**
```
/{slug}/login               → email + password; link lupa password
/{slug}/register            → nama, email, HP, WA (opsional), password; member lookup live
/{slug}/forgot-password     → input email → Better Auth kirim link reset
/{slug}/reset-password      → input password baru via token
/{slug}/akun                → dashboard (protected, redirect login jika belum auth)
/{slug}/akun/profil         → edit profil (nama, HP, WA, alamat sederhana)
/{slug}/akun/transaksi      → riwayat invoice
/{slug}/akun/lengkapi       → wizard lengkapi data anggota IKPM (2 step) — hanya untuk member
```

**Self-service member profile completion (`/akun/lengkapi`):**
- Hanya untuk `accountType = "member"` — non-member di-redirect ke `/akun`
- Step 1: identitas (nama, NIK, stambuk, gender, tgl lahir, tempat lahir, tahun lulus Gontor, profesi)
- Step 2: kontak (HP, WA, email) + alamat domisili (WilayahSelect atau LN) + sosial media
- Data existing di-load dari `GET /api/akun/member-data` saat page mount
- Save via `PATCH /api/akun/member-data` (Step 1) dan `PATCH /api/akun/member-contact` (Step 2)
- Field admin-only (status, joinedAt, memberNumber) TIDAK bisa diubah di sini

**API routes self-service anggota:**
```
GET  /api/akun/member-data      → fetch identitas + kontak + alamat + sosmed anggota yang login
PATCH /api/akun/member-data     → update identitas (step 1) — tanpa status/joinedAt/memberNumber
PATCH /api/akun/member-contact  → upsert kontak + alamat + sosmed (step 2) — sama dengan admin upsertMemberContactAction
```

**Kelengkapan data di dashboard `/akun`:**
- Banner kuning muncul jika `!members.birthDate || !members.contactId`
- Quick link "Data Keanggotaan" selalu tampil untuk member
- Banner hilang otomatis setelah `/akun/lengkapi` diisi dan disimpan

**Halaman Legal Singleton (terms + privacy):**
- `PAGE_TEMPLATES` diperluas: `"terms"` + `"privacy"` — satu per tenant, tidak bisa duplikasi
- `SINGLETON_TEMPLATES: PageTemplate[]` di `lib/page-templates.ts`
- Buat via tombol khusus di list pages (`createSingletonPageAction`) — cek existing sebelum insert
- Editor: template dropdown dikunci (tidak bisa diubah setelah dibuat)
- Konsumsi via `GET /api/akun/legal?slug=&template=terms|privacy` → `{ found, title, html, updatedAt }`
- Tampil di register form sebagai modal Dialog dengan konten HTML dari API
- DDL CHECK constraint di `create-tenant-schema.ts` sudah mencakup `"terms"` dan `"privacy"`

**Register 2-jalur + stambuk:**
- Layar 1: pilih path — "Anggota IKPM Gontor" atau "Bukan Anggota" (full-screen card)
- Layar 2 (IKPM path): form + field stambuk opsional + live lookup `GET /api/akun/lookup-member?stambuk=`
- Layar 2 (publik path): form tanpa stambuk
- Auto-link 3 jalur di `POST /api/akun/register`: stambuk → email → phone/whatsapp
- Checkbox persetujuan legal wajib dicentang sebelum submit

**Route conflict fix — dashboard `/akun` → `/accounts`:**
- `(dashboard)/[tenant]/akun` dan `(public)/[tenant]/akun` → konflik path `/{tenant}/akun`
- Fix: rename `(dashboard)/[tenant]/akun` → `(dashboard)/[tenant]/accounts`
- Semua href + revalidatePath di dalam folder diupdate; sidebar-nav.tsx path diubah ke `"accounts"`

**Member auto-link saat daftar:**
Saat registrasi: lookup email/HP di `public.contacts → public.members`. Jika cocok:
- `profiles.memberId` = UUID member
- `profiles.accountType` = "member"
- Nama di-override dari `members.fullName` jika field nama kosong

**Member lookup live (onBlur):**
- `GET /api/akun/lookup-member?email=X` atau `?phone=X`
- Return `{ found, name, memberId }` — ditampilkan sebagai banner di form registrasi
- Auto-isi nama jika ditemukan, user bisa override

**WhatsApp OTP — ✅ SELESAI (2026-06-30):**
- Storage: tabel `public.otp_tokens` (bukan Redis) — TTL via `expires_at`, sekali pakai via `used_at`
- Endpoint: `POST /api/akun/send-otp`, `POST /api/akun/verify-otp`, `GET /api/wa/available`
- Register: OTP step muncul kondisional (hanya jika admin aktifkan toggle `otp_register`)
- Forgot-password: tab "Via WhatsApp" dengan alur OTP → inject Better Auth `verification` token → redirect `/reset-password?token=`
- Tidak ada halaman `/register/verify` terpisah — OTP step inline di form yang sama
- Migration wajib: `packages/db/migrations/0016_otp_tokens.sql`

**Dashboard `/akun` — perbedaan member vs publik:**
| Section | Member | Akun Umum |
|---------|--------|-----------|
| Badge | "Anggota IKPM" | "Akun Publik" |
| Info keanggotaan | Nomor anggota, cabang, status | — |
| Transaksi | Invoice, donasi, event, produk | Sama |

**Auth pattern server component:**
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun`);
```

### [2026-05] Migrasi URL Admin — Lessons Learned

**Arsitektur URL sebelum:** Admin dan publik berbagi `/{slug}/*` → konflik nama modul (toko vs produk, donasi vs campaign, event vs agenda).

**Arsitektur URL sesudah:** Admin di `/app/{slug}/*`, publik tetap `/{slug}/*`. Tidak ada konflik lagi.

**Empat kategori perubahan dalam migrasi ini (urutan penting):**
1. **Route structure** — pindah folder di filesystem (Next.js otomatis ikut)
2. **redirect() + revalidatePath()** — di semua `actions.ts` (bulk sed per pattern)
3. **href + router.push** — di semua komponen dan page
4. **import paths** — `@/app/(dashboard)/[tenant]/...` → `@/app/(dashboard)/app/[tenant]/...`

**Bug yang terlewat saat audit Phase 3:**
Import statements ke `actions.ts` menggunakan string literal yang berbeda format dari `href`. Grep pattern `href.*${slug}` tidak menangkap `from "@/app/(dashboard)/[tenant]/..."`. Harus grep terpisah untuk import paths.
**Aturan:** Setiap kali pindah folder yang berisi `actions.ts`, selalu grep juga `from "@/app/(dashboard)/[tenant]/` untuk cari import yang mengarah ke sana.

**`useSearchParams()` wajib Suspense di Next.js 15:**
Halaman baru yang menggunakan `useSearchParams()` akan gagal build di production jika tidak dibungkus `<Suspense>`. Pattern: pisah komponen inner (pakai `useSearchParams`) dan outer (wrapper dengan `<Suspense fallback={null}>`). Berlaku untuk semua halaman client dengan `useSearchParams`.

**Redirect 301 di `next.config.ts` untuk backward compat:**
Gunakan `redirects()` di `next.config.ts` untuk handle URL lama → baru. Regex pada `:slug` perlu negative lookahead agar tidak salah match `/api`, `/app`, `/platform`. Cache browser menyimpan 301 → user perlu Incognito atau clear cache untuk test. Bukan bug jika URL baru tidak muncul di browser yang sudah pernah buka URL lama.

**Deploy command (PM2):**
```bash
cd /var/www/jalajogja && git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja --update-env
```
Tidak perlu migrasi DB — migrasi URL adalah perubahan routing saja, schema tidak berubah.

**Bug post-deploy: link admin lama di public area (ditemukan dari error mobile)**

Setelah Fase 1–4 selesai dan di-deploy, muncul "client-side exception" di mobile untuk pengunjung `ikpmjogja.com`. Root cause: ada beberapa file di `(public)/` dan `components/website/public/` yang punya link ke URL admin lama (`/{slug}/dashboard`) tapi **tidak termasuk dalam scope audit Phase 3** karena audit hanya fokus ke `(dashboard)/` dan `components/dashboard/`.

**File yang terlewat dan difix post-deploy:**

| File | Masalah | Fix |
|------|---------|-----|
| `flex-header.tsx` baris 283 | Tombol "Dashboard Admin" di dropdown user → `/{tenantSlug}/dashboard` | → `/app/${tenantSlug}/dashboard` |
| `akun/layout.tsx` | redirect pengurus ke `/${slug}/dashboard` | → `/app/${slug}/dashboard` |
| `akun/page.tsx` | redirect pengurus ke `/${slug}/dashboard` | → `/app/${slug}/dashboard` |
| `akun/event/page.tsx` | redirect pengurus ke `/${slug}/dashboard` | → `/app/${slug}/dashboard` |
| `invite/page.tsx` | link "Buka Dashboard" setelah accept invite | → `/app/${slug}/dashboard` |
| `invite/invite-accept-client.tsx` | `router.push` setelah terima undangan | → `/app/${res.slug}/dashboard` |
| `(auth)/register/page.tsx` | redirect setelah daftar tenant baru | → `/app/${slug}/dashboard` |

**Kenapa hanya mobile yang kena?**
Pengunjung desktop kemungkinan tidak ada yang login sebagai pengurus, atau redirect 301 dari URL lama berhasil di-handle mulus. Di mobile, pengurus yang login dan klik "Dashboard Admin" di header mendapat 404 → Next.js render error page → terlihat sebagai "client-side exception".

**Pola audit yang benar untuk migrasi URL serupa:**
Setiap kali ada migrasi URL admin, grep EMPAT area berbeda:
```bash
# 1. redirect() dan revalidatePath() di actions
grep -r 'redirect\|revalidatePath' app/(dashboard) --include="*.ts"

# 2. href dan router.push di dashboard
grep -r 'href=.*slug\|router\.push.*slug' app/(dashboard) components/dashboard --include="*.tsx"

# 3. import paths dari actions
grep -r 'from "@/app/(dashboard)/\[tenant\]/' components app --include="*.ts" --include="*.tsx"

# 4. Link admin di public area — YANG SERING TERLEWAT
grep -r 'slug}/dashboard\|slug}/members\|slug}/settings' \
  app/(public) app/(auth) components/website components/akun \
  --include="*.tsx" --include="*.ts"
```

**Checklist post-deploy untuk migrasi URL:**
```
[ ] Buka front-end di browser Incognito (bukan cache)
[ ] Login sebagai pengurus → cek tombol "Dashboard Admin" di header → klik → URL benar?
[ ] Buka link invite → terima → redirect ke dashboard benar?
[ ] Buka /akun sebagai pengurus → redirect ke dashboard benar?
[ ] Cek di mobile (berbeda behavior dengan desktop)
[ ] Cek error log VPS: pm2 logs jalajogja --lines 50
```

### [2026-05] Deployment Production — Lessons Learned

**Infrastruktur:**
- Docker multi-stage (deps → builder → runner). Runner pakai Node.js minimal — tidak ada `bun` di dalamnya.
- Jalankan migrasi DB dari **VPS host** (bukan dari dalam container): install bun di host, gunakan `DATABASE_URL` dengan `localhost:5432`.
- Docker Compose baca `.env` bukan `.env.local` — wajib buat symlink: `ln -s .env.local .env`
- MinIO console (port 9001) dan S3 API (port 9000) adalah dua endpoint berbeda. `minio.jalakarta.com` → port 9000 (S3 API).

**Next.js build di Docker:**
- Semua API route WAJIB `export const dynamic = "force-dynamic"` di baris pertama.
  Tanpa ini Next.js mencoba prerender route → koneksi DB saat build time → `ECONNREFUSED`.
- Folder `apps/web/public/` harus ada (boleh kosong dengan `.gitkeep`) atau Dockerfile COPY gagal.
- `postcss.config.js` harus CommonJS (`module.exports = {}`), bukan ESM (`export default {}`).

**"use server" constraint:**
- File `"use server"` hanya boleh export **async function**. Type, konstanta, dan fungsi non-async harus di file terpisah.
- Pattern fix: ekstrak ke `lib/toko-settings.ts` (tanpa `"use server"`), import dari sana di kedua sisi (server action + API route).

**drizzle-kit `strict: true` — tidak kompatibel non-interaktif:**
- `strict: true` di `drizzle.config.ts` minta konfirmasi terminal → hang lalu exit code 1 di CI/VPS.
- Fix produksi: jalankan SQL migration files langsung via psql:
  ```bash
  for f in $(ls *.sql | sort); do
    docker compose exec -T postgres psql -U jalakarta -d jalakarta < "$f"
  done
  ```

**Bash gotcha di VPS:**
- `!` di password dalam double quotes → bash history expansion → error. Selalu pakai **single quotes** untuk nilai yang mengandung `!`.
- Command panjang yang wrap ke baris baru di terminal → bash parse error karena flag terpisah dari argumennya. Paste sebagai satu baris atau gunakan `\` line continuation.

**`createTenantSchemaInDb` — urutan DDL kritis:**
- Tabel yang punya FK ke tabel lain HARUS dibuat SETELAH tabel yang direferensikan.
- Bug ditemukan: `letters` dibuat sebelum `officers` padahal punya `REFERENCES officers(id)` → error saat register tenant pertama.
- Fix: pindah `divisions` dan `officers` ke sebelum `letters` dalam `create-tenant-schema.ts`.
- **Aturan**: setiap kali tambah FK baru di DDL tenant, cek ulang apakah tabel yang direferensikan sudah dibuat lebih awal.

**`member_owned_pesantren` — tabel tanpa migration:**
- Tabel ini ada di Drizzle schema tapi tidak punya migration CREATE TABLE (ditambahkan langsung tanpa `drizzle-kit generate`).
- Fix produksi: jalankan CREATE TABLE manual via psql, lalu migration 0009 yang pakai `ADD COLUMN IF NOT EXISTS` akan skip gracefully.
- **Aturan**: setiap tambah tabel baru ke Drizzle schema → SELALU generate migration. Jangan hanya update schema file tanpa migration.

### [2026-05] Bug Kritis: `media.variants` di DB = Path Relatif, Bukan URL Penuh

> **ATURAN: `media.variants` (JSONB di tabel `tenant.media`) menyimpan path RELATIF — SELALU wrap dengan `publicUrl()` sebelum dipakai sebagai `src` gambar.**

**Root cause**: Upload route menyimpan `variants: variantPaths` (relative) ke DB. Media list API (`/api/media/list`) sudah benar — memanggil `publicUrl()` per variant saat serve response. Tapi query langsung DB di server component **tidak** otomatis wrap — inilah sumber bug.

**Gejala**: Gambar cover artikel return 404 di custom domain `ikpmjogja.com`. URL error: `https://ikpmjogja.com/pc-ikpm-jogjakarta/post/website/2026/05/[uuid]_lg.webp` — browser me-resolve path relatif terhadap URL halaman artikel, bukan terhadap MinIO.

**Kode bermasalah di `post/[slug]/page.tsx`:**
```typescript
// SALAH — vv?.large adalah path relatif: "website/2026/05/uuid_lg.webp"
coverUrl = vv?.large ?? vv?.original ?? publicUrl(tenantSlug, media.path);
// Di-render sebagai <img src={coverUrl}> → 404 di custom domain
```

**Fix — gunakan `resolveMediaUrl()` dari `lib/minio.ts`:**
```typescript
// BENAR — resolveMediaUrl() selalu wrap dengan publicUrl()
export function resolveMediaUrl(
  slug: string,
  path: string,
  variants: Record<string, string> | null | undefined,
  preferOrder: string[] = ["large", "original"],
): string {
  if (variants) {
    for (const key of preferOrder) {
      if (variants[key]) return publicUrl(slug, variants[key]);
    }
  }
  return publicUrl(slug, path);
}
```

**File yang menggunakan `resolveMediaUrl()` (sudah difix):**
- `app/(public)/[tenant]/post/[slug]/page.tsx` — cover post
- `app/(public)/[tenant]/campaign/[slug]/page.tsx` — cover campaign (di `generateMetadata`)
- `lib/minio.ts` — definisi helper

**Bedakan dua jenis variants:**
| Source | Format | Treatment |
|--------|--------|-----------|
| `media.variants` (tenant.media JSONB) | Path relatif | WAJIB `publicUrl()` / `resolveMediaUrl()` |
| `products.images[].variants` (JSONB dari MediaPicker) | URL penuh | Langsung pakai, JANGAN `publicUrl()` lagi |

MediaPicker response sudah mengembalikan URL penuh karena upload route memanggil `publicUrl()` sebelum insert ke `products.images`. Jangan dobel.

**`PostCardData.coverVariants` — JANGAN isi dengan path relatif dari DB:**
`PostCardData.coverVariants` harus berisi URL penuh, bukan path relatif. Komentar di type-nya:
`"semua variant resolved URLs"`. Jika membangun `PostCardData` secara manual (misal di fungsi helper
seperti `getRelatedPosts`), **set `coverVariants: null`** dan hanya isi `coverUrl` via `resolveMediaUrl()`.
`pickCover()` otomatis fallback ke `coverUrl` jika `coverVariants` null atau tidak punya variant yang diminta.

```typescript
// SALAH — path relatif dari DB langsung ke coverVariants
const coverVariants = media?.variants ?? null;   // "website/2026/05/...._sq.webp"
return { ..., coverUrl, coverVariants };         // → 404 di custom domain

// BENAR — hanya coverUrl yang di-resolve, coverVariants dikosongkan
const coverUrl = media ? resolveMediaUrl(tenantSlug, media.path, media.variants) : null;
return { ..., coverUrl, coverVariants: null };   // pickCover() fallback ke coverUrl
```

Berlaku di semua tempat yang membangun `PostCardData` secara manual di luar pipeline standar.

**POSTGRESQL JSONB LIKE gotcha (temuan saat debug):**
PostgreSQL serialisasi JSONB dengan spasi: `"src": "..."` bukan `"src":"..."`. Query `WHERE content::text LIKE '%"src":"website/%'` → 0 rows karena tidak ada spasi. Gunakan `LIKE '%"src": "website/%'` (ada spasi setelah colon).

### [2026-05] renderBody — `imageBaseUrl` Context untuk Gambar Inline Tiptap

`lib/letter-render.ts` diperluas dengan `RenderContext { imageBaseUrl? }` dan `fixImageSrc()`:
- Menangani path relatif di `<img src>` dalam konten Tiptap
- Menangani localhost/127.0.0.1 URL yang perlu di-replace saat production
- Signature: `renderBody(body, { imageBaseUrl })` — backward compatible

**Pattern penggunaan di semua halaman yang render Tiptap content:**
```typescript
const imageBaseUrl = `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${slug}`;
const html = renderBody(post.content, { imageBaseUrl });
```

Berlaku di: `post/[slug]`, `campaign/[slug]`, `produk/[slug]`, `agenda/[slug]`.

### [2026-05] Campaign Cards + Detail — Terkumpul Tanpa Target

**Masalah**: `collectedAmount` tidak pernah tampil di card maupun detail jika campaign tidak punya `targetAmount`. Kondisi lama: `progressPercent !== null` (card) dan `target && showAmount` (detail) → dua-duanya butuh target.

**Fix pattern untuk cards** — pisahkan kondisi "ada data" dari "ada target":
```tsx
{campaign.campaignType !== "qurban" && (
  <div>
    {campaign.progressPercent !== null ? (
      // Ada target: progress bar + persentase + amount
    ) : (
      // Tanpa target: cukup teks "Terkumpul Rp X"
      <p>Terkumpul <span>{formatRp(campaign.collectedAmount)}</span></p>
    )}
  </div>
)}
```

**Fix detail page** — hapus syarat `target` dari kondisi showAmount:
```tsx
// LAMA: butuh target DAN showAmount
{campaign.campaignType !== "qurban" && target && campaign.showAmount && (...)}

// BARU: cukup showAmount (admin setting); tampilan beda tergantung ada/tidaknya target
{campaign.campaignType !== "qurban" && campaign.showAmount && (
  target ? <ProgressBar ... /> : <p>Terkumpul Rp X</p>
)}
```

**Tab Donatur** — komponen `CampaignDetailTabs` di `components/donasi/public/campaign-detail-tabs.tsx`:
- Dua tab: "Detail" (deskripsi) + "Donatur (N)" (list dengan nominal)
- Tab hanya muncul jika `showDonorList = true` (admin setting)
- Nominal donatur: JOIN `payments` WHERE `source_type='donation'` AND `source_id=donations.id` AND `status='paid'`
- Donor dari cart flow (tanpa donations record) → tidak tampil di list (hanya berkontribusi ke `collected_amount`). Ini limitasi saat ini.

**VPS setup ringkas (untuk referensi deploy ulang):**
```
1. git clone → /var/www/jalajogja/
2. buat .env.local → ln -s .env.local .env
3. docker compose build --no-cache
4. docker compose up -d
5. install bun di host → jalankan migrasi dari packages/db/
6. setup nginx + certbot
7. register tenant pertama via /register
```

### [2026-05] PM2 vs Docker — Pilih Satu, Jangan Keduanya

**Keputusan yang dikunci**: Aplikasi dijalankan via **PM2** (`next start`), bukan Docker container.
Docker hanya dipakai untuk PostgreSQL dan MinIO.

**Konfigurasi PM2** — file `ecosystem.config.cjs` di root repo:
```js
module.exports = {
  apps: [{
    name: "jalajogja",
    cwd: "/var/www/jalajogja/apps/web",
    script: "node_modules/.bin/next",
    args: "start",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "1G",
    env: { NODE_ENV: "production", PORT: "3000" },
  }],
};
```

**`output: "standalone"` tidak kompatibel dengan PM2 `next start`:**
`output: standalone` menghasilkan `.next/standalone/` yang punya server.js sendiri — berbeda dengan
`next start` yang baca `.next/` biasa. Pakai `output: standalone` hanya di Docker multi-stage.
Untuk PM2: hapus `output` dari `next.config.ts`, jalankan `next start` seperti biasa.

**Deploy ulang dengan PM2:**
```bash
cd /var/www/jalajogja
git pull
bun run build --filter=@jalajogja/web
pm2 restart jalajogja --update-env
```

**Migrasi DB di VPS — wajib pakai `docker compose exec` (bukan `psql` langsung):**
`psql` tidak tersedia di VPS host karena PostgreSQL jalan di dalam Docker container.
```bash
docker compose exec -T postgres psql -U jalakarta -d jalakarta < packages/db/migrations/0017_nama_migration.sql
```
Urutan wajib: **migrate DB dulu → baru restart PM2**. Jangan kebalik.

**Jika PM2 belum setup atau perlu reset:**
```bash
pm2 delete jalajogja        # hapus proses lama (tidak hapus sistem)
pm2 start ecosystem.config.cjs
pm2 save                    # persist agar restart otomatis setelah reboot VPS
```

### [2026-05] Data Cleanup — Orphan Contacts di `public.contacts`

**Masalah**: Tabel `public.contacts` bisa punya banyak baris dengan nomor HP yang sama — dari
berbagai sesi registrasi yang gagal di tengah jalan (error, retry, dll).

**Dua jenis pemakai `public.contacts`:**
1. `public.members` — via kolom `contact_id` (satu kontak per anggota)
2. `public.member_businesses` — via kolom `contact_id` (satu kontak per usaha)

**WAJIB cek keduanya sebelum hapus contact orphan:**
```sql
-- Cari contact yang punya phone tertentu
SELECT c.id, c.phone, m.name AS member_name, mb.name AS business_name
FROM public.contacts c
LEFT JOIN public.members m ON m.contact_id = c.id
LEFT JOIN public.member_businesses mb ON mb.contact_id = c.id
WHERE c.phone = '+62xxx';
```

Baris yang `member_name IS NULL` DAN `business_name IS NULL` → orphan, aman dihapus.
Baris yang ada member atau bisnis → **JANGAN dihapus**.

**Cara hapus:**
```bash
docker compose exec postgres psql -U jalakarta -d jalakarta -c \
  "DELETE FROM public.contacts WHERE id IN ('uuid-1', 'uuid-2');"
```

### [2026-05] Bot/Scraper Errors — `generateMetadata` Harus Cek Tenant Existence

**Masalah**: PM2 error log penuh dengan `relation "tenant_favicon.ico.settings" does not exist`
dan `relation "tenant_dua-divonis-3-tahun-penjara-atas-kasus-narkoba.settings" does not exist`.

**Root cause**: Bot/scraper hit URL random seperti `/favicon.ico` atau bekas URL artikel lama.
Path segment pertama di-capture oleh `[tenant]` dynamic route. `generateMetadata` dan `getTenantSeoBase`
langsung memanggil `createTenantDb(slug)` → `getSettings(tenantClient, "general")` **tanpa** cek
apakah tenant dengan slug tersebut benar-benar ada di `public.tenants`.

**Aturan yang dikunci:**
> **WAJIB**: Setiap fungsi yang menerima `slug` dan akan query `tenant_{slug}.*` HARUS cek
> `public.tenants WHERE slug = ?` dulu. Jika tenant tidak ada → return early / `notFound()`.

**File yang difix (commit `cc16b5a`):**
- `app/(public)/[tenant]/layout.tsx` — `generateMetadata` sekarang cek tenant exists sebelum `getSettings`
- `lib/tenant-seo.ts` — `getTenantSeoBase` sekarang return fallback jika `!tenant?.isActive`

**Catatan**: `PublicLayout` (main function di layout.tsx) sudah benar sejak awal — ada `if (!tenant?.isActive) notFound()`. Yang bermasalah hanya `generateMetadata` yang dieksekusi secara independen oleh Next.js sebelum layout render.

**Pattern fix yang benar:**
```typescript
// WAJIB di generateMetadata dan semua helper yang menerima slug
export async function generateMetadata({ params }) {
  const { tenant: slug } = await params;
  const [tenantRow] = await db.select({ isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenantRow?.isActive) return {};  // ← early return, jangan lanjut query schema
  
  const tenantClient = createTenantDb(slug);  // ← baru aman dipanggil
  // ...
}
```

### [2026-05] Internal Fetch di Server Component — Jangan Forward Semua Headers

**Masalah**: `TypeError: fetch failed` di `app/(public)/[tenant]/akun/mitra/page.tsx` dengan
cause `[Error [InvalidArgumentError]: invalid connection header] { code: 'UND_ERR_INVALID_ARG' }`.

**Root cause**: Server component melakukan internal fetch ke API route sendiri:
```typescript
// SALAH — forward semua incoming request headers
const res = await fetch(url, { headers: await headers(), cache: "no-store" });
```

Header `connection` (dan header hop-by-hop lain seperti `transfer-encoding`, `keep-alive`) adalah
header yang **tidak boleh di-forward** ke request lain. Browser/proxy mengirimnya ke server, tapi
server tidak boleh meneruskannya ke upstream request. `undici` (HTTP client di Node.js/Next.js)
menolak keras header ini → `UND_ERR_INVALID_ARG`.

**Fix:**
```typescript
// BENAR — hanya forward cookie untuk auth
const hdrs = await headers();
const res = await fetch(url, {
  headers: { cookie: hdrs.get("cookie") ?? "" },
  cache: "no-store",
});
```

**Aturan**: Setiap server component atau server action yang melakukan internal fetch ke API route
sendiri, **hanya forward `cookie` header** — tidak pernah `await headers()` langsung ke fetch options.
Cukup cookie untuk meneruskan session auth.

### [2026-05] UUID Validation di API Routes — Validasi Format Sebelum Query

**Masalah**: `invalid input syntax for type uuid: "ikpmjogja"` — string non-UUID dikirim ke kolom
UUID di PostgreSQL → crash langsung di driver level.

**Contoh kasus**: Bot atau request manual hit `GET /api/member-public/ikpmjogja?slug=...` di mana
`ikpmjogja` adalah tenant subdomain, bukan UUID member. Kolom `tenantMemberships.memberId` bertipe UUID.

**Fix — tambah UUID regex check sebelum query:**
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
```

**Aturan**: Setiap API route yang menerima ID sebagai path param (misal `[id]`) dan ID tersebut akan
dipakai dalam query ke kolom UUID, WAJIB validasi format UUID sebelum hit DB. Berlaku untuk:
- `member-public/[id]` ← sudah difix
- semua route pattern `[id]` lain yang query UUID columns

### [2026-05] "Failed to find Server Action" — Normal Post-Deploy, Bukan Bug Kode

**Gejala**: `[Error: Failed to find Server Action "x". This request might be from an older or newer deployment.]`
muncul berkali-kali di PM2 error log setelah deploy.

**Bukan bug kode.** Ini terjadi karena:
- Next.js me-hash setiap server action saat build → hash berbeda di setiap deployment
- User yang masih buka tab browser lama (versi sebelum deploy) submit form → hash lama tidak dikenal
- Setelah user refresh browser, error ini tidak muncul lagi

**Tidak perlu tindakan** kecuali error ini muncul pada URL yang baru saja dibuka (bukan tab lama).
Jika muncul terus-menerus pada semua request baru → kemungkinan ada masalah build (action tidak ter-bundle).
