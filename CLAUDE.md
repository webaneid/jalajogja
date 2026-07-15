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
- Super admin jalajogja: akses semua `public.members` tanpa filter
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

jalajogja punya **tiga level akses** yang berbeda entitas, berbeda tabel, berbeda lifecycle.
**PRINSIP UTAMA (tidak boleh dilanggar):**

> Pengurus adalah anggota IKPM yang sedang bertugas — bukan entitas terpisah.
> Satu akun Better Auth berlaku di dua konteks: dashboard (saat menjabat) + front-end (selamanya).

**Super Admin jalajogja** (platform level) — terpisah dari sistem tenant, tidak dibahas di sini.

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
> Detail lengkap — dashboard CMS, domain routing, front-end publik, caching, open questions: **`docs/arsitektur-website.md`**
> Detail lengkap — tiga fase routing, masalah custom domain, roadmap perbaikan: **`docs/arsitektur-domain.md`**
> SEO helper, bug `og:type` + Twitter images, rencana Related Posts: **`docs/arsitektur-seo.md`**

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
- **Prinsip**: front-end pakai cart universal, admin pakai invoice manual — SATU infrastruktur. Fulfillment terpisah dari payment. Detail di `docs/arsitektur-billing.md` + `docs/arsitektur-fulfillment.md`.
- [x] Donasi / Infaq — arsitektur di `docs/arsitektur-donasi.md` (schema + CRUD + SEO + kategori)
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
- [x] **Halaman publik `/produk`** — archive + filter kategori + search + pagination. URL `/produk` (bukan `/toko` — hindari konflik dashboard). TypeScript 0 errors.
- [x] **Halaman publik `/produk/kategori/{slug}`** — arsip per kategori + breadcrumb + SEO. TypeScript 0 errors.
- [x] **Halaman publik `/produk/{slug}`** — detail produk: gallery + variasi picker + add to cart via `addToCartAction` + produk terkait. TypeScript 0 errors.
- [x] **EventCard + EventsSection** — 3 card variant (grid/list/ringkas) + 3 section design + integrasi landing-template + section-editors. Archive `/{slug}/agenda` + detail `/{slug}/agenda/{slug}` ✅. TypeScript 0 errors.
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
│   ├── Subdomain jalajogja: [input].jalakarta.com
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
│       └── CATATAN: field "website" di sini = URL eksternal org (bukan jalajogja)
│           Domain jalajogja dikelola di /settings/domain
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
jalajogja adalah super-app untuk organisasi — bukan satu aplikasi monolitik, melainkan **ekosistem modular** di mana organisasi memilih fitur sesuai kebutuhan.

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
- Login di: `platform.jalakarta.com/login` — JWT terpisah (`lib/platform-auth.ts`)
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
addons                      → katalog semua add-on tersedia (dikelola jalajogja)
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
- **Hosting: Self-hosted di VPS jalajogja** (72.61.215.7) — Docker service port 3002. Sumopod menutup layanan 2026-06-30.
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
- **[RENCANA] Sesi khusus evaluasi ulang arsitektur domain/URL secara menyeluruh** — diminta user
  2026-07-14 setelah bug redirect legacy salah tangkap path publik di custom domain (lihat lesson
  "next.config.ts redirects() Salah Tangkap Path Publik di Custom Domain"). Empat entitas domain
  yang perlu dipetakan ulang secara sistematis dan didokumentasikan sebagai satu sumber kebenaran:
  1. `jalakarta.com` — landing page platform (belum dibangun)
  2. `platform.jalakarta.com` — admin platform (tim Jalakarta)
  3. `jalakarta.com/app/{slug}/*` — dashboard admin tenant
  4. `jalakarta.com/{slug}/*` **atau** `{custom-domain}/*` — front-end publik tenant
  Fokus evaluasi: konflik path (kasus `/akun/media` vs `/:slug/media` legacy redirect adalah contoh
  nyata), urutan eksekusi Next.js (`redirects → middleware → rewrites`) dan implikasinya ke custom
  domain, konsistensi `has: host` guard di semua redirect/rewrite yang path-based, serta status
  Fase 5 (admin subdomain) yang masih tertunda. **Belum dijadwalkan** — tunggu instruksi user untuk
  mulai sesi ini secara eksplisit, jangan dieksekusi proaktif.

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

jalajogja adalah super-app komunitas IKPM. Ada tiga level akses yang berbeda entitas:

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

Redis hanya diperlukan jika OTP di-generate jutaan kali per hari (high-traffic). Untuk jalajogja,
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

## Context Sesi Terakhir
- Terakhir dikerjakan: **WhatsApp Notification Fase 3 (Billing) + teks notifikasi editable per tenant** (sesi 2026-07-13).
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
