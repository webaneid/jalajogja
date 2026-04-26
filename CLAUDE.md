# CLAUDE.md — jalajogja Project Brain

## Identitas Project
- Nama: jalajogja
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

## UI Standards
- **Container width front-end publik: selalu `max-w-7xl mx-auto px-4`** — header, footer, semua section (hero, posts, events, dll) wajib pakai lebar yang sama agar layout proporsional. Jangan pakai `max-w-6xl`, `max-w-5xl`, atau lebar lain kecuali ada alasan desain yang eksplisit.
- **Border dekoratif: selalu sertakan `border-border`** — `border-l`, `border-t`, dst tanpa kelas warna menggunakan warna default browser (hitam). Wajib: `border-l border-border`, `border-t border-border`, dst.
- SEMUA dropdown/select wajib menggunakan Combobox (autocomplete), bukan plain `<select>` HTML
- Implementasi: shadcn/ui Command + Popover pattern
- Untuk data kecil (<100 items): filter client-side
- Untuk data besar (>100 items, misal wilayah): server-side fetch per keystroke / on-open
- Komponen standar: `components/ui/wilayah-select.tsx` untuk wilayah, generic combobox pattern untuk lainnya
- Konsisten di seluruh aplikasi: wizard form, edit form, filter tabel, search, semua

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

### Arsitektur Akun: Universal Customer Identity
> Detail lengkap: **`docs/arsitektur-akun.md`**

Lapisan identitas untuk siapapun di luar ekosistem IKPM (pembeli umum, donatur, peserta event).

- `public.profiles` — identitas universal publik (BARU, belum diimplementasikan)
- Relasi: `profiles.member_id → public.members.id` (nullable — jika ternyata alumni)
- Relasi: `profiles.better_auth_user_id → public.user.id` (nullable — jika punya login)

**Konsep kunci:**
- `public.members` = sakral, hanya alumni IKPM, dikontrol admin
- `public.profiles` = siapapun, self-service register dari halaman publik tenant manapun
- Transaksi tabel akan punya dua kolom: `member_id` (IKPM) + `profile_id` (publik) — keduanya nullable
- Lookup di checkout: session → profile lookup → member lookup → guest
- Dashboard tenant tidak bisa diakses oleh profile publik (hanya front-end)

**Status**: Arsitektur selesai, implementasi belum dimulai. Ikuti fase di `docs/arsitektur-akun.md`.

### Struktur File packages/db/src/
```
src/
├── index.ts               ← public API
├── client.ts              ← public schema db instance
├── tenant-client.ts       ← factory: createTenantDb(slug)
├── schema/
│   ├── public/            ← auth.ts, tenants.ts, members.ts, tenant-memberships.ts, profiles.ts (BELUM)
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

- Dashboard CMS (`/{slug}/website/`): posts, pages, kategori, tag — **SELESAI**
- Domain routing 3 fase (path → subdomain → custom domain) — schema selesai, middleware Fase 2–3 saat front-end
- Front-end publik Layer 1–4 — **SELESAI** (header/footer, homepage, post cards, section post, search)
- Route group `(public)` sudah ada, donasi/event/dokumen/surat sudah render publik

### Template Card Post
> Detail lengkap: **`docs/arsitektur-template-post-card.md`**

Sistem card reusable untuk menampilkan post di mana saja — analog `get_template_part()` di WordPress.

- Komponen: `<PostCard post={data} variant="..." tenantSlug={slug} />`
- 6 variant: `klasik` | `list` | `overlay` | `ringkas` | `judul` | `ticker`
- Registry: `lib/post-card-templates.ts` — `PostCardVariant` + `PostCardData` type
- File komponen: `components/website/public/post-cards/`
- Dipakai di: **post** archive, landing section posts, search results, related posts (future)
- URL post publik: **`/{tenantSlug}/post/{slug}`** — BUKAN `/blog/`
- URL arsip post: **`/{tenantSlug}/post`** — dengan query `?category={slug}` atau `?tag={slug}`
- `PostCardData`: id, title, slug, excerpt, **coverUrl** (sudah resolved, bukan coverId), categoryName, publishedAt, isFeatured
- **Status: ✅ Selesai**

### Section Post
> Detail lengkap: **`docs/arsitektur-section-post.md`**

Container untuk menampilkan kumpulan post dalam berbagai layout design, di atas sistem Template Card Post.

- Hirarki: `SectionItem (type="posts", variant="N")` → `PostsSection` wrapper → `PostsDesignN` → `PostCard`
- Registry: `lib/posts-section-designs.ts` — 5 design, field `type: "hero" | "section"` di tiap entry
- **Dua kategori design**: `hero` (Design 1 — fetch featured+recent, tanpa title) vs `section` (Design 2–5 — filter kategori/tag, wajib ada `PostsSectionTitle`)
- `PostsSectionTitle` — shared component wajib untuk semua section type: heading + dashed line + "Lihat Semua ›"
- Design 4 (Trio Column): `columns[]` — tiap kolom punya filter `categoryId`/`tagId` sendiri
- Design 5 (Post Carousel): client component, aspect ratio 3:4, `className?` prop di `PostCardOverlay`
- **Status: ✅ Selesai — semua 5 design + section title + fetch wrapper diimplementasikan**

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
│   │   ├── page.tsx        → list pesanan: tabel + filter status + search + pagination
│   │   ├── new/page.tsx    → buat pesanan manual (fetch produk aktif → OrderCreateClient)
│   │   └── [id]/page.tsx   → detail pesanan: info + items + pembayaran + OrderActions
│   └── kategori/
│       └── page.tsx        → CRUD kategori produk (inline create)
├── website/                → /{slug}/website/*
├── letters/                → /{slug}/letters/* (keluar, masuk, nota, template)
├── finance/                → (belum dibuat)
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
- [x] **Billing Phase 1** — schema 7 tabel + nav + dashboard invoice (list/create/detail + partial payment) — arsitektur di `docs/arsitektur-billing.md`
- [ ] **Billing Phase 2** — public API cart + checkout + halaman invoice publik
- [ ] **Billing Phase 3** — integrasi Toko/Donasi/Event → invoice otomatis
- [x] Donasi / Infaq — arsitektur di `docs/arsitektur-donasi.md` (schema + CRUD + SEO + kategori)
- [x] Event — arsitektur di `docs/arsitektur-event.md` — semua Step 1–6 selesai
- [x] Dokumen — arsitektur di `docs/arsitektur-document.md` (schema + CRUD + versioning + PDF viewer + halaman publik)
- [x] Role System & User Management — custom roles + permission matrix + `/settings/users` + `/settings/roles` + halaman undangan publik
- [x] **Modul Akun Phase 1** — `public.profiles` schema + migrasi `profile_id` ke 4 tabel transaksi (invoices, orders, donations, event_registrations). TypeScript 0 errors. Tenant existing `pc-ikpm-jogjakarta` sudah dimigrasikan manual.
- [x] **Modul Akun Phase 2** — `resolveIdentity()` helper + update `checkoutAction`. TypeScript 0 errors.
- [x] **Modul Akun Phase 3** — API routes selesai (front-end ditunda sampai website dibangun). 3 endpoints: register, profil (GET/PATCH/DELETE), transaksi (GET). TypeScript 0 errors.
- [x] **Modul Akun Phase 4** — Dashboard admin `/akun` — list page + detail page + link/unlink ke anggota IKPM. TypeScript 0 errors.
- [x] **Front-end Publik** — PublicLayout (header+footer switcher), `/post` archive + detail, 6 PostCard variants, PostsSection (5 designs), PostsSectionTitle, search API, login/register pages, `/settings/website` dengan header/footer design picker. TypeScript 0 errors.
- [ ] **Image System** — arsitektur selesai di `docs/arsitektur-image.md`; implementasi belum dimulai (Sharp + 6 variants + WebP + cron cleanup)
- [ ] Add-on Marketplace UI (settings + install flow)
- [ ] Docker deployment

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
│   ├── Default URL (read-only): app.jalajogja.com/{slug}
│   ├── Subdomain jalajogja: [input].jalajogja.com
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
tenants.subdomain              → "ikpm" (untuk ikpm.jalajogja.com)
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

- Tabel tersendiri (bukan berbasis produk Toko): `campaigns`, `donations`, `donation_sequences`
- Donatur: anggota login (member_id) atau publik tanpa akun (nama/email/phone manual)
- Kategori: umum / infaq / sedekah / wakaf / zakat / iuran — dipilih per campaign
- Pembayaran via rekening/QRIS kategori `donasi` — fallback ke `general`
- Konfirmasi manual + unique code 3 digit untuk identifikasi transfer
- Sertifikat PDF otomatis saat konfirmasi, kirim email ke donatur
- Halaman publik: `/(public)/[tenant]/donasi/[slug]` — tanpa auth
- 5 pertanyaan terbuka di `docs/arsitektur-donasi.md` bagian Q&A

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
   URL: app.jalajogja.com/{slug}/*
   Status: SEDANG DIBANGUN

2. Front-end (Public) → website publik organisasi
   URL: {slug}.jalajogja.com atau custom domain
   Status: BELUM — setelah Tenant Dashboard selesai

3. Platform Dashboard → admin jalajogja (bukan untuk tenant)
   URL: platform.jalajogja.com
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

### Struktur Komponen
```
components/toko/
├── toko-nav.tsx              → sub-nav kiri: Dashboard, Produk, Pesanan, Kategori
├── product-form.tsx          → full editor produk (Tiptap + MediaPicker + SeoPanel + sidebar)
├── product-list-client.tsx   → tombol pre-create produk baru
├── order-create-client.tsx   → UI keranjang pesanan manual admin
├── order-detail-client.tsx   → OrderActions + AddPaymentForm (status transitions)
└── category-manage-client.tsx → CRUD kategori inline
```

### Server Actions (toko/actions.ts)
```typescript
// Produk
createProductDraftAction(slug)                        → pre-create + return productId
updateProductAction(slug, productId, data: ProductData) → full update + SEO
toggleProductStatusAction(slug, productId)            → draft→active→archived→draft cycle
deleteProductAction(slug, productId)                  → delete

// Pesanan
createOrderAction(slug, data: OrderData)              → buat pesanan + generate nomor ORD-YYYYMM-NNNNN
addPaymentToOrderAction(slug, orderId, paymentData)   → input pembayaran manual
confirmOrderPaymentAction(slug, paymentId)            → konfirmasi bayar → kurangi stok → recordIncome()
cancelOrderAction(slug, orderId)                      → cancel → kembalikan stok jika sudah terbayar
updateOrderStatusAction(slug, orderId, newStatus)     → processing | shipped | done

// Kategori
createProductCategoryAction(slug, { name, slug })     → buat kategori baru
```

### Tipe Data Kunci
```typescript
type ProductImage = { id: string; url: string; alt: string; order: number };
// Disimpan sebagai JSONB array di products.images

type ProductData = {
  name, slug, sku?, description?, price, stock,
  images: ProductImage[],   // ← dari MediaPicker, bukan URL manual
  categoryId?, status,
  metaTitle?, metaDesc?, ogTitle?, ogDescription?, ogImageId?,
  twitterCard?, focusKeyword?, canonicalUrl?, robots?,
};
```

### Alur Status Produk
```
draft → active → archived → draft (cycle)
```
- draft: tidak tampil di front-end
- active: tampil + bisa dipesan
- archived: tidak tampil, tidak bisa dipesan baru

### Alur Status Pesanan + Pembayaran
```
Order: pending → paid → processing → shipped → done
                 ↓
             cancelled (dari status apapun kecuali done)

Payment: pending → paid (setelah konfirmasi admin)
```
- `confirmOrderPaymentAction`: validasi stok → `recordIncome()` → kurangi stok → order.status = 'paid'
- `cancelOrderAction`: jika order sudah paid/processing/shipped → kembalikan stok

### Nomor Pesanan
Format: `ORD-YYYYMM-NNNNN` — via COUNT query per bulan, **bukan** via `financial_sequences` enum.
Alasan: menghindari DDL change (ALTER TYPE) di tenant yang sudah ada.

### Schema productCategories — Kolom yang Ada
```
id, slug, name, parentId, createdAt
```
**Tidak ada kolom `description`** — jangan tambahkan di query atau komponen.

### TiptapEditor — Prop Wajib
`TiptapEditor` butuh prop `slug` (tenant slug) untuk MediaPicker di toolbar:
```tsx
<TiptapEditor slug={slug} content={...} onChange={...} />
```

### [2026-04] Lessons Learned Modul Toko

**Bug: Fungsi utilitas di-export dari "use server" file jadi server action proxy**
- `slugify` di-export dari `actions.ts` (file `"use server"`)
- Di client component, fungsi non-async dari `"use server"` file menjadi server action proxy → return `Promise`, bukan nilai langsung
- Efek: `data.slug` yang diterima server adalah Promise object, bukan string → `trim is not a function`
- **Fix**: JANGAN import fungsi utilitas (bukan server action) dari file `"use server"`. Selalu implementasikan fungsi utilitas secara lokal di client component, atau pindahkan ke file utility terpisah yang tidak pakai `"use server"`.

**Bug: Dev server cache stale setelah edit client component**
- Error runtime menunjukkan kode lama meskipun file sudah diubah
- Fix: restart dev server (`pkill -f "next dev"`) + reload browser
- Ini terjadi khususnya saat ada perubahan import/export antar boundary server-client

**Gambar produk: wajib MediaPicker, bukan URL manual**
- Array `images: ProductImage[]` — setiap item dari MediaPicker: `{ id, url, alt, order }`
- `order` field: index posisi, di-set ulang saat simpan: `images.map((img, i) => ({ ...img, order: i }))`
- Reorder via tombol naik/turun (swap adjacent), bukan drag-drop
- Prevent duplicate: cek `images.some(img => img.id === media.id)` sebelum add

**Sidebar path harus konsisten dengan route folder**
- Route folder: `[tenant]/toko/` → sidebar path harus `"toko"`, bukan `"shop"`
- Selalu verifikasi path di `sidebar-nav.tsx` saat buat modul baru

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

### [2026-04] Role System & User Management — SELESAI

**Arsitektur lengkap di `docs/arsitektur-role-user.md`.**

**Schema baru di tenant:**
- `custom_roles` — nama, deskripsi, permissions (JSONB array per module), is_system flag
- `tenant_invites` — token UUID, deliveryMethod, expiresAt, acceptedAt, memberId, customRoleId

**TENANT_ROLES enum diperluas:**
- Sebelumnya: `owner|admin|editor|viewer`
- Sekarang: `owner|ketua|sekretaris|bendahara|custom`
- `custom` → role didefinisikan di `custom_roles` per tenant

**Permission Matrix:** lib/permissions.ts
- 10 modul: `anggota|website|surat|keuangan|toko|donasi|event|dokumen|pengurus|pengaturan`
- 4 level: `full|read|own|none` (linear dengan `own` = khusus surat)
- Helper: `canManageUsers()`, `getPermission()`, `hasPermission()`, `DEFAULT_ROLE_PERMISSIONS`

**Dua metode aktivasi user:**
1. **Kirim Link Undangan** — token UUID 7 hari, user klik link → isi password sendiri
2. **Aktifkan Langsung** — admin set password, akun langsung aktif

**Email dari data anggota — PENTING:**
Email user SELALU diambil dari `public.contacts` via `members.contactId`, BUKAN dari input admin.
Ini mencegah typo dan menjamin konsistensi dengan data anggota yang sudah ada.
Di form "Aktifkan Langsung": email ditampilkan read-only, hanya password yang perlu diisi admin.
Di server action `activateUserDirectAction`: email di-fetch ulang dari DB (tidak percaya input client).

**Cross-tenant account reuse:**
Jika email sudah ada di Better Auth (`public.user`), akun lama dipakai ulang — tidak buat akun baru.
Ini menangani pengurus yang melayani di beberapa cabang IKPM sekaligus.

**Bug patterns ditemukan:**
- Relative import dari `components/` ke `app/(dashboard)/` butuh alias `@/app/(dashboard)/...`, bukan path relatif
- `revalidatePath` harus di-import dari `"next/cache"` — tidak auto-imported
- TypeScript shorthand `{ email }` di callback gagal jika variable `email` sudah tidak ada di scope — pakai `{ email: memberEmail }` eksplisit

**Invite upsert — jangan duplikat:**
`createInviteAction` cek existing invite dengan `memberId` yang sama → update (reset token + expiry) daripada insert baru. Ini mencegah satu anggota punya banyak invite pending aktif.

**Route group `(public)` untuk halaman tanpa auth:**
`/(public)/[tenant]/invite/page.tsx` — di luar group `(dashboard)`, tidak ada middleware auth.
Pattern sama seperti `verify/[hash]` dan `dokumen/[id]` sebelumnya.

**Available members filter — dua kondisi:**
Member tersedia untuk diundang hanya jika:
1. Belum ada di `tenant.users` (belum aktif)
2. Belum punya invite pending (non-expired + belum di-accept)
Filter kedua mencegah double-invite ke anggota yang sama.

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

## Context Sesi Terakhir
- Terakhir dikerjakan: **Front-end Publik — implementasi lengkap** (header/footer system, 6 PostCard variants, 5 PostsSection designs, PostsSectionTitle, LandingTemplate, PublicLayout, search API, login/register, /settings/website design picker)
- Dokumentasi: `docs/arsitektur-image.md` dibuat (arsitektur image system dengan Sharp + 6 variants + WebP + cron cleanup)
- Type check: **0 errors**
- Next: bebas — Image System implementation atau Billing Phase 2

### Known TODO
- Role System: email SMTP sending untuk invite (saat ini hanya manual link copy), update role dropdown di daftar user aktif, wajibkan email di form anggota
- Modul Dokumen: uploader name di version history (perlu cross-schema join tenant.users → public.user)
- Fitur surat belum: inter-tenant letters, attachment MediaPicker
- **Keuangan** — laporan & event_income selesai; sisa: Budget UI, export PDF laporan — lihat `docs/arsitektur-keuangan.md`
- **Billing** — Phase 1 selesai (schema + dashboard invoice + partial payment). Phase 2: public cart/checkout. Phase 3: integrasi modul existing.
- **Image System** — arsitektur di `docs/arsitektur-image.md`: `bun add sharp`, `lib/image-processor.ts`, `lib/image-url.ts`, update media upload route, update DB schema (variants JSONB + processingStatus + originalExpiresAt), cron cleanup API

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
