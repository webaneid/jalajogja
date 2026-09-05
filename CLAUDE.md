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
- NIK duplicate: deteksi via constraint name `members_nik_hash_not_null_unique` di catch block
  (NIK dienkripsi at-rest sejak 2026-08 — lihat lesson `[2026-08]` di bawah)
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
- ⚠️ **KOREKSI (ditemukan 2026-07-26, baris ini sebelumnya salah klaim "sudah dibuat")**: konstanta
  `AI_FRIENDLY_CRAWLERS`/`ROBOTS_ALLOW_ALL`/dst di `lib/seo-defaults.ts` **cuma didefinisikan, tidak
  pernah dipakai di mana pun** (grep nol pemanggil) — `app/robots.ts` yang benar-benar aktif
  hanya `{userAgent:"*", allow:"/"}` generik, TIDAK ADA baris per-bot AI (GPTBot/ClaudeBot/
  Google-Extended/PerplexityBot) sama sekali. Wiring-nya adalah rencana **Fase 6** di
  `docs/arsitektur-seo.md` § 5 — belum diimplementasikan. Lihat juga lesson
  `[2026-07-26] Audit Rencana SEO Agen Lain` di bawah untuk temuan lengkap (termasuk bug live
  `/robots.txt` di custom domain).
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
> Peta dokumen, status fitur, fondasi schema/route/actions: **`docs/arsitektur-modul-surat.md`**
> Identitas surat, tujuan surat, format tanggal, render PDF: **`docs/arsitektur-surat.md`**
> Render body, merge fields, halaman detail: **`docs/arsitektur-surat-detail.md`**
> Layout TTD, slot-based signing, alur URL publik: **`docs/arsitektur-tandatangan.md`**

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
Commit+push: `5352de1`. Deploy ke VPS **dilakukan MANUAL oleh user sendiri** (bukan Claude) atas
permintaan eksplisit — bukan bagian dari SOP otomatis sesi ini.

### [2026-07-20] `connectWhatsAppAction` — Dari "Percaya Response GOWA" ke "Verifikasi + Retry"

**Pertanyaan kritis dari user setelah fix QR di atas**: "apa yang menyebabkan tidak bisa create
new device? apakah itu juga sudah diperbaiki? karena problemnya kalau kita selesaikan manual,
nanti akan terjadi lagi." Jawaban jujur saat ditanya: **belum** — device `pc-ikpm-jogjakarta`
yang sempat hilang sebelumnya HANYA dipulihkan manual via curl langsung selama investigasi
(lihat lesson QR di atas), kode `connectWhatsAppAction` itu sendiri BELUM disentuh — celah yang
menyebabkan kegagalan silent (`POST /devices` direspons GOWA seolah "already exists" padahal
device TIDAK genuinely listed/usable) akan terulang persis sama kalau device hilang lagi.

**Fix**: `connectWhatsAppAction` sekarang punya helper lokal `existsOnGowa()` — verifikasi
via `GET /app/devices` (dengan header `X-Device-Id`, sama seperti yang dipakai `/api/wa/qr`)
bahwa `deviceId` BENAR-BENAR muncul di `results[]`, bukan cuma percaya status response
`POST /devices`. Alur baru:
1. `POST /devices` seperti biasa (branch "already exists" tetap dianggap non-fatal, TAPI
   sekarang lanjut ke verifikasi, bukan langsung dianggap sukses).
2. `existsOnGowa()` — kalau device TIDAK listed, retry SEKALI (`POST /devices` lagi + verifikasi
   ulang) — cukup untuk menutup celah race/inkonsistensi GOWA yang jadi penyebab bug ini.
3. Kalau MASIH tidak listed setelah retry → return error eksplisit ke admin ("Device WhatsApp
   tidak berhasil dibuat di server GOWA. Coba lagi beberapa saat, atau hubungi admin platform.")
   — TIDAK LAGI melaporkan sukses secara diam-diam seperti sebelumnya.

**`deactivateWhatsAppAction` SENGAJA TIDAK disentuh** — perilakunya sudah benar: tujuannya
mereset STATE KITA SENDIRI (config lokal), bukan menunggu konfirmasi GOWA — upaya logout ke
GOWA boleh gagal (device sudah tidak ada, dst), config lokal tetap harus di-wipe supaya UI
kembali ke state "belum dikonfigurasi". Menambah verifikasi di sana justru kontraproduktif.

**Aturan digeneralisasi**: kalau integrasi ke service eksternal punya respons "sudah ada,
lanjutkan saja" yang SENGAJA dianggap non-fatal (pola umum untuk idempotency) — jangan berhenti
di situ. Response "sudah ada" TIDAK SAMA dengan "genuinely ada dan bisa dipakai" — service
eksternal bisa punya state internal yang tidak konsisten (soft-delete, cache basi, dst).
Tambahkan verifikasi READ terpisah setelah operasi WRITE/CREATE, terutama untuk resource yang
kegagalannya baru ketahuan user JAUH kemudian (di sini: baru ketahuan saat QR tidak bisa
di-scan, bukan saat klik "Aktifkan").

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error. Belum dicoba ulang skenario asli
(hapus device di GOWA → nonaktifkan → aktifkan lagi dari UI) untuk konfirmasi retry logic
benar-benar menutup celah — device saat ini justru SUDAH ada di GOWA (dari investigasi
sebelumnya), jadi jalur "retry" belum ter-exercise oleh kondisi nyata, hanya oleh code review.

### [2026-07-20] Halaman Notifikasi WA — Hapus Toggle Dead "Aktifkan WhatsApp" + Perjelas Card Gateway

**Keluhan user**: dua card di `/settings/notifications` yang sama-sama menyebut "aktifkan/
nonaktifkan WhatsApp" — card #1 "Notifikasi WhatsApp" (toggle "Aktifkan WhatsApp" + badge
"Butuh add-on") dan card #2 "WhatsApp Gateway" (tombol Aktifkan/Scan QR/Putuskan/Nonaktifkan).
User toggle card #1 off→on, buka `gowa.jalakarta.com`, device tidak berubah sama sekali — benar
curiga ada yang tidak nyambung, plus bingung apa bedanya "Nonaktifkan" di state "diaktifkan
belum tersambung" dengan "Putuskan" di state "terhubung".

**Root cause dikonfirmasi via grep**: `values.whatsappEnabled` (card #1, tersimpan di
`settings.notifications.whatsappEnabled`) **tidak pernah dibaca di mana pun** — bukan di
`sendWaNotification` (`lib/whatsapp.ts`), bukan di tempat lain manapun. Gate pengiriman WA
sesungguhnya HANYA 3 hal, semuanya dari card #2: `config.device_id` (ada/tidak),
`config.verified` (true setelah QR discan), `config.notifications[event]` (toggle per-jenis
notifikasi). Card #1 adalah sisa desain lama yang mengasumsikan ada alur install add-on formal
(`tenant_addon_installations`) — TIDAK PERNAH selesai dibangun (sudah didokumentasikan sebagai
gap di § "WhatsApp Gateway" — "tidak ada quota enforcement/addon billing check sama sekali").
Toggle-nya cuma tulis ke DB, dibaca oleh nol konsumen.

**Fix — hapus dead code, bukan disembunyikan**: fieldset "Notifikasi WhatsApp" + toggle
"Aktifkan WhatsApp" dihapus total dari `NotificationsSettingsForm` (`DefaultValues` type ikut
dirampingkan, `saveNotificationSettingsAction` signature disesuaikan — cuma 1 caller, aman
diubah). `notifications/page.tsx` — `NotifConfig` type dan default values disesuaikan.

**Card #2 (`WhatsAppSetupClient`) dipertegas jadi SATU-SATUNYA sumber kebenaran**:
- Deskripsi header section diubah eksplisit: "Satu-satunya sakelar untuk notifikasi WhatsApp —
  status di kartu di bawah ini... menentukan apakah pesan benar-benar terkirim."
- Tambah blok `<ol>` 3-langkah (Aktifkan → device dibuat di GOWA; Scan QR → nomor ditautkan;
  Putuskan/Nonaktifkan → HANYA logout+hapus config lokal) — highlight langkah aktif via
  `isConfigured`/`isVerified`.
- Confirm dialog "Putuskan" dan "Nonaktifkan" diperjelas: keduanya **TIDAK PERNAH menghapus
  device dari server GOWA** (tidak ada endpoint delete-device yang dipanggil kode kita — GOWA
  cuma di-logout via `/app/logout`, device row-nya tetap ada) — device baru dihapus kalau admin
  menghapusnya manual langsung di GOWA. Ini menjawab observasi user "ketika di non aktifkan
  juga tidak terhapus device-nya" — itu memang perilaku yang disengaja (bukan bug): "Nonaktifkan"
  reset ke status "Belum Diaktifkan" secara LOKAL saja, supaya "Aktifkan" berikutnya idempotent
  (pakai device yang sama, bukan bikin baru — konsisten dengan verifikasi `existsOnGowa()` yang
  baru ditambah di lesson sebelumnya).

**Aturan digeneralisasi**: kalau ditemukan field/toggle yang di-*write* ke DB tapi grep
menunjukkan nol *read* di seluruh codebase (di luar file yang menulisnya sendiri) — itu dead
code, bukan "fitur belum lengkap yang boleh dibiarkan". Hapus total (ikuti pola project:
`MobileMenuDrawer` dan komponen mati lain sebelumnya juga dihapus, bukan dikomentari) — jangan
biarkan UI menjanjikan kontrol yang tidak benar-benar mengontrol apa pun, itu sumber kebingungan
user yang nyata (persis kasus ini).

**Verifikasi**: `tsc --noEmit` + `bun run build` — 0 error, `/app/[tenant]/settings/notifications`
terkonfirmasi muncul di build output. Tidak ada migration DB (field `whatsappEnabled` di JSONB
`settings.notifications` cukup berhenti ditulis — data lama yang masih menyimpan field itu tidak
apa-apa dibiarkan, tidak pernah dibaca lagi).

### [2026-07-20] Bug Kritis: `deactivateWhatsAppAction` Crash — `settings.value` JSONB NOT NULL

**Gejala production**: setelah deploy fix card WhatsApp di atas, user coba klik "Nonaktifkan"
untuk device `pc-ikpm-jogjakarta` (yang ternyata TIDAK PERNAH benar-benar tercipta di GOWA
meski admin UI menampilkan status "Diaktifkan" — data lokal stale dari sesi lama sebelum
`existsOnGowa()` verification ada) → browser console: `Uncaught (in promise) Error: An error
occurred in the Server Components render...` (digest disembunyikan di production build).

**Root cause**: `deactivateWhatsAppAction` (`settings/actions.ts`) menulis
`upsertSettings(tenantClient, "notif", { whatsapp_config: null })` untuk "menghapus" config —
TAPI kolom `tenant_{slug}.settings.value` bertipe **`jsonb("value").notNull()`**
(`packages/db/src/schema/tenant/settings.ts`). Drizzle mengirim literal SQL `NULL` untuk value
JS `null` → PostgreSQL menolak dengan `null value in column "value" violates not-null
constraint` → exception tidak tertangkap di dalam Server Action → Next.js production build
menyembunyikan detail (by design, security) → muncul sebagai error generik yang tidak
informatif di console customer/admin.

**Kenapa baru ketahuan sekarang**: ini SATU-SATUNYA tempat di seluruh codebase yang menulis
`null` sebagai *top-level value* ke `upsertSetting`/`upsertSettings` (diverifikasi via grep
menyeluruh — semua occurrence `: null` lain di file settings/donasi/letters/widget-areas
adalah field NESTED di dalam object JSONB, yang aman karena JSONB boleh berisi null di
dalamnya, cuma kolomnya sendiri yang tidak boleh SQL NULL). Bug laten sejak fitur WhatsApp
Gateway dibuat — baru ter-trigger sekarang karena "Nonaktifkan" untuk device yang sebenarnya
tidak pernah ter-create baru benar-benar dicoba end-to-end.

**Fix**: `deleteSetting(tenantDb, key, group)` — helper baru di `packages/db/src/helpers/
settings.ts` (DELETE row, bukan UPDATE value ke null) + di-export dari `@jalajogja/db` barrel.
`deactivateWhatsAppAction` diganti pakai `deleteSetting(tenantClient, "whatsapp_config",
"notif")`. Setelah row dihapus, `getSettings()` otomatis tidak mengembalikan key itu sama
sekali (`Object.fromEntries` dari hasil SELECT) → `settings["whatsapp_config"]` jadi
`undefined` → `isConfigured = !!config` di UI otomatis `false`, tanpa perubahan lain diperlukan.

**Aturan digeneralisasi**: setiap kolom `jsonb(...).notNull()` — pola yang dipakai project ini
untuk SEMUA `settings.value` — TIDAK PERNAH boleh ditulis `null` untuk "mengosongkan"/"hapus"
sebuah key. Kalau maksudnya "reset ke tidak ada", **hapus row-nya** (`deleteSetting`), bukan
`upsert(..., null)`. Berlaku untuk fitur settings manapun ke depan yang butuh alur "aktifkan →
nonaktifkan sepenuhnya" (bukan sekadar reset ke object kosong `{}`).

**Catatan terpisah soal device `pc-ikpm-jogjakarta` yang stale**: fix `existsOnGowa()`
verification (lesson sebelumnya) HANYA berjalan di titik `connectWhatsAppAction` (create baru)
— tidak retroaktif memvalidasi config yang SUDAH tersimpan sebelumnya. Data lokal tenant ini
kemungkinan besar peninggalan sesi investigasi sebelumnya (device sempat dibuat manual via
curl, lalu hilang lagi dari GOWA — mungkin container GOWA restart/redeploy tanpa persistent
volume). Alur pemulihan setelah fix ini deploy: klik "Nonaktifkan" (sekarang berhasil, tidak
crash) → config lokal bersih → klik "Aktifkan WhatsApp Gateway" lagi → `connectWhatsAppAction`
membuat device BARU + verifikasi `existsOnGowa()` memastikan kali ini benar-benar tercipta.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (dua package terpisah,
karena `deleteSetting` ditambah di `packages/db`) + `bun run build --filter=@jalajogja/web`
sukses. Belum diverifikasi end-to-end di production (butuh user coba ulang alur Nonaktifkan →
Aktifkan → Scan QR setelah deploy) — tapi root cause exception sudah pasti (PostgreSQL NOT NULL
constraint adalah kesalahan yang deterministik, bukan tebakan).

### [2026-07-20] Diagnosa OTP Gagal 503 di Tenant Baru — WhatsApp Error 463 "Reach-Out Timelock", Bukan Bug Kode

> Detail lengkap + tabel endpoint GOWA gaya baru: `docs/arsitektur-whatsapp.md` § 14.1–14.2,
> § 2.4.

User laporkan OTP login gagal 503 di `ikpmjogja.com` (tenant `pc-ikpm-jogjakarta`) tapi normal
di `visikita.com`, disertai 2 pertanyaan arsitektur: (1) apakah GOWA multi-device benar-benar
bisa banyak device aktif bersamaan, (2) apa arti status "Use"/"Selected" yang terlihat di
dashboard `gowa.jalakarta.com`. Diagnosa dilakukan via SSH langsung ke VPS (kredensial GOWA
di-`source` dari `.env.local` lalu dipakai inline di curl — TIDAK PERNAH di-echo/print) —
bukan tebakan dari baca kode saja, konsisten dengan lesson lama soal bug integrasi eksternal.

**Root cause SESUNGGUHNYA, dikonfirmasi dari log `docker compose logs gowa`**: WhatsApp
**menolak** pengiriman dengan error 463 "reach-out timelock" — restriksi anti-spam PLATFORM
WHATSAPP SENDIRI terhadap nomor yang baru ditautkan/rendah aktivitas yang mencoba mengirim ke
kontak yang belum pernah chat duluan dengan nomor itu ("cannot be bypassed by the API"). Device
`pc-ikpm-jogjakarta` baru dibuat ulang jam 16:53 (recovery dari bug `existsOnGowa()` sesi
sebelumnya), percobaan OTP gagal jam 16:55 — 2 menit kemudian, tepat pola "nomor baru".
`visikita` sudah aktif sejak 2026-07-08 (~12 hari, riwayat pengiriman established) → tidak kena.

**BUKAN masalah kode/config kita** — dicek satu-satu dan semuanya benar: `whatsapp_config`
tenant ini `verified: true`, `device_id` cocok, `otp_login: true`. `GET /devices/{id}/status`
GOWA juga menunjukkan KEDUANYA `is_connected: true, is_logged_in: true` secara bersamaan (bukti
langsung multi-device GENUINELY konkuren, bukan "cuma satu aktif dalam satu waktu" — dikonfirmasi
juga dari dokumentasi resmi `aldinokemal/go-whatsapp-web-multidevice`). Kirim tes manual ke
NOMOR SENDIRI via `POST /send/message` sukses (bukan "kontak baru" dari sudut pandang WhatsApp)
— justru inilah yang sempat mengecoh sebelum log GOWA dicek dan menemukan error 463 yang
sesungguhnya terjadi saat mengirim ke customer (kontak benar-benar baru).

**Label "Use"/"Selected" di dashboard GOWA — TIDAK relevan untuk sistem kita**: itu murni UI
STATE dashboard bawaan GOWA (`DeviceManager.js` frontend-nya sendiri, menentukan device mana
yang sedang ditampilkan di tab dashboard itu) — sama sekali tidak merepresentasikan status live
koneksi. Aplikasi kita tidak pernah pakai dashboard itu, selalu API langsung dengan
`X-Device-Id` eksplisit — status di sana tidak pernah jadi sinyal diagnosa yang valid.

**Tidak ada perbaikan kode** — WhatsApp eksplisit bilang restriksi ini "cannot be bypassed by
the API", retry otomatis tidak membantu. Mitigasi cuma satu: kirim beberapa pesan manual dari
HP yang ditautkan ke beberapa kontak dulu setelah pairing device baru, jangan langsung andalkan
OTP otomatis ke kontak benar-benar baru di jam-jam pertama. Restriksi ini **sementara** — hilang
sendiri begitu nomor punya riwayat pengiriman wajar, bukan masalah permanen. Dicatat sebagai
**known limitation platform WhatsApp** (§ 14.1 arsitektur-whatsapp.md), bukan technical debt.

**Pertanyaan susulan user**: apakah penyebabnya karena jalakarta.com pakai SATU instance GOWA
untuk SEMUA tenant (beda dengan project lain user yang punya GOWA server terpisah per device,
URL beda-beda)? **Jawaban: tidak terkait sama sekali** — restriksi 463 beroperasi di level
NOMOR/AKUN WhatsApp itu sendiri (pesan error eksplisit menyalahkan "the sending account", bukan
server/IP). WhatsApp Web protocol tidak mengekspos info hosting ke WhatsApp — satu GOWA server
menjalankan 5 device via `X-Device-Id` terlihat SAMA PERSIS dari sudut pandang WhatsApp dengan
5 server terpisah 1-device masing-masing. Pindah ke server terpisah per tenant TIDAK akan
mencegah/mempercepat lolos dari restriksi ini. Arsitektur "satu GOWA server untuk semua tenant"
(keputusan sejak awal § 2) TETAP dipertahankan — tidak ada alasan berubah dari temuan ini.
Detail lengkap: § 14.3 `docs/arsitektur-whatsapp.md`.

**Temuan sampingan berguna**: GOWA versi yang di-deploy TERNYATA sudah punya endpoint gaya baru
per-device (`GET /devices/{id}/status`, `POST /devices/{id}/reconnect`, `DELETE /devices/{id}`)
yang JAUH lebih informatif dari `/app/devices`/`/app/logout` yang dipakai kode kita sekarang —
termasuk `DELETE /devices/{id}` yang genuinely menghapus device (kode kita SAAT INI tidak pernah
memanggil delete apa pun, cuma logout — konsisten dengan lesson sebelumnya, tapi sekarang ada
opsi kalau suatu saat "Nonaktifkan" ingin benar-benar hapus device dari GOWA, bukan cuma
putus sesi). Dicatat di § 2.4 dokumen arsitektur, belum diintegrasikan ke kode.

### [2026-07-21] Fallback Registrasi + Reset Password Saat WA Gateway Down — SMTP Platform Baru

> Konteks: langsung menyusul insiden ban WA nomor `pc-ikpm-jogjakarta` (lesson di atas). User
> sadar risiko sistemik: registrasi & lupa-password **wajib** WA, tidak ada jalan lain kalau WA
> down/dibatasi lagi ke depan (dan ini AKAN terulang — lihat § 14.1 `docs/arsitektur-whatsapp.md`,
> restriksi WhatsApp bisa kena tenant manapun, bukan cuma sekali kejadian).

**Temuan sebelum eksekusi**: endpoint `GET /api/wa/available` **sudah ada sejak lama**, komentar
di kode-nya sendiri eksplisit bilang "dipakai oleh register form dan forgot-password untuk
memutuskan apakah tampilkan OTP step" — tapi grep membuktikan **tidak pernah dipanggil dari
manapun**. Infrastruktur untuk fallback ini sebenarnya sudah direncanakan sejak awal, cuma tidak
pernah benar-benar disambungkan. Ditemukan juga: `lib/auth.ts` (Better Auth) **tidak punya
`sendResetPassword` callback sama sekali** — `POST /api/auth/request-password-reset` akan SELALU
error `RESET_PASSWORD_DISABLED` (dikonfirmasi baca source Better Auth 1.6.2 langsung, bukan
tebakan). Dan seluruh sistem "Email/SMTP" di `/settings/email` ternyata **facade murni** —
`nodemailer` bahkan belum terinstall di project, tombol "Kirim Test Email" cuma
`// TODO: implement test email server action` (tunggu 1.5 detik, selalu tampil "berhasil" tanpa
kirim apa pun). Dicek juga: 0 baris `smtp_config` tersimpan di DB kedua tenant produksi — jadi
tidak ada regresi terhadap konfigurasi existing.

**Keputusan arsitektur — DUA transport SMTP terpisah, bukan satu** (dikonfirmasi via
`AskUserQuestion`, user pilih "keduanya sekaligus"):
1. **`sendPlatformMail()`** (`lib/mail.ts`) — SMTP dari **env var server** (`SMTP_HOST`/
   `SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`), satu akun untuk SEMUA tenant. Dipakai HANYA
   untuk hal **auth-critical** yang harus selalu jalan terlepas tenant sudah setting SMTP sendiri
   atau belum: `sendResetPassword` Better Auth. **Kredensial tidak pernah disimpan di DB** —
   murni server-side env, konsisten dengan pola `WHATSAPP_API_PASS` dst.
2. **`sendTenantMail()`** (`lib/mail.ts`) — SMTP milik tenant sendiri (`settings.smtp_config`,
   form `/settings/email` yang sudah ada), untuk notifikasi bisnis bermerek tenant (anggota baru,
   pembayaran). Sekarang genuinely berfungsi — `sendTestEmailAction` baru dipasang ke tombol
   "Kirim Test Email" (mengirim ke email admin yang sedang login, via `getCurrentSession()`).

**Kenapa dua transport, bukan satu**: kalau reset-password ikut bergantung ke SMTP TENANT
(`smtp_config`), fallback-nya sendiri jadi rapuh — sama persis kelas masalah yang baru saja
terjadi dengan WA (satu titik kegagalan per tenant). SMTP platform sengaja independen dari
konfigurasi tenant manapun.

**Register — fallback aman (skip verifikasi total), Reset Password — fallback wajib verifikasi
lain (tidak boleh skip)**: dua flow ini punya profil risiko BEDA, ditangani BEDA:
- `register-form.tsx` — `handleSubmit` sekarang cek `GET /api/wa/available` (live, setiap
  submit — BUKAN toggle manual yang bisa lupa dinyalakan admin saat kejadian) → kalau
  `registerOtp: false`, `doRegister()` dipanggil LANGSUNG tanpa verifikasi nomor sama sekali —
  persis alur sebelum fitur OTP register pernah ada. **Aman** karena registrasi bukan aksi
  sensitif (tidak ada yang bisa diambil alih hanya dengan tahu nomor HP orang lain).
- `forgot-password/page.tsx` — **TIDAK BOLEH** skip verifikasi (kalau boleh, siapa saja bisa
  reset password orang lain cuma modal nomor HP-nya — lubang keamanan nyata). `useEffect` cek
  `resetOtp` dari `/api/wa/available` saat mount → kalau `false`, `step` otomatis pindah ke form
  EMAIL baru (`step: "email"` → `POST /api/auth/request-password-reset` → Better Auth
  `sendResetPassword` → `sendPlatformMail()`) — verifikasi TETAP wajib, cuma medianya beralih.
  Fail-safe: kalau fetch `/api/wa/available` sendiri gagal (network error) → default ke email
  juga (arah yang paling mungkin masih hidup).

**Aturan digeneralisasi**: kalau sebuah flow AUTH punya SATU jalur verifikasi (di sini: WA OTP)
dan jalur itu bisa down karena faktor eksternal (ban platform, service down, dst) — WAJIB
dibedakan dulu: apakah aksi di baliknya SENSITIF (bisa disalahgunakan tanpa verifikasi — reset
password, ganti email, dst → butuh fallback verifikasi LAIN, tidak boleh di-skip) atau TIDAK
sensitif (registrasi baru, konfirmasi kontak opsional → aman di-skip sepenuhnya saat channel
utama down). Jangan pukul rata "kalau OTP gagal, ya sudah lewati saja" untuk SEMUA flow — itu
baru benar untuk kelas pertama, berbahaya untuk kelas kedua.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db`. `bun run build` sukses
(dev server dimatikan dulu, `.next` dibersihkan) — dicek eksplisit `lib/mail.ts` (pakai
`import "server-only"`) tidak bocor ke client bundle, konsisten dengan lesson lama soal
client/server boundary. Sudah di-commit dan di-push (`c2cff8e`).

### [2026-07-21] Deploy SMTP Platform ke VPS — 3 Gotcha Ditemukan Saat Setup Nyata

**Gotcha 1 — dependency baru butuh `bun install` ulang, bukan cuma `git pull`:**
Deploy pertama gagal build: `Module not found: Can't resolve 'nodemailer'`. `git pull` menarik
`package.json`/`bun.lock` yang sudah berubah, tapi **tidak otomatis menginstall** paket baru —
`bun install` (di ROOT monorepo, bukan di `apps/web`) wajib dijalankan dulu sebelum `bun run build`
setiap kali ada dependency baru di commit yang di-deploy. Bukan hal baru (sudah pola lama), tapi
perlu diingatkan ulang karena SOP deploy yang biasa dipakai (`git pull && bun run build && pm2
restart`) tidak selalu menyertakan `bun install` secara eksplisit.

**Gotcha 2 — App Password Google berspasi + format `Nama <email>` merusak parsing `.env.local`:**
Google menampilkan App Password sebagai `abcd efgh ijkl mnop` (4 kelompok, ada spasi) untuk
keterbacaan. Ditulis apa adanya (tanpa quote) ke `.env.local` → merusak baris berikutnya. Sama,
`SMTP_FROM="Jalakarta" <email>` (quote cuma di sebagian value) juga tidak valid. **Fix**:
`SMTP_PASS` tanpa spasi sama sekali (`abcdefghijklmnop`, App Password Google tetap valid tanpa
spasi — spasinya cuma kosmetik saat ditampilkan). `SMTP_FROM` — SATU pasang quote membungkus
SELURUH value: `SMTP_FROM="Jalakarta <email>"`.

**Gotcha 3 — `pm2 env <id>` BUKAN cara yang benar untuk verifikasi env var Next.js:**
Sempat menyesatkan diagnosa — `pm2 env 0 | grep SMTP` return KOSONG meski `.env.local` sudah
benar. Root cause: `.env.local` dibaca **Next.js sendiri** secara internal (via `@next/env`, style
dotenv) saat aplikasi boot — BUKAN via PM2 meng-inject OS-level environment variable ke child
process. `pm2 env <id>` cuma menampilkan environment yang PM2 SENDIRI suntikkan (dari
`ecosystem.config.cjs` atau shell tempat PM2 dijalankan) — tidak pernah mencakup apa yang dimuat
Next.js dari file `.env.local` di dalam proses Node.js-nya sendiri. **Cara verifikasi yang
benar**: `node --env-file=.env.local -e "console.log(process.env.SMTP_HOST)"` (Node 20.6+ punya
flag native `--env-file`, parsing-nya sama-sama dotenv-style seperti yang dipakai Next.js) — atau
langsung tes fungsional (kirim email test sungguhan via nodemailer) alih-alih inspeksi env var
tidak langsung. **Verifikasi akhir dilakukan begini** — kirim email test langsung dari server via
`node --env-file=.env.local -e "..."` memanggil `nodemailer.createTransport()` persis config yang
sama dengan `lib/mail.ts` → **SUKSES**, email diterima nyata di `webane.com@gmail.com`. SMTP
platform dikonfirmasi berfungsi end-to-end.

**Aturan digeneralisasi**: `pm2 env <id>` HANYA valid untuk debug env var yang PM2 sendiri
suntikkan (biasanya dari `ecosystem.config.cjs`) — untuk env var yang dimuat framework (Next.js
`.env.local`, atau mekanisme serupa framework lain), verifikasi dari SISI FRAMEWORK/APLIKASI-nya
(`node --env-file=`, atau tes fungsional langsung), bukan dari sisi process manager.

### [2026-07-21] Tab "WhatsApp OTP" di Login — Konsistensi Terakhir dari Audit Fallback WA

**Pertanyaan user saat audit ulang**: "tab login by otp ketika whatsapp tidak aktif ganti
alternatif apa?" — jawaban jujurnya sebelum fix ini: **tidak ada alternatif otomatis** — tab
"WhatsApp OTP" di `login-form.tsx` tidak pernah cek `/api/wa/available` sama sekali, beda dengan
register/forgot-password yang sudah dibenahi. Risiko di sini LEBIH RENDAH dari dua flow lain
(tab "Email & Password" sudah jadi default aktif sejak awal, jadi tidak pernah benar-benar
buntu) — tapi tetap tidak konsisten: user yang klik tab WA saat gateway down cuma lihat error
generik, tidak diarahkan kembali ke tab yang jelas-jelas ada di sebelahnya.

**Fix**: `/api/wa/available` diperluas — tambah field `loginOtp` (sebelumnya cuma
`registerOtp`+`resetOtp`). `login-form.tsx` — `useEffect` cek availability saat mount, tab
"WhatsApp OTP" di-**disable** (bukan disembunyikan — Email & Password tetap terlihat sebagai
opsi utama yang selalu jalan) + label `(tidak tersedia)` kalau `loginOtp: false`. Kalau user
entah bagaimana sudah ada di tab WA saat status resolve jadi unavailable → `setMode("email")`
paksa balik.

**Ringkasan status akhir 3 titik auth setelah audit user (2026-07-21)**:
| Flow | Saat WA aktif | Saat WA tidak tersedia |
|---|---|---|
| Registrasi | OTP WA wajib | **Tanpa verifikasi sama sekali** — langsung daftar |
| Login | Tab Email+Password DAN tab WA OTP, dua-duanya aktif | Tab WA OTP **disabled**, Email+Password tetap jalan (tidak pernah berubah — sudah aman sejak awal) |
| Lupa Password | OTP WA wajib | Form otomatis beralih ke **email (link Better Auth)** — verifikasi TETAP wajib, medianya beralih |

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses. Belum di-commit/push.

### [2026-07-21] Bug: Rate-Limit (429) Diperlakukan Sebagai "Nomor Tidak Ditemukan" — Nama Donatur Kosong Diam-Diam

**Laporan user**: di halaman campaign `donasi-rutin-mingguan-ikpm-jogja-charity`, masukin nomor
HP tapi Nama Lengkap tidak auto-muncul — padahal fitur "Phone First" (lookup otomatis, isi nama
kalau nomor sudah terdaftar, bahkan tanpa login) sudah dikunci sebagai desain sejak lama.

**Diagnosa**: dites LANGSUNG ke production — API `/api/akun/lookup-member?phone=` dan database-
nya terbukti BENAR (curl dengan nomor terdaftar sungguhan → `{"found":true,"name":"..."}`,
HTTP 200). Bug-nya bukan di backend, tapi di **client-side error handling**:
`campaign-detail-client.tsx` (dan `register-form.tsx` — pola identik) memanggil
`/api/akun/lookup-member` lalu langsung `res.json()` TANPA cek `res.ok` dulu. Endpoint ini
punya `rateLimitGuard(req, "lookup-member", 10, 60_000)` — 10 request/menit per IP. Kalau
limit kena (gampang terjadi kalau user retype/koreksi nomor beberapa kali dalam sesi
pendek — debounce 500ms, tapi tiap "jeda ketik" = 1 request baru), response jadi
`{error:"Terlalu banyak permintaan..."}` dengan status 429 — client TIDAK cek status ini,
langsung baca `data.found` yang `undefined` (falsy) → diperlakukan SAMA PERSIS dengan "nomor
tidak terdaftar" → `setDonorName("")` — nama dikosongkan diam-diam, TANPA pesan error apa pun
ke user. User tidak tahu itu rate-limit, cuma lihat "nama kok tidak muncul".

**Fix**: tambah `if (!res.ok) return;` (skip update state, jangan simpulkan apa-apa) SEBELUM
`res.json()` di kedua caller (`campaign-detail-client.tsx`, `register-form.tsx`). Prinsip:
"gagal diketahui status-nya" (network error, rate limit, 500) HARUS diperlakukan beda dari
"sudah pasti tidak ditemukan" (200 + `found:false`) — jangan disamakan.

**Aturan digeneralisasi**: setiap `fetch()` ke API yang responsnya dipakai untuk KESIMPULAN
bisnis (found/not-found, valid/invalid, dst) WAJIB cek `res.ok` sebelum parse body sebagai
data sukses — kalau tidak, body error (`{error: "..."}`) ikut ter-parse dan field yang
diharapkan (`data.found`, dst) selalu `undefined`/falsy, gampang salah disimpulkan sebagai
"negatif" alih-alih "gagal". Pola ini WAJIB dicek di setiap caller endpoint yang punya
`rateLimitGuard` — audit lain yang belum dicek: cek semua caller endpoint publik lain yang
mungkin kena pola sama (belum dilakukan, di luar 2 titik yang ditemukan sesi ini).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses. Belum dikonfirmasi ini PERSIS
skenario yang user alami (bisa juga nomor yang dites memang belum terdaftar) — tapi bug ini
nyata dan sudah pasti ada terlepas dari itu, ditutup sekalian.

### [2026-07-21] Keputusan: Fallback Email untuk Notifikasi Bisnis (Donasi/Pembayaran/dll) — DITUNDA

User tanya apakah SEMUA notifikasi WA (bukan cuma auth) juga perlu fallback ke email saat WA
mati. **Beda mendasar dari fallback auth yang sudah dibangun**: alur donasi/checkout tamu
("Phone First", `docs/arsitektur-donasi-alur.md`) SENGAJA cuma minta nomor HP, bukan email —
untuk donatur tamu yang tidak dikenali sistem (`isKnown=false`), **tidak ada alamat email untuk
dikirimi apa pun** sama sekali, terlepas WA hidup atau mati. Fallback email cuma bisa menutup
sebagian kasus (member/akun yang emailnya sudah tersimpan), bukan semua. Scope juga jauh lebih
besar dari auth: ~24 `WaNotifKey` event tersebar di ~10 file caller `notifyWa()`.

**Keputusan (via `AskUserQuestion`)**: **ditunda** — alasan: auth (login/daftar/lupa-password)
adalah yang PALING kritis (kalau buntu, user benar-benar tidak bisa masuk sistem sama sekali)
dan sudah tertutup. Notifikasi bisnis kalau gagal terkirim masih bisa dicek manual di dashboard
admin (invoice list, status pembayaran, dst) — tidak menghalangi transaksi berjalan, cuma
mengurangi kenyamanan. Dicatat di sini sebagai keputusan SADAR, bukan terlupa — kalau nanti mau
dikerjakan, opsi yang sempat dibahas: (a) scope terbatas — cuma untuk penerima yang emailnya
diketahui, reuse teks WA existing (`wa-templates.ts`) sebagai isi email, tidak perlu 24 template
baru; (b) scope penuh — sekalian wajibkan email di form donasi/checkout tamu (mengubah UX "cukup
HP" yang baru dikunci).

### [2026-07-21] Bug Sesungguhnya: `lookup-member` Ambil Contact Sembarang, Bukan yang Terhubung Member

**Setelah fix rate-limit di atas, user tetap tidak ketemu** — dan nomor yang dites terkonfirmasi
BENAR nomor terdaftar milik user sendiri (Wawan Sugianto). Diagnosa lanjutan: curl langsung
`?phone=+6285210626455` → `{"found":false}` bersih (HTTP 200, bukan rate-limit). Cek DB
langsung: nomor ini muncul di **5 baris `contacts` berbeda**. Root cause: `lookup-member`
mencari contact dulu (`contacts.findFirst({where: or(phone,whatsapp)})` — TANPA `orderBy`,
hasil tidak deterministik/bisa salah pilih), BARU cari member via `contactId` itu. Kalau
`findFirst()` kebetulan mengembalikan salah satu dari 5 baris yang **bukan** yang terhubung ke
`members`, pencarian member gagal — meski orangnya sungguh terdaftar.

**Bukan data sampah** — dicek satu-satu, 3 dari 5 contact itu SAH, masing-masing terhubung ke
entitas SENDIRI-SENDIRI: `members` (akun utama), `member_businesses` (usaha), dan
`member_professionals` (profesional) — arsitektur yang memang mengizinkan satu nomor HP dipakai
di beberapa profil self-reported berbeda (lihat § "Data Cleanup — Orphan Contacts" — pola sama,
tapi kali ini SEBAGIAN besar bukan orphan). Cuma 2 dari 5 yang genuinely orphan (sisa registrasi
gagal). Konsekuensinya: `contacts.findFirst()` TANPA JOIN eksplisit ke `members` pada dasarnya
selalu berisiko salah pilih begitu satu nomor dipakai di >1 profil — bukan kasus langka.

**Fix**: query diubah dari "cari contact → cari member by contactId" (dua langkah, rawan salah
pilih) menjadi **JOIN langsung** `members INNER JOIN contacts ON contacts.id = members.contactId
WHERE contacts.phone/whatsapp = X` — INNER JOIN secara struktural memfilter HANYA contact yang
benar-benar terhubung ke `members`, jadi baris usaha/profesional/orphan otomatis tidak pernah
ikut terpilih. Diterapkan di kedua jalur (`email` dan `phone`) di
`app/api/akun/lookup-member/route.ts`. Jalur `profiles` TIDAK perlu diubah — `profiles.phone`
kolom langsung, tidak lewat `contacts`, jadi tidak kena masalah yang sama.

**Verifikasi**: query JOIN yang sama dites LANGSUNG ke database production via SQL manual
SEBELUM deploy → mengembalikan member yang benar (`Wawan Sugianto`). `tsc --noEmit` bersih +
`bun run build` sukses.

**Aturan digeneralisasi**: kapan pun ada tabel helper yang di-referensi oleh LEBIH DARI SATU
entitas berbeda (di sini: `contacts` dipakai `members`, `member_businesses`,
`member_professionals`, `member_owned_pesantren` — semua punya `contactId` sendiri-sendiri) —
mencari row di tabel helper itu dulu (`findFirst`) baru mencari entitas yang mereferensikannya
adalah pola YANG SALAH kalau nilai yang dicari (di sini: nomor HP) bisa muncul di banyak baris
helper untuk entitas berbeda. Selalu JOIN dari sisi ENTITAS TARGET (di sini: `members`) ke tabel
helper, bukan sebaliknya — supaya filter "harus terhubung ke entitas ini" terjadi di level SQL
(INNER JOIN), bukan diasumsikan benar dari "contact pertama yang ketemu".

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

### [2026-07] Bug Fundamental: Auto-Sync Tenant Memberships (PC IKPM & Marhalah)

**Masalah**: Ketika admin membuat/mengedit anggota di dashboard tenant (mis. Forum Forbis) atau meng-import massal data anggota dari Excel, data `members.primaryCabangRefId` (PC IKPM) dan `graduationYear` (Marhalah) tersimpan di `public.members`. Namun, anggota tersebut **tidak otomatis muncul di dashboard tenant PC IKPM Cabang** (mis. PC IKPM Yogyakarta) atau Marhalah terkait.

**Root cause**:
Daftar anggota di dashboard tenant bergantung pada `JOIN public.tenant_memberships WHERE tenant_id = {current}`. Sebelumnya, `createMemberAction`, `updateMemberAction`, dan `commitImportAction` HANYA membuat `tenant_memberships` untuk tenant di mana admin sedang berada (`access.tenant.id`). Logika auto-join sebelumnya hanya ada di API self-service user (`PATCH /api/akun/member-data`).

**Fix**:
Dibuat helper sentral `syncAutoTenantMemberships(runner, memberId, primaryCabangRefId, graduationYear, graduationPeriod)` di `packages/db/src/helpers/member-sync.ts` (dire-export dari `@jalajogja/db`).
- Mencari tenant tipe `cabang` (`refCabangId == primaryCabangRefId`) & `marhalah` (`marhalahYear == graduationYear`).
- Menambahkan record ke `public.tenant_memberships` dengan `.onConflictDoNothing()` (`registeredVia: 'auto_cabang'` / `'auto_marhalah'`).
- Dipanggil secara konsisten di **4 titik**:
  1. `createMemberAction` (`app/(dashboard)/app/[tenant]/members/actions.ts`)
  2. `updateMemberAction` (`app/(dashboard)/app/[tenant]/members/actions.ts`)
  3. `commitImportAction` (`app/(dashboard)/app/[tenant]/members/import/actions.ts`)
  4. `PATCH /api/akun/member-data` (`app/api/akun/member-data/route.ts`)

### [2026-07] Fix Runtime TypeError: Cannot read properties of null (reading 'trim') di Step1Identity

**Masalah**: Error `Cannot read properties of null (reading 'trim')` pada `step1-identity.tsx` saat menyimpan form edit anggota.
**Root cause**: `(fd.get("name") as string).trim()` dipanggil tanpa optional chaining `?.trim()`. Jika `fd.get("name")` mengembalikan `null`, ekspresi tersebut melemparkan TypeError.
**Fix**: Menggunakan `(fd.get("name") as string)?.trim() || ""` diikuti validasi guard `if (!nameVal)` di `components/members/wizard/step1-identity.tsx`.

### [2026-07] Feature: Aktifkan Akun Login Anggota oleh Admin Dashboard

**Kebutuhan**: Banyak data anggota historis / hasil import belum memiliki akun Better Auth (`members.betterAuthUserId` null). Admin membutuhkan akses di Dashboard Admin untuk membuatkan password sementara dan mengaktifkan akun login anggota tersebut.

**Implementasi**:
- **Server Action**: `activateMemberAccountAction(slug, memberId, email, password)` di `app/(dashboard)/app/[tenant]/members/actions.ts`.
  - Cek hak akses admin tenant & format email + password.
  - Buat akun Better Auth via `auth.api.signUpEmail`.
  - Set `public.members.betterAuthUserId = authUserId`.
  - Update/create `contacts.email` agar data email kontak konsisten.
- **Komponen UI**: `<ChangePasswordSection>` di `components/members/change-password-section.tsx`.
  - Jika `hasAccount === false`: Tampilkan form **"Aktifkan Akun Login"** (Email Login pre-filled dari kontak + Password Sementara + Konfirmasi Password + Tombol "Aktifkan Akun Login").
  - Jika `hasAccount === true`: Tampilkan form **"Ubah Password"** seperti biasa.

### [2026-07] Feature: Kolom PC IKPM Cabang pada Template & Importer Anggota

**Kebutuhan**: Admin memerlukan kemampuan untuk meng-import kolom PC IKPM Cabang agar anggota yang di-import otomatis terdaftar di tenant PC IKPM Cabang yang sesuai (`primaryCabangRefId`).
**Implementasi**:
- Kolom `"PC IKPM Cabang"` ditambahkan ke `TEMPLATE_HEADERS` / `HEADERS` (45 kolom).
- File template Excel (`GET /api/members/import/template`) memuat daftar PC IKPM Cabang aktif di sheet `Panduan` dan menyediakan **sheet ke-3 "Daftar PC IKPM Cabang"** berisi tabel nama & kode cabang dari DB (`public.ref_ikpm_cabang`) agar mudah disalin/dirujuk.
- Parser `matchCabang(raw)` di `lib/import-anggota.server.ts` melakukan *case-insensitive ILIKE match* terhadap `ref_ikpm_cabang.nama` / `kode`.
- `commitImportAction` menyimpan `primaryCabangRefId` dan `syncAutoTenantMemberships` otomatis meng-create `tenant_memberships` pada tenant cabang terkait.

### [2026-07] [PERENCANAAN ARSITEKTUR] Import/Export WordPress, Yoast SEO, Custom Permalinks, & Sanitasi Editor

> **Dokumen Spesifikasi Lanjutan**: `docs/arsitektur-import-export-post-wordpress.md` (Juga dirujuk dari `docs/arsitektur-website.md` § 6 dan `docs/arsitektur-domain.md` § 8.7).
> **STATUS**: ⚠️ **BELUM DIEKSEKUSI / PERLU KLARIFIKASI MATANG BERIKUTNYA BEFORE EXECUTION**.

**Ringkasan Perencanaan**:
- **Import/Export**: Dukungan import file WXR XML & pull REST API WordPress (`/wp-json/wp/v2/`), serta ekspor balik dari Jalakarta ke format WXR XML (bebas vendor lock-in).
- **Yoast SEO Integration**: Pemetaan 1-to-1 dari Yoast meta key (`_yoast_wpseo_*`) ke kolom SEO Jalakarta (`posts.metaTitle`, `metaDesc`, `focusKeyword`, `ogImageId`, `robots`, `schemaType`).
- **Custom Permalinks**: Opsi penyesuaian struktur URL post (`post_name` `/{tenant}/{slug}`, `date_name` `/{tenant}/{year}/{month}/{slug}`, dll) di `/{slug}/website/pengaturan` dengan perlindungan blacklist `RESERVED_TENANT_SLUGS`.
- **Timezone**: Parser tanggal publikasi dengan konversi `post_date_gmt` / offset local timezone tenant (`Asia/Jakarta`) ke UTC `timestamptz`.
- **Media & Content Sanitization**: Worker download featured image/inline image dari WP ke MinIO self-hosted storage (`public.media`), serta sanitasi Gutenberg comment / WordPress shortcode ke HTML/Tiptap clean format.
- **Aturan Eksekusi**: Dokumen arsitektur ini murni spesifikasi perencanaan. Jangan mengeksekusi penulisan kode tanpa instruksi dan klarifikasi eksplisit dari user.

### [2026-07] [PERENCANAAN ARSITEKTUR] SEO Master Blueprint (GTM, Dual Sitemap Index, AI Bots, & Google Rich Sitelinks Engine)

> **Dokumen Spesifikasi Utama**: `docs/arsitektur-seo.md`
> **STATUS**: 📋 **ARSITEKTUR LENGKAP — SIAP DIEKSEKUSI PER FASE (FASE 4 – 7)**.

**Ringkasan Perencanaan**:
- **Fase 4 (GTM & Webmaster Verification)**: Tab baru di `/app/{slug}/settings/seo` untuk mengelola `seo_gtm_id` (`GTM-XXXXXXX`), Google/Bing Meta Verification, script injection di `PublicLayout`, dan Card Petunjuk Submisi Google Search Console.
- **Fase 5 (Dual Sitemap Index)**: Menyediakan `/{slug}/sitemap.xml` (Native Jalakarta Index) dan `/{slug}/sitemap_index.xml` (Yoast SEO Migration Index) yang mengarahkan ke sub-sitemap modular (`posts`, `pages`, `categories`, `products`, `events`, `campaigns`) tanpa 404 saat migrasi dari WP.
- **Fase 6 (AI Crawler & Agent LLM)**: Konfigurasi `robots.txt` dengan izin eksplisit bot AI (Google-Extended/Gemini, GPTBot/ChatGPT, ClaudeBot, PerplexityBot) serta endpoint Markdown `/{slug}/llms.txt`.
- **Fase 7 (Google Rich Sitelinks Engine)**: Struktur HTML `<header>`/`<nav>` bersih, disuntik 5 Schema JSON-LD (`SiteNavigationElement`, `BreadcrumbList` universal, `WebSite` dengan `SearchAction` Sitelinks Search Box, dan `Organization` identity) untuk menghasilkan tampilan hasil pencarian Google berhirarki seperti institusi/kampus besar.
- **Aturan Eksekusi**: Perencanaan telah dikunci di `docs/arsitektur-seo.md`. Eksekusi dilakukan bertahap per fase setelah konfirmasi user.

### [2026-07] Feature & Arsitektur: Tiptap Editor & Universal Content Renderer

> **Dokumen Spesifikasi Utama**: `docs/arsitektur-editor.md` (Dirujuk dari `docs/arsitektur-website.md` § 7).
> **STATUS**: ✅ **IMPLEMENTASI SELESAI & DIVERIFIKASI (2026-07-26) — `bun x tsc --noEmit` 0 ERROR**.

**Hasil Implementasi**:
- **Konsistensi Editor**: Single-source `<TiptapEditor>` (`components/editor/tiptap-editor.tsx`) melayani seluruh modul (`posts`, `pages`, `products`, `campaigns`, `events`, `letters`).
- **Fase 1 (Block "Baca Juga")**: Extension `RelatedLinkBlock` (`related-link-ext.ts` & `related-link-view.tsx`) terhubung dengan dialog toolbar dan `<PublicLinkPicker>` untuk autocomplete URL internal & eksternal.
- **Fase 2 (Enhanced Block Quote)**: Extension `EnhancedBlockquote` (`enhanced-blockquote-ext.ts`) mendukung atribut `citation` (`— Nama Penulis`) dan render Quote Card ber-border warna primer di frontend/PDF (`letter-render.ts`).
- **Fase 3 (Responsive YouTube & Instagram Embed)**: Extension `EmbedBlock` (`embed-block-ext.ts` & `embed-block-view.tsx`) memuat parser YouTube 16:9 (`aspect-video` anti-overflow mobile) serta Instagram Post/Reel Embed dengan auto-loader script `instagram.com/embed.js`.
- **Fase 4 (Frontend Spacing Standard)**: Class utility `.prose-jalakarta` di `globals.css` dan parser server-side `letter-render.ts` menjamin jarak antar-block responsif dan konsisten.
- **Kompatibilitas WordPress**: Seluruh block terpetakan 1-to-1 dengan Gutenberg Block HTML (`wp-block-callout`, `wp-block-quote`, `wp-embed` YouTube & Instagram).

### [2026-07] Feature: Modal Popup Konfirmasi Pembayaran & Unggah Bukti Transfer Invoice Admin

> **STATUS**: ✅ **IMPLEMENTASI SELESAI & DIVERIFIKASI — `bun x tsc --noEmit` 0 ERROR**.

**Hasil Implementasi**:
- **Modal Popup Dialog**: Tombol **"Konfirmasi Pembayaran"** pada halaman Detail Invoice Admin (`/app/[tenant]/finance/billing/invoice/[id]`) kini membuka modal popup (`<Dialog>`), menggantikan form inline di bawah halaman.
- **Unggah Bukti Transfer**: Menambahkan komponen `ProofUploadField` (konsisten dengan `/finance/pemasukan/new`), mendukung upload langsung (HEIC/JPG/PNG ➔ WebP via Sharp + MinIO).
- **Integrasi Server Action & Database**: Field `proofUrl` diteruskan ke `confirmInvoicePaymentAction` dan disimpan ke `schema.payments.proofUrl`, otomatis tampil di card **Riwayat Pembayaran** dengan lightbox zoom.

### [2026-07] Feature: Peningkatan Form Buat Invoice Admin (Customer Autocomplete, Products & Tickets Integration, Unique Code, WA Notif)

> **STATUS**: ✅ **IMPLEMENTASI SELESAI & DIVERIFIKASI — `bun x tsc --noEmit` 0 ERROR**.

**Hasil Implementasi**:
- **Customer Autocomplete (`MemberNameAutocomplete`)**: Input nama customer di halaman `/finance/billing/invoice/new` kini terintegrasi dengan pencarian data Anggota. Saat anggota dipilih, `customerName`, `customerPhone`, `customerEmail`, dan `memberId` terisi otomatis. Admin tetap dapat mengentri nama & kontak kustom jika bukan anggota.
- **Item Tagihan Autocomplete (`CatalogItemAutocomplete`)**: Menambahkan server actions `searchBillingProductsAction`, `searchBillingPaidTicketsAction`, & `searchBillingCampaignsAction`. Admin dapat memilih item dari Produk Toko aktif (`tenant.products`), Tiket Event Berbayar (`tenant.event_tickets`), atau Campaign Donasi aktif (`tenant.campaigns`) ➔ nama, harga (atau rekomendasi nominal), dan `itemId` terisi otomatis.
- **Kode Unik Otomatis**: Saat invoice diterbitkan (`createInvoiceAction`), jika setting `unique_code_enabled` bernilai true, kode unik Rp 100–999 acak di-generate via `generateUniqueCode(tenantDb)` dan disimpan ke `schema.invoices.uniqueCode`.
- **Notifikasi WhatsApp**: Saat invoice berhasil diterbitkan dan `customerPhone` ada, sistem secara otomatis mengirimkan notifikasi WA (`invoice_created`) berisi rincian invoice, total tagihan (+ kode unik), tanggal jatuh tempo, dan tautan invoice publik (`waAppUrl`).

### [2026-07] UI Feature: Pembaruan Desain Header Pill Modern (Border Bottom & Centered Nav Menu)

> **STATUS**: ✅ **IMPLEMENTASI SELESAI & DIVERIFIKASI — `bun x tsc --noEmit` 0 ERROR**.

**Hasil Implementasi**:
- **Border Bottom Tipis**: Menambahkan garis pembatas bawah `border-b border-border/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]` pada komponen `<header>` di `apps/web/components/website/public/layout/headers/pill-header.tsx`.
- **Nav Menu Center Alignment**: Memperbarui struktur layout menjadi 3 kolom grid (`grid grid-cols-2 md:grid-cols-3 items-center h-16 gap-4`) sehingga kontainer kapsul navigasi (`bg-muted/60 rounded-full p-1 mx-auto`) secara matematis tepat berada di posisi tengah antara Logo (kiri) dan Action Buttons (kanan).
- **Dokumentasi Terbarui**: [`docs/arsitektur-header-footer-publik.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-header-footer-publik.md) Section Desain 3 Pill Header ter-update.

### [2026-07] UI Feature: Desain Footer Baru "Forcreator" & Pengaturan Logo Footer

> **STATUS**: ✅ **IMPLEMENTASI SELESAI & DIVERIFIKASI — `bun x tsc --noEmit` 0 ERROR**.

**Hasil Implementasi**:
- **Desain Footer Forcreator (`forcreator-footer.tsx`)**:
  - **Row Top (Marquee Ticker)**: Running text continuous marquee dengan background warna Secondary (`secondaryColor` / `--secondary`) yang mengalirkan username Instagram anggota tenant (`@username @username ...`).
  - **Row Middle (2-Row Grid)**:
    - Row Atas: Kolom Kiri = **Logo Footer** (`footerLogoUrl`, fallback ke `logoUrl`), Kolom Kanan = **Ikon Sosial Media** (`SocialLinks` `variant="brand"`, aligned `items-start`).
    - Row Bawah: Kolom Kiri = **Deskripsi Tenant** + Sub-section **Navigation** (`Useful Links`), Kolom Kanan = Sub-section **Contact Us** (Sub-label *Alamat* warna secondary, Alamat lengkap, Telepon, Email).
  - **Row Bottom (Copyright Bar)**: Copyright bar standar (`© {year} {siteName}. All rights reserved.`) dengan atribusi Jalakarta (jika bukan custom domain).
- **Setting Logo Footer Admin**: Menambahkan field `footerLogoUrl` / key database `footer_logo_url` (group `general`) di form `/app/[tenant]/settings/general` & `saveGeneralSettingsAction` untuk mengunggah logo khusus footer.
- **Dokumentasi Terbarui**: [`docs/arsitektur-header-footer-publik.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-header-footer-publik.md) Section Desain 4 Forcreator Footer ter-update.

### [2026-07] Architecture Feature: Perencanaan Taksonomi Sektor Usaha BPS KBLI 2020

> **STATUS**: ✅ **DOKUMENTASI PERENCANAAN LENGKAP DI `docs/arsitektur-usaha.md` § 9**.

**Rangkuman Perencanaan**:
- **Evaluasi Riset Gemini (`docs/evaluasi-arsitektur-usaha-gemini.md`)**: Memisahkan "Kesehatan" (KBLI Q) dan "Pendidikan" (KBLI P) yang memiliki beda *supply chain* & regulasi, serta menambahkan sektor Logistik, Konstruksi, Agribisnis, F&B, dan Keuangan.
- **Formulasi 10 Sektor BPS Hybrid**: Di-upgrade dari 7 sektor lama menjadi 10 sektor berstandar BPS KBLI 2020.
- **Sektor `Kreatif` Mandiri (Request Forcreator)**: Sektor `Kreatif` dipertahankan sebagai sektor tersendiri (tidak dilebur ke Teknologi) untuk mendukung komunitas Forcreator. Sektor `Teknologi & Informasi` berdiri sendiri.
- **Harmonisasi Modul Profesional (`member_professionals`)**: Taksonomi usaha disederhanakan murni untuk entitas bisnis/lembaga, sedangkan kredensial perorangan dikelola terpisah di `docs/arsitektur-profesional.md`.
- **Rincian Sub-Sektor Tier 3 (`docs/arsitektur-usaha-taxonomy-gemini.md`)**: Menetapkan rincian sub-sektor presisi per sektor, dengan Sektor `Kreatif` menggunakan 9 Sub-Bidang Custom khas Forcreator (`Event`, `Kaligrafi`, `Desain Komunikasi Visual`, `Seni Teater dan Sastra`, `Seni Media Rekam`, `Seni Lukis dan Illustrasi`, `Seni Musik`, `Seni Instalasi dan Kontemporer`, `Seni Kriya`).
- **Integrasi Ekosistem (`docs/arsitektur-ekosistem.md`)**: Taksonomi 3-Tier Usaha (termasuk Forcreator sub-sectors) di-seed ke `lib/ecosystem-tags.ts` untuk menggerakkan autocomplete pencocokan presisi pada `offeredTags` ("Menawarkan") dan `neededTags` ("Membutuhkan").
- **Dokumentasi Terbarui**: [`docs/arsitektur-usaha.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha.md) Section 9, [`docs/arsitektur-usaha-taxonomy-gemini.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha-taxonomy-gemini.md) & [`docs/arsitektur-ekosistem.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-ekosistem.md) ter-update.

### [2026-07] Architecture Feature: Section Directory Organisasi (`directory`)

- **Modul Baru Section Builder**: `directory` ("Direktori Organisasi") untuk menampilkan item Usaha (`member_businesses`), Praktik Profesional (`member_professionals`), atau Pesantren Alumni (`member_owned_pesantren`).
- **Gaya Judul Section (`titleStyle`)**: `default` (Title block standar `eyebrow` + `title` + `description`) vs `simple` (Judul simpel kiri + link *"Direktori [Type] Forcreator →"* berwarna **Secondary** `text-secondary font-semibold hover:opacity-85`).
- **Layout Grid Kolom (`gridCols`)**: `4` (4 kolom 1 row), `3` (3 kolom 1 row), atau `2` (2 kolom 1 row terpusat `max-w-4xl mx-auto` ~70% width seperti Post Design 6 Forcreator).
- **Desain Kartu Directory (`cardDesign`)**: `default` (Card bawaan halaman arsip) vs `custom` (Desain Forcreator: foto persegi tajam `rounded-none`, aksen diamond melayang `w-3.5 h-3.5 bg-secondary rotate-45`, 2 baris deskripsi `line-clamp-2`, alamat berwarna Secondary, badge bidang usaha/kategori, border bottom tipis, & avatar bulat pemilik + nama anggota di paling bawah).
- **Server-Side Feed Aggregator (`lib/directory-feed.server.ts`)**: Otomatis me-resolve data direktori dari DB public dengan JOIN ke members & addresses, serta fallback mock data yang kaya jika DB tenant masih kosong.
- **Dokumentasi Terbarui**: [`docs/arsitektur-website.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-website.md) Section 2.8 ter-update.

### [2026-07] Architecture Feature: Section Quote & Impact Counter (`quote`)

- **Modul Baru Section Builder**: `quote` ("Quote & Impact Counter") untuk menampilkan kutipan utama tokoh/anggota di kolom kiri dan counter statistik anggota terdaftar di kolom kanan.
- **Kolom Kiri (Quote & Sitasi)**: Teks quote utama (`quoteText`), foto avatar 1:1 rounded full (`authorAvatarUrl`), nama & profesi berwarna **Secondary** (`authorName`, `authorTitle`), serta info alumni (`authorSub`).
- **Kolom Kanan (Angka Stat & Real-Time Date)**: Counter angka anggota terdaftar dari DB (`public.tenant_memberships` per tenant), `statLabel` & link CTA berwarna **Secondary**, serta update waktu real-time yang di-generate server saat runtime (`"Berdasarkan data bulan [Bulan] [Tahun]"`).
- **100% Multi-Tenant & Dinamis**: Nama organisasi ter-resolve via `getTenantSeoBase(slug)`, angka terdaftar riil dari DB tenant, NOL hardcode.
- **Dokumentasi Terbarui**: [`docs/arsitektur-website.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-website.md) Section 2.8 ter-update.
















### [2026-08-07] Menu Admin Khusus IKPM Pusat: "Ringkasan Tenant" — DIEKSEKUSI

Lanjutan langsung dari 2 sesi perencanaan sebelumnya (§ "[PERENCANAAN ARSITEKTUR] Menu Admin
Khusus IKPM Pusat" dan "Refinement Rencana 'Ringkasan Tenant'" — keduanya di atas). User beri
lampu hijau eksekusi penuh: *"ok ok .. mari kita eksekusi ... biar nanti gue punya gambaran
kalau sudah lihat hasilnya.. ini kan kita sementara baru punya 4 tenant yg online.."*

**Ekstraksi murni (Task #72-73)** — `apps/web/app/(public)/[tenant]/statistik/page.tsx` (600
baris) DIBACA ULANG PENUH sebelum eksekusi (bukan direkonstruksi dari ingatan sesi sebelumnya)
untuk memastikan "pure code motion" genuinely presisi. Query (baris ±100–357) dipindah apa
adanya ke `lib/member-statistics.server.ts`'s `computeMemberStatistics(tenantId: string)` —
**deviasi kecil dari rencana tertulis**: parameter `enabledModules` yang tadinya direncanakan
di signature ternyata TIDAK PERNAH dipakai di badan query (query section Pesantren/Usaha/
Profesional selalu jalan penuh terlepas toggle admin — `enabledModules` cuma menggate RENDER-
nya, bukan hitungannya) — dijatuhkan dari signature demi kejujuran API, caller tetap fetch
`enabledModules` sendiri dan meneruskannya langsung ke komponen render. Return type
`MemberStatisticsData = Awaited<ReturnType<typeof computeMemberStatistics>>` — diturunkan
OTOMATIS dari compiler (bukan didefinisikan manual terpisah), menghilangkan risiko drift antara
fungsi dan tipe. JSX render (4 `<section>` + helper lokal `StatCard`/`BarList`/`SectionTitle` +
label map gender/waliSantri/domisili) dipindah apa adanya ke `components/statistik/
statistik-sections.tsx`'s `<StatistikSections>` — SENGAJA tidak merender header/judul halaman,
supaya tiap caller (publik/overview Pusat/drill-down per-tenant) bebas pakai header sesuai
konteksnya masing-masing. `statistik/page.tsx` diperkecil jadi murni resolve tenant → panggil
fungsi+komponen baru — perilaku publik dijamin nol berubah (struktur JSX final identik byte-
demi-byte dengan yang lama, cuma dipecah lokasi filenya).

**Wiring sidebar (Task #74)** — `layout.tsx` SUDAH punya `tenant.tenantType` dari
`getTenantAccess()` (nol query tambahan) → `isPusatTenant = tenant.tenantType === "pusat"` →
di-thread lewat rantai `layout.tsx → Sidebar (desktop) + MobileSidebar (mobile, sekadar wrap
`<Sidebar>`) → SidebarNav`. `NavItem` type dapat field baru `pusatOnly?: boolean`, entry baru
`{ label: "Ringkasan Tenant", icon: Network, path: "ringkasan-tenant", module: null, pusatOnly:
true }` — filter logic cek `pusatOnly` PALING AWAL (sebelum cek `module`), item ini sengaja
`module: null` supaya tidak ikut lolos permission check `canAccess()` dari sistem 10-modul yang
sudah ada (axis TIPE TENANT, bukan axis PERMISSION — dua konsep sengaja tidak dicampur). Icon
`Network` diverifikasi dulu ADA di `.d.ts` `lucide-react@1.8.0` yang genuinely terinstall
(`grep "declare const Network:"`) sebelum dipakai — bukan ditebak dari familiaritas versi lain.

**Halaman overview `ringkasan-tenant/page.tsx` (Task #75)** — guard 2-lapis: sidebar hiding
(murni UX, sudah di atas) DAN `if (access.tenant.tenantType !== "pusat") redirect(\`/app/${slug}
/dashboard\`)` di baris awal Server Component (pertahanan SESUNGGUHNYA — pola persis guard
10-modul `canAccess()` yang sudah ada, cuma kondisinya tipe tenant bukan role-permission).
4 KPI (`<StatCard>` reuse `components/dashboard/stat-card.tsx` apa adanya, nol perubahan):
total tenant aktif, total anggota unik (`public.members`), total baris keanggotaan tercatat
(`tenant_memberships`, bisa lebih besar dari anggota unik — disclaimer jujur di `sublabel`),
anggota baru bulan ini (`gte(members.createdAt, startOfMonthUtc)` — anchor "awal bulan WIB"
dihitung manual via `todayInTz("Asia/Jakarta")` + `Date.UTC(y, m-1, 1)`, pola sama persis
`anchorTodayUtc()` yang sudah dikunci di lesson-lesson WIB/UTC sebelumnya, BUKAN `new Date()`
mentah). Breakdown tenant per tipe: urutan tetap `TENANT_TYPES` (import dari `@jalajogja/db`),
BUKAN hasil `COUNT` descending — supaya urutan render konsisten setiap kali. Tabel utama:
`LEFT JOIN tenant_memberships` + `count(${tenantMemberships.id}) filter (where status = '...')`
per status (active/alumni/inactive) dalam SATU query `GROUP BY tenants.id` (murah, bukan N+1) —
tiap baris dapat link "Lihat Statistik →" ke drill-down. Insight data quality: `COUNT(*) FROM
members WHERE primary_cabang_ref_id IS NULL`, ditampilkan sebagai banner amber HANYA kalau
`>0` (tidak menampilkan noise kalau datanya sudah bersih). **"Total Statistik Pusat"** — bagian
paling elegan: cukup `computeMemberStatistics(access.tenant.id)` dipanggil DARI DALAM dashboard
tenant Pusat itu sendiri, TANPA cabang kode terpisah apa pun — otomatis mencakup statistik
SELURUH sistem, konsekuensi langsung desain "keanggotaan tanpa batas" yang sudah dikunci di
Fase A-D IKPM Pusat sebelumnya (tenant Pusat punya baris `tenant_memberships` untuk SEMUA
anggota via auto-populate unconditional + backfill).

**Halaman drill-down `ringkasan-tenant/[targetSlug]/page.tsx` (Task #76)** — LAZY, cuma
dihitung saat admin benar-benar klik masuk (analog `/platform/tenants/[slug]`) — mencegah
~20 query × N tenant di satu page load kalau breakdown detail dihitung untuk semua tenant
sekaligus di halaman overview. **Guard dicek dari `access.tenant.tenantType` (tenant DI URL
dashboard yang sedang dibuka), BUKAN tipe `targetSlug`** (tenant yang datanya sedang dilihat,
bisa cabang/marhalah/forum apa saja) — kalau guard pertama gagal, redirect SEBELUM `targetSlug`
bahkan di-resolve, jangan bocorkan apa pun. `getEnabledEkosistemModules(createTenantDb
(targetSlug))` — SATU-SATUNYA pengecualian sempit terhadap prinsip "hanya baca 3 tabel public
schema backbone" yang dikunci di dokumen: baca `tenant_{targetSlug}.settings` group "general",
diterima karena murni toggle UI boolean (bukan data finansial/PII) dan tanpa ini breakdown
Pesantren/Usaha/Profesional akan salah tampil section yang admin tenant target sudah matikan.

**Drive-by fix `/platform/tenants` (Task #77)** — `TYPE_LABEL` (badge tipe tenant) sebelumnya
cuma punya 3 entry (`cabang`/`marhalah`/`forum`), tenant tipe "pusat" fallback diam-diam ke
`TYPE_LABEL.cabang` (badge salah tampil "Cabang"). Ditambah entry `pusat` + opsi filter
dropdown `<option value="pusat">IKPM Pusat</option>` + baris WHERE clause `status === "pusat"
? eq(tenants.tenantType, "pusat")` yang sebelumnya juga belum ada (kalau cuma tambah opsi
dropdown tanpa WHERE clause-nya, filter itu akan terlihat berfungsi tapi diam-diam tidak
memfilter apa pun) — gap yang sudah diidentifikasi eksplisit sejak sesi perencanaan pertama.

**Verifikasi (Task #78)** — `tsc --noEmit` bersih di KEDUA package (`apps/web` + `packages/db`)
dicek di SETIAP langkah (6× sepanjang eksekusi — bukan ditumpuk ke akhir, sesuai SOP ketat
project ini), bukan cuma sekali di penghujung. `bun run build --filter=@jalajogja/web` genuine
(dev server dimatikan via `lsof -ti:6202 | xargs kill -9`, `.next` dibersihkan via `rm -rf`,
direstart setelah) — sukses, `Cached: 0 cached` (bukti bukan cache-hit), 50.4 detik — kedua
route baru (`/app/[tenant]/ringkasan-tenant` 829 B, `/app/[tenant]/ringkasan-tenant/
[targetSlug]` 863 B) terkonfirmasi compile bersih di build output, tidak ada error. Dev server
direstart, `curl localhost:6202/` → 200 OK.

Dokumentasi disinkronkan: `docs/arsitektur-backbone-ikpm.md`'s header section + tabel "File
yang disentuh" diupdate dari "📋 RENCANA" jadi "✅ SELESAI" per-baris, plus catatan eksplisit
soal deviasi signature `computeMemberStatistics` dari rencana awal (dokumentasi TIDAK diam-diam
disamakan dengan implementasi — perbedaan dicatat dengan alasan, konsisten prinsip project ini
"dokumen historis tidak dihapus, ditandai eksplisit kalau berubah").

**Belum di-commit/push ke git, belum dijalankan di VPS** (nol migrasi DB dibutuhkan — murni
kode aplikasi baru, deploy cukup `git pull && bun run build --filter=@jalajogja/web && pm2
restart jalajogja --update-env`), **belum diverifikasi visual di browser** (keterbatasan
environment sesi ini, tidak ada browser) — user perlu coba: buka dashboard tenant Pusat,
konfirmasi item "Ringkasan Tenant" muncul di sidebar HANYA untuk tenant itu; klik masuk → cek
4 KPI + breakdown per tipe + tabel tenant+anggota + "Total Statistik Pusat"; klik "Lihat
Statistik →" salah satu baris → cek drill-down tampil benar; coba akses
`/app/{slug-cabang-biasa}/ringkasan-tenant` langsung via URL (harus redirect ke dashboard,
BUKTI guard lapis-2 genuinely bekerja, bukan cuma sidebar hiding).
