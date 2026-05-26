# CLAUDE.md — jalajogja Project Brain

## Identitas Project
- Nama: jalakarta
- Klien pertama: IKPM (Ikatan Keluarga Pondok Modern Gontor)
- Tujuan: Super-app untuk organisasi (website, surat, anggota, keuangan, toko)
- Target: Multi-tenant SaaS — dibangun untuk IKPM, dijual ke banyak organisasi
- Developer: Webane (familiar dengan WordPress/PHP, belajar TypeScript/Next.js)

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
- **Prinsip**: front-end pakai cart universal, admin pakai invoice manual — SATU infrastruktur. Fulfillment terpisah dari payment. Detail di `docs/arsitektur-billing.md` + `docs/arsitektur-fulfillment.md`.
- [x] Donasi / Infaq — arsitektur di `docs/arsitektur-donasi.md` (schema + CRUD + SEO + kategori)
- [x] Event — arsitektur di `docs/arsitektur-event.md` — semua Step 1–6 selesai
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

### Tiga Layer Pembangunan (Urutan)
```
1. Tenant Dashboard  → aplikasi yang dipakai organisasi
   URL: app.jalakarta.com/{slug}/*
   Status: SEDANG DIBANGUN

2. Front-end (Public) → website publik organisasi
   URL: {slug}.jalakarta.com atau custom domain
   Status: BELUM — setelah Tenant Dashboard selesai

3. Platform Dashboard → admin jalajogja (bukan untuk tenant)
   URL: platform.jalakarta.com
   Status: BELUM — setelah Front-end selesai
   Fitur: kelola tenant, modul, add-on, billing, package
```

**Aturan urutan ini TIDAK boleh diubah** — Front-end dan Platform Dashboard bergantung pada keputusan arsitektur yang dibuat saat membangun Tenant Dashboard.

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
- Library: [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice)
- **Hosting: sumopod** (bukan main VPS — murah, tidak membebani app server)
- Satu service, banyak tenant — masing-masing punya `device_id` unik
- Tenant self-service: scan QR via dashboard jalajogja → nomor WA terdaftar
- Platform env: `WHATSAPP_SERVICE_URL`, `WHATSAPP_API_SECRET`
- Config per tenant di `tenant_addon_installations.config`:
  ```json
  { "device_id": "ikpm-001", "phone_number": "628xxx", "verified": true,
    "notifications": { "payment_submitted": true, "payment_confirmed": true, ... } }
  ```

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

#### inArray untuk filter array UUID
`inArray(column, ids)` adalah cara Drizzle yang benar untuk `WHERE column = ANY(array)`.
Jangan pakai `sql.raw` dengan spread args — TypeScript tidak bisa inferensikan tipe.

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

### [2026-05] Bug: Link TTD "Tidak Valid" setelah officer menandatangani

**Masalah**: Setelah officer TTD via link, jika link dibuka lagi → "Link Tidak Valid".

**Root cause**: `signLetterAction` meng-null-kan `signingToken` setelah signing (alasan lama:
"invalidate agar tidak bisa sign ulang"). Padahal token null = row tidak bisa ditemukan by token
= "Link Tidak Valid" alih-alih "sudah ditandatangani".

**Mengapa aman mempertahankan token setelah signing:**
Double-sign sudah dicegah oleh `if (existing?.signedAt) return { error }` di `signLetterAction` —
bukan oleh nullifikasi token. Token yang tetap ada hanya memungkinkan link menampilkan halaman
konfirmasi "sudah ditandatangani".

**Fix:**
1. `signLetterAction` — hapus `signingToken: null` dari UPDATE setelah signing
2. `generateSigningTokenAction` — hapus guard `if (sig.signedAt) return error` agar admin bisa
   pulihkan link untuk slot yang tokennya sudah terlanjur di-null; token slot signed tidak punya expiry
3. `signature-slot-manager.tsx` — tombol "Pulihkan Link Konfirmasi" muncul di signed slot yang tokennya null
   + link konfirmasi (salin) tampil di signed slot yang sudah punya token

**Untuk slot lama yang tokennya sudah di-null**: admin klik "Pulihkan Link Konfirmasi" di halaman
detail surat → token baru di-generate → bagikan link baru ke officer → halaman tampil
"sudah ditandatangani" dengan benar.

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

---

## Context Sesi Terakhir
- Terakhir dikerjakan: **Fix media upload errors + letters image processor** (sesi 2026-05-27, commit `960d6fd`).
- Sesi ini (2026-05-26–27):
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

**`lucide-react` tidak punya `Instagram` dan `Youtube` icon:**
Versi v0.503 yang dipakai tidak mengeksport social media brand icons.
Fix: gunakan `Globe` sebagai pengganti universal untuk semua platform sosial media.
Aturan: jangan import icon yang tidak tersedia, selalu cek dengan `tsc` sebelum commit.

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

**WhatsApp OTP (Fase 2 — saat gateway aktif):**
- Kolom `phone_verified_at`, `email_verified_at` ditambah ke `profiles`
- Endpoint: `POST /api/akun/send-otp`, `POST /api/akun/verify-otp`
- Halaman: `/{slug}/register/verify`

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
