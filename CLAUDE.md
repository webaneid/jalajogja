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

### [2026-07-21] Audit Lanjutan: Bug Sama Ditemukan Lagi di Register — Duplikat Lolos Tak Terdeteksi

**Konfirmasi user**: setelah fix `lookup-member` di atas, user menegaskan requirement eksplisit —
verifikasi donasi HARUS strict ke `members` (dan `profiles` sebagai fallback publik), TIDAK
BOLEH pernah mencocokkan nomor yang cuma ada di data usaha/pesantren/profesional. Dikonfirmasi
fix sebelumnya SUDAH benar secara struktural (`INNER JOIN members↔contacts` = hanya bisa
mencocokkan contact yang ADA di kolom `members.contactId` — kolom itu terpisah total dari
`member_businesses.contactId` dst, jadi tidak mungkin nyasar).

**Audit menyeluruh** (grep pola `contacts.findFirst` + `eq(members.contactId, ...)` di seluruh
`apps/web`) menemukan **satu lagi instance bug yang sama persis**, di `api/akun/register/route.ts`
— pengecekan duplikat email/HP saat registrasi baru: `contacts.findFirst({where:
or(email,phone)})` lalu `members.findFirst({where: eq(members.contactId, dupContact.id)})`
TERPISAH. Dampaknya LEBIH SERIUS dari bug donasi: kalau `dupContact` yang terpilih kebetulan
baris usaha/profesional (bukan yang terhubung ke `members`), pengecekan "sudah terdaftar" GAGAL
mendeteksi — **orang bisa membuat akun KEDUA meski email/HP-nya sudah dipakai anggota lain yang
sudah punya akun**, karena `linkedMember` jadi `undefined` (pengecekan duplikat di-skip).

**Fix**: pola sama — ganti jadi `SELECT ... FROM members INNER JOIN contacts ... WHERE
contacts.email = X OR contacts.phone = Y LIMIT 1`, hapus variabel `dupContact` perantara.

**Audit lokasi lain**: semua pemakaian `contacts.findFirst` lain di codebase (`anggota/[id]/
page.tsx`, `api/akun/profil/route.ts`, `lib/akun-identity.ts`) dikonfirmasi AMAN — semuanya
mulai dari `contactId` milik entitas yang SUDAH diketahui (`member.contactId`,
`business.contactId`, dst — fetch by primary key langsung), bukan mencari berdasarkan nilai yang
bisa dipakai bersama (email/HP) lintas banyak baris. `lib/find-user-by-phone.ts` sudah lebih
dulu benar (JOIN pattern, dipakai lesson sebelumnya).

**Aturan digeneralisasi (diperkuat)**: kelas bug ini ("cari row di tabel helper dulu, baru cari
entitas pemiliknya terpisah") TIDAK CUKUP diperbaiki di SATU titik yang dilaporkan — begitu
ditemukan sekali, WAJIB grep pola yang sama (`{helperTable}.findFirst` diikuti
`eq({entitas}.{fk}, hasil_pencarian_pertama)`) di SELURUH codebase, karena pola yang sama
kemungkinan besar di-copy-paste ke tempat lain yang punya kebutuhan serupa (di sini: lookup dan
register sama-sama butuh "cari member by phone/email", ditulis terpisah, sama-sama salah).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses.

### [2026-07-21] Refactor `/akun` Mobile — "App Mode" + Kartu Anggota

> Arsitektur lengkap: `docs/arsitektur-akun.md` § "Mobile 'App Mode' + Kartu Anggota" +
> `docs/arsitektur-mobile-shell.md` § 2.3 (skema header baru).

User bawa referensi desain (`design-refs/akun/design-mobile-akun.jpg`, mockup app fintech) —
eksplisit: "cuma referensi visual, bukan ditiru literal", inti permintaan: mau ada "kartu
anggota" saat user login. Masuk Plan Mode (scope besar: komponen baru + skema header baru) —
riset `docs/arsitektur-akun.md` + kode `akun/layout.tsx`/`akun/page.tsx`/`akun-nav.tsx` +
`docs/arsitektur-mobile-shell.md`, lalu 2 putaran `AskUserQuestion` sebelum tulis kode:
1. **"App mode" penuh** (dipilih, bukan "konten saja") — header situs + `BottomNav` situs
   disembunyikan total di `/akun` mobile, diganti header+bottom-nav milik akun sendiri.
2. **Berlaku SEMUA `/akun/*`** (bukan cuma dashboard) — konsistensi, tidak "keluar-masuk"
   app-mode saat pindah antar sub-halaman.
3. **Bell notifikasi**: tampil tapi non-fungsi (belum ada sistem notifikasi in-app).

**Temuan kunci saat riset — `isSingleMobileRoute` TIDAK bisa dipakai untuk akun**:
fungsi itu (§ 2.1 `docs/arsitektur-mobile-shell.md`) hardcoded ke pattern SPESIFIK
(post/agenda/campaign/produk 2-segmen, atau 1-segmen generik di luar `STATIC_TOP_SEGMENTS`) dan
didesain untuk skema "detail+gambar" (overlay back+menu di atas hero image) — bukan skema
"greeting header app-like" yang dibutuhkan akun, dan tidak generic terhadap KEDALAMAN path
(`/akun/mitra/pesanan` 3-segmen tidak akan pernah match pattern 2-segmen yang ada). Solusinya
fungsi BARU `isAkunAppMode(pathname, baseUrl)` — cek generic `segments[0] === "akun"`, independen
dari `isSingleMobileRoute`, dua-duanya di-OR di `header-visibility.tsx` dan `footer-bottom-nav.tsx`.
`"akun"` TETAP di `STATIC_TOP_SEGMENTS` (bukan dihapus) — supaya `isSingleMobileRoute` tidak ikut
salah proses `/akun`, dua mekanisme independen.

**Komponen baru** (`components/akun/mobile/`): `AkunMobileHeader` (server, avatar+sapaan+bell
statis), `MemberCard` (server, warna `bg-primary`/`text-primary-foreground` — ikut tema tenant
OTOMATIS via CSS var, BUKAN warna hardcode dari mockup referensi — hanya di dashboard, varian
`type==="public"` lebih sederhana), `AkunBottomNav` (client, 3 tab utama + drawer "Lainnya",
POLA STRUKTUR diadaptasi dari `BottomNav` situs tapi TANPA tombol melayang — itu gimmick
branding situs, tidak relevan di app-mode akun).

**`MEMBER_NAV_ITEMS`/`PUBLIC_NAV_ITEMS` di-export dari `akun-nav.tsx`** (sebelumnya module-scope
private) — dipakai ULANG oleh `AkunBottomNav`, bukan diketik ulang, cegah drift 2 daftar
independen (sidebar desktop vs bottom-nav mobile) — pola yang sudah berkali-kali ditegaskan di
sesi-sesi sebelumnya untuk kasus serupa (nav item list, template default, dst).

**Spacer (§ 5 `docs/arsitektur-mobile-shell.md`)** — kasus PALING AMAN dari semua pola yang ada
di dokumen: `akun/layout.tsx` sepenuhnya mengontrol akhir tree untuk SEMUA `/akun/*` (mobile
block: `AkunMobileHeader` → `{children}` → `AkunBottomNav`, tidak ada sibling di luar file itu
yang render setelahnya) — spacer dibundle langsung di dalam `AkunBottomNav` (Pola A), tidak
perlu trailing spacer terpisah seperti kasus campaign/produk/invoice sebelumnya.

**Desktop (`≥md`) TIDAK disentuh sama sekali** — `akun/layout.tsx`+`akun/page.tsx` desktop
block dibungkus `hidden md:block`/`hidden md:flex` PERSIS konten lama, cuma dipindah posisi
(bukan diubah isinya) — mobile dapat blok BARU `md:hidden` dengan data YANG SAMA (`identity`,
`membershipInfo`, dll — tidak ada query tambahan kecuali fetch `logo_url`/`site_name` dari
settings `general` untuk `MemberCard`).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan) — semua 16 route `/akun/*` terkonfirmasi muncul di
build output. `grep "fixed.*bottom-0"` di area akun → cuma SATU elemen (`AkunBottomNav`
sendiri), tidak ada konflik dengan elemen fixed lain. Belum diverifikasi visual di browser
(keterbatasan environment sesi ini, sudah berulang kali dicatat) — user perlu cek langsung
sebelum dianggap final, terutama proporsi `MemberCard` dan interaksi drawer "Lainnya".

### [2026-07-21] Disambiguasi Label "Profil" vs "Data Diri" — Info Login vs Edit Profil

**Masalah**: "Profil" dipakai untuk DUA hal berbeda di nav — `/akun/profil` (kredensial login:
email, password — h1 halaman itu SUDAH lama bilang "Info Login", cuma label nav-nya yang belum
konsisten) vs `/akun/lengkapi`|`/akun/data` (data pribadi: nama, tanggal lahir, dst, berlabel
"Data Diri" di nav). User: ganti jadi **"Info Login"** (untuk `/profil`) dan **"Edit Profil"**
(untuk `/lengkapi`|`/data`) — supaya tidak ambigu.

**Fix — satu sumber kebenaran, otomatis propagate ke semua permukaan**: label diubah di
`MEMBER_NAV_ITEMS`/`PUBLIC_NAV_ITEMS` (`akun-nav.tsx`, di-export sesi sebelumnya) — karena
`AkunBottomNav` (tab utama + drawer "Lainnya") dan `AkunNav` (sidebar desktop) SAMA-SAMA
render `item.label` dinamis dari array yang sama, rename di SATU tempat otomatis konsisten di:
sidebar desktop, tab bottom-nav mobile, drawer "Lainnya" mobile — TANPA perlu sentuh 3 file
terpisah. Ini bukti langsung manfaat "export array, jangan duplikasi" dari sesi sebelumnya.

**Perubahan tambahan di `akun/page.tsx` (mobile quick-actions, hanya bisa diubah di sini —
bukan bagian array yang di-share)**: 3 tombol aksi cepat berubah dari `Transaksi/Profil/Donasi`
→ `Transaksi/Info Login/Edit Profil` (href tombol ketiga kondisional
`${isMember ? "lengkapi" : "data"}`, sama seperti pola href nav item). "Donasi" TIDAK dihapus —
dipindah ke section "Layanan" (di bawah Agenda+Produk yang sudah ada, jadi baris ke-2 grid
2-kolom) — masih ada, cuma pindah posisi sesuai permintaan user.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses.

### [2026-07-21] Gradasi Header Mobile + Tombol "Kembali ke Dashboard" di 4 Halaman Akun

**1. Gradasi `AkunMobileHeader`** — `bg-primary` polos diganti `bg-gradient-to-b from-primary
to-secondary` (kedua CSS var sudah bagian sistem tema tenant, `theme-palette.ts` — otomatis
ikut warna tenant, tidak perlu fetch manual). Padding bawah dilebarkan (`pb-6` → `pb-20`) supaya
area gradasi cukup tinggi untuk "menyambung" ke `MemberCard` di bawahnya.

**Teknik overlap kartu**: `MemberCard` (+ `completeBanner` di atasnya) dibungkus
`<div className="-mt-16 space-y-4">` di `akun/page.tsx` — menarik naik SPESIFIK blok pertama
itu ke area gradasi yang sudah dilebarkan, sehingga kartu tampak mengambang di atas gradasi
(pola umum di app fintech/banking: hero band berwarna + kartu overlap). Sengaja HANYA blok
pertama yang ditarik (bukan seluruh `space-y-4` mobile) — elemen setelahnya (quick actions,
Menu Cepat, Layanan) tetap flow normal. Aman terhadap `space-y-4` margin-leak (§ 6
`docs/arsitektur-mobile-shell.md`) karena FIRST CHILD tidak pernah dapat margin-top dari
`space-y-*` sama sekali — tidak perlu `mt-0` override.

**2. Tombol "Kembali ke Dashboard" di 4 halaman** (`/akun/profil`, `/akun/lengkapi`,
`/akun/transaksi`, `/akun/media`) — pola PERSIS disalin dari yang sudah ada di
`pesantren/page.tsx`/`usaha-client.tsx` (`<a href={baseUrl+"/akun"}>` + `ArrowLeft` + outline
button style) — bukan komponen baru, styling manual disalin identik untuk konsistensi visual.
3 dari 4 halaman (`profil`/`transaksi`/`lengkapi`) belum punya `baseUrl` sama sekali sebelumnya
— ditambah via `useBaseUrl(slug)` (`lib/use-base-url.ts`, hook client yang sudah ada untuk
kasus ini). `media/page.tsx` sudah punya `baseUrl`+ikon panah kecil di atas (breadcrumb-style,
dipertahankan) — tombol lengkap ditambahkan di BAWAH sebagai tambahan, bukan pengganti.

**Penempatan berbeda sesuai struktur halaman** (bukan copy-paste posisi buta): 3 halaman
sederhana (`profil`/`transaksi`/`media`) — tombol di PALING BAWAH konten (sama persis posisi di
pesantren/usaha). `lengkapi` (wizard 3-step) — tombol di HEADER (persisten di semua step,
karena "paling bawah" berubah-ubah tergantung step yang aktif, tidak masuk akal untuk wizard).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses. Belum diverifikasi visual di
browser (efek gradasi+overlap kartu — proporsi `-mt-16` mungkin perlu disesuaikan setelah
dilihat langsung, keterbatasan environment sesi ini yang sudah berulang kali dicatat).

### [2026-07-21] Koreksi Gradasi Header + Logo MemberCard (2 putaran feedback user)

**Koreksi warna gradasi**: user tegas "salah perintah" — maksudnya BUKAN `primary→secondary`
(yang dibangun sebelumnya) tapi **`secondary → putih`**, dan lebih panjang ~30-40%. Fix di
`AkunMobileHeader`: `bg-gradient-to-b from-secondary to-white`, `pb-20`→`pb-28`. Sekalian
dikoreksi: `text-primary-foreground` → `text-secondary-foreground` di semua elemen header (teks,
ring avatar, badge lonceng) — kontras warna sekarang harus dihitung terhadap `secondary` (warna
background yang sesungguhnya dipakai di area konten header), bukan `primary` yang sudah tidak
relevan di komponen ini sama sekali.

**MemberCard — logo polos tanpa label/bingkai**: 2 putaran feedback berurutan:
1. Label nama tenant (teks di samping logo) dihapus — cukup logo saja. Logo dipaksa putih via
   `brightness-0 invert` (bekerja untuk logo warna apa pun, tidak perlu tahu warna aslinya).
2. Putaran kedua: bingkai (`bg-primary-foreground/15 p-1 rounded-md`) dihapus juga — logo
   sepenuhnya polos (tanpa background/padding/rounded), ukuran diperbesar `h-7 w-7`→`h-10 w-10`
   supaya tetap terlihat jelas tanpa bingkai penanda batas.

Badge "Kartu Anggota"/"Akun Publik" di sisi kanan TIDAK ikut dihapus — user cuma minta hapus
label di cluster logo (kiri), bukan seluruh baris atas kartu.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses di setiap putaran (2× untuk
gradasi, 2× untuk logo — total 4 siklus verifikasi dalam sesi feedback beruntun ini).

### [2026-07-21] MemberCard — Restrukturisasi Info Bottom-Row + Generalisasi ke Semua Tipe Tenant

**4 perubahan kartu sekaligus**, saling terkait jadi satu redesain kohesif:
1. **Logo**: lebar `calc(var(--spacing)*17)` — di Tailwind v4 ini setara persis `w-17` (utility
   spacing dinamis, generate otomatis untuk integer berapa pun — bukan arbitrary value manual).
2. **Badge "Kartu Anggota"/"Akun Publik" (top-right) dihapus total** — bukan disembunyikan.
3. **No. Anggota**: `text-sm` (14px) → `text-xl` (20px, exact match Tailwind default scale —
   `text-xl = 1.25rem = 20px`). Baris stambuk (fallback saat member number belum ada) ikut
   diperbesar sama, konsisten satu slot visual.
4. **Baris bawah kartu direstrukturisasi total** — sebelumnya "PC IKPM: {nama cabang}" (kiri) +
   badge "✓ Aktif" (kanan, member-only). Sekarang: **"Nama Anggota: {nama orang}"** (kiri —
   echo nama, pola umum kartu bank yang menampilkan nama pemegang kartu di bagian bawah, mirip
   referensi desain awal) + **badge nama tenant/organisasi** (kanan, GENERIK — bukan hardcode
   asumsi "PC IKPM {cabang}", supaya benar untuk SEMUA tipe tenant: cabang, marhalah, ATAU forum
   seperti "Visikita" — dikonfirmasi eksplisit oleh user sebagai alasan perubahan).

**Konsekuensi struktural**: `primaryCabangNama` dan `orgLabel` — dua props yang SEBELUMNYA jadi
sumber nilai untuk baris "PC IKPM" — sekarang genuinely TIDAK DIPAKAI SAMA SEKALI oleh
`MemberCard` (diganti `name`+`siteName` yang sudah ada). **Dihapus total dari `Props` type**
(bukan dibiarkan sebagai dead prop) — pemanggilan di `akun/page.tsx` disesuaikan. Data-fetching
`primaryCabangNama` (query `ref_ikpm_cabang`) TIDAK dihapus dari `page.tsx` — masih dipakai oleh
blok DESKTOP ("Info keanggotaan" card, baris PC IKPM) yang tidak disentuh sama sekali sesi ini.

**Verifikasi**: `tsc --noEmit` bersih (mengonfirmasi tidak ada pemanggil lain yang masih
mengharap 2 prop yang dihapus) + `bun run build` sukses.

### [2026-07-21] MemberCard Baris Bawah — "Nama Anggota" Ternyata Pengulangan, Diganti Identitas Organisasi

**Koreksi susulan langsung dari user** setelah restrukturisasi bottom-row di atas: baris "Nama
Anggota: {nama}" (echo nama yang SUDAH tampil besar di tengah kartu) dianggap pengulangan —
"karena nama di tengah tetap ada, jadi pengulangan kalau dibawahnya kita kasih nama juga".

**Fix**: baris bawah-kiri diganti teks statis "Ikatan Keluarga" (label kecil, uppercase) /
"Pondok Modern Gontor" (nama lengkap IKPM) — bukan data dinamis apa pun, murni identitas
organisasi payung. Badge nama tenant (kanan, generik, dari lesson sebelumnya) TIDAK berubah.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build` sukses. **Instruksi eksplisit user saat
itu: "jangan push dulu ya"** — perubahan sempat tertahan uncommitted sampai sesi lanjutan
berikutnya (lihat lesson Resolusi Branding di bawah, di mana komit akhirnya dilakukan bersamaan
dengan pekerjaan lanjutan).

### [2026-07-21] Resolusi Branding Kartu Anggota — Bukan Selalu Tenant yang Sedang Dibrowsing

> Arsitektur lengkap: **`docs/arsitektur-akun.md` § "Resolusi Branding Kartu Anggota"**

**Masalah konseptual ditemukan user, bukan bug laporan**: `MemberCard` (fitur sesi sebelumnya)
mengambil logo+nama SELALU dari tenant yang sedang dibrowsing — salah di bawah prinsip "1 ID for
all" platform ini. Contoh eksplisit user: alumnus yang BUKAN "Angkatan 1999 Akhir" (bukan anggota
genuine tenant "Visikita") tidak seharusnya melihat badge "Visikita" hanya karena kebetulan
browsing `visikita.com/akun`. User eksplisit minta proses penuh sebelum eksekusi: baca CLAUDE.md
→ Plan Mode (2 Explore agent riset paralel: skema backbone + infra platform admin) → tulis
dokumentasi arsitektur → baru implementasi.

**Temuan riset kunci yang menjawab pertanyaan terbuka sesi sebelumnya**: `tenant_memberships.
membershipType` (cabang/marhalah/forum) **tidak pernah dipakai sebagai filter WHERE di manapun**
di seluruh codebase (grep menyeluruh, hanya dipakai sebagai VALUE saat INSERT). Jadi "ada baris
`tenant_memberships` untuk (member, tenant)" = genuine member, apapun tipenya — resolusi TIDAK
perlu membedakan tipe membership sama sekali.

**Helper baru `apps/web/lib/resolve-akun-branding.ts`** — `resolveAkunBranding(memberId,
browsedSlug)`, 4 langkah urut: (1) genuine member tenant yang dibrowsing → pakai branding tenant
itu; (2) bukan genuine member → cari cabang resmi via `members.primaryCabangRefId → tenants WHERE
refCabangId=X AND isActive=true`; (3) cabang resmi belum onboard tenant sama sekali → fallback ke
`public.platform_settings` (tabel baru, singleton row, dikelola dari `/platform/settings`); (4)
akun publik (bukan member) — TIDAK lewat helper ini sama sekali, selalu pakai tenant yang
dibrowsing (tidak ada konsep cabang untuk akun publik).

**3 titik pemanggil diperbaiki sekaligus** (bukan cuma `MemberCard` yang dikeluhkan user — 2
titik lain ditemukan kena bug identik saat riset, scope perluasan yang dicatat eksplisit di
plan sebelum eksekusi): `akun/page.tsx`'s `orgMemberLabel` (badge desktop) + `logoUrl`/`siteName`
(`MemberCard` mobile), dan `akun/layout.tsx`'s `memberBadgeLabel` (dipakai BERSAMA sidebar
desktop dan `AkunMobileHeader` mobile — satu query, dua tempat render). **TIDAK disentuh** (sudah
benar sejak awal): `anggota/[id]/page.tsx` (PC IKPM dari `primaryCabangRefId` langsung, Marhalah
& Forum dari `tenant_memberships` lintas SEMUA tenant yang diikuti — independen tenant yang
dibrowsing), dan `membershipInfo.status`/`memberNumber` di `akun/page.tsx` (fakta "status SAYA DI
TENANT INI", semantiknya memang harus scoped ke tenant yang dibrowsing, beda dari branding).

**Infrastruktur platform-level baru** (sebelumnya genuinely tidak ada sama sekali — dikonfirmasi
riset): tabel `public.platform_settings` (migration `0035_platform_settings.sql`, singleton row
`id="default"`, kolom `defaultLogoUrl`+`defaultOrgName`), bucket MinIO baru `platform-assets`
(fungsi baru `platformPublicUrl`/`uploadPlatformFile`/`ensurePlatformBucket` di `lib/minio.ts`,
TERPISAH TOTAL dari fungsi tenant yang ada — `lib/minio.ts` sebelumnya 100% ter-couple ke
`slug` tenant, `tenantBucket(slug) → "tenant-{slug}"`), route upload
`POST /api/platform/settings/upload-logo` (sharp → WebP 480×480, path FIXED `branding/logo.webp`,
selalu overwrite — bukan bagian modul media tenant, tanpa variant system), dan card baru
"Branding Default IKPM" di `/platform/settings` (sebelumnya cuma berisi status env var
RajaOngkir) — form + action `updatePlatformBrandingAction` mengikuti persis pola
`createCabangAction` yang sudah ada (`requirePlatformSession()` → FormData → `db.insert/update`
→ `revalidatePath`).

**Simplifikasi yang disengaja**: tidak ada cascading fallback logo (tenant hasil resolusi ADA
tapi belum upload logo sendiri → TIDAK ikut fallback ke platform default, `MemberCard` sudah
punya fallback badge-huruf untuk `logoUrl=null`). Efek samping menguntungkan: kalau auto-join
`tenant_memberships` pernah gagal untuk cabang yang sebenarnya sudah match, langkah 2 (via
`primaryCabangRefId`) menemukan tenant yang SAMA — self-healing, hasil akhir tetap benar.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (schema baru + barrel
export). `bun run build --filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next`
dibersihkan, sesuai SOP). Migration `0035` dijalankan di lokal (`psql` native,
`postgres://webane@localhost/jalajogja`) — dikonfirmasi baris singleton ter-seed. **Belum
dijalankan di VPS** — wajib sebelum deploy, pola standar project ini. **Verifikasi visual
(upload logo di `/platform/settings`, cek badge `/akun` berubah sesuai skenario "bukan anggota
genuine tenant yang dibrowsing") belum dilakukan** — perlu dicoba user di 3 skenario: member
genuine di tenant sendiri, member browsing tenant lain (bukan cabang/marhalah/forum sendiri),
dan akun publik di tenant manapun (harus tidak berubah dari perilaku sebelumnya).

### [2026-07-21] Image System Phase D3 — Guard Upscale, Cegah Logo/Favicon Dipaksa Jadi Ukuran Konten

> Detail lengkap: **`docs/arsitektur-image.md` § "Phase D3 — Guard Upscale"**

**Laporan user**: upload logo 250×90px di `/settings/general` hasilnya "dipaksa" jadi 1200×630 —
menanyakan apakah ini disengaja. **Jawaban: bukan disengaja, ini bug nyata di pipeline.**

**Root cause**: `fit: "cover"` di Sharp selalu mengisi PENUH kotak target — sumber lebih kecil dari
target = di-upscale (buram) lalu dipotong biar rasio pas. 6 dari 7 variant builder di
`lib/image-processor.ts` (`large`/`medium`/`thumbnail`/`square`/`square-large`/`profile`) TIDAK
punya guard `withoutEnlargement` sama sekali — cuma `original` (modul `akun`) yang punya. Logo
tenant di-upload lewat modul `"general"` yang TIDAK ada di `MODULE_VARIANTS` (isinya cuma
`shop`/`members`/`akun`/`letters`) → jatuh ke `DEFAULT_VARIANTS` (set variant untuk KONTEN artikel,
1.91:1 ala Open Graph — bukan untuk branding rasio bebas). `PATH_PRIORITY` lalu memilih `large`
sebagai URL utama. Favicon (`variants.square`, 400×400) kena kelas bug persis sama.

**Keputusan user (dikonfirmasi eksplisit)**: perbaikan HANYA untuk upload BARU ("abaikan yang
sudah terjadi") — tidak ada backfill/reprocess file lama. Logika yang diminta user, tepat sama
dengan yang diimplementasikan: **sumber cukup besar (≥ target di kedua sisi) → crop seperti biasa;
sumber lebih kecil → jangan dipaksa, lewati variant itu, ambil `original` (convert WebP saja, tanpa
crop) sebagai fallback**.

**Fix — `fitsWithoutUpscale()` baru di `lib/image-processor.ts`**: bandingkan dimensi sumber
(`sharp().metadata()`) terhadap target (`IMAGE_VARIANTS[name]`) SEBELUM generate — kalau sumber
lebih kecil di salah satu sisi, variant di-`.filter()` keluar dari daftar yang digenerate (bukan
error, murni "tidak relevan untuk sumber ini"). `original` selalu digenerate tanpa syarat (tidak
ada di `IMAGE_VARIANTS`, jadi tidak pernah kena filter — jaminan tidak ada kasus "semua variant
kosong"). `withoutEnlargement: true` ditambah ke SEMUA resize call sebagai defense-in-depth
(jaga-jaga metadata width/height gagal terbaca — `0 >= target` otomatis `false` = aman, bukan
mekanisme utama).

**2 route upload disesuaikan** (`/api/media/upload` DAN `/api/akun/media/upload` — dicek proaktif,
pola sama persis di keduanya sejak awal): `if (!output) throw new Error(...)` di dalam
`Promise.all` HARUS diubah jadi `if (!output) return;` — sebelumnya variant kosong = SELALU
dianggap gagal (throw → rollback seluruh upload), sekarang variant kosong bisa juga berarti
"sengaja dilewati", bukan error.

**Kenapa aman tanpa sentuh consumer manapun**: konsumen variant di seluruh app SUDAH pakai pola
fallback-chain (`variants.large ?? variants.original ?? media.url`, `resolveMediaUrl()`, dst —
verifikasi: `ProductImageViewer.getFullUrl()` sudah `variants["square-large"] ?? img.url`) — variant
yang hilang dari JSONB otomatis membuat fallback jatuh ke variant lebih kecil yang tersedia, ujungnya
ke `original`. Nol perubahan di sisi consumer.

**Sengaja TIDAK disentuh**: `processVariant()` (dipakai `POST /api/media/[id]/recrop`, manual crop
admin) — itu tindakan eksplisit admin menggambar crop box sendiri, beda konteks dari auto-generate
saat upload; di luar scope permintaan user kali ini.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev server
dimatikan dulu, `.next` dibersihkan). Tidak ada migrasi DB. Belum diverifikasi visual (upload logo
kecil sungguhan lalu cek `logo_url` yang tersimpan) — keterbatasan environment sesi ini, perlu
dicoba user.

### [2026-07-21] Resolusi Warna Kartu Anggota — Perluasan `resolveAkunBranding()`

> Detail lengkap: **`docs/arsitektur-akun.md` § "Resolusi Warna Kartu Anggota"**

**Pertanyaan user, langsung membuktikan resolusi branding logo/nama sebelumnya belum lengkap**:
warna `MemberCard` harus ikut aturan resolusi yang SAMA — genuine anggota tenant dibrowsing →
warna tenant itu; bukan genuine anggota → warna cabang sendiri (kalau onboard) atau warna default
IKPM platform (kalau belum). User juga langsung sadar sendiri: "warnanya blm ada di pengaturan
branding ikpm di platform" — gap yang sama persis ditemukan tanpa perlu saya jelaskan dulu.

**Root cause sebelum fix**: `MemberCard` pakai `bg-primary`/`text-primary-foreground` — dua class
Tailwind yang resolve ke CSS var `--primary`/`--primary-foreground` yang di-inject PAGE-WIDE oleh
`PublicLayout` untuk tenant yang SEDANG DIBROWSING (`buildTenantThemeCss()`, `.public-layout`
scope). Jadi meski logo+nama sudah benar hasil resolusi (fix sesi sebelumnya), warna kartu tetap
"nyasar" ikut tenant yang dibrowsing — inkonsisten dengan logo/nama yang ditampilkan.

**Fix — CSS custom property di-override LOKAL di root `MemberCard`** (BUKAN reimplementasi warna
manual per-elemen):
```tsx
const cardVars = { "--primary": color, "--primary-foreground": foregroundFor(color) } as CSSProperties;
<div className="... bg-primary text-primary-foreground ..." style={cardVars}>
```
CSS var yang di-set via inline `style` pada sebuah elemen cascade ke SEMUA children dan MENANG
atas nilai `.public-layout` di ancestor lebih atas (resolve dari deklarasi terdekat) — jadi
SELURUH JSX kartu yang sudah pakai `bg-primary`/`text-primary-foreground`/`bg-primary-foreground/
15`/dst otomatis ikut warna lokal, TANPA ubah satu class pun di isi kartu. `foregroundFor()`
(`lib/theme-palette.ts`, sudah di-export sejak lesson lama, WCAG contrast hitam/putih) dipakai
ulang — bukan fungsi baru.

**`resolveAkunBranding()` diperluas** — return type tambah `primaryColor`. Setiap langkah resolusi
fetch warna dari TENANT YANG SAMA dengan logo/nama-nya (helper lokal `getTenantPrimaryColor()` →
`getSettings(createTenantDb(slug), "display").primary_color`, default `#2563eb`) — **prinsip
kunci: logo, nama, DAN warna tidak pernah campur dari tenant berbeda**. Kolom baru
`platform_settings.default_color` (migration `0036`, default `#2563eb` — sama dengan default
warna tenant baru di `/settings/display`, konsisten) untuk fallback platform. Akun publik (di
luar `resolveAkunBranding`, tidak punya konsep cabang) fetch warna tenant dibrowsing langsung.

**`/platform/settings`** — card "Branding Default IKPM" ditambah color picker (pola sama
`display-settings-form.tsx`: `type="color"` + hex text input). `updatePlatformBrandingAction`
validasi format hex (`^#[0-9a-fA-F]{6}$`), fallback ke `#2563eb` kalau tidak valid (bukan reject
form).

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build` sukses
(dev server dimatikan dulu, `.next` dibersihkan). Migration `0036` dijalankan di lokal, kolom
`default_color` terkonfirmasi ada dengan nilai `#2563eb`. **Belum dijalankan di VPS. Belum
diverifikasi visual** (belum coba browsing sebagai member lintas-tenant untuk lihat warna kartu
berubah sesuai skenario) — perlu dicoba user.

### [2026-07-21] Arsitektur SEO Menyeluruh — Audit 3 Kelas Halaman + Fase 1 (Dokumen) Selesai

> Arsitektur lengkap: **`docs/arsitektur-seo.md`** (ditulis ulang total — sebelumnya cuma catatan
> bug lama, sekarang jadi peta lengkap cakupan SEO seluruh aplikasi)

**Permintaan user**: audit menyeluruh — cari halaman yang belum punya custom SEO (title/
description hardcode), rancang arsitektur dulu SEBELUM eksekusi, dengan pembedaan eksplisit:
konten yang sudah punya form create/edit (post/produk/campaign/kategori) → SEO field di tempat
itu juga; halaman tanpa konteks (login, registrasi) → pengaturan SEO terpisah di admin.

**Riset via 2 Explore agent paralel** (audit `generateMetadata` di semua `page.tsx` publik +
audit `SeoPanel`/kolom SEO skema DB) menemukan struktur 3 kelas halaman:
- **Kelas A** (konten bertabel, form sudah ada) — 5 tabel SUDAH lengkap: `posts`, `pages`,
  `products`, `events`, `campaigns` (11 kolom SEO + `<SeoPanel>` di form masing-masing). **Gap**:
  modul Dokumen (`documents`) — NOL kolom SEO, `dokumen-form.tsx` nol baris kode SEO, halaman
  publik `dokumen/view/[id]/page.tsx` bahkan TIDAK PUNYA `generateMetadata` sama sekali meski
  publik by design (`visibility="public"`).
- **Kelas B** (taksonomi/kategori) — 6 tabel (`post_categories`, `post_tags`,
  `product_categories`, `event_categories`, `campaign_categories`, `document_categories`) NOL
  kolom SEO sama sekali. Post/Event/Campaign/Dokumen filter kategori via QUERY PARAM di halaman
  arsip yang SAMA (bukan rute terpisah) — hanya Produk yang punya rute kategori sendiri
  (`/produk/kategori/[slug]`).
- **Kelas C** (halaman statis tanpa "rumah") — 11 halaman arsip dengan title HARDCODE
  ("Berita & Artikel", "Direktori Anggota", dst) + **30 halaman TANPA `generateMetadata` sama
  sekali** (login, register, forgot-password, checkout, keranjang, invoice, seluruh `akun/*`,
  invite, sign, verify) — semua warisan title generik `{siteName}` dari `layout.tsx`, tanpa
  description apa pun.

**Prinsip inti yang dikunci**: field SEO hidup DI TEMPAT admin sudah edit kontennya (Kelas A/B) —
JANGAN bikin halaman "Custom SEO" terpisah untuk konten yang sudah punya form sendiri, itu
duplikasi UX. Halaman pengaturan SEO terpisah (tabel baru `seo_page_overrides` + admin page baru
`/app/{slug}/settings/seo`, direncanakan Fase 3) HANYA untuk halaman yang genuinely tidak punya
baris DB pemilik.

**3 keputusan dikonfirmasi user** (via `AskUserQuestion`): (1) eksekusi berurutan Fase 1→2→3,
verifikasi tiap fase; (2) entitas milik-anggota (`member_businesses`/`member_owned_pesantren`/
`member_professionals`, self-service `/akun/usaha` dst) **dibiarkan tanpa SeoPanel** — form
dipakai anggota non-teknis, SeoPanel 3-tab akan membingungkan, tidak sepadan manfaatnya untuk
konten self-reported; (3) `invoice/[id]` dapat `robots: noindex` sebagai perbaikan kecil
terpisah (bukan bagian sistem override).

**Fase 1 (Dokumen) — SELESAI**: 11 kolom SEO ditambah ke `documents` (schema + DDL + migration
`0037_documents_seo_columns.sql`, pola persis disalin dari `events.ts` — termasuk FK
`og_image_id → media(id) ON DELETE SET NULL`, CHECK constraint `twitter_card`/`robots`). `"document"`
ditambah ke union `contentType` SeoPanel + `SCHEMA_ORG_TYPES.document = ["WebPage",
"DigitalDocument"]`. `<SeoPanel contentType="document">` dipasang di `dokumen-form.tsx` (posisi:
akhir kolom Main, setelah `MediaPicker`, sebelum Sidebar — pola sama campaign/event). `actions.ts`
(`createDocumentAction`/`updateDocumentAction`) + kedua `page.tsx` (new/edit) diupdate meneruskan
field SEO, pola identik `campaign-form.tsx`'s `buildData()` (flat fields, bukan nested `seo:{}`
saat dikirim ke server action). `dokumen/view/[id]/page.tsx` dapat `generateMetadata` BARU dari
nol (sebelumnya nihil) — resolve `ogImageId → media` (fallback `base.logoUrl` kalau kosong),
guard `doc.visibility !== "public" → return {}` (dokumen internal tidak pernah bocorkan metadata).

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build` sukses (dev server
dimatikan dulu, `.next` dibersihkan). Migration `0037` dijalankan di lokal, 11 kolom + FK + 2
CHECK constraint dikonfirmasi via `\d`. **Belum dijalankan di VPS.**

### [2026-07-21] Fase 2 SEO — 6 Tabel Taksonomi + 2 Penyesuaian Ditemukan Saat Eksekusi

> Detail lengkap: **`docs/arsitektur-seo.md` § 3.2**

**Riset dulu (1 Explore agent)** — petakan lokasi PERSIS form CRUD + action untuk 6 tabel
(`post_categories`, `post_tags`, `product_categories`, `event_categories`,
`campaign_categories`, `document_categories`) sebelum eksekusi, sesuai pola project ini. Semua 6
tabel ditambah 2 kolom RINGAN (`meta_title`, `meta_desc` — bukan 11-field penuh seperti Kelas A,
sesuai keputusan arsitektur: kategori bukan konten utuh, `SeoPanel` 3-tab overkill untuk form
inline kecil) — schema + DDL + migration `0038_taxonomy_seo_columns.sql` (satu file, `DO $$` loop
ganda: per-tenant × per-tabel via `FOREACH tbl IN ARRAY[...]`).

**2 temuan yang mengubah rencana SAAT eksekusi (bukan diasumsikan sejak awal)**:
1. **`/post` arsip TIDAK PUNYA filter kategori/tag via query param sama sekali** — beda dari
   asumsi awal (dikira semua 4 modul archive sudah filter `?category=`/`?tag=` seperti
   agenda/campaign/dokumen). `post/page.tsx` ternyata cuma list flat 50 post tanpa
   `searchParams` apa pun — bahkan tanpa `PostCard`/`PostsSection` component pattern yang
   didokumentasikan CLAUDE.md untuk modul post lain (kemungkinan implementasi lama yang belum
   di-upgrade). Ini GAP FITUR (bukan SEO), di luar scope — kolom `metaTitle`/`metaDesc` di
   `post_categories`/`post_tags` tetap ditambahkan (siap dipakai nanti), tapi
   `post/page.tsx`'s `generateMetadata` TIDAK disentuh (tidak ada konteks kategori aktif untuk
   dibaca sama sekali).
2. **`product_categories` tidak punya `updateProductCategoryAction`** — modul toko sejak awal
   cuma bisa CREATE kategori, nol UI edit/delete. Field SEO ditambahkan HANYA ke form "Tambah
   Kategori" — TIDAK membangun kapabilitas edit dari nol (gap pre-existing di luar scope SEO).

**4 pola konsumen berbeda ditemukan** (bukan semua 5 halaman arsip seragam):
- Agenda/Campaign/Dokumen — filter via query param DI HALAMAN ARSIP YANG SAMA (bukan rute
  terpisah) → `generateMetadata` ditambah parameter `searchParams` (sebelumnya SEMUA 4 file
  cuma terima `{ params }`, meski default export-nya SUDAH terima `searchParams` — ketidak-
  sesuaian yang tidak disadari sebelum riset).
- Produk — SATU-SATUNYA yang punya rute terpisah `/produk/kategori/[slug]` — title-nya
  SEBELUMNYA sudah dinamis (nama kategori dari DB) tapi FORMAT-nya hardcode; sekarang override
  `metaTitle`/`metaDesc` kalau admin isi, fallback ke format lama kalau tidak.
- Dokumen — kuirk tambahan: filter `?category=` di sini pakai ID kategori, bukan slug (beda
  dari 3 modul lain) — konsisten dengan kuirk yang sudah didokumentasikan di
  `lib/public-url-registry.ts`. Sekalian di-upgrade dari `{title}` polos (tanpa `buildMetadata`,
  tanpa description/OG/canonical sama sekali) ke `buildMetadata()` penuh seperti 3 modul lain.

**Verifikasi**: `tsc --noEmit` bersih di kedua package (12+ file diubah dalam satu batch, nol
error) + `bun run build --filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next`
dibersihkan). Migration `0038` dijalankan di lokal, 6 tabel × 2 kolom dikonfirmasi via query
`information_schema.columns`. **Belum dijalankan di VPS.**

### [2026-07-21] Fase 3 SEO — Tabel `seo_page_overrides` + Halaman Admin Baru, 16 `generateMetadata` Diupdate

> Detail lengkap: **`docs/arsitektur-seo.md` § 3.3 dan § 4**

Fase terakhir dari roadmap SEO (§ 3.3, Prinsip C) — halaman publik yang TIDAK PUNYA "rumah" tabel
(login, register, 10 arsip statis) sekarang bisa dikustomisasi admin lewat SATU halaman baru
`/app/{slug}/settings/seo`, bukan 16 tempat terpisah.

**Tabel baru `seo_page_overrides`** (tenant-scoped, `packages/db/src/schema/tenant/seo.ts`) —
6 field editable (`metaTitle`, `metaDesc`, `ogTitle`, `ogDescription`, `ogImageId`, `robots`),
`pageKey TEXT UNIQUE` sebagai identifier stabil — BUKAN URL (URL berubah tergantung custom
domain/path mode). Migration `0039_seo_page_overrides.sql` — pola `CREATE TABLE` per-tenant sama
seperti `0034_vouchers.sql`. Daftar `pageKey` (16 total) hidup di kode
(`lib/seo-page-keys.ts`, client-safe zero-dependency) — pola yang sama dengan
`STATIC_TOP_SEGMENTS` di `lib/mobile-route-checks.ts` (daftar tetap, bukan tabel DB terpisah).

**`lib/get-page-seo-override.ts`** (server-only) — satu fungsi dipanggil dari SEMUA 16
`generateMetadata`, resolve `ogImageId → ogImageUrl` via `resolveMediaUrl()` (pola persis
`dokumen/view/[id]/page.tsx` dari Fase 1). Return `null` kalau belum ada override — caller SELALU
fallback ke title hardcode lama, default TIDAK PERNAH dihapus.

**Halaman admin `/app/{slug}/settings/seo`** — pola disalin dari `RolesManageClient`/`RoleDialog`
(list + dialog, `key={editingEntry.key}` supaya form reset total saat ganti target — bug lama
"dialog tidak reset state" sudah pernah dikunci sebagai lesson, langsung dihindari di sini).
Field OG Image pakai `<MediaPicker>` dengan mini-preview+tombol ganti, disalin dari pola yang
sama persis di `seo-panel.tsx`. Field robots pakai `<Combobox>` generik (BUKAN `<select>` polos —
aturan UI Standards project ini: semua dropdown wajib Combobox).

**2 temuan saat eksekusi:**
1. **`/produk` arsip TERNYATA juga filter `?category=`** (selain rute terpisah `/produk/kategori/
   [slug]` yang sudah ditangani Fase 2) — kelewat saat riset Fase 2 karena signature
   `generateMetadata`-nya cuma `{ params }` (tidak `searchParams`), beda dari default export-nya
   yang justru MENERIMA `searchParams` — grep berbasis signature `generateMetadata` saja tidak
   cukup untuk menyimpulkan "halaman ini tidak filter kategori". Ditutup sekalian di sini,
   memakai `product_categories.metaTitle`/`metaDesc` yang sudah ada dari Fase 2.
2. **`forgot-password/page.tsx` dan `reset-password/page.tsx` adalah Client Component MURNI**
   (`"use client"` baris pertama) — Next.js menolak `generateMetadata` di-export dari file yang
   ditandai `"use client"` (build error eksplisit, bukan silent). Fix: ekstrak SELURUH logic form
   ke file client baru (`forgot-password-form.tsx`, `reset-password-form.tsx` — terima `slug`
   sebagai prop biasa, ganti `use(params)` yang sebelumnya dipakai untuk unwrap Promise params di
   client component), `page.tsx` ditulis ulang jadi Server Component tipis: `generateMetadata` +
   `await params` + render komponen client. **Perilaku form 100% tidak berubah** — refactor murni
   pemindahan lokasi kode, bukan perubahan logic.

**Layering fallback untuk 3 halaman arsip berkategori (agenda/campaign/dokumen/produk)**:
kategori aktif (`?category=`) dengan `metaTitle`/`metaDesc` terisi → menang untuk title+desc;
`ogTitle`/`ogDescription`/`ogImageUrl`/`robots` SELALU dari override page-wide (Fase 3) — kategori
Fase 2 sengaja tidak punya field OG/robots sendiri (2-field ringan, bukan duplikasi form 6-field).
Kalau tidak ada filter kategori aktif, ATAU kategori tidak ditemukan → seluruhnya jatuh ke
override page-wide, lalu ke title hardcode lama sebagai fallback terakhir.

**`invoice/[id]`** — perbaikan kecil terpisah dari sistem override (sesuai § 3.4, dikunci di § 5
sejak audit awal): `generateMetadata` baru HANYA berisi `robots: { index: false, follow: false }`
hardcode, tanpa query DB apa pun — data transaksi privat per-invoice, cukup dicegah ter-index,
tidak butuh title/desc custom.

**Verifikasi**: `tsc --noEmit` bersih di kedua package (dicek bertahap per kelompok file — 10
archive pages, lalu 6 Grup 1 pages, lalu keseluruhan) + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan), `/app/[tenant]/settings/seo` terkonfirmasi
muncul di build output. Migration `0039` dijalankan di lokal, tabel+kolom+FK+CHECK constraint
dikonfirmasi via `\d`. **Belum dijalankan di VPS.** Belum diverifikasi visual di browser (isi
dialog form, upload OG image, lihat hasil di `<head>` halaman publik) — user perlu coba langsung.

**Seluruh roadmap SEO (docs/arsitektur-seo.md) sekarang 100% selesai dari sisi kode — Fase 1, 2,
3, dan perbaikan `invoice/[id]` noindex.** Migration `0037`+`0038`+`0039` sudah dijalankan di VPS
dan kode sudah live — **DEPLOY SELESAI 2026-07-21**, dikonfirmasi via build sukses + log bersih +
`curl` 200 OK setelah sempat gagal build pertama (lihat catatan "Gotcha Deploy" di bawah).

### [2026-07-21] Gotcha Deploy: Build Gagal Diam-Diam Karena Command Menyatu di Terminal

Saat deploy Fase 1-3 SEO ke VPS, `bun run build --filter=@jalajogja/web` dan `pm2 restart
jalajogja --update-env` sempat ter-paste/tereksekusi menyatu di satu baris terminal tanpa jeda —
build tidak sempat selesai (atau outputnya tidak sempat tertangkap), tapi `pm2 restart` tetap
jalan terhadap `.next/` yang lama/tidak lengkap. Gejala: `pm2 logs` menunjukkan `Cannot find
module '.next/server/middleware-manifest.json'` + restart counter (`↺`) sudah di angka ratusan
(crash-loop). **Diagnosa yang benar**: jalankan `bun run build` SENDIRIAN dulu, tunggu sampai
muncul `Tasks: 1 successful, 1 total`, verifikasi `ls -la apps/web/.next/server/middleware-
manifest.json` benar-benar ada dengan timestamp baru, BARU `pm2 restart`. Setelah itu cek stabil
via `pm2 flush` (bersihkan log lama) → `pm2 logs` (harus kosong di percobaan berikutnya) →
`pm2 list` (restart counter tidak naik lagi) → `curl -I http://localhost:3000` (200 OK).

**Aturan untuk instruksi deploy ke depan**: SELALU minta user jalankan command build TERPISAH
dari command restart (jangan gabung di satu balasan/blok tanpa penekanan "tunggu sampai selesai
dulu") — dan SELALU sertakan langkah verifikasi (`ls` file target build, `pm2 list` restart
counter stabil, `curl` response) sebagai bagian dari instruksi, bukan cuma "jalankan lalu restart".
Restart counter yang sudah tinggi (ratusan) BUKAN indikasi masalah BARU — itu bisa jadi akumulasi
lama; yang penting dicek adalah apakah angka itu **naik lagi** setelah restart terbaru.

### [2026-07-22] Section CTA — 4 Axis Sub-Opsi + Tombol Kedua, Tetap "Design 1" Tunggal

> Detail lengkap: **`docs/arsitektur-cta-section.md`**

Permintaan user (dengan referensi gambar `design-refs/sections/cta/cta-design-2.jpg`): perkaya
section CTA landing page dengan opsi align teks (kiri/tengah/kanan), background (sekunder/
primary), lebar (full/boxed + radius toggle), dan posisi tombol (bawah/samping teks) — TAPI
eksplisit semua tetap masuk **"Design 1"**, BUKAN jadi Design 2 terpisah seperti pola Hero/Modules.
Alasan user: opsi-opsi ini kombinasi tampilan dalam satu layout, bukan struktur JSX berbeda total.

**Riset dulu (bukan asumsi)**: sebelum tulis kode, dibaca penuh implementasi CTA existing
(`landing-template.tsx`) — ternyata CTA SATU-SATUNYA title di seluruh sistem section yang size-nya
lewat inline `style={{fontSize: "clamp(...)"}}` (bukan Tailwind class), dan CTA belum pernah punya
`CtaSectionData` type khusus (anonymous inline type, drift-prone). Juga dikonfirmasi: `CtaEditor`
tidak pernah dapat `variant`/`onVariantChange` — tidak ada picker "Design Layout" untuk CTA sejak
awal (beda dari Hero/Posts/Modules).

**Sebelum eksekusi, 1 titik ambigu ditanyakan via `AskUserQuestion`** (bukan diasumsikan): apakah
"tombol kedua" (disebut user sebagai "shadow button") HANYA muncul saat `background=primary`
(bacaan literal instruksi), atau selalu tersedia di editor apapun kombinasi axis lain. User pilih
**selalu tersedia** — field `ctaSecondaryLabel`/`ctaSecondaryUrl` selalu ada di editor (kosong =
tidak dirender), pola sama dengan "Tombol Kedua (opsional)" yang sudah ada di Hero editor.

**Variant `PublicButton` baru: `outline-light`** — border+teks pakai `color: inherit` +
`border-color: currentColor` (BUKAN CSS var tetap seperti `outline-primary`/`outline-dark` yang
sudah ada, keduanya salah kalau dipakai di atas bg berwarna arbitrary karena hover-nya fill-flip
ke warna CSS var tetap). `currentColor` mewarisi `text-secondary-foreground`/`text-primary-
foreground` dari section pembungkus — otomatis benar untuk warna tenant apa pun (termasuk tenant
dengan warna terang yang `foregroundFor()` hasilkan teks gelap, bukan cuma asumsi "selalu putih").
Icon default `arrow-up` (`ArrowUpRight`, ↗) — cocok dengan "Learn More ↗" di referensi gambar.
Ditambahkan sebagai variant KE-9, nol perubahan ke 8 variant existing. Ditemukan sekalian saat
baca `cn()` composition logic di `public-button.tsx`: special-case `outline-primary`/`outline-dark`
di situ TERNYATA redundan (`btn-${variant}` generic fallback menghasilkan string identik) — jadi
`outline-light` baru tidak butuh special-case tambahan, otomatis jatuh ke fallback yang sudah ada.

**Judul CTA disamakan persis dengan Hero Design 1**: `text-3xl sm:text-4xl md:text-5xl xl:text-6xl
font-bold leading-[1.1] tracking-tight` — mengganti inline `clamp(48px,6vw,88px)`+`font-normal`
lama. `renderAccentTitle()` (sintaks `*teks*`) tidak berubah.

**Layout "boxed" vs "full"**: `full` (default) — `<section>` sendiri yang punya `bgClass` +
`overflow-hidden`, full-bleed edge-to-edge persis perilaku lama. `boxed` — `<section>` luar
transparan (ikut bg halaman) + padding, box di dalamnya (`max-w-7xl mx-auto`) yang punya bgClass +
optional `rounded-3xl`. Radial gradient overlay dan `content` (title/subtitle/tombol) di-share
lewat 1 variable JSX dipakai kedua cabang — bukan diduplikasi, karena benar-benar identik antara
boxed/full (cuma wrapper luar yang beda), berbeda dari pola "duplikasi demi isolasi" yang biasa
dipakai project ini untuk hal yang BOLEH divergen ke depan.

**Layout "beside" (posisi tombol di samping teks)**: `flex md:flex-row md:items-center
md:justify-between gap-8` — teks kolom kiri (`flex-1 min-w-0`), tombol kolom kanan (`shrink-0`).
`textAlign` di mode ini HANYA pengaruhi align teks di kolom teksnya sendiri — TIDAK menggeser
posisi kolom tombol (didokumentasikan eksplisit sebagai keputusan, bukan celah tak terpikirkan).

**Data shape baru** (`lib/cta-section-designs.ts`, type `CtaSectionData` — menutup gap "CTA tidak
pernah punya type khusus" sekalian): 5 field baru (`ctaSecondaryLabel`, `ctaSecondaryUrl`,
`textAlign`, `background`, `width`, `boxedRadius`, `buttonPosition` — total 7) semuanya opsional
dengan fallback `?? "<default>"` di titik baca (render DAN editor) — section CTA existing manapun
(data lama tanpa field-field ini) otomatis resolve ke tampilan PERSIS sebelum perubahan ini, **nol
migrasi data**, konsisten pola yang sudah berkali-kali dipakai project ini untuk field baru non-
breaking (funfactStyle, showModuleStrip, dst).

**Editor**: helper lokal baru `OptionRow<T>` (button-row kompak 2-3 pilihan, BEDA dari picker
"Design Layout" yang list-vertikal-dengan-deskripsi di Hero/Posts/Modules — axis CTA cuma toggle
singkat, bukan alternatif layout penuh) dipakai 4× dalam `CtaEditor`. Toggle `boxedRadius`
kondisional — cuma dirender saat `width==="boxed"` (tidak relevan untuk full-bleed).

**Verifikasi**: `tsc --noEmit` bersih di kedua package + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB — murni data JSON di
kolom `pages.body` yang sudah ada. Belum diverifikasi visual di browser — user perlu cek kombinasi
axis di `/app/{slug}/website/pengaturan` setelah deploy.

### [2026-07-22] Section Keunggulan/Layanan — 5 Axis + Icon Picker Baru dari Nol

> Detail lengkap: **`docs/arsitektur-keunggulan-section.md`**

Lanjutan langsung dari CTA (sesi yang sama) — user tegaskan ulang prinsip umum sebelum mulai:
"semua sections di landingpage terdiri dari sections, yang mana masing-masing section memiliki
design bermacam-macam" — prolog yang berlaku untuk SEMUA section landing page ke depan, dicatat
di `docs/arsitektur-keunggulan-section.md` § 1 supaya tidak diulang tiap sesi baru. Tetap Design 1
tunggal (pola sama CTA), bukan Design 2 terpisah.

**Field icon sebelumnya `<Input>` teks bebas** (admin ketik emoji manual, mis. `⭐`) — diganti
total jadi `<IconPicker>` (komponen baru, generik, `components/ui/icon-picker.tsx`), searchable
grid dari katalog kurasi `lib/icon-catalog.ts`. **1 pertanyaan blocking ditanyakan via
`AskUserQuestion`** sebelum eksekusi: kurasi ~100-150 icon relevan vs expose seluruh
`lucide-react` (~1700+). User pilih kurasi — alasan: mayoritas icon full library tidak relevan
konteks bisnis/layanan (bahasa pemrograman, medis spesifik, dll), dan search UI jadi berat/
berisik kalau semua di-expose.

**Bug dicegah SEBELUM ditulis, bukan ditemukan setelah build gagal**: sebelum menulis katalog
~120 icon dari memori/asumsi nama, SETIAP nama diverifikasi dulu terhadap `.d.ts` package yang
BENAR-BENAR terinstall (`lucide-react@1.8.0`) — ternyata banyak nama icon populer di versi lama
yang saya kira masih ada TERNYATA sudah di-rename di versi ini: `CheckCircle2`→`CircleCheck`,
`BarChart3`→`ChartBar`, `HelpCircle` tidak ada penggantinya persis, `Filter`→`ListFilter`,
`PieChart`→`ChartPie`, `LineChart`→`ChartLine`, `Fingerprint`→`FingerprintPattern`. Verifikasi:
dump SELURUH ~1698 nama export dari `node_modules/.../lucide-react/dist/lucide-react.d.ts` ke
satu file referensi (`grep -oE "^declare const [A-Za-z0-9]+:"`), baru pilih icon DARI daftar itu
— bukan menebak lalu menunggu `tsc` menangkap typo satu-satu. **Aturan untuk penambahan icon
baru ke katalog ke depan**: SELALU verifikasi dulu dengan cara yang sama — jangan asumsikan nama
icon dari familiaritas versi lain/project lain.

**UI grid, bukan list vertikal**: `Command`/`CommandGroup` (shadcn/cmdk) secara default merender
list vertikal — dipaksa jadi grid 7 kolom per kategori via Tailwind arbitrary selector
`[&_[cmdk-group-items]]:grid` pada `className` `CommandGroup` (cmdk merender wrapper internal
`[cmdk-group-items]` yang tidak bisa ditarget langsung lewat prop biasa, cuma lewat selector
turunan — pola yang SUDAH dipakai `CommandDialog` di file yang sama untuk override cmdk internal
lain, jadi bukan hack baru, cuma diperluas). **Search dua lapis**: `CommandItem value={name +
" " + keywords}` — `keywords` adalah sinonim Bahasa Indonesia per icon (`DollarSign` → "uang mata
uang dolar rupiah") supaya admin non-teknis bisa ketik "uang" dan tetap ketemu icon relevan,
bukan cuma nama Inggris literal. `onSelect` pakai closure (bukan parameter balik cmdk) — pola
yang SAMA PERSIS dengan lesson lama "Combobox generik cari berdasar UUID" (value cmdk untuk
search, resolusi via closure) — ditegakkan ulang karena file BARU, bug lama gampang terulang
kalau lupa polanya.

**Resolusi render `resolveIcon(name)`**: nama tak dikenal (termasuk EMOJI LAMA dari data
pre-existing) fallback ke `DEFAULT_ICON_NAME="CircleCheck"` — TIDAK crash, TIDAK kosong, cuma
diam-diam ganti jadi icon default. Ini SATU-SATUNYA titik non-backward-compat di seluruh
perubahan — didokumentasikan eksplisit sebagai trade-off yang diterima (emoji dan nama-icon-
string secara struktural tidak bisa dipetakan otomatis), BUKAN kelupaan.

**5 axis lain** (title block 3-field opsional + align + posisi desc below/beside, background
4-pilihan, lebar full/boxed, gaya icon plain/colored+warna+bentuk, gaya kartu radius+background+
highlight-item-pertama) — semua default dipilih untuk **PERSIS mereplikasi tampilan lama**
(backward compat penuh kecuali icon): `titleAlign:"center"` (dulu hardcode center),
`background:"light"` (dulu `bg-muted/40` hardcode), `iconStyle:"plain"` (dulu bare emoji tanpa
container), `cardRadius:true`+`cardBackground:"white"` (dulu `rounded-xl border bg-white`
hardcode). Section existing manapun (data lama tanpa field-field baru ini) resolve ke tampilan
SAMA PERSIS via `?? "<default>"` — nol migrasi data.

**`OptionRow` (dibuat untuk CTA) di-reuse langsung** tanpa modifikasi — generik `<T extends
string>`, bukti nyata manfaat menulis helper generik sejak awal alih-alih duplikasi per section.

**Verifikasi**: `tsc --noEmit` bersih (termasuk verifikasi ~120 import icon-catalog.ts nol typo
sejak percobaan pertama, berkat verifikasi nama di muka) + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Belum diverifikasi
visual di browser — user perlu cek kombinasi axis DAN icon picker (search, grid, seleksi) di
section builder setelah deploy.

### [2026-07-22] Section Tentang Kami — Standar Background Baru + Kolom 50/50 + Tombol Baru

> Detail lengkap: **`docs/arsitektur-tentang-kami-section.md`**

Lanjutan langsung dari Keunggulan/Layanan (sesi yang sama). Berbeda dari CTA/Features (yang
defaultnya 100% preservasi tampilan lama), section ini punya perubahan visual DISENGAJA untuk
data existing — konsekuensi langsung dari instruksi eksplisit "kolom: SELALU 2 kolom 50/50" (kata
"selalu" = bukan opsi, struktur tetap) — beda dari implementasi lama yang `flex-1` (teks) +
`md:w-80` (gambar fix 320px), TIDAK PERNAH 50/50. Section existing otomatis pindah ke grid 50/50
baru begitu deploy — didokumentasikan eksplisit sebagai perubahan disengaja (§ 4 dokumen), bukan
kelalaian backward-compat seperti pola CTA/Features sebelumnya.

**Standar background baru 5-opsi** (`none`/`light`/`primary`/`secondary`/`dark`,
`lib/section-background.ts`) — user eksplisit menyatakan "selalu seperti ini untuk background
kedepannya" (jadi standar section BARU). **Ditanya via `AskUserQuestion` apakah retrofit ke
CTA/Features sekarang juga** — user pilih TIDAK, biarkan keduanya seperti sekarang (baru saja
selesai, tidak perlu ditambah risiko). Helper `resolveSectionBgClass()` +
`resolveOutlineButtonVariant()` dirancang REUSABLE — section berikutnya yang butuh background
standar tinggal impor, bukan redefinisi ulang tiap kali (persis pola `OptionRow` yang sudah
terbukti manfaatnya di Keunggulan/Layanan).

**Koreksi user di tengah diskusi — pelajaran tentang jangan asumsi istilah teknis**: rencana awal
saya mengusulkan opsi rasio gambar "square" dan "4:3", plus (sebagai opsi B yang saya rekomendasikan
TIDAK) kemungkinan menambah variant pemrosesan gambar baru. User koreksi: **"ukuran profile
maksudnya bro .. jgn bikin varian baru.. kayanya kita ada ukuran profil foto apa tidak ada varian
yg sedikit panjang kebawah bro?"** — ternyata yang dimaksud BUKAN "4:3" (rasio landscape) tapi
**"profile"** (rasio POTRET 3:4, "panjang ke bawah") — variant yang SUDAH ADA di `lib/image-
processor.ts` (300×400, dipakai foto profil anggota) sejak lama. Verifikasi cepat konfirmasi:
`profile: {width:300, height:400}` — 3:4, persis. **Solusi final: CSS-only** — `imageRatio:
"square"|"profile"` cuma menentukan class `aspect-square`/`aspect-[3/4]` di tampilan + `object-
cover`, sumber gambar TETAP `variants.large`/`variants.medium` seperti sebelumnya (modul `website`
yang dipakai `MediaPicker` di sini bahkan tidak generate variant `profile` secara fisik — tidak
masalah, karena CSS `object-cover` yang melakukan crop visual, bukan file yang harus sudah
berbentuk pas). **Nol perubahan ke `lib/image-processor.ts`** — tepat sesuai "jangan bikin varian
baru". Pelajaran: kalau user menyebut istilah yang terdengar generik ("4:3") tapi konteksnya
(project sudah punya sistem image variant established) menunjukkan kemungkinan mereka merujuk ke
KONSEP YANG SUDAH ADA dengan nama berbeda, cek dulu istilah yang sudah dipakai di codebase
sebelum mengusulkan solusi baru — di sini untungnya user sendiri yang mengoreksi sebelum eksekusi,
tapi idealnya saya yang harus curiga duluan ("app ini sudah punya sistem variant gambar mapan,
mungkin '4:3' yang dimaksud user sebenarnya salah satu variant yang sudah ada").

**Tombol baru** (section ini sebelumnya TIDAK PUNYA tombol sama sekali) — `<PublicLinkPicker>`
di editor (pola sama CTA/Hero), render `<PublicButton variant={resolveOutlineButtonVariant(
background)}>` — variant OTOMATIS kontras: `outline-light` (dari sistem CTA, border `currentColor`)
kalau background berwarna, `outline-dark` kalau netral. Bukti lanjutan manfaat `outline-light`
yang dibuat untuk CTA — sekarang dipakai ulang oleh section ketiga tanpa modifikasi.

**Mode deskripsi teks/list** — list-repeater REUSE LANGSUNG tipe icon (`FeaturesIconStyle` dkk)
dan komponen `<IconPicker>` dari Keunggulan/Layanan TANPA modifikasi — tapi item list SENGAJA
TIDAK punya card/border/background (beda dari Keunggulan/Layanan yang punya kartu berbingkai) —
sesuai instruksi literal "tidak memiliki border untuk box, cuma border bottom aja diaktifkan
atau tidak" — satu-satunya elemen visual antar-item adalah toggle `listDividers` (garis pemisah).

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB, nol perubahan pipeline
gambar. Belum diverifikasi visual di browser — user perlu cek kombinasi axis, terutama transisi
layout lama→50/50 pada section existing, setelah deploy.

### [2026-07-22] Section Galeri Foto — Title+Background Standar + Bug Fix Scroll-to-Top di Shared Component

> Detail lengkap: **`docs/arsitektur-gallery.md`** § "Bug Fix" + "Status Implementasi"

Lanjutan langsung dari Tentang Kami (sesi yang sama). Berbeda dari 3 section sebelumnya (CTA,
Keunggulan/Layanan, Tentang Kami — semuanya section landing-page-only), Gallery adalah SHARED
SYSTEM (`lib/gallery.ts` + `components/gallery/*`) yang didesain dipakai lintas modul (produk,
event, donasi, editor Tiptap, landing) — jadi perubahan di sini punya blast radius lebih luas
dari sekadar landing page.

**Riset dulu via background agent** (bukan asumsi) — konfirmasi penting: `<Gallery>` (komponen
display, bukan `GalleryPicker` admin) TERNYATA baru dipakai SATU tempat di seluruh app
(`landing-template.tsx`) — produk/event/donasi baru pakai `GalleryPicker` untuk input admin,
belum ada renderer publik yang pakai `<Gallery>`. Ini menurunkan risiko perubahan shared
component secara signifikan (tidak ada modul lain yang bisa langsung terdampak REGRESI visual
saat ini — meskipun API-nya tetap didesain aman untuk pemakai masa depan).

**Bug scroll-to-top — root cause ditemukan via baca kode langsung, bukan tebak-tebakan**:
navigasi INTERNAL lightbox (`gallery-lightbox.tsx`, tombol prev/next/tutup) SUDAH benar sejak
awal, `router.replace(..., {scroll:false})` di kedua tempat. Root cause sesungguhnya ada di titik
BERBEDA yang sepintas tidak dicurigai: `gallery-grid.tsx` — thumbnail-nya `<a href={openHref(id)}>`
**anchor HTML POLOS**, bukan `next/link`'s `<Link>`, tanpa `onClick` handler. Klik anchor polos =
navigasi native browser (bukan client-side routing Next.js) — TIDAK ADA cara pasang `scroll:false`
pada navigasi native, browser reset scroll ke atas sesuai default. **Fix**: ganti `<a>` →
`<Link href={...} scroll={false}>` — `Link` aman dipakai langsung di Server Component (`GalleryGrid`
TIDAK perlu jadi Client Component, boundary client sudah dibungkus internal oleh `next/link`).

**Pelajaran pola bug**: kalau ada laporan "navigasi X di dalam Y menyebabkan scroll jump", jangan
cuma cek kode navigasi YANG SUDAH DICURIGAI (di sini: kode di dalam lightbox itu sendiri, yang
ternyata sudah benar) — cek juga TITIK PEMBUKA/PEMICU-nya (di sini: grid thumbnail di luar
lightbox) — root cause sering ada di komponen TETANGGA yang menghubungkan dua state, bukan di
komponen yang menampilkan gejalanya.

**Bug kedua ditemukan sekalian oleh agent riset (bukan diminta user, proaktif)**: `param`
lightbox (`?gallery=id`) di `GallerySection` sebelumnya STRING LITERAL tetap `"gallery"` — kalau
admin taruh LEBIH DARI SATU section Galeri Foto di satu landing page, keduanya berbagi query key
yang sama (celah laten collision, belum pernah jadi bug NYATA karena baru 1 section Gallery yang
umum dipakai per halaman). Ditutup sekalian: `param={`gallery-${section.id}`}` — diturunkan dari
ID section (unik per section, sudah ada dari `createSection()`), bukan literal tetap.

**Gap ke-3 ditemukan sekalian**: `GallerySection` sudah lama MEMBACA `d.layout`/`d.columns` dari
data, tapi `GalleryEditor` TIDAK PERNAH punya UI untuk mengaturnya — field itu cuma bisa
`undefined` selamanya (fallback default) sejak section ini dibuat. Ditutup sekalian dengan
axis Kolom (3/4) yang diminta user, plus Rasio Gambar (square/landscape, field BARU — extend
`GalleryConfig.aspectRatio`, opsional, default `"square"` = PERSIS perilaku lama hardcode
`aspect-square` di `gallery-grid.tsx` — backward compat untuk SEMUA pemakai `<Gallery>` manapun,
bukan cuma landing).

**Title block + background** — pola identik Tentang Kami: eyebrow+title+headerDesc opsional
(REPLACE `PostsSectionTitle` yang dulu dipakai — visual berubah dari gaya "dashed-line + Lihat
Semua" ke gaya eyebrow+bold-title, perubahan disengaja karena Gallery tidak punya halaman arsip
untuk di-link), background reuse `lib/section-background.ts` (standar yang sama dikunci di
Tentang Kami, TIDAK diretrofit ke CTA/Keunggulan, konsisten dengan keputusan sebelumnya).

**`OptionRow` diperluas jadi `<T extends string | number>`** (sebelumnya `string` saja) — Kolom
(`3|4`) secara semantik adalah angka (konsisten dengan `GalleryConfig.columns: 2|3|4` yang
dipakai di seluruh sistem Gallery), bukan string — daripada convert ke string arbitrary di data
section (`"3"|"4"`) cuma demi cocok constraint lama, generic constraint-nya yang diperluas.
Perubahan aman non-breaking — semua pemakai lama (`string`) tetap valid di bawah `string | number`.

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Bug fix scroll-to-top
BELUM diverifikasi visual langsung (keterbatasan environment) — root cause dan fix sangat
percaya diri secara teknis (native `<a>` vs `<Link scroll={false}>` adalah perbedaan mekanisme
navigasi yang well-understood, bukan tebakan), tapi user perlu konfirmasi setelah deploy bahwa
gejala scroll-jump benar-benar hilang.

### [2026-07-22] `<SectionTitleBlock>` — Ekstraksi Blok Judul Bersama (CTA-Keunggulan-Tentang Kami-Galeri)

> Detail lengkap: **`docs/arsitektur-section-title-block.md`**

Lanjutan langsung dari 4 section sebelumnya (CTA, Keunggulan/Layanan, Tentang Kami, Galeri Foto —
sesi yang sama). Ketiganya (KECUALI CTA, yang punya judul besar sendiri menyamai Hero) menyalin
ulang trio JSX yang identik persis: `{eyebrow && <p className="text-xs font-semibold uppercase
tracking-widest text-primary mb-2">...}` + `{title && <h2 className="text-2xl sm:text-3xl
md:text-4xl font-bold leading-tight tracking-tight">...}` + `{headerDesc && <p
className="text-base opacity-80 leading-relaxed mt-3">...}`. User minta ini distandarkan sebelum
duplikasinya bertambah lagi di section berikutnya.

**Ekstraksi sengaja SEMPIT** — `<SectionTitleBlock>` (`components/website/public/sections/
section-title-block.tsx`) HANYA merender trio konten. Layout luar (align, max-width, mode
"beside" Keunggulan, posisi di dalam kolom Tentang Kami) TETAP tanggung jawab caller via prop
`className` — 3 section ini punya kebutuhan layout luar yang legit berbeda, memaksakan satu
wrapper akan mengorbankan salah satunya. Tentang Kami memanggil tanpa `description` sama sekali
(body/list-nya dirender terpisah sebagai sibling); Keunggulan mode "beside" memanggil tanpa
`description` juga (deskripsinya jadi sibling kolom kanan, sudah begitu sejak awal — tidak
diubah).

**`.section-title` (CSS baru, `globals.css`)** — user kasih spec CSS eksternal persis
(`clamp(1.8rem,3vw,2.6rem)`, `font-weight:800`, `letter-spacing:-0.04em`, `color:
var(--slate-900)`, dst) yang pakai token `--slate-*` yang **tidak ada** di project ini (dicek
root `globals.css` — cuma ada `--foreground/--primary/--secondary/--muted/--border/--radius`
per konvensi shadcn/Tailwind v4 yang sudah dipakai project). `color` SENGAJA DIHILANGKAN dari
kelas (bukan alpa menerjemahkan) — h2 di ketiga section sebelumnya TIDAK punya color utility
sendiri, murni mewarisi warna section (foreground normal, atau text-primary-foreground/
text-background saat background berwarna). Kalau `.section-title` hardcode
`color:var(--foreground)`, declared property akan SELALU menang atas inheritance — judul di
Keunggulan dengan background primary/secondary/dark jadi teks gelap di atas bg gelap (tidak
kebaca). Menghilangkan `color` mempertahankan kontras yang sudah benar tanpa kode tambahan.

**Warna eyebrow kontras-otomatis** — `resolveAccentTextClass(bg)` baru di
`lib/section-background.ts`: `none`/`light` → `text-primary` (aman di bg netral, seperti
sebelumnya); `primary`/`secondary`/`dark` → `opacity-70` (BUKAN warna baru — cuma meredupkan
warna teks section yang SUDAH benar via `resolveSectionBgClass`, menciptakan hierarki
eyebrow-lebih-redup-dari-judul tanpa masalah kontras `text-primary` di atas `bg-primary`).
Keunggulan (`FeaturesBackground = light|primary|secondary|white`, BUKAN `SectionBackground`,
sengaja tidak diretrofit ke standar 5-opsi — keputusan lama dipertahankan lagi) di-map manual:
`background === "white" ? "none" : background` sebelum diteruskan — TypeScript narrow otomatis
membuktikan hasil ternary adalah subset valid `SectionBackground`, tidak perlu cast.

**"Lihat Semua" jadi bordered pill — `<SectionSeeAllLink>`, BUKAN menimpa `.btn-ghost`**: user
kasih CSS reference kedua (bordered pill, `border:1.5px solid var(--slate-200)`, dst) untuk
tombol "Lihat Semua" — **PENTING**: project ini SUDAH punya `.btn-ghost` sistem-wide (Public
Button System, `variant="ghost"` — `background:transparent;color:var(--primary);
border:transparent`, visual link-tipis-tanpa-border, dipakai luas untuk "Lihat Semua"/"Kembali").
Nama class user SAMA (`.btn-ghost`) tapi visual TOTAL BERBEDA (pill berbingkai). **Tidak ditimpa**
— akan merusak semua pemakai `.btn-ghost` lain. Dibuat sebagai komponen React berdiri sendiri
(`section-see-all-link.tsx`, Tailwind inline, bukan class global baru) — satu-satunya pemakai
"Lihat Semua" yang genuinely ada saat ini adalah `PostsSectionTitle` (Post/Produk/Campaign/Event),
diupdate untuk pakai komponen baru ini (implementasi lama inline dihapus). Keunggulan/Tentang
Kami/Galeri belum punya field "Lihat Semua" sama sekali (di luar scope untuk ditambahkan
sekarang, tidak diminta eksplisit) — tapi `SectionTitleBlock`+`SectionSeeAllLink` sudah siap
dikomposisikan kapan pun salah satu section itu butuh fitur ini.

**Aturan yang ditegaskan**: kalau user memberi CSS reference eksternal dengan nama class yang
KEBETULAN sama dengan class yang SUDAH ADA dan dipakai luas di sistem (di sini: `.btn-ghost`),
JANGAN asumsikan itu instruksi untuk menimpa definisi lama — cek dulu apakah keduanya benar-benar
menjelaskan visual yang sama. Kalau beda, buat implementasi terpisah (komponen baru, bukan class
global baru dengan nama yang sama) — menghindari collision sambil tetap memenuhi permintaan.

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Belum diverifikasi
visual di browser (keterbatasan environment) — perubahan CSS murni (ukuran judul + warna eyebrow
+ style tombol), risiko regresi rendah tapi tetap perlu dicek user terutama di background
primary/secondary/dark (Keunggulan/Tentang Kami) untuk pastikan opacity-70 eyebrow benar-benar
terlihat proporsional, bukan cuma terhitung benar secara CSS.

### [2026-07-22] Screening Ukuran Judul — Semua Section Landing Page Kecuali Hero+CTA

> Detail lengkap: **`docs/arsitektur-section-title-block.md`** § 6–8

Lanjutan langsung `<SectionTitleBlock>` (entri di atas, sesi yang sama) — user minta "screening
semua section, mulai dari tentang kami, statistik, keunggulan layanan, gallery foto dan
semuanya, menggunakan ukuran yang sama pakai section title", lalu susulan "selain hero dan cta"
mengkonfirmasi dua-duanya (bukan cuma CTA) tetap dikecualikan.

**Audit menyeluruh** (`grep -rn "<h1\|<h2\|<h3"` di seluruh `components/website/public/sections/`
+ `landing-template.tsx`) — pemisahan penting sebelum eksekusi: **judul SECTION** (chrome section
itu sendiri) vs **judul ITEM/CARD** (nama post/produk/event individual di dalam kartu, item
repeater Keunggulan/Tentang Kami). Hanya kelas pertama yang disamakan — kelas kedua (mis.
`<h3 className="text-4xl md:text-5xl...">` di kartu post unggulan `posts-design-2.tsx`) sengaja
TIDAK disentuh, beda kelas visual sepenuhnya (konten individual, bukan chrome section).

**5 titik judul section yang disamakan ke `.section-title`**:
1. `PostsSectionTitle` (dipakai hampir semua design Post/Produk/Campaign/Event) — dari
   `font-normal leading-none m-0 text-4xl lg:text-[48px]` + inline `letterSpacing` → `section-title
   !mb-0` (margin dinolkan — flex `items-end` dengan tombol "Lihat Semua", tidak ada konten di
   bawahnya).
2. `posts-design-1.tsx` (Design "Hero 3 Kolom", satu-satunya design Post dengan judul bespoke
   TANPA `PostsSectionTitle`) — `text-2xl font-bold mb-6 border-b...` → `section-title !mb-6
   border-b...` (`!mb-6` mempertahankan jarak visual asli ke grid, bukan mengandalkan margin
   bawaan `.section-title` yang cuma 0.6rem).
3. `modules-design-2.tsx` (Strip Modul Desain 2) — `text-2xl sm:text-3xl font-bold m-0` →
   `section-title !m-0`.
4. `ContactInfoSection` ("Info Kontak", judul statis tanpa eyebrow) — `text-2xl font-bold mb-6` →
   `section-title !mb-6`.
5. `StatsSection` ("Statistik") — **beda dari 4 titik lain**: SEBELUMNYA sama sekali tidak punya
   judul (`SECTION_DEFAULTS.stats = {items:[]}`, cuma repeater angka+label). Ditambahkan
   `eyebrow`/`title`/`headerDesc` opsional (default kosong) + `<SectionTitleBlock>` — section
   existing manapun otomatis TIDAK berubah tampilan (return `null` kalau ketiganya kosong, pola
   backward-compat yang sama dipakai Features/About/Gallery sebelumnya).

**Pola `!mb-*`/`!m-0` (Tailwind important-modifier) — WAJIB dipakai untuk override margin
`.section-title`**: kelas ini bawaannya `margin-bottom: 0.6rem`, didefinisikan di LUAR `@layer
utilities` (plain top-level rule di `globals.css`) — artinya urutan cascade vs utility Tailwind
biasa (yang di-emit DALAM `@layer utilities`) tidak bisa diandalkan tanpa `!important` eksplisit
untuk menjamin override menang. Setiap kali sebuah usage butuh margin berbeda dari 0.6rem bawaan
(nol untuk layout flex `items-end`, atau angka lama untuk mempertahankan proporsi visual desain
yang sudah ada), WAJIB pakai `!mb-0`/`!mb-6`/`!m-0`, bukan `mb-0`/`mb-6`/`m-0` polos.

**Aturan yang ditegaskan**: saat "screening"/menyamakan style di banyak lokasi sekaligus, pisahkan
DULU secara eksplisit "chrome section" (yang memang harus konsisten) dari "konten individual di
dalamnya" (yang boleh — dan harus — tetap beda sesuai desain masing-masing card/item) SEBELUM
mulai grep-and-replace. Kalau tidak dipisah, risiko nyata: menyamakan ukuran judul artikel di
dalam card post unggulan dengan judul section "Berita Terbaru"-nya sendiri — merusak hierarki
visual card, bukan memperbaiki konsistensi.

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB (field baru Stats
opsional di JSONB `pages.body`). Belum diverifikasi visual di browser — user perlu cek terutama:
(1) ukuran judul konsisten di semua section publik, (2) margin/spacing di 5 titik override tidak
terasa aneh (`PostsSectionTitle` vs `modules-design-2` flex `items-end` alignment), (3) Statistik
sekarang punya opsi judul di section builder.

### [2026-07-22] Audit Lebar Pill Header/Hero — Tidak Ditemukan Bug di Kode (Ditunda)

User laporkan Pill Header dan Hero terlihat asimetris kiri-kanan dibanding section lain. Audit
kode menyeluruh (`grep` seluruh `max-w-7xl`/`px-*`/`pl-`/`pr-`/`ml-`/`mr-`/`100vw`/`w-screen` di
`PillHeader`, kedua desain Hero, SEMUA section landing, dan seluruh jalur wrapper
`HeaderVisibility → PublicHeader → {Classic,Flex,Pill}Header`) — hasilnya **semua identik**
`max-w-7xl mx-auto px-4`, tidak ada asimetri di level class Tailwind manapun. Tidak ada akses
browser/screenshot di environment ini untuk verifikasi visual lebih lanjut. User memilih
**ditunda** ("biarkan saja dulu bro") — tidak ada perubahan kode. Kalau muncul lagi, minta
screenshot atau URL+breakpoint spesifik sebelum mulai audit ulang — audit berbasis grep class
sudah terbukti tidak cukup untuk menemukan bug visual jenis ini.

### [2026-07-22] `PostsSectionTitle` — Perluasan Trio Standar ke Post/Produk/Campaign/Event

> Detail lengkap: **`docs/arsitektur-section-title-block.md`** § 9

Lanjutan langsung dari screening ukuran judul (lesson di atas, sesi berikutnya) — user minta
Product/Event/Campaign/Donasi (dan otomatis Post, karena berbagi `PostsSectionTitle`) juga punya
standar 3-judul yang sama, dengan syarat: tombol "Lihat Semua" tetap di kanan untuk align "left"
(default), tapi pindah ke baris terpisah di bawah — terpusat — untuk align "center". **Hanya 2
opsi align** (left/center), beda dari Keunggulan/CTA yang 3 opsi (+kanan). Pesan user sempat
kepotong di tengah kalimat ("jika center, maka button") — dilanjutkan di pesan berikutnya
("button 'Lihat Semua→' itu berada dibawah sejajar..").

**`PostsSectionTitle` direstrukturisasi total** — sebelumnya render eyebrow/judul manual sendiri
(terpisah dari `SectionTitleBlock`), sekarang delegasikan sepenuhnya ke `<SectionTitleBlock>`.
Dua perubahan pada `SectionTitleBlock` diperlukan untuk reuse ini valid: `title` type `string` →
`ReactNode` (untuk terima `renderTitle(title)`, array hasil parsing markup `*italic*` — existing
caller string tetap valid, subset dari `ReactNode`), dan `as?: "h2"|"h3"` baru (default h2, untuk
dukung sub-header per-kolom Design 4 "Trio Column" Post). Field `label` (teks mono kecil, TIDAK
PERNAH dipakai satu caller pun — dikonfirmasi grep sebelum dihapus) dihapus total, digantikan
`eyebrow` yang secara visual konsisten dengan section lain.

**`[&>*:last-child]:!mb-0` (Tailwind arbitrary child selector)** — di mode "left", trailing
margin harus nol supaya tombol align persis ke baseline via `items-end`, TAPI elemen TERAKHIR di
title block sekarang bisa berbeda (judul kalau tanpa deskripsi, deskripsi kalau ADA — baru
mungkin karena `description` fitur BARU di komponen ini). Selector ini menargetkan child terakhir
APAPUN bentuknya otomatis, tidak hardcode asumsi seperti sweep sebelumnya.

**`lib/section-title-align.ts` baru** — `SectionTitleAlign` (`left`/`center`), field baru
`eyebrow?`/`headerDesc?`/`titleAlign?` ditambah ke 4 tipe data (`PostsSectionData` dkk) — SENGAJA
TIDAK ditambahkan ke `SECTION_DEFAULTS` (konvensi lokal minimal-defaults yang sudah ada untuk 4
tipe ini, beda dari CTA/Features yang exhaustive — dua konvensi berbeda, dihormati masing-masing).

**Design yang SENGAJA tidak ikut**: Post Design 1 "Hero 3 Kolom" (judul bespoke tanpa tombol,
hasil sweep sebelumnya) dan sub-header per-kolom Post Design 4 "Trio Column" (`as="h3"`, bukan
judul section keseluruhan) — keduanya tidak memakai `PostsSectionTitle` di level section. 11
design lain (Post 2/3/5, Produk 1/2/3, Campaign 1/2/3, Event 1/2/3) semua diperluas menerima
`eyebrow`/`description`/`align` — perlu tambah `data` ke destructuring props di 10 dari 11 file
(hanya `posts-design-2.tsx` yang sudah punya `data` sebelumnya). 2 design carousel (Post 5,
Produk 3) menaruh `PostsSectionTitle` di dalam `flex-1` bersama tombol panah scroll —
`align="center"` masih bisa dipilih tapi hasilnya kurang ideal (center di kolom sempit, bukan
center section penuh) — diterima sebagai trade-off, tidak di-guard.

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Belum diverifikasi
visual di browser — user perlu cek terutama: (1) mode "center" pada masing-masing dari 4 tipe
section, (2) editor Posts menyembunyikan field baru dengan benar saat Design 1/4 aktif, (3) 2
design carousel dengan `align="center"` dipilih (edge case yang diterima, bukan di-guard).

### [2026-07-22] Audit Kelengkapan Standar 3-Judul — Strip Modul/Galeri/Statistik Dapat Perluasan

> Detail lengkap: **`docs/arsitektur-section-title-block.md`** § 12–14

Setelah user konfirmasi ukuran judul Post sudah konsisten (§ lesson di atas), user tanya: "selain
yg sudah kita update dan perbaiki tadi, apakah ada section design yg blm kita sentuh?". Audit
dari 13 tipe section (`SECTION_TYPES`) menemukan 3 gap nyata: **Strip Modul** (belum tersentuh
sama sekali — Design 1 pakai `PostsSectionTitle` tapi tidak diwire eyebrow/desc/align, Design 2
raw `<h2>` tanpa `SectionTitleBlock` sama sekali), **Galeri Foto** dan **Statistik** (sudah punya
eyebrow+judul+deskripsi dari sesi sebelumnya, tapi wrapper-nya di-hardcode `text-center`, tidak
ada pilihan align). User pilih beresin ketiganya sekaligus.

**Bug yang DICEGAH sebelum ditulis (bukan ditemukan setelah)**: kalau `titleAlign` untuk Galeri/
Statistik di-default ke `"left"` (mengikuti pola Post/Produk/dst di § 9), section EXISTING yang
sudah dikonfigurasi admin (punya eyebrow/judul/deskripsi tersimpan) akan tiba-tiba lompat dari
center ke kiri — regresi visual nyata, karena perilaku ASLI keduanya SUDAH SELALU center (hardcode
`text-center`, tanpa opsi lain) SEBELUM opsi align ada. Fix: `const titleAlign = d.titleAlign ??
"center"` (bukan `"left"`) khusus untuk `GallerySection`/`StatsSection` — satu-satunya baris yang
membedakan perluasan ini dari pola default § 9. `SECTION_DEFAULTS.gallery`/`.stats` juga eksplisit
set `titleAlign: "center"` (kedua entri ini sudah pakai gaya exhaustive-default, beda dari
Post/Produk/dst yang minimal-default — § 9c — jadi field baru ditambahkan konsisten dengan gaya
masing-masing, bukan dipaksa seragam).

**Pola align 2-bagian (`flex flex-col ${alignItemsCls}` untuk POSISI blok + `max-w-3xl
${textAlignCls}` untuk ALIGN TEKS di dalamnya)** — disalin dari `FeaturesSection` yang sudah lebih
dulu ada, bukan pola baru: `text-center`/`text-left` SAJA pada `SectionTitleBlock` tidak cukup,
karena tanpa `items-center`/`items-start` di flex parent, blok `max-w-3xl` akan selalu menempel ke
kiri (default flex alignment) terlepas dari `text-align` di dalamnya.

**Strip Modul Design 2 — tombol panah BUKAN "Lihat Semua"**: dua tombol `ChevronLeft`/
`ChevronRight` mengontrol scroll rail carousel, beda semantik dari href-based `SectionSeeAllLink`
(yang selalu opsional) — tidak bisa langsung reuse `PostsSectionTitle`. Direstrukturisasi manual
mengikuti POLA yang sama (title kiri+panah kanan 1 baris untuk "left"; title terpusat lalu panah
di baris terpisah di bawah untuk "center") tapi reuse `<SectionTitleBlock>` langsung (bukan
`PostsSectionTitle`) karena Design 2 tidak butuh href/`linkLabel` sama sekali. Panah SELALU tampil
di kedua mode (fungsional, mengontrol rail) — beda dari "Lihat Semua" yang genuinely opsional.

**Yang SENGAJA tidak diubah (bukan gap)**: Keunggulan/Layanan tetap 3 opsi align (kiri/tengah/
kanan) — desain awalnya sendiri, bukan inkonsistensi yang perlu diseragamkan ke 2 opsi. Info
Kontak (judul "Info Kontak" hardcode, bukan field admin sama sekali) dan Divider (tidak ada
konsep judul) tetap tidak tersentuh — keduanya bukan gap, cuma tidak relevan untuk standar ini.

**Aturan yang ditegaskan**: saat memperluas sebuah standar/pola ke section BARU yang PERNAH punya
perilaku default berbeda dari section yang jadi acuan awal (di sini: Post/Produk/dst selalu
"left", Galeri/Statistik selalu "center"), JANGAN asumsikan default yang sama berlaku untuk semua
— identifikasi dulu perilaku ASLI section itu SEBELUM field baru ditambahkan, dan jadikan itu
sebagai default runtime (`?? "..."`) DAN default eksplisit di `SECTION_DEFAULTS` kalau section itu
sudah pakai gaya exhaustive-default. Kegagalan melakukan ini adalah kelas regresi visual paling
gampang lolos audit `tsc`/build (compile bersih, tapi tampilan production tiba-tiba berubah).

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Belum diverifikasi visual
di browser — user perlu cek terutama: (1) Galeri/Statistik existing (kalau ada) TETAP center
setelah deploy (verifikasi backward-compat paling kritis di atas), (2) mode "center" Strip Modul
Design 2 — panah pindah ke bawah dengan benar, (3) editor Modules menampilkan field baru dengan
benar.

### [2026-07-22] Bug Gallery: `aspectRatio` Tidak Pernah Sampai ke `<GalleryGrid>`

> Detail lengkap: **`docs/arsitektur-gallery.md`** § "Status Implementasi", catatan bug fix

User laporkan pilih "Landscape" di editor Galeri Foto tidak mengubah apa-apa — foto tetap kotak
di front-end. Root cause: `<Gallery>` (wrapper, `components/gallery/gallery.tsx`) melakukan
`const { layout, columns } = { ...DEFAULT_GALLERY_CONFIG, ...config };` — HANYA menarik
`layout`+`columns`, `aspectRatio` diam-diam tidak pernah ikut di-destructure MAUPUN diteruskan ke
`<GalleryGrid>`. `GalleryGrid`'s default parameter `aspectRatio = "square"` selalu jadi yang
dipakai, terlepas apa pun yang admin pilih. `GalleryGrid` sendiri (logic `ASPECT[aspectRatio]`,
CSS `aspect-square`/`aspect-[4/3]`) dan `GallerySection` (landing-template.tsx, sudah benar kirim
`config={{..., aspectRatio: d.imageRatio ?? "square"}}`) SAMA-SAMA benar sejak awal — bug murni
di SATU baris wrapper di tengah yang lupa meneruskan satu field dari config gabungan ke prop
komponen anak. Fix: tambah `aspectRatio` ke destructuring `Gallery` + teruskan sebagai prop ke
`<GalleryGrid>`.

**Kenapa gambar tidak perlu ganti file/variant** — CSS `aspect-*` + `object-cover` pada wrapping
div sudah cukup untuk crop visual berbeda; tidak perlu variant gambar baru di pipeline upload
(`lib/image-processor.ts`) atau ganti `getGalleryThumb()` — keputusan ini sudah dikunci sejak
`imageRatio` pertama kali ditambahkan, tetap berlaku, cuma butuh wiring yang benar.

**Aturan yang ditegaskan**: kalau sebuah komponen WRAPPER menerima `config` (objek gabungan)
dan meneruskan SEBAGIAN field-nya ke komponen anak via destructuring manual (bukan spread
`{...config}` utuh), setiap kali field baru ditambahkan ke tipe config, WAJIB cek juga apakah
wrapper-nya ikut di-update untuk menarik+meneruskan field baru itu — field bisa 100% valid secara
TYPE (tsc tidak protes, `config.aspectRatio` ada di type `GalleryConfig`) tapi tetap hilang total
di RUNTIME karena wrapper tidak pernah membacanya. `tsc` tidak menangkap kelas bug ini sama
sekali (destructuring parsial itu sendiri bukan type error) — cuma ketahuan lewat testing visual
langsung, seperti yang dilaporkan user di sini.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev server
dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. `<Gallery>` dikonfirmasi cuma punya SATU
caller nyata di seluruh app (`GallerySection`), jadi fix ini tidak berisiko memengaruhi konsumen
lain yang belum ada.

### [2026-07-22] Gallery di dalam Post — Melengkapi Fitur Setengah Jadi, Scope Sempit Diminta User

> Detail lengkap: **`docs/arsitektur-gallery.md`** § "Status Implementasi", catatan Gallery di
> dalam Post

User tanya (diskusi dulu, "jgn eksekusi apapun") soal bikin "post gallery" — riset (Explore agent)
menemukan `GalleryBlock` (node Tiptap + NodeView lengkap: picker, preview, layout/kolom) **sudah
lama terdaftar** di `tiptap-editor.tsx` yang dipakai editor Post, TAPI tidak pernah ada entry
point UI (nol tombol toolbar, nol slash-command) — fitur setengah jadi, tidak pernah bisa dipakai
admin sejak dibuat. `renderBody()`'s `case "galleryBlock"` juga cuma grid `<table>` statis tanpa
lightbox. User eksplisit minta scope SEMPIT dua kali ("jangan meluas kemana2", "gue cuma butuh
gallery di post") — jawabannya: **tidak perlu tipe/format post baru** (beda dari `pages.template`)
untuk "gallery bisa disisipkan di post" — editor tetap sama persis, cuma 2 bagian yang dikerjakan.

**1. Tombol toolbar** (`editor-toolbar.tsx`) — `handleInsertGallery()` manggil `editor.chain()
.focus().insertGallery({items:[], layout:"grid", columns:3}).run()`, pola identik tombol
"Sisipkan Tabel" yang sudah ada (1 command call, tanpa dialog). Sisipkan block KOSONG — admin
lanjut isi lewat UI "Edit Gallery" yang SUDAH ADA di NodeView (`gallery-block-view.tsx`, TIDAK
disentuh sama sekali) — picker gambar, preview thumbnail, semua reuse murni tanpa kode baru.

**2. Render publik dengan lightbox** (`lib/post-body-segments.ts`, baru) — masalahnya:
`renderBody()` (dipakai post detail page) pure-string server-safe, di-share dengan render PDF
surat, TIDAK bisa render komponen React `<Gallery>` (yang butuh `Suspense`+`useSearchParams` untuk
lightbox). Solusi: `splitPostBodySegments()` memecah `post.content` (Tiptap JSON) di LEVEL
`post/[slug]/page.tsx` — kumpulkan node non-galeri jadi "buffer", tiap ketemu node `galleryBlock`
→ flush buffer lewat `renderBody()` seperti biasa, lalu masukkan gallery sebagai segmen TERPISAH
yang di-render via `<Gallery items={...} config={{layout:"grid",columns:3}} param={key} />` ASLI
(React component, dapat lightbox). Halaman detail sekarang `.map()` array segmen — HTML string
(`dangerouslySetInnerHTML`, `.prose`) diselingi komponen `<Gallery>` sungguhan, urutan sesuai body
aslinya. **`letter-render.ts` TIDAK diekspor/diubah sama sekali** — `splitPostBodySegments`
memanggilnya sebagai black box per potongan (`JSON.stringify({type:"doc",content:buffer})`),
zero risiko ke PDF surat yang pakai file yang sama.

**Kolom SELALU 3** (permintaan eksplisit "otomatis 3 kolom, mobile 2 kolom") — `GalleryGrid`'s
`grid-cols-2 sm:grid-cols-3` untuk `columns=3` SUDAH PERSIS itu tanpa kerja tambahan (2 mobile/3
desktop otomatis). Dipaksa di 2 titik: default tombol toolbar, DAN di titik konstruksi gallery
segment saat render publik (mengabaikan `layout`/`columns` apa pun yang tersimpan di node) — NodeView
editor TETAP punya UI untuk mengubah layout/kolom (tidak dihapus, di luar scope untuk disentuh),
tapi hasilnya tidak pernah dipakai di publik. Trade-off kecil (editor preview vs publik bisa beda)
diterima demi tidak menyentuh `gallery-block-view.tsx` sama sekali, sesuai "jangan meluas".

**Aturan yang ditegaskan**: kalau riset menemukan infrastruktur yang SUDAH ADA (schema, extension,
NodeView) tapi TIDAK PERNAH ada entry point UI untuk memakainya, itu "setengah jadi", bukan
"selesai" — treat sebagai gap yang perlu SATU langkah kecil (biasanya tombol/UI trigger) untuk
benar-benar hidup, bukan sebagai fitur yang harus dibangun dari nol. Saat user secara eksplisit
membatasi scope ("jangan meluas"), cari jalur yang REUSE infrastruktur existing seluas mungkin dan
HANYA sentuh file yang benar-benar perlu — di sini: 1 file baru (splitter, murni fungsi) + 2 baris
di toolbar + wiring render di 1 halaman, TIDAK ada schema baru, TIDAK ada tipe post baru, TIDAK
ada perubahan NodeView, TIDAK ada perubahan `letter-render.ts`.

**Verifikasi**: `tsc --noEmit` bersih dari percobaan pertama + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan). Nol migrasi DB. Belum diverifikasi
visual di browser — user perlu cek: (1) tombol "Sisipkan Galeri Foto" muncul di toolbar post
editor, (2) setelah pilih foto+publish, galeri tampil dengan lightbox popup di halaman post publik
(bukan grid statis), (3) 2 kolom di mobile, 3 kolom di desktop otomatis tanpa pengaturan apa pun.

### [2026-07-22] Audit Produksi: Payment Ditolak Tidak Pernah Kehitung Pemasukan — Plus Fix Tampilan

> Detail lengkap: **`docs/arsitektur-billing.md`** § "Q&A Keputusan Desain"

User khawatir: kemarin ada beberapa invoice yang sempat 2x konfirmasi pembayaran (duplikat), sudah
ditolak salah satunya via admin, tapi masih tertulis di `/finance/pemasukan` — was-was itu masih
ikut kehitung sebagai pemasukan. Diinvestigasi dengan pola established
(`feedback_financial_data_fixes.md`): **SELECT diagnosa dulu ke data production sungguhan** (via
user jalankan `docker compose exec postgres psql` — saya sendiri TIDAK PUNYA akses SSH ke VPS,
`ssh root@72.61.215.7` dari environment ini return "Permission denied"), bukan cuma percaya kode.

**Temuan struktural (dicek kode dulu)**: `recordIncome()` HANYA dipanggil saat payment transisi
KE `"paid"` — dan `rejectPaymentAction` (2 salinan, `finance/actions.ts` + `finance/billing/
actions.ts`) punya guard keras `if (status==="paid") return error`. Jadi payment yang berhasil
ditolak SELALU berasal dari "submitted" (belum pernah lunas) — tidak mungkin sudah punya baris
jurnal. `/finance/laporan` (laporan resmi) dihitung dari `transaction_entries` LANGSUNG, bukan
dari `payments` — immune struktural terhadap status apa pun di `payments`.

**Verifikasi ke data production (bukan cuma teori)** — 3 putaran query:
1. `SELECT ... WHERE status='rejected' AND transaction_id IS NOT NULL` → **0 rows**. Konfirmasi
   langsung: tidak ada payment ditolak yang nyangkut di jurnal.
2. **False alarm dari saya sendiri**: query `COUNT(*) > 1 WHERE status='paid'` per invoice
   menemukan 3 invoice — saya SEMPAT mengira ini bukti duplikat/double-count. Setelah lihat
   detail nominal per payment, ternyata itu bukan duplikat — itu **pola "Kode Unik Transaksi"**
   (fitur lama, sudah ada, bukan sesuatu yang baru dibuat sesi ini): customer transfer round
   number dulu (mis. Rp 700.000), lalu transfer terpisah untuk sisa kode uniknya (Rp 432) —
   `sum(kedua payment) = paid_amount = total + uniqueCode`, PAS, tidak ada kelebihan. Query
   `COUNT(*) > 1` yang saya tulis pertama kali NAIF — cuma cek "lebih dari 1 payment lunas",
   tidak cek apakah SUM-nya melebihi yang seharusnya. Saya akui salah alarm ke user secara
   eksplisit, bukan diam-diam dikoreksi.
3. **Kasus nyata yang user kasih** (`620-PAY-202607-00015`) — INI baru contoh genuine
   duplikat-lalu-ditolak: 2 payment identik (nominal SAMA PERSIS Rp 350.472, payer sama) untuk
   1 invoice, satu `status='paid'` (`confirmed_at` terisi), satu `status='rejected'`
   (`confirmed_at` KOSONG — bukti tidak pernah lewat "lunas" sama sekali). `invoices.paid_amount`
   cuma mencerminkan SATU payment yang confirmed, bukan dua-duanya dijumlah. Contoh nyata yang
   membuktikan sistem bekerja benar persis sesuai klaim struktural di atas.

**Root cause kekhawatiran user — bukan bug data, murni tampilan**: `/finance/pemasukan`
menampilkan SEMUA status (termasuk rejected/cancelled) di SATU tabel tanpa filter default, DAN
kolom nominal selalu hijau untuk SEMUA baris tanpa mempedulikan status — jadi baris "Ditolak"
(badge merah) tetap punya angka hijau di sampingnya, kelihatan seperti uang masuk padahal bukan.
Halaman ini sendiri TIDAK punya total/sum sama sekali (murni list+pagination) — jadi tidak ada
angka AGREGAT yang salah di halaman itu, cuma kesan visual yang membingungkan per baris.

**Fix** (`finance/pemasukan/page.tsx`): filter default ("Semua") sekarang `WHERE status NOT IN
('rejected','cancelled')` — kedua status itu tetap bisa dicari eksplisit lewat tombol filter yang
sudah ada (tidak dihilangkan, cuma disembunyikan dari default view, mempertahankan jejak audit).
Nominal untuk baris rejected/cancelled: `text-muted-foreground line-through` (abu-abu+dicoret),
bukan `text-green-600` lagi.

**Aturan yang ditegaskan**: untuk pertanyaan finansial yang menyangkut uang sungguhan di
production, JANGAN berhenti di jawaban berbasis pembacaan kode saja meski strukturnya terlihat
aman — verifikasi ke DATA SUNGGUHAN dulu (lewat user, karena tidak ada akses SSH langsung ke
VPS dari environment ini). Dan kalau query diagnosa SENDIRI ternyata memberi hasil yang
menyesatkan (seperti `COUNT(*) > 1` di atas), akui secara EKSPLISIT ke user begitu ketahuan salah
— jangan diam-diam pura-pura tidak pernah bilang begitu. Query desain untuk deteksi "duplikat"
harus bandingkan SUM aktual terhadap nilai yang SEHARUSNYA (`total + uniqueCode`), bukan cuma
`COUNT(*) > 1` — sistem ini sengaja mendukung pembayaran dicicil/dipisah jadi beberapa transfer
per invoice (termasuk pola kode-unik-menyusul), jadi "lebih dari 1 payment lunas per invoice"
BUKAN sinyal bug dengan sendirinya.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev server
dimatikan dulu, `.next` dibersihkan). Nol migrasi DB — murni perubahan query filter + styling di
1 halaman admin. Data production `visikita` sudah diverifikasi bersih (tidak ada koreksi SQL yang
perlu dijalankan) — investigasi ini murni audit + 1 perbaikan tampilan, bukan perbaikan data.

### [2026-07-22] Form Pemasukan Manual — Autocomplete Anggota + Bukti Pembayaran

> Detail lengkap: **`docs/arsitektur-keuangan.md` § "Keputusan Desain yang Dikunci"**

User minta 3 perbaikan sekaligus di `/finance/pemasukan/new` (form "Catat Pemasukan" — 4 tab:
Manual/Toko/Donasi/Event): (1) Nama Pembayar (tab Manual) / Nama Donatur (tab Donasi) bisa
autocomplete dari anggota, fallback ketik manual; (2) sertakan bukti pembayaran — bukti transfer
untuk transfer/QRIS, atau "tanda terima" untuk cash; (3) begitu nama diambil dari anggota, telepon
+email otomatis terisi (kosong+manual kalau nama diketik bebas).

**Endpoint pencarian anggota REUSE, bukan baru**: `/api/ref/tenant-members` (dibuat untuk
`RecipientCombobox` modul Surat, `docs/arsitektur-...` lama) sudah mengembalikan `phone`/`email`
per anggota via JOIN `contacts` yang benar (`members INNER JOIN tenantMemberships LEFT JOIN
contacts` — bukan pola `contacts.findFirst` yang pernah kena bug salah-pilih-baris di lesson
sebelumnya, lihat "[2026-07-21] Bug Sesungguhnya: lookup-member Ambil Contact Sembarang"). Cukup
dipanggil ulang oleh komponen baru `MemberNameAutocomplete` — tidak perlu endpoint baru.

**`payments.memberId` sudah ADA sejak awal skema tapi TIDAK PERNAH diisi dari jalur manapun** —
dikonfirmasi baca kode sebelum eksekusi. Begitu juga `donations.memberId`. Kedua kolom FK ini
sekarang genuinely terpakai: saat admin pilih anggota dari autocomplete, `memberId` diisi;
mengetik manual → tetap `null` (bukan bug, berarti bukan anggota terdaftar/sengaja tidak ditaut).

**`payerPhone`/`payerEmail` — kolom baru di `payments`** (migration `0040_payment_payer_contact.sql`,
`DO $$ LOOP` per-tenant, pola sama migration 0033/0038). `donations.donorPhone`/`donorEmail` SUDAH
ADA sejak lama — tab Donasi tidak butuh migrasi, cuma diwire ke autocomplete yang sama.

**Auto-isi HANYA saat memilih dari dropdown, TIDAK auto-clear saat mengetik manual**: begitu
admin klik hasil pencarian, `payerPhone`/`payerEmail` (atau `donorPhone`/`donorEmail`) langsung
terisi dari kontak anggota — tapi kalau admin lanjut mengetik nama secara bebas (tidak memilih
ulang dari dropdown), field itu TIDAK dikosongkan otomatis oleh `MemberNameAutocomplete` —
mencegah kehilangan data yang sudah diisi admin secara tidak sengaja hanya karena mengubah teks.

**Bukti pembayaran — satu field, label dinamis by metode, BUKAN generate PDF otomatis**: sempat
dipertimbangkan "tanda terima" berarti auto-generate dokumen kwitansi (seperti PDF surat yang
sudah ada infrastrukturnya via Playwright) — dipilih interpretasi yang lebih murah dan sesuai
bahasa instruksi user ("...atau kecuali kalau cash berarti **tetap ada** tanda terima" — kata
"tetap" menyiratkan field yang SAMA, cuma label beda, bukan mekanisme baru): `ProofUploadField`
tetap SATU widget upload opsional, labelnya "Bukti Transfer" (transfer/qris) vs "Tanda Terima /
Kwitansi" (cash). Upload ke endpoint BARU `POST /api/finance/payment-proof?tenant=` (admin-only,
guard `getTenantAccess`+`hasFullAccess(...,"keuangan")`) — bukan reuse `/api/invoice/proof-upload`
(publik, tanpa auth, path per-`invoiceId`) karena payment belum tercipta saat upload terjadi di
form ini; path generik `payments/manual/{uuid}.webp`. Server-side convert ke WebP via Sharp — pola
persis disalin dari `/api/invoice/proof-upload` (deteksi format dari isi file, bukan MIME header
browser yang kadang kosong untuk HEIC — lihat lesson lama "Bug: Bukti Transfer Gagal Upload
Diam-Diam").

**Alur status TIDAK berubah**: payment hasil form ini tetap masuk `status="submitted"` (bukan
langsung `"paid"`) — bukti/tanda terima yang baru ditambahkan ini jadi BUKTI TAMBAHAN yang dilihat
admin sebelum klik "Konfirmasi Lunas" di halaman detail (`PaymentActions`, sudah ada sejak lama),
bukan pengganti langkah konfirmasi itu. Halaman detail (`[id]/page.tsx`) diperluas: baris
Telepon/Email (kondisional, cuma tampil kalau terisi) + card bukti pembayaran dengan
`PaymentProofThumbnail` (klik = lightbox popup, pola disalin dari `invoice-detail-client.tsx` —
bukan buka tab baru, konsisten aturan lama "Bukti Transfer + Verifikasi Dua Tahap").

**3 komponen baru** (`components/keuangan/`): `member-name-autocomplete.tsx` (generik, dipakai
tab Manual DAN Donasi — bukan 2 komponen terpisah), `proof-upload-field.tsx` (generik by
label/hint prop, bukan hardcode teks cash/transfer di dalamnya — caller yang tentukan lewat prop),
`payment-proof-thumbnail.tsx` (thumbnail+lightbox, dipakai halaman detail).

**Verifikasi**: `tsc --noEmit` bersih di kedua package (`apps/web`+`packages/db`) dari percobaan
pertama + `bun run build --filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next`
dibersihkan) — 4 route baru/berubah (`/api/finance/payment-proof`, `/finance/pemasukan{,/new,/[id]}`)
terkonfirmasi muncul di build output. Migration `0040` dijalankan di lokal (belum di VPS). Belum
diverifikasi visual di browser (autocomplete dropdown, upload preview, lightbox) — user perlu
coba langsung setelah deploy.

### [2026-07-23] Audit Menyeluruh Konsistensi Phone/WhatsApp — Sebelum Fitur Besar

> Detail lengkap: **`docs/arsitektur-kontak.md`** (ditulis ulang total, status "SELESAI" per audit
> ini — versi lama 2026-05-13 hanya menutup form yang ADA saat itu, banyak form baru yang dibangun
> setelahnya lolos dari aturan).

User minta audit "sebelum kita ke fitur besar" — cek konsistensi phone/WA di SEMUA form (admin +
publik), karena `PhoneInput`+`normalizePhone()`+`displayPhone()` sudah ada tapi dicurigai tidak
dipakai konsisten. Dikerjakan via 1 Explore agent (audit eksploratif) + verifikasi manual sendiri
untuk temuan yang butuh keputusan (bukan sekadar dicatat).

**Skala temuan** (jauh lebih besar dari 6 file yang saya temukan manual di awal):
- **9 file input form** pakai `<input type="tel">` polos, bukan `<PhoneInput>` — 1 di antaranya
  (`qurban-order-form.tsx` + `createQurbanOrderAction`) confirmed **dead code** (superseded
  `campaign-detail-client.tsx` sejak lama, tidak diimpor di mana pun) — dihapus total, bukan difix.
- **Write-side `normalizePhone()` hilang** di ~11 titik, termasuk pola yang sama BERULANG dalam
  SATU fungsi: `registerForEventAction` (event/actions.ts) menormalisasi `eventRegistrations.
  attendeePhone` dengan benar, tapi baris berikutnya di fungsi yang SAMA meneruskan raw value ke
  `invoices.customerPhone` via `createLinkedInvoice()` — dua kolom untuk data yang sama, satu benar
  satu tidak.
- **24 titik display** render phone/WA mentah tanpa `displayPhone()` — admin (accounts, invoice,
  payment, voucher, letter contacts) dan publik (event registration card+QR, akun self-service
  usaha/pesantren/profesional, 3 desain footer, contact-template, landing "Info Kontak").
- **Bug fungsional nyata, bukan cuma gaya**: 4 titik (`anggota-directory-client.tsx` +
  `/api/member-public/[id]`, dan 3 halaman detail publik usaha/pesantren/profesional) membangun
  link `wa.me` dengan `.replace(/\D/g,"")` pada nilai yang **SUDAH melewati `displayPhone()`**
  (`+6281234567890` → `081234567890`) — hasil stripping-nya `081234567890` (hilang kode negara,
  leading zero tersisa), link `wa.me` rusak total di production untuk siapa pun yang mengklik.
- **3 implementasi normalizePhone-like yang kompetitif**: `lib/phone.ts:normalizePhone` (canonical),
  `lib/whatsapp.ts:toE164` (dipakai 3 route OTP, fallback beda — tanpa default `+62`), dan 3×
  fungsi lokal `function normalizePhone(...)` di `dark-footer.tsx`/`light-footer.tsx`/
  `modern-footer.tsx` (dipakai khusus untuk bangun link `wa.me` — kebetulan namanya sama persis
  dengan helper canonical tapi logic beda, potensi salah kira "sudah pakai yang benar").

**Fix arsitektural kunci — `toWaDigits()` helper baru** (`lib/phone.ts`): `normalizePhone(raw)`
lalu strip `+` — SATU-SATUNYA cara benar membangun digit untuk `wa.me`/GOWA send API. Dipakai
untuk mengganti SEMUA 3 sumber duplikat sekaligus: `toE164()` dihapus (3 route OTP diarahkan ke
`normalizePhone()` langsung), 3 fungsi lokal footer dihapus (diganti `toWaDigits()`), dan
`sendWaNotification()`'s digit-stripping internal ikut diarahkan ke `toWaDigits()` — efek samping:
`notifyWa()` (helper WA notifikasi bisnis) otomatis dapat defense-in-depth normalisasi tanpa perlu
disentuh sama sekali, karena `sendWaNotification` yang dipanggilnya sudah robust duluan.

**Fix bug wa.me — pola "dua variabel, bukan satu"**: titik mana pun yang perlu MENAMPILKAN nomor
(`displayPhone()`) SEKALIGUS membangun link (`toWaDigits()`) WAJIB simpan keduanya sebagai variabel
terpisah dari SUMBER E.164 asli, bukan menurunkan satu dari yang lain:
```typescript
if (c.isWhatsappPublic) {
  whatsapp       = displayPhone(c.whatsapp);                    // teks tampilan: "0812xxx"
  whatsappWaLink = `https://wa.me/${toWaDigits(c.whatsapp)}`;    // link: dari E.164 ASLI
}
```
Untuk endpoint API yang mengirim data ke client terpisah (`/api/member-public/[id]`), link `wa.me`
jadi-jadian (bukan raw whatsapp value) dikirim sebagai field JSON tersendiri (`whatsappWaLink`) —
supaya client tidak perlu (dan tidak bisa) membangun ulang link dari nilai yang sudah terlanjur
dilokalkan oleh `displayPhone()`.

**Aturan baru yang dikunci**: `displayPhone()` adalah fungsi TERMINAL — hasilnya HANYA untuk
ditampilkan sebagai teks. Begitu sebuah nilai sudah lewat `displayPhone()`, JANGAN PERNAH proses
ulang untuk keperluan lain (link, kalkulasi, dsb.) — selalu turunkan representasi lain dari nilai
E.164 ASLI.

**`packages/db` butuh normalizePhone juga tapi tidak boleh impor `apps/web/lib/phone.ts`** —
`createLinkedInvoice()` (shared helper dipakai Toko/Donasi/Event untuk bikin invoice universal,
hidup di `packages/db/src/helpers/billing.ts`) butuh normalisasi `customerPhone`, tapi
`lib/phone.ts` harus tetap zero-dependency ke `@jalajogja/db` supaya aman dipakai client component
(persis alasan kenapa `tenant-timezone.ts` di-split jadi client-safe vs `.server.ts` sebelumnya).
Fix: `packages/db/src/helpers/phone.ts` — duplikasi minimal SATU fungsi `normalizePhone()` saja
(bukan `displayPhone`/`toWaDigits`, karena package itu tidak butuh keduanya), pola sama persis
"duplikasi demi isolasi" yang sudah dipakai `generateEventRegNumber`/`formatEventDateWib`.
**Efek "single choke point"**: karena `createLinkedInvoice()` menormalisasi `customerPhone` di
SATU tempat, ketiga pemanggilnya (`createOrderAction` toko, `createDonationAction` donasi,
`registerForEventAction` event) otomatis terlindungi TANPA perlu disentuh satu-satu — cukup
konfirmasi via baca kode bahwa `customerPhone` mereka memang mengalir lewat fungsi itu, tidak
perlu tambahan `normalizePhone()` di titik pemanggilan.

**Cart-flow JSON snapshot — dua titik tulis, bukan satu**: tiket event via cart universal
menyimpan data peserta sebagai JSON di `cart_items.notes` (`addEventTicketToCartAction`), lalu
di-parse ulang dan di-insert ke `event_registrations.attendeePhone` saat invoice lunas
(`confirmInvoicePaymentAction`/`verifySubmittedPaymentAction`, 2 fungsi paralel). KEDUA titik
(tulis JSON DAN parse-insert) sempat tidak dinormalisasi — diperbaiki keduanya, karena
menormalisasi cuma salah satu tidak cukup (JSON blob di antara keduanya bisa berasal dari kode
lama yang belum diperbaiki, atau bug lain di masa depan yang menulis raw value lagi ke JSON).

**Dead API endpoint ditemukan+ditutup sekalian**: `/api/akun/profil` (halaman "Info Login" —
lihat lesson lama soal disambiguasi label) PATCH handler-nya menerima `phone`/`whatsapp`/alamat
dan menulisnya TANPA normalisasi — tapi kliennya (`akun/profil/page.tsx`) TERKONFIRMASI (grep +
baca kode) tidak pernah mengirim field itu sama sekali, HANYA `{ name }`. `/api/akun/profile-data`
(dipanggil `akun/data/page.tsx`) adalah satu-satunya endpoint LIVE untuk field itu, dan sudah benar
menormalisasi sejak awal. Fix: `/api/akun/profil` PATCH disederhanakan HANYA menerima `{ name }` —
bukan "ditambal" dengan `normalizePhone()` untuk kode yang confirmed tidak pernah dipanggil dengan
field itu (mengikuti prinsip project "kalau yakin tidak dipakai, hapus sepenuhnya" — bukan
dipertahankan sebagai duplikat berbahaya yang bisa dipanggil manual via curl tanpa normalisasi).

**Backfill data lama** — `packages/db/migrations/0041_backfill_phone_normalization.sql`:
normalisasi `public.profiles.{phone,whatsapp}` (skema tunggal) + per-tenant (loop semua tenant)
`donations.donor_phone`, `payments.payer_phone`, `invoices.customer_phone`,
`event_registrations.attendee_phone`, `contact_submissions.phone`, `letter_contacts.phone`, dan
3 key settings JSONB (`contact_phone`, `contact_whatsapp` group `contact`; `toko_whatsapp` group
`toko`). Fungsi normalisasi dibuat di `pg_temp` (session-scoped, otomatis hilang, tidak perlu
`DROP FUNCTION` manual). **`COALESCE(normalize(...), original)` WAJIB** — bukan assign langsung
hasil normalize — karena kolom `settings.value` JSONB `NOT NULL`: kalau fungsi normalize
mengembalikan NULL (input kosong/spasi doang, lolos filter `NOT LIKE '+%'` tapi sebenarnya blank),
assign langsung akan coba menulis SQL NULL ke kolom NOT NULL dan GAGALKAN SELURUH migration
di tengah jalan. `COALESCE` memastikan nilai asli dipertahankan kalau normalize tidak menghasilkan
apa-apa, bukan pernah menulis NULL.

**Ditemukan saat verifikasi lokal**: `settings.contact_phone` tersimpan sebagai JSON **number**
(bukan string) di satu tenant — kuirk lama dari jalur tulis yang berbeda entah kapan. `value #>>
'{}'` (ekstraksi JSONB path kosong ke text) bekerja seragam untuk kedua tipe, dan `to_jsonb(text)`
di ujung migration otomatis mengonversi ke JSON string — migration ini SEKALIGUS membetulkan
inkonsistensi tipe itu sebagai efek samping yang diterima, bukan disengaja secara eksplisit.

**Verifikasi**: `tsc --noEmit` bersih di kedua package (`apps/web`+`packages/db`) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan, direstart setelah
build). Migration 0041 dijalankan LOKAL 2× (idempotency check — run kedua "UPDATE 0" di semua
statement, konfirmasi aman diulang) — ditemukan+dibenarkan 1 baris `letter_contacts.phone`
(`085210626455` → `+6285210626455`) dan 2 baris settings di tenant `pc-ikpm-jogjakarta`.

**Deploy ke VPS SELESAI (2026-07-23)** — commit `3a992a4` di-push, migration 0041 dijalankan di
production (`CREATE FUNCTION` + 2× `UPDATE 0` untuk `public.profiles` + `DO` sukses tanpa error
untuk loop per-tenant — `public.profiles` production ternyata sudah bersih, tidak ada baris yang
perlu dinormalisasi di situ; PL/pgSQL `DO` block tidak expose row count per tabel jadi tidak
tahu persis berapa baris di `donations`/`payments`/`invoices`/dll yang kena, cuma tahu prosesnya
sukses tanpa error). Build+PM2 restart+curl 200 dikonfirmasi stabil (restart counter tidak naik
setelah restart, log bersih). **Verifikasi visual di browser (klik link wa.me sungguhan) masih
jadi PR user** — belum ada konfirmasi baliknya di sesi ini.

### [2026-07-23] Audit Consent Visibilitas Kontak (Usaha/Pesantren/Anggota) — Kesimpulan: Tidak Ada Bug

> Detail lengkap: **`docs/arsitektur-direktori-publik.md` § 1b/1c** (dikoreksi — sebelumnya
> keliru mendaftar "Email usaha"/"Email pesantren" sebagai field yang dikontrol toggle, padahal
> tidak ada UI di mana pun untuk mengaktifkannya).

Menyusul audit format phone/WA di atas, user tanya lanjutan: apakah toggle "tampilkan/sembunyikan"
kontak (`contacts.is_phone_public`/`is_whatsapp_public`/`is_email_public`) SUDAH konsisten,
khususnya untuk Usaha dan Profesional — prinsip yang ditegaskan user: **"semua publikasi kontak
harus sepersetujuan dari pemilik nomor... jangan sampai kita kena tuntut karena mempublish nomor
HP tanpa izin."**

**Audit menyeluruh (bukan cuma baca kode sepintas) mengonfirmasi bagian yang AMAN:**
- Ketiga halaman detail publik (`usaha/[id]`, `profesional/[id]`, `pesantren/[id]`) + `/api/
  member-public/[id]` SEMUA mengecek toggle dengan benar sebelum menampilkan apa pun — tidak
  disentuh sama sekali oleh fix format phone/WA sesi ini (formatting ditambahkan DI DALAM blok
  `if (c.isXxxPublic)` yang sudah ada, gate-nya sendiri tidak diubah).
- **Nol leak di halaman list/arsip** (`/usaha`, `/profesional`, `/pesantren`, `/anggota`) — dicek
  sampai level SQL SELECT: tidak satu pun query list yang bahkan JOIN ke tabel `contacts` sama
  sekali, jadi tidak ada risiko exposure lewat network/devtools meski UI tidak merender apa pun.
- **Nol leak lewat side-channel** — `generateMetadata` (SEO/OG) untuk keempat entitas tidak query
  `contacts` sama sekali; `/api/search` untuk member hanya `SELECT name, memberNumber`; tidak ada
  JSON-LD/structured data yang menyertakan kontak.

**2 ketidakkonsistenan ditemukan, keduanya dikonfirmasi SENGAJA oleh user (bukan bug):**
1. **Toggle email tidak ada UI-nya untuk Usaha maupun Pesantren** — kolom `is_email_public` ADA
   di skema dan SUDAH dicek di query publik (`if (c.isEmailPublic) email = c.email`), tapi baik
   admin wizard (`step4-business.tsx` malah tidak punya toggle HP/WA SAMA SEKALI, `step5-
   pesantren.tsx` punya HP/WA tapi bukan email) maupun self-service (`usaha-client.tsx`,
   `pesantren/page.tsx`) tidak pernah expose checkbox untuk mengaktifkannya. Efeknya: email
   selalu default `false` (private) selamanya untuk kedua tipe ini — **aman** (tidak pernah bisa
   ke-leak), cuma membatasi pilihan pemilik. **Keputusan user: biarkan seperti ini, JANGAN
   ditambahkan** — beda dari kontak pribadi anggota dan Profesional yang SUDAH punya toggle email.
2. **Siapa boleh menge-toggle "Publik" berbeda per entitas**: Usaha — HANYA pemilik sendiri lewat
   `/akun/usaha` (admin wizard business sama sekali tidak punya kapabilitas toggle visibilitas).
   Kontak pribadi anggota & Pesantren — admin/pengurus dashboard BISA mencentang "Publik" atas
   nama anggota (lewat `step2-contact.tsx`/`step5-pesantren.tsx`), tanpa mekanisme apa pun yang
   memverifikasi anggota sungguh sudah setuju secara langsung. **Ditanya eksplisit via
   `AskUserQuestion`: apakah kapabilitas admin ini harus dikunci hanya ke self-service (menyamakan
   dengan pola Usaha) demi memperkuat prinsip consent, atau dibiarkan sebagai wewenang
   administratif pengurus normal? Keputusan user: BIARKAN admin tetap bisa toggle** — dianggap
   wewenang administratif pengurus mengelola data anggota cabangnya, bukan celah consent yang
   perlu ditutup.

**Hasil**: NOL perubahan kode. Dua ketidakkonsistenan yang ditemukan sama-sama dikonfirmasi
sebagai keputusan produk yang disengaja, bukan gap yang perlu ditutup. Yang diperbaiki HANYA
dokumentasi (`docs/arsitektur-direktori-publik.md` § 1b/1c) — sebelumnya keliru mengklaim ada
toggle email yang berfungsi untuk usaha/pesantren, padahal secara nyata tidak ada UI untuk
memicunya di mana pun.

**Aturan yang ditegaskan untuk sesi mendatang**: kalau menemukan field yang menurut dokumen
"dikontrol toggle X" tapi grep tidak menemukan UI apa pun yang benar-benar men-set toggle itu
ke `true`, itu **bukan** otomatis berarti dokumen benar dan implementasinya kurang — cek dulu
apakah ini keputusan produk yang disengaja (seperti kasus ini) sebelum menyimpulkan "ada yang
belum selesai" dan menambah fitur yang tidak diminta. Kalau menemukan gap consent/visibilitas
serupa di masa depan, JANGAN unilateral memutuskan mana yang "lebih aman" — presentasikan
trade-off-nya dan biarkan user memutuskan, seperti pola sesi ini.

### [2026-07-23] Alur Pendaftaran Forum v2 — Perencanaan Murni, Belum Dieksekusi

> Detail lengkap: **`docs/arsitektur-backbone-ikpm.md`** § "Alur Pendaftaran Forum v2 — Prinsip
> Single-ID, Tanpa Form Baru" (v1 lama ditandai SUPERSEDED tapi dipertahankan sebagai catatan
> sejarah, § 1–3-nya yang soal schema TIDAK superseded — itu backbone umum yang sudah live).

User tanya: apakah alur pendaftaran jadi anggota FORUM (satu dari 3 tipe tenant di backbone
IKPM) sudah ada — verifikasi kode (bukan cuma baca dokumen) mengonfirmasi: **belum ada sama
sekali**. Roadmap dokumen lama sendiri (Phase 4) 100% unchecked, dan dikonfirmasi langsung:
tidak ada route `/{slug}/daftar`, tidak ada `joinForumAction`, tidak ada halaman settings
config forum, `forum_registration` tidak ada di enum `invoices.source_type`. Yang sudah ada
cuma kolom schema nganggur (`forumStatus`/`forumInvoiceId`/`approvedAt`/`expiresAt` di
`tenant_memberships`, dari migration 0018). **Ada tenant forum yang sudah live** (`forcreator`
di DB lokal) — jadi gap ini bukan teoretis, sudah bisa jadi masalah nyata kalau ada yang coba
daftar ke sana hari ini (auto-jadi member aktif tanpa konfirmasi apa pun, karena
`/api/akun/register` tidak pernah cek `tenant_type` sama sekali).

**Diskusi murni via chat (bukan Plan Mode formal), user eksplisit "jangan eksekusi apapun
dulu"** — beberapa putaran mengarah ke desain yang JAUH lebih ramping dari rencana lama:

**Kenapa rencana lama (v1, di dokumen) diganti total**: v1 mengasumsikan forum butuh FORM
PENDAFTARAN SENDIRI ("data pre-filled, alumni konfirmasi") + `invoices.source_type` baru
(`forum_registration`). User menegaskan: project ini sudah menganut **prinsip single-ID** —
data anggota hidup sekali, dipakai ulang di semua tempat — jadi "daftar jadi anggota forum"
TIDAK BOLEH jadi form baru yang mengumpulkan data lagi.

**Desain v2 yang disepakati** (lihat dokumen untuk detail lengkap):
1. **Syarat kelayakan SAMA untuk semua forum** (bukan per-forum configurable) — profil Step 1+2
   wizard `/akun/lengkapi` lengkap (Step 3 riwayat pendidikan dikecualikan) + minimal 1 dari 3
   direktori self-report (Usaha/Pesantren/Profesional — BUKAN field `professionId` umum yang
   otomatis terisi di Step 1, itu akan trivial terpenuhi semua orang).
2. **Pembayaran forum (opsional per forum) REUSE Toko/Donasi yang sudah ada** — admin forum
   cukup MENUNJUK 1 produk dan/atau 1 campaign yang sudah ada di tenantnya sebagai "syarat
   iuran", BUKAN bikin sistem invoice/pembayaran baru. Ini artinya `invoices.source_type` TIDAK
   PERLU nilai baru — checkout tetap `"cart"` seperti biasa, tinggal tambah hook di
   `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` (fungsi yang SAMA yang sudah
   disentuh sesi audit phone/WA sebelum ini) untuk cek: item invoice yang baru lunas cocok
   dengan produk/campaign yang dikonfigurasi tenant forum ini? Kalau ya → aktivasi
   `tenant_memberships`. Invoice sudah otomatis ter-scope ke tenant yang benar (billing
   per-tenant-schema) — TIDAK perlu cari lintas tenant.
3. **UX**: saat buka domain sebuah forum di `/akun` dan belum jadi anggotanya, kartu
   keanggotaan yang biasa tampil (`resolveAkunBranding()`) tetap dirender DI BELAKANG, tapi
   ketutup **overlay glass-effect** (`bg-background/80 backdrop-blur-lg`, pola yang sama
   dengan `single-mobile-topbar.tsx`) berisi tombol "Daftar Menjadi Anggota {Nama Forum}"
   (kalau eligible) atau pesan kekurangan syarat + tautan langsung ke halaman yang perlu
   dilengkapi (kalau belum eligible) — memaksa mereka menuntaskan status dulu sebelum bisa
   "melihat" kartu forum itu secara normal.
4. Klik tombol → halaman pendaftaran TERPISAH (bukan proses inline di overlay) — di situ baru
   proses lengkap terjadi (gratis = satu klik konfirmasi; berbayar = redirect ke checkout
   produk/campaign yang dikonfigurasi, reuse alur cart publik yang sudah ada sepenuhnya).

**Kolom schema `forumStatus` dkk (migration 0018) TERNYATA tidak sia-sia** — meski Phase 4
lama tidak pernah dieksekusi, kolom-kolom itu (dari perencanaan v1) ternyata PAS dipakai untuk
v2 tanpa perlu migrasi baru sama sekali — satu-satunya migrasi baru yang dibutuhkan v2 cuma
1 nilai baru di `SETTING_GROUPS` (`"forum"`), pola sama persis `0031_settings_group_event.sql`.

**Susulan di sesi yang sama — ketiga keputusan terbuka di atas SUDAH DIJAWAB user dan
DIVERIFIKASI, bukan lagi blocking:**
1. **Produk+campaign both vs either** — dijawab lebih detail dari sekadar itu: user
   menambahkan SUMBU BARU `paymentRequired: boolean` (checkbox admin) — kalau `false`
   (default), produk/campaign yang ditunjuk cuma jadi ajakan dukungan sukarela, TIDAK
   memblokir join sama sekali. `requireMode: "either"|"both"` cuma relevan kalau
   `paymentRequired=true` DAN kedua produk+campaign ditunjuk sekaligus — default `"either"`.
2. **Nama rute** — dikunci: `/gabung` (halaman pendaftaran) + `/app/{slug}/settings/
   keanggotaan` (settings admin). Dicek langsung via grep — nol collision dengan rute lain.
3. **Field `domicileStatus`** — user eksplisit menegaskan: **"kamu harus check jangan
   ngarang, ini aplikasi sudah jadi... semua ada di dokumentasi maupun actual code."** Semua
   10 field syarat kelayakan diverifikasi SATU PER SATU langsung ke
   `packages/db/src/schema/public/members.ts` + `contacts.ts` (bukan dari ingatan) — SEMUA
   cocok persis dengan yang ditulis di draft pertama, termasuk `domicileStatus` (kolom
   langsung di `members`, bukan di `addresses`).

**Aturan yang ditegaskan (generalisasi dari poin 3)**: kalau menulis rencana/dokumen
arsitektur yang menyebut nama field/kolom DB spesifik, dan belum benar-benar di-grep/dibaca
dari schema aktual saat menulisnya (ditulis dari ingatan percakapan/context), WAJIB tandai
eksplisit sebagai "belum diverifikasi" di dokumen itu sendiri (seperti yang sudah dilakukan
sesi ini) — JANGAN nulis seolah-olah sudah pasti benar. User berhak menagih verifikasi ini
sebelum implementasi, dan itu yang terjadi di sesi ini — tandanya sistem "tulis dulu, tandai
yang belum pasti, verifikasi belakangan" ini BEKERJA sesuai tujuannya (bukan sekadar formalitas).

**Status akhir sesi**: HANYA dokumen (`docs/arsitektur-backbone-ikpm.md`, termasuk update
susulan yang menutup ketiga poin di atas) yang ditulis + memory (`project_backbone_ikpm.md`)
diperbarui. **Nol baris kode aplikasi disentuh** — sesuai instruksi eksplisit user. Per § 7
dokumen (sekarang berjudul "Keputusan — Status Akhir"): **tidak ada lagi keputusan blocking
yang menggantung** — rencana v2 siap dieksekusi dari Fase A kapan pun user memberi sinyal,
kecuali 1 item yang sengaja dibiarkan di luar scope MVP pertama (cron reminder iuran tahunan).

### [2026-07-24] Alur Pendaftaran Forum v2 — Fase A+B+C Dieksekusi (Jalur Gratis End-to-End)

> Detail lengkap: **`docs/arsitektur-backbone-ikpm.md` § "Alur Pendaftaran Forum v2"** — bagian
> "Urutan Eksekusi" sekarang berisi status per-fase + daftar file yang dibuat.

User memberi izin eksekusi eksplisit dengan penekanan kuat: **"selalu terlebih dahulu claude.md
agar konsisten, dan jangan ngarang maupun membuat sesuatu tanpa cek dan recek terlebih dahulu,
ikut sop yg ada di claude.md terus selalu strick terhadap arsitektur."** — instruksi ini dipatuhi
literal: setiap nama kolom/tabel yang dipakai kode (bukan cuma yang ditulis di dokumen rencana)
diverifikasi ULANG langsung ke schema file sebelum dipakai (`members.ts`, `contacts.ts`,
`tenant-memberships.ts`, `member-businesses.ts`, `member-owned-pesantren.ts`,
`member-professionals.ts`, `tenants.ts`) — bukan disalin begitu saja dari dokumen rencana yang
sudah ditulis sebelumnya (meski dokumen itu sendiri sudah diverifikasi sesi lalu, prinsip
"jangan ngarang" diterapkan lagi di titik implementasi, bukan cuma di titik perencanaan).

**Fase A (schema)** — `SETTING_GROUPS` (`packages/db/src/schema/tenant/settings.ts`) + DDL CHECK
constraint (`create-tenant-schema.ts`) ditambah nilai `"forum"`. Migration
`0042_settings_group_forum.sql` (pola persis `0031_settings_group_event.sql`, `DO $$ LOOP` per
tenant aktif) dijalankan lokal, diverifikasi via query `pg_constraint` langsung terhadap tenant
forum (`forcreator`) — dikonfirmasi `'forum'` sudah masuk array constraint.

**Fase B+C digabung jadi satu milestone** (deviasi kecil dari rencana yang sudah dituliskan
sebelumnya, dijelaskan alasannya di dokumen) — admin settings page untuk forum ditunda ke Fase D
karena TIDAK ADA GUNANYA sampai ada picker produk/campaign untuk dikonfigurasi (Fase D); tanpa
baris `settings` key `membership_config` tersimpan sama sekali, perilaku sistem OTOMATIS berarti
"forum gratis, tanpa syarat bayar" — jadi milestone ini cukup membangun jalur gratis penuh:

- `apps/web/lib/forum-eligibility.ts` — `checkForumEligibility(memberId)`, cek ULANG 10 kolom
  langsung ke DB tiap kali dipanggil (bukan dari flag tersimpan) + `FORUM_ELIGIBILITY_LABELS`
  (Bahasa Indonesia per field) + `forumEligibilityFixHref()` (routing ke `/akun/lengkapi` atau
  `/akun/usaha` tergantung field yang kurang).
- `apps/web/app/(public)/[tenant]/gabung/{page.tsx,actions.ts,join-forum-button.tsx}` — halaman
  pendaftaran baru dengan 4 kemungkinan state (bukan member sama sekali / sudah jadi anggota
  forum ini / belum eligible dengan daftar field yang kurang + link perbaikan / eligible dengan
  tombol join). `joinForumAction` — jalur GRATIS saja untuk sekarang: verifikasi ulang session +
  identity + tipe tenant + eligibility DI SERVER (tidak percaya state client), lalu UPSERT manual
  (SELECT dulu → UPDATE kalau baris `tenant_memberships` sudah ada dengan status apa pun,
  supaya baris lama yang sempat `rejected`/`suspended` bisa diaktifkan ulang tanpa menabrak
  unique constraint `(tenantId, memberId)`; INSERT kalau belum ada baris sama sekali) dengan
  `membershipType:'forum'`, `forumStatus:'active'`, `registeredVia:'self'`.
- `apps/web/components/akun/forum-join-overlay.tsx` — komponen presentasional murni (server
  component, tanpa state), glass-effect `bg-background/80 backdrop-blur-lg`, cuma berisi `<a
  href="/gabung">` (TIDAK memproses join inline, sesuai keputusan §4 dokumen).
- `apps/web/app/(public)/[tenant]/akun/page.tsx` — overlay diwire ke 2 titik (kartu desktop "Info
  keanggotaan" + `MemberCard` mobile), masing-masing dibungkus wrapper `relative` tambahan untuk
  `absolute inset-0` overlay. Query "apakah tenant forum + apakah member sudah aktif di situ"
  SENGAJA dibuat TERPISAH dari query `membershipInfo` yang sudah ada — query lama pakai INNER
  JOIN `tenant_memberships ⋈ tenants` yang mensyaratkan baris `tenant_memberships` sudah ADA,
  padahal "belum ada baris sama sekali" justru kasus UTAMA yang harus terdeteksi overlay ini.

**Redirect pasca-join** memakai `window.location.href` (bukan `router.push`) ke `${baseUrl}/akun`
— mengikuti lesson lama "PC IKPM Cabang — Cache RSC basi di `/akun`" (§ [2026-07-13] di atas),
generalisasi: navigasi PASCA-MUTASI ke `/akun` spesifik selalu butuh full reload, bukan cuma
navigasi pasca-login.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan) — route
`/gabung` terkonfirmasi muncul di build output. Nol migrasi DB tambahan di luar migration 0042
(semua kolom `tenant_memberships` yang dipakai sudah ada sejak migration 0018 lama).

**Belum dikerjakan (Fase D+E, exposed di dokumen)**: halaman admin `/app/{slug}/settings/
keanggotaan` (picker produk/campaign + `paymentRequired`/`requireMode`), hook aktivasi forum di
`confirmInvoicePaymentAction`/`verifySubmittedPaymentAction`, dan verifikasi manual end-to-end
di browser (belum ada tenant forum + member uji coba nyata yang dicoba) — environment sesi ini
tidak punya browser/dev-server penuh untuk uji visual, konsisten keterbatasan yang sudah dicatat
berulang kali di lesson-lesson sebelumnya.

### [2026-07-24] Alur Pendaftaran Forum v2 — Fase D Dieksekusi (Integrasi Pembayaran)

> Detail lengkap: **`docs/arsitektur-backbone-ikpm.md` § "Urutan Eksekusi" → "Fase D — detail"**

Langsung menyusul Fase A+B+C (lesson di atas) — user sempat bertanya klarifikasi konseptual:
**"bukannya sudah integrated dengan donasi? jadi detected sesuai selected donasi"** — jawaban:
BENAR sebagian — mekanisme "deteksi item mana yang dibeli" memang sudah 100% ada (billing
universal, `invoice_items` selalu mencatat persis produk/campaign asalnya), yang BELUM ada
cuma DUA hal spesifik: (1) admin belum punya cara MENUNJUK campaign/produk mana yang jadi
syarat iuran forum tertentu, (2) belum ada HOOK yang mengaktifkan `tenant_memberships` setelah
pembayaran terkait itu lunas. Sebelum eksekusi, **1 pertanyaan desain krusial** diklarifikasi via
`AskUserQuestion`: kalau member yang BELUM eligible kebetulan bayar/donasi ke campaign yang
ditunjuk (via jalur MANAPUN, bukan cuma `/gabung` — misal donasi organik lewat `/campaign`),
apakah keanggotaan tetap aktif otomatis? User pilih **TIDAK** — payment saja tidak cukup,
`checkForumEligibility()` WAJIB dicek ulang di titik konfirmasi pembayaran.

**Implikasi penting dari jawaban itu**: hook aktivasi (`activateForumMembershipIfApplicable`,
`finance/billing/actions.ts`) dirancang bereaksi terhadap **SEMBARANG invoice yang lunas**
selama itemnya cocok dengan konfigurasi tenant — BUKAN cuma invoice yang berasal dari alur
`/gabung`. Ini artinya reuse billing universal benar-benar penuh: tidak perlu menandai invoice
sebagai "untuk pendaftaran forum" secara eksplisit sama sekali — siapa pun yang kebetulan
donasi/beli item yang sama (untuk alasan apa pun) otomatis dapat "dicek ulang" kelayakannya
begitu invoice-nya lunas, dan diaktifkan kalau memang eligible.

**Struktur implementasi:**
- `settings/actions.ts` — `MembershipConfigData` type (SATU sumber kebenaran, bukan 3 salinan)
  + `saveMembershipConfigAction`. Guard-nya `getTenantAccess(slug)` + cek
  `access.tenant.tenantType === "forum"` saja (POLA SAMA dengan `saveGeneralSettingsAction`/
  `saveContactSettingsAction` — bukan `hasFullAccess(...,"keuangan")` seperti billing, karena
  ini konfigurasi organisasi biasa, bukan data finansial sensitif).
- `settings/keanggotaan/page.tsx` (baru) + `settings-nav.tsx` (item "Keanggotaan" muncul
  KONDISIONAL via prop `isForum`, diteruskan dari `settings/layout.tsx` yang sudah punya
  `access.tenant.tenantType` dari `getTenantAccess`) + `membership-config-form.tsx` (2
  `<Combobox>` produk/campaign + checkbox `paymentRequired` + toggle `requireMode` yang HANYA
  muncul kalau `paymentRequired=true` DAN kedua picker terisi).
- `finance/billing/actions.ts` — `activateForumMembershipIfApplicable()` (helper privat baru,
  dipanggil dari KEDUA `confirmInvoicePaymentAction` DAN `verifySubmittedPaymentAction`) —
  dipanggil SETELAH `db.transaction()` (tenant-schema) commit, BUKAN di dalamnya, karena
  `tenant_memberships` ada di PUBLIC schema (koneksi terpisah dari `tx`). Dibungkus try/catch
  TERPISAH dari catch utama — pembayaran yang sudah sah TIDAK BOLEH gagal tercatat hanya karena
  aktivasi forum error (fakta "uang sudah masuk" independen dari "keanggotaan teraktivasi").
  Gating "hanya saat benar-benar lunas (bukan partial)" pakai object holder
  `paymentStatusInfo: {newStatus: string}` — bukan `let newStatus` polos — konsisten dengan
  lesson lama soal TypeScript narrowing `never` pada `let` yang di-reassign di dalam closure
  `db.transaction()` dan diakses sesudahnya.
- `gabung/actions.ts` — `joinForumAction` ditambah guard: tolak eksplisit kalau
  `paymentRequired=true` (pertahanan server-side KEDUA — UI `/gabung` sudah tidak menampilkan
  tombol join untuk kasus ini, tapi "server action publik tidak boleh percaya state client"
  sudah berkali-kali ditegaskan sepanjang project ini).
- `gabung/page.tsx` — branch UI: `paymentRequired=false` → tombol join seperti sebelumnya (+
  CTA "Ingin mendukung forum ini?" opsional kalau ada produk/campaign dikonfigurasi meski tidak
  wajib); `paymentRequired=true` → TIDAK ADA tombol join sama sekali, cuma link ke halaman
  produk/campaign (mengikuti `requireMode` — "salah satu cukup" atau "wajib keduanya") dengan
  penjelasan "keanggotaan aktif otomatis setelah pembayaran dikonfirmasi". Klik link ini
  langsung ke halaman PUBLIK biasa (`/produk/{slug}`/`/campaign/{slug}`) — TIDAK ADA action
  custom "tambah ke cart" baru dibuat untuk alur ini, murni reuse flow checkout yang sudah ada.

**Matching invoice item ↔ config**: `itemType='product' AND itemId=requiredProductId`,
`itemType='donation' AND itemId=requiredCampaignId`. **Limitasi yang diterima dan
didokumentasikan**: campaign tipe QURBAN tidak akan pernah match kalau ditunjuk sebagai
`requiredCampaignId` — item qurban di cart tersimpan dengan `itemId=qurban_animals.id` (bukan
`campaigns.id` langsung, sesuai arsitektur donasi yang sudah dikunci lama) — admin sebaiknya
menunjuk campaign donasi REGULAR sebagai syarat iuran, bukan qurban.

**Tipe dibagi lintas 3 file via import type, bukan 3 salinan independen**: `MembershipConfigData`
didefinisikan SATU KALI di `settings/actions.ts` (pemilik penulisan config), diimpor sebagai TYPE
oleh `finance/billing/actions.ts` (`../../settings/actions`) dan `gabung/{actions,page}.tsx`
(`../../../(dashboard)/app/[tenant]/settings/actions`) — relative path lintas route group
diverifikasi dengan `node -e "path.resolve(...)"` sebelum dipakai (bukan dihitung manual dan
dipercaya begitu saja), karena sempat salah hitung satu level di percobaan pertama (`../` vs
`../../`) — dikoreksi sebelum `tsc` sempat menangkapnya.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan dulu, `.next` dibersihkan) — route `/settings/keanggotaan` DAN
`/gabung` terkonfirmasi muncul di build output. Nol migrasi DB tambahan (key JSONB baru
`membership_config` di group `"forum"` yang skemanya sudah dibuat Fase A — tidak perlu ALTER
TABLE lagi). **Belum diverifikasi visual di browser, belum ada tenant forum + konfigurasi
pembayaran nyata yang dicoba end-to-end** — Fase E (verifikasi manual penuh + deploy) masih
menunggu, dan ini SATU-SATUNYA fase tersisa dari roadmap.

### [2026-07-24] Standar Label Keanggotaan — "Lengkapi Data" vs "Anggota X" (2 Bug Ditemukan)

> Detail lengkap: **`docs/arsitektur-akun.md` § "Standar Label Keanggotaan"**

User bikin tenant forum lokal (`forcreator`) untuk uji coba, langsung menemukan gejala nyata:
badge "Anggota Forcreator" muncul di sidebar `/akun` begitu daftar — tanpa pernah isi data
apa pun, apalagi lewat `/gabung`. Investigasi menemukan **2 bug independen**, bukan cuma soal
teks label:

1. **`joinTenant()` di `/api/akun/register`** — insert `tenant_memberships` `status:"active"`
   untuk tenant APA PUN tempat orang daftar, tanpa cek `tenantType`. Registrasi langsung di
   domain forum otomatis bikin baris keanggotaan aktif, MELEWATI seluruh gate `/gabung` yang
   baru dibangun sesi sebelumnya.
2. **`resolveAkunBranding()`'s "genuine member" check** — cukup "ada baris `tenant_memberships`
   apa pun", tidak pernah cek `forumStatus`.

**User memberi standar baru dalam 3 poin — salah satunya ternyata typo** ("sudah melengkapi"
seharusnya "belum melengkapi", dikonfirmasi via `AskUserQuestion` sebelum eksekusi karena
membalik total arah logikanya):
1. **Prasyarat universal SEBELUM label apa pun bisa "Anggota X"**: profil harus lolos
   `checkForumEligibility()` (REUSE fungsi yang sama dari alur forum — bukan bikin fungsi baru,
   bar-nya PERSIS sama: data pribadi Step1+2 kecuali Riwayat Pendidikan + minimal 1 dari 3
   direktori). **Dikonfirmasi user: berlaku SEMUA tipe tenant** (cabang/marhalah/forum) — bukan
   cuma forum, meski ini berarti anggota lama yang auto-join tapi belum pernah isi
   `/akun/lengkapi` akan melihat labelnya berubah dari "Anggota PC IKPM X" jadi "Lengkapi Data"
   setelah deploy.
2. Belum lolos → `"Lengkapi Data"`, ikon centang (`BadgeCheck`) TIDAK ditampilkan.
3. Sudah lolos: cabang/marhalah TIDAK berubah ("ada baris" tetap cukup — auto-populate tidak
   punya tahap verifikasi terpisah); forum SEKARANG wajib `forumStatus='active'` (genuinely
   lewat `/gabung`) — kalau belum, fallback ke cabang resmi sendiri ("Anggota PC IKPM <cabang
   dia>"), BUKAN nama forum yang sedang dibrowsing.

**Klarifikasi tambahan dari user (jawaban Q3 yang awalnya "bingung pilih mana")**: register flow
tetap SAMA untuk semua tipe tenant (base member record dibuat identik) — yang beda adalah APA
YANG TERJADI SETELAHNYA: cabang/marhalah auto-jadi anggota begitu data lengkap DAN memenuhi
kriteria tenant (cabang: `primaryCabangRefId` cocok; marhalah: `graduationYear`/`period` cocok)
— mekanisme auto-populate yang SUDAH ADA, tidak disentuh. Forum HARUS tetap lewat `/gabung` —
melengkapi data cuma prasyarat untuk BISA verified, bukan verifikasi itu sendiri.

**Implementasi**: `resolveAkunBranding()` direstrukturisasi — 3 `return` terpisah (satu per
langkah resolusi) digabung jadi 1 variable `resolved` yang di-assign per langkah, supaya
eligibility override (`checkForumEligibility()` dipanggil SEKALI di awal fungsi) bisa diterapkan
SEKALI di titik akhir — bukan diulang 3×. Field baru `verified: boolean` ditambah ke
`ResolvedAkunBranding`. **Hanya `memberLabel` yang di-override** jadi "Lengkapi Data" saat belum
eligible — `logoUrl`/`orgName`/`primaryColor` tetap resolve normal (identitas visual kartu tidak
berubah, cuma klaim status yang jujur) — `MemberCard` sama sekali tidak perlu disentuh karena
tidak pernah membaca `memberLabel`. Step 1 forum-aware pakai spread kondisional:
`and(eq(memberId), eq(tenantId), ...(isForum ? [eq(forumStatus,"active")] : []))`.
`akun/layout.tsx`+`akun/page.tsx` — `BadgeCheck` di kedua tempat digate `memberVerified`;
`AkunMobileHeader` (badge teks polos, tanpa ikon) otomatis benar tanpa disentuh.
`register/route.ts`'s `joinTenant()` — tambah `registeredAtTenantType` ke SELECT tenant lookup
yang sudah ada, skip insert `tenant_memberships` total kalau `tenantType==="forum"`.

**Efek samping diterima**: `checkForumEligibility()` sekarang bisa terpanggil 2× per render
`/akun` untuk forum tenant yang belum join (sekali oleh `ForumJoinOverlay` block yang sudah ada
sesi sebelumnya, sekali lagi di dalam `resolveAkunBranding()`) — duplikasi query kecil, tidak
di-cache/share, diterima demi menghindari refactor lintas fungsi untuk beberapa SELECT ringan.

**Aturan yang ditegaskan (lagi)**: kalau instruksi user berisi kondisi if/then yang terbaca
kontradiktif dengan alur logika di sekitarnya (di sini: poin 1 vs poin 2-3), JANGAN diam-diam
"membetulkan" via asumsi — konfirmasi eksplisit via `AskUserQuestion` sebelum menulis kode,
persis yang dilakukan di sesi ini. Kalau jawaban user untuk pertanyaan pilihan-ganda ternyata
"saya bingung, tapi mudah-mudahan kamu bisa simpulkan maksud saya" — itu sinyal untuk MENYUSUN
ULANG pemahaman dari narasi bebas yang mereka berikan (bukan salah satu opsi literal yang
ditawarkan), verifikasi masuk akal secara arsitektur, baru eksekusi — bukan memaksakan salah
satu pilihan A/B yang sudah disediakan.

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan, direstart setelah build karena user sedang aktif
menguji). Nol migrasi DB. **Belum diverifikasi visual di browser** — user yang punya tenant
forum `forcreator` lokal perlu konfirmasi langsung setelah reload.

### [2026-07-24] Eligibility Overlay Digeneralisasi ke Semua Tipe Tenant + Rename Total

> Detail lengkap: **`docs/arsitektur-akun.md` § "Eligibility Overlay Generik"**

Dua permintaan susulan berurutan di sesi yang sama:

1. **"Tombol rancu"** — overlay forum selalu mengarah ke `/gabung` meski belum eligible sama
   sekali (double-hop membingungkan). Dipecah jadi 3 kondisi eksplisit berdasar `missing[]`
   (bukan cuma `eligible: boolean`): profil belum lengkap → "Lengkapi Data Pribadi" →
   `/akun/lengkapi`; tinggal direktori → "Lengkapi Data →" buka **popup** 3 pilihan
   (`DirectoryChoicePopover`, client component baru, Radix `Popover` — pola sama `Combobox`);
   eligible → "Gabung {tenantName}" → `/gabung` (satu-satunya kasus yang benar masuk situ).
2. **Generalisasi ke SEMUA tipe tenant** — user: "bedanya kan cuma: selain anggota forum tidak
   perlu masuk URL /gabung, tenant lain otomatis menjadi anggota... ini kita namakan
   eligibiliti kali ya biar konsisten." Diminta rename TOTAL dari istilah forum-spesifik ke
   generik, di seluruh codebase — bukan cuma tambah fitur baru.

**Rename lengkap** (logic CHECK-nya sendiri, 10 field + minimal 1 direktori, TIDAK berubah):
`lib/forum-eligibility.ts`→`lib/member-eligibility.ts`, `checkForumEligibility()`→
`checkMemberEligibility()`, `ForumEligibilityField/Result`→`MemberEligibilityField/Result`,
`FORUM_ELIGIBILITY_LABELS`→`MEMBER_ELIGIBILITY_LABELS`, `forumEligibilityFixHref()`→
`memberEligibilityFixHref()`, `components/akun/forum-join-overlay.tsx`
(`ForumJoinOverlay`)→`membership-eligibility-overlay.tsx` (`MembershipEligibilityOverlay`).
6 file importer diupdate via `sed` per-simbol (bukan cari-ganti membabi buta satu pola besar) —
grep akhir `checkForumEligibility|ForumEligibilityField|ForumJoinOverlay|forum-eligibility|
forum-join-overlay` di seluruh `apps/web` mengonfirmasi nol sisa referensi lama.

**Kondisi tampil overlay SEKARANG beda per tipe tenant** (keputusan kunci, bukan sekadar
rename) — ditentukan di `akun/page.tsx`:
```typescript
if (tenantType === "forum") {
  showOverlay = forumStatus !== "active";   // termasuk "eligible tapi belum klik gabung"
} else { // cabang / marhalah
  showOverlay = !eligibility.eligible;       // begitu eligible, keanggotaan SUDAH otomatis
}
```
Untuk cabang/marhalah, `tenant_memberships` row SUDAH ter-insert otomatis oleh mekanisme
auto-populate lama (matching `primaryCabangRefId`/`graduationYear`+`period`) — TIDAK bergantung
eligibility sama sekali, TIDAK disentuh. Overlay di sana MURNI soal "kartu belum layak
ditampilkan sampai data lengkap" — begitu eligible, overlay hilang, kartu langsung terlihat
TANPA tombol join apa pun (beda dari forum). `MembershipEligibilityOverlay` punya guard
defensif `if (eligible && !isForum) return null` untuk mencegah "Gabung X" tersaran ke tenant
yang tidak punya alur itu, meski caller seharusnya sudah tidak pernah merendernya di kondisi
itu.

**Aturan yang ditegaskan (generalisasi dari permintaan user)**: kalau user secara eksplisit
minta penamaan diseragamkan/digeneralisasi ("biar konsisten"), itu BUKAN sekadar preferensi
kosmetik yang boleh diabaikan — treat sebagai instruksi refactor penuh: rename FILE + semua
export + semua importer, bukan cuma menambah fungsionalitas baru di atas nama lama yang sudah
menyesatkan. Verifikasi selesai via grep pola lama = nol hasil, bukan cuma "kompilasi lolos"
(kompilasi bisa lolos meski ada sisa nama lama yang re-export dari alias, jadi grep tetap
langkah wajib terpisah).

**Verifikasi**: `tsc --noEmit` bersih + `bun run build --filter=@jalajogja/web` sukses (dev
server dimatikan dulu, `.next` dibersihkan, direstart tiap kali — user aktif menguji sepanjang
sesi ini). Nol migrasi DB. **Belum diverifikasi visual di browser** — khususnya kasus cabang/
marhalah yang belum eligible (member lama yang belum isi `/akun/lengkapi`) perlu dicoba user
untuk konfirmasi overlay benar-benar menutupi kartu, bukan cuma teks badge yang berubah.

### [2026-07-24] Kategori Profesi Baru "Kreatif" — Bug CHECK Constraint Tertinggal

> Detail lengkap: **`docs/arsitektur-profesional.md` § 14**

User minta kategori profesi baru "Kreatif" untuk forum "Forcreator" (kreator & pekerja seni) —
didiskusikan dulu (9 Bidang Usaha dari kepengurusan mereka dipetakan ke jenis profesi spesifik,
pola sama "setiap profesi entitas terpisah" yang sudah dikunci di § 2.4 dokumen, mis. Media
Rekam → Fotografer/Videografer/Editor sebagai 3 profesi berbeda) sebelum eksekusi. User sempat
tanya ulang untuk konfirmasi level: "Bidang Usaha" BUKAN level tersendiri di sistem 3-level
(kategori→jenisProfesi→spesialisasi) — cuma data acuan untuk menurunkan `professionType`;
"Kreatif" sendiri adalah SATU kategori baru sejajar 7 kategori existing.

**Bug ditemukan saat implementasi (bukan cuma nambah 1 baris konstanta)**: menambah "Kreatif"
HANYA di `lib/professional-types.ts` menyebabkan TypeScript error di `profesional/page.tsx` —
kolom `member_professionals.profession_category` di Drizzle schema
(`packages/db/src/schema/public/member-professionals.ts`) punya `text(..., {enum:[...]})`
SENDIRI, daftar TERPISAH yang harus disinkronkan manual (tidak saling reference). Lebih dalam
lagi: kolom ini JUGA punya **CHECK constraint PostgreSQL sungguhan**
(`member_professionals_profession_category_check`, dari migration `0027`, DDL inline `CHECK
(...IN(...))`— bukan `pgEnum`, sesuai aturan project) — mengubah TypeScript enum saja TIDAK
CUKUP, INSERT `professionCategory:"Kreatif"` akan tetap ditolak DB kalau constraint-nya tidak
ikut diupdate.

**Fix — 2 titik**: Drizzle schema enum ditambah `"Kreatif"` + migration baru
`0043_member_professionals_kreatif_category.sql` (`DROP`+`ADD CONSTRAINT`). `member_
professionals` ada di PUBLIC schema (bukan per-tenant) — migration ini jalan SEKALI, BUKAN
loop `DO $$ ... LOOP` per tenant seperti migration `settings.group` sebelumnya di sesi ini.
Constraint name diverifikasi LANGSUNG via `psql \d public.member_professionals` (bukan ditebak
dari pola auto-generate Postgres) sebelum menulis migration.

**Aturan yang ditegaskan**: kalau sebuah kolom `text(...,{enum:[...]})` di Drizzle punya
"kembaran" konseptual di file konstanta terpisah (di sini: `PROFESSION_CATEGORIES` di `lib/`),
KEDUANYA wajib diupdate bersamaan — DAN kalau kolom itu dibuat via migration SQL manual (bukan
`drizzle-kit generate` otomatis), kemungkinan besar ADA CHECK constraint DB sungguhan yang juga
perlu di-`ALTER` terpisah. `tsc` menangkap SEBAGIAN masalah (union type mismatch di consumer
query lain) tapi TIDAK PERNAH menangkap CHECK constraint DB yang ketinggalan — itu cuma
ketahuan lewat error runtime saat insert, atau lewat pengecekan manual `\d` seperti di sesi ini.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan, direstart).
Migration `0043` dijalankan+diverifikasi di lokal (`\d` mengonfirmasi `'Kreatif'` masuk
constraint). **Belum dijalankan di VPS. Belum diverifikasi visual** — user diminta coba tambah
profesional kategori "Kreatif" di `/akun/profesional`.

### [2026-07-24] Bidang Usaha `/akun/usaha` — Facet Independen, Bukan Sub-Sektor

> Detail lengkap: **`docs/arsitektur-usaha.md`** (dokumen baru)

Lanjutan diskusi kategori "Kreatif" — user tanya apakah 9 Bidang Usaha forcreator bisa
dimasukkan juga ke `/akun/usaha` (bukan cuma `/akun/profesional`). Diskusi berkembang jadi
sesuatu yang lebih besar: user mengungkap tujuan sesungguhnya adalah **matchmaking** — retailer
menemukan produsen yang relevan, kolaborasi lintas bidang usaha, bukan sekadar data lebih rinci.

**Masalah kritis yang DITEMUKAN USER SENDIRI sebelum implementasi**: percobaan pertama
membayangkan struktur bertingkat `sector → sub-sector` (9 bidang di bawah "Kreatif"). User
langsung melihat cacatnya: bidang spesifik sering tumpang tindih lintas sektor (mis. "Desain
Komunikasi Visual" masuk akal sebagai "Kreatif" MAUPUN "Jasa Profesional" — tidak ada satu
induk yang benar). Ini BUKAN bug desain user, itu sifat datanya sendiri.

**Solusi**: `sector` (7 nilai, sudah ada) **tidak diubah**. Field BARU `businessFields:
string[]` — **facet independen**, bukan anak dari sector manapun. Satu usaha bisa multi-tag
lintas bidang, tidak terikat ke satu sektor. Ini menghilangkan masalah "yang mana induknya"
sepenuhnya — tag tidak dimiliki siapa pun.

**Fase 2 didokumentasikan (BUKAN dibangun)**, atas permintaan eksplisit user ("bagus untuk
dicatat dalam arsitektur"): field `supplies`/`seeking` ("saya menyediakan"/"saya membutuhkan")
untuk mesin pencocokan B2B — SENGAJA memakai vocabulary yang SAMA dengan `businessFields`,
supaya begitu dibangun nanti, pencocokan bisa langsung jalan tanpa migrasi data ulang. Urutan
yang benar: kosakata dulu (Fase 1, sekarang), mesin pencocokan menyusul (Fase 2, nanti).

**Implementasi Fase 1**:
- `packages/db/src/schema/public/member-businesses.ts` — kolom baru `businessFields:
  jsonb(...).$type<string[]>().notNull().default([])`
- `packages/db/migrations/0044_member_business_fields.sql` — sekali jalan (public schema)
- `apps/web/lib/business-fields.ts` — `BUSINESS_FIELD_SUGGESTIONS`, 9 Bidang Usaha ASLI dari
  forcreator (BUKAN daftar 15 profesi yang lebih pecah seperti `professionType` "Kreatif" —
  usaha dikategorikan per domain/industri, satu usaha bisa sekaligus fotografi+videografi+
  editing di bawah satu badan usaha, beda dari profesi yang per-jabatan individu)
- `components/ui/tag-multi-select.tsx` (BARU, generik) — multi-select autocomplete+creatable,
  pola interaksi sama `TagInput` (`post-form.tsx`, pills+dropdown+koma/Enter+backspace) tapi
  value `string[]` polos TANPA DB-backed entity/server-action (beda dari `TagInput` yang
  panggil `createTagAction` untuk tag artikel) — reusable untuk kebutuhan multi-select serupa
  di tempat lain.
- Diwire ke **KEDUA** tempat sesuai aturan "update form anggota di front-end DAN admin
  sekaligus": `/akun/usaha` (`usaha-client.tsx` + API route) DAN admin wizard
  (`step4-business.tsx` + `saveMemberBusinessesAction` + 2 halaman admin yang mengonstruksi
  `BusinessEntry[]` dari data DB — `members/[id]/edit/page.tsx` DAN
  `member-data-sections.tsx`, ditemukan via `tsc` sebagai 2 titik yang butuh field baru).

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (2 putaran — putaran
pertama menangkap 1 titik construction `BusinessEntry[]` yang terlewat, langsung difix) +
`bun run build --filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan,
direstart). Migration `0044` dijalankan+diverifikasi di lokal. **Belum dijalankan di VPS. Belum
diverifikasi visual** — user diminta coba tambah "Bidang Usaha" di `/akun/usaha`.

### [2026-07-24] Halaman `/gabung` — Info Pendaftaran Custom + Persetujuan Legal + Header Diperkaya

> Susulan langsung dari Fase D (lesson di atas). Detail penuh (termasuk penjelasan lebih
> panjang): `docs/arsitektur-backbone-ikpm.md` § "Susulan Fase D — Informasi Pendaftaran +
> Persetujuan Legal".

User mencoba tenant forum lokal (Forcreator) dan minta halaman `/gabung` bisa menampilkan teks
penjelasan organisasi yang custom per forum — contoh yang diberikan eksplisit menyebut sifat
keanggotaan **EKSKLUSIF** (dikoreksi user sendiri di tengah pengetikan dari draft awal
"inklusif" — khusus IKPM Gontor, bukan terbuka untuk umum), plus checkbox persetujuan Syarat &
Ketentuan + Kebijakan Privasi sebelum tombol join (pola sama `/register`), plus (permintaan
susulan) UI logo tenant + kartu info yang lebih "keren" — bukan cuma teks tanpa dan box abu-abu.

**Field baru `registrationInfo: string | null`** ditambah ke `MembershipConfigData` (satu
field lagi di JSONB `membership_config`, group "forum" — TIDAK butuh migrasi DB, konsisten
dengan field lain di key ini). Textarea admin baru di `MembershipConfigForm`
(`/settings/keanggotaan`), ditampilkan sebagai teks bebas multi-paragraf
(`whitespace-pre-line`, baris baru dipertahankan) di `/gabung` — **dipindah supaya SELALU
tampil, terlepas status eligibility pengunjung** (bukan cuma saat `eligibility.eligible`, yang
tadinya jadi syarat fetch `config` sama sekali) — teks organisasi relevan untuk SEMUA calon
anggota, bahkan yang belum lengkap datanya, bukan cuma yang sudah lolos gate.

**`LegalModal` diekstrak jadi komponen shared** (`components/akun/legal-modal.tsx`) — sebelumnya
private/inline di `register/register-form.tsx` (~50 baris fetch+dialog logic). Dipakai ulang
oleh `gabung/join-forum-button.tsx`: checkbox "Dengan ini saya menyatakan menyetujui Syarat dan
Ketentuan serta Kebijakan Privasi" ditaruh tepat di atas tombol "Ya, Saya Ingin Bergabung",
tombol di-disable sampai dicentang — pola identik `agreed` state di form register. Modal tetap
konsumsi API yang sama (`GET /api/akun/legal?slug=&template=terms|privacy`, halaman legal
singleton tenant) — nol endpoint baru. Ini konsumen KEDUA yang genuinely membenarkan ekstraksi
(beda dari kebanyakan pola "duplikasi demi isolasi" di project ini) — komponen murni
presentasional+fetch tanpa efek samping, risiko share mendekati nol.

**Header `/gabung` diperkaya** (permintaan eksplisit "UI design-nya lebih keren... kalau ada
logo panggil logo, kasih bulatan border"): `logo_url` tenant di-fetch via
`getSettings(tenantDb, "general")` PARALEL dengan `membership_config` (`Promise.all`, satu
`tenantDb` yang sama dipakai keduanya — tidak query ulang). **Koreksi user setelah draft
pertama**: logo BUKAN elemen dekoratif tambahan di ATAS judul — logo **menggantikan** label
teks nama tenant yang sebelumnya selalu tampil di bawah "Daftar Menjadi Anggota". Jadi:
`h1` "Daftar Menjadi Anggota" tetap SELALU tampil, lalu SATU dari dua di bawahnya —
`logoUrl` ada → avatar bulat `h-16 w-16` (`ring-4 ring-primary/10` + border putih + shadow);
`logoUrl` kosong → teks nama tenant seperti semula (`text-lg font-semibold text-primary`).
Draft pertama salah menaruh KEDUANYA (avatar/badge-inisial DI ATAS + teks nama DI BAWAH) —
fallback inisial-huruf dihapus total karena tidak lagi relevan (kalau tidak ada logo, cukup
teks, bukan badge inisial). Kartu info registrasi diberi header kecil "Tentang {tenant}"
(ikon `Info`, `text-primary` uppercase) + gradient tipis `from-primary/[0.04]`, menggantikan
box abu-abu polos draft pertama — bagian ini TIDAK dikoreksi, tetap seperti semula.

**Aturan yang ditegaskan (generalisasi)**: setiap kali sebuah setting per-tenant (di sini:
`membership_config`) menyimpan campuran "field yang cuma relevan kalau eligible/lulus syarat"
(product/campaign syarat iuran) DAN "field yang relevan untuk SEMUA pengunjung terlepas status
mereka" (info organisasi), JANGAN gate fetch keseluruhan config di belakang kondisi eligibility
— fetch config-nya SEKALI di awal, lalu gate PENGGUNAAN field per-fieldnya sendiri-sendiri
sesuai relevansinya. Draft pertama sesi ini sempat salah menggate seluruh `getSetting(...)` di
belakang `if (eligibility.eligible)`, sehingga `registrationInfo` tidak pernah terbaca untuk
member yang belum lengkap datanya — root cause yang sama dengan pola "jangan gabung dua
keputusan berbeda dalam satu guard" yang sudah berulang di project ini.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` (2× — sekali setelah field+modal, sekali
lagi setelah redesign header) + `bun run build --filter=@jalajogja/web` sukses (dev server
dimatikan dulu, `.next` dibersihkan, direstart). Nol migrasi DB. **Belum diverifikasi visual di
browser** — user perlu isi textarea "Informasi Pendaftaran" di `/settings/keanggotaan` (tenant
forum lokal `forcreator`) lalu buka `/gabung` untuk lihat hasil render logo+info+checkbox.

### [2026-07-24] Nomor Keanggotaan Lokal Forum — Khusus Forum, Counter Tidak Reset, Simpan String Jadi

> Detail penuh: **`docs/arsitektur-backbone-ikpm.md` § "Nomor Keanggotaan Lokal Forum"**.

User sadar setelah coba `/gabung`: forum butuh nomor identitas anggota SENDIRI, terpisah dari
`members.member_number` (global lintas IKPM) — contoh: `2017.00001` (tahun + urutan 5-digit).
Dikonfirmasi via `AskUserQuestion` sebelum eksekusi (ini nambah schema baru + logic penomoran
atomic — aturan project "tanya konfirmasi sebelum ubah arsitektur"): **khusus tenant forum**
(TIDAK digeneralisasi ke cabang/marhalah — mereka sudah punya `member_number` global), dan
**counter TIDAK reset per tahun** (jalan terus selama umur tenant, bukan "urutan dalam tahun
itu"). Format: preset dropdown 3 pilihan (bukan token-engine bebas ketik seperti nomor surat) —
Tahun+Urutan (default), Tahun+Tgl Lahir+Urutan (recipe SAMA PERSIS `member_number` global,
`lib/member-number.ts`), Bulan-Tahun+Urutan. **Nomor disimpan sebagai string hasil jadi**
(bukan direkonstruksi dari bagian mentah di titik baca) — prinsip yang sudah berkali-kali
ditegaskan di project ini untuk menghindari kelas bug "format ulang di titik baca" (Rupiah
ICU/CLDR, `displayPhone()` dipakai ulang untuk wa.me, dll).

**Schema baru** (migration `0045_forum_membership_number.sql`): kolom
`tenant_memberships.membership_number` + tabel PUBLIC-schema baru
`forum_membership_sequences` (satu baris per tenant, `SELECT ... FOR UPDATE` di dalam
`db.transaction()` — pola locking SAMA PERSIS `letter_number_sequences`, cuma dipindah ke
public schema karena `tenant_memberships` sendiri ada di sana, TANPA kolom `year`/`period`
karena counter tidak reset).

**Bug client/server boundary ditemukan+difix SEGERA saat `next build`** (PERSIS lesson lama
`nav-menu.ts`/`tenant-timezone.ts`, terulang lagi — `tsc --noEmit` TIDAK menangkap ini sama
sekali, cuma `next build` yang tahu): `lib/forum-membership-number.ts` awalnya satu file
(`import "server-only"` + konstanta + fungsi generate yang butuh `db`), diimpor oleh
`membership-config-form.tsx` (client component, cuma butuh daftar preset+label) → build gagal
eksplisit *"You're importing a component that needs 'server-only'... not supported in the
pages/ directory"*. Fix: split jadi `lib/forum-membership-number.ts` (client-safe: konstanta +
`formatForumMembershipNumber()` pure function, ZERO import `@jalajogja/db`) +
`lib/forum-membership-number.server.ts` (`import "server-only"`,
`generateForumMembershipNumber()` yang butuh DB).

**Generation di dua titik aktivasi** (`joinForumAction` jalur gratis + `activateForumMembership
IfApplicable` jalur bayar) — keduanya guard `existing?.membershipNumber` dulu, HANYA generate
kalau kosong (member yang sempat suspended lalu aktif lagi TIDAK dapat nomor baru).

**Display**: baris baru "No. Anggota Forum" di panel "Info keanggotaan" desktop `/akun`.
Admin dashboard member detail belum menampilkan ini (di luar scope MVP).

**Susulan — MemberCard mobile (permintaan langsung sesudah fitur di atas live)**: bukan baris
tambahan seperti desktop — nomor forum **menggantikan** `memberNumber` (No. Anggota global)
yang tampil besar di tengah kartu, plus caption kecil di bawahnya "No. ID {nama forum}".
`MemberCard` (`components/akun/mobile/member-card.tsx`) dapat prop opsional
`forumMembershipNumber?: string | null` — cabang render 3-tingkat: forum number ada → tampilkan
itu + caption (bukan `memberNumber` sama sekali); tidak ada → fallback `memberNumber`; kosong
dua-duanya → fallback `stambuk`. **Reuse `siteName` yang sudah ada untuk caption** — TIDAK
butuh prop nama-tenant baru, karena `forumMembershipNumber` HANYA terisi untuk member yang
genuinely aktif di forum yang sedang dibrowsing, dan pada kondisi itu `resolveAkunBranding()`
SUDAH resolve `siteName` ke tenant forum itu sendiri (bukan kebetulan — konsekuensi langsung
arsitektur resolusi branding yang dikunci sebelumnya, § "Resolusi Branding Kartu Anggota" di
`docs/arsitektur-akun.md`). Tidak berlaku cabang/marhalah secara otomatis (data-driven guard,
kolom memang tidak pernah diisi untuk keduanya).

**Limitasi diterima (bukan lupa)**: TIDAK ada backfill untuk anggota forum yang sudah aktif
SEBELUM fitur ini diaktifkan — mereka `membership_number` tetap NULL selamanya kecuali
dibackfill manual nanti. Diterima karena tenant konteks fitur ini (Forcreator) masih baru.

**Aturan yang ditegaskan (ke-3 kalinya di project ini)**: setiap kali membuat file `lib/*.ts`
BARU yang akan diimpor client component, WAJIB cek dari awal apakah file itu (atau apa yang
di-`export ... from`-nya) mengimpor `@jalajogja/db` — kalau ya, split dari awal jadi
`nama.ts` (client-safe) + `nama.server.ts` (`import "server-only"`), JANGAN tunggu `next build`
gagal untuk ketahuan. `tsc --noEmit` tidak cukup untuk memverifikasi ini.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (2×, sekali untuk fitur
inti, sekali lagi untuk susulan MemberCard) + `bun run build --filter=@jalajogja/web` sukses
(2×, dev server dimatikan+dibersihkan+direstart tiap kali). Migration `0045` dijalankan+
diverifikasi di lokal. **Belum dijalankan di VPS. Belum diverifikasi visual** — user perlu
aktifkan format di `/app/{slug}/settings/keanggotaan` (tenant `forcreator`), coba join via
`/gabung`, cek hasil di `/akun` (desktop + mobile).

### [2026-07-24] Audit Menyeluruh Modul Surat — Dokumen Basi Dikoreksi + 2 Bug Ditemukan

> Dokumen baru: **`docs/arsitektur-modul-surat.md`** (indeks + hasil audit menyeluruh, JANGAN
> baca sebagai duplikasi 3 dokumen detail yang sudah ada — 3 dokumen itu tetap sumber kebenaran
> untuk detail teknis masing-masing bagian).

User minta audit menyeluruh modul Surat sebelum istirahat — cek arsitektur ada/tidak, cek kode
aktual, cek apakah dokumen dan implementasi benar-benar konsisten, cek khusus notifikasi WA
saat butuh TTD, cek gap/bug, rencanakan perbaikan (BUKAN eksekusi langsung). 3 dokumen arsitektur
sudah ada (`arsitektur-surat.md`, `arsitektur-surat-detail.md`, `arsitektur-tandatangan.md`) —
diverifikasi SATU PER SATU ke kode aktual via grep+Read langsung, bukan dipercaya begitu saja.

**2 dokumen basi ditemukan+dikoreksi** (murni dokumentasi, kode-nya sendiri sudah benar):
1. `arsitektur-surat.md` header tertulis **"PROPOSAL — belum dieksekusi"**, padahal SEMUA
   fiturnya (3 layout identitas, format tanggal Masehi/Hijriah per jenis surat, kalender Hijriah
   `Intl.DateTimeFormat`, `attachment_label`, fetch `letter_types.name` untuk Layout 3 di PDF)
   dikonfirmasi 100% sudah live di kode — dokumen ini ditulis April, tidak pernah diupdate
   statusnya meski sudah lama dieksekusi. Sekalian dikoreksi: § 5-nya salah mendeskripsikan
   penyimpanan setting sebagai 2 key terpisah (`letter_date_format`/`letter_hijri_offset`),
   padahal implementasi aktual pakai SATU object `letter_config` (key tunggal, group="general")
   yang menampung semua pengaturan surat sekaligus.
2. `arsitektur-tandatangan.md` — **kontradiksi internal dalam DOKUMEN YANG SAMA**: § 5 menulis
   "Accordion 'Lihat Preview Surat' — render body surat via `renderBody()`" seolah sudah ada,
   tapi § 11 "Pertanyaan Terbuka" (di dokumen yang sama!) menulis "saat ini tidak ada preview
   isi surat". Diverifikasi ke kode: § 11 yang BENAR — `sign/[token]/page.tsx` tidak pernah
   fetch kolom `body`, `signing-page-client.tsx` tidak punya accordion apa pun. § 5 dikoreksi.

**Bug #1 — `generateSigningTokenAction` tidak kirim notifikasi WA** (inkonsisten dengan jalur
sync): ada 2 jalur yang sama-sama bisa menerbitkan token TTD baru — `syncSignatureSlotsAction`
(saat admin simpan surat) SUDAH otomatis kirim WA `letter_sign_request`, tapi
`generateSigningTokenAction` (tombol "Buat Link TTD" untuk slot lama/edge case) TIDAK PERNAH
kirim WA sama sekali, admin harus salin+kirim link manual. Kemungkinan besar
`generateSigningTokenAction` dibuat SEBELUM Fase 6 notifikasi WA (2026-07-19) dan tidak pernah
di-retrofit. Rencana: ekstrak logic notifikasi jadi helper kecil, panggil dari kedua tempat.

**Bug #2 — Officer menandatangani "buta" di `/sign/[token]`**: halaman publik penandatanganan
TIDAK PERNAH menampilkan isi surat — SELECT surat cuma ambil `subject, letterNumber, letterDate,
recipient`, kolom `body` tidak pernah di-fetch. Officer cuma lihat metadata sebelum klik "Tanda
Tangani Sekarang" — bukan cuma gap UX, ini masalah kepercayaan (menandatangani tanpa bisa baca
isi dokumen dulu). `arsitektur-tandatangan.md` § 5 sendiri sudah MENGASUMSIKAN fitur ini ada
sejak awal ditulis — jadi ini gap yang terlewat sejak implementasi awal, bukan regresi baru.
Rencana: tambah `body` ke SELECT yang sudah ada, reuse `resolveMergeFields()`+`renderBody()`
(pola sama `keluar/[id]/page.tsx`), render sebagai accordion collapsed-by-default di
`signing-page-client.tsx`.

**2 gap lama dikonfirmasi masih terbuka** (bukan temuan baru, sudah lama tercatat di CLAUDE.md):
attachment lampiran file (`attachment_urls` cuma plumbing kosong, nol UI MediaPicker, nol
tempat ditampilkan) dan inter-tenant (`inter_tenant_to`/`inter_tenant_status` cuma kolom+field
opsional, nol picker tenant tujuan, nol logic kirim/terima lintas tenant) — keduanya butuh
keputusan desain sendiri sebelum bisa direncanakan detail, tidak di-scope ke sesi ini.

**Yang dicek dan dikonfirmasi AMAN** (tidak ada masalah): toggle gating notifikasi WA berlaku
generik untuk `letter_sign_request` juga, template WA variabelnya match persis dengan yang
dikirim, `syncSignatureSlotsAction` idempotent (tidak spam WA saat surat disimpan berkali-kali
tanpa ubah signature), render body + merge fields konsisten dengan dokumen, `masuk` read-only
memang disengaja bukan halaman yang lupa dibuat edit-nya.

**NOL kode diubah di sesi ini** (kecuali 3 titik koreksi dokumentasi di atas) — sesuai
permintaan eksplisit user "rencanakan perbaikan" (bukan "perbaiki"). Bug #1 dan #2 dinilai
risiko rendah untuk dieksekusi (nol migrasi DB, reuse pola existing) — menunggu konfirmasi user
untuk lanjut eksekusi di sesi berikutnya. Gap #3 dan #4 butuh keputusan desain dulu.

### [2026-07-24] Bug #1 + #2 Modul Surat — Dieksekusi (Lanjutan Langsung dari Audit)

> User minta lanjut fix di giliran yang sama: "ok sementara kita perbaiki terlebih dahulu 2 bug
> tersebut, lalu verifikasi unk check error type." Detail rencana: lesson audit di atas +
> `docs/arsitektur-modul-surat.md` § 4 (sekarang ditandai ✅ FIXED untuk keduanya).

**Bug #1 fix** — helper baru `notifyOfficerSignRequest(tenantClient, slug, letterId, officerId,
token)` di `letters/actions.ts`, melakukan sendiri lookup officer→member→contact→phone + fetch
subject/nomor surat + `waAppUrl()`+`notifyWa()` untuk SATU officer. Dipanggil dari KEDUA tempat:
`syncSignatureSlotsAction` (loop `toNotify`, MENGGANTIKAN ~40 baris resolusi batch inline yang
lama jadi 3 baris) dan `generateSigningTokenAction` (baru, digate `if (!sig.signedAt)` — token
untuk slot yang sudah TTD tidak perlu notifikasi "diminta tanda tangan"). Trade-off diterima:
`syncSignatureSlotsAction` kehilangan optimasi batch-query lama (dulu 1 query untuk semua
officer sekaligus, sekarang N query per slot) — diterima karena jumlah slot baru per simpan
surat biasanya 1-2 (bukan puluhan) dan ini fire-and-forget, tidak block response ke admin.
Import `inArray` dari `drizzle-orm` jadi tidak terpakai lagi setelah refactor ini, dihapus.

**Bug #2 fix** — `sign/[token]/page.tsx`: SELECT surat ditambah `body`+`sender`, fetch
`getSettings` general+contact (pola SAMA `keluar/[id]/page.tsx`, direuse bukan ditulis ulang),
`buildMergeContext()` dengan `signers: []` (context minimal, cukup untuk preview read-only) →
`resolveMergeFields()` → `renderBody()` → `bodyHtml`, dibungkus try/catch (gagal render →
`bodyHtml=null`, accordion tidak dirender, TIDAK menggagalkan seluruh halaman TTD).
`signing-page-client.tsx`: prop baru `bodyHtml: string | null`, accordion native
`<details>`/`<summary>` "Lihat Isi Surat" (collapsed by default, tanpa JS state tambahan)
ditaruh antara blok "Detail Surat" dan "Penandatangan". **Bonus ditemukan saat implementasi**:
copy existing di bawah tombol TTD ("Dengan menandatangani, Anda menyetujui isi surat di atas.")
SEBELUMNYA menipu (tidak ada isi surat di atas sama sekali) — sekarang jadi teks yang BENAR
tanpa perlu diubah, karena accordion isi surat memang ada di atas tombol itu sekarang.

**Gotcha kecil**: build sempat gagal "Script not found 'build'" — bukan bug kode, cwd shell
masih di `packages/db` (persist dari command `tsc --noEmit` sebelumnya via `cd .../packages/db
&& ...`), `bun run build --filter=@jalajogja/web` dijalankan dari direktori yang salah. Fix:
`cd` eksplisit balik ke repo root sebelum build. **Aturan**: shell tool ini mempertahankan cwd
antar command — kalau sebelumnya sempat `cd` ke subpackage untuk keperluan lain (tsc scoped),
WAJIB `cd` balik ke root sebelum command yang butuh root context (`bun run build --filter=`,
`bun run dev`), jangan asumsikan cwd masih root.

**Koreksi dokumen lanjutan**: `docs/arsitektur-tandatangan.md` § 5 dan § 11 diupdate lagi —
dari "❌ BELUM ADA" (koreksi audit sebelumnya) jadi "✅ SELESAI" (karena baru saja
diimplementasikan beneran) — dokumen sekarang benar-benar sinkron dengan kode, bukan cuma
"sudah dikoreksi statusnya jadi jujur" tapi juga "sudah dieksekusi jadi statusnya positif lagi".

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart). Nol migrasi DB
(kolom `body` di `letters` sudah ada sejak lama). **Belum di-commit/push, belum dijalankan/
diverifikasi di VPS, belum diverifikasi visual di browser** — user perlu coba alur end-to-end:
assign officer → cek WA `letter_sign_request` masuk → buka `/sign/{token}` → expand "Lihat Isi
Surat" → tanda tangan, DAN coba tombol "Buat Link TTD" untuk slot lama → cek WA ikut terkirim.

**Susulan — dokumentasi disusun ulang biar gampang dilanjutkan (permintaan eksplisit user
"dokumentasikan perubahan... agar mudah kita improve kelak")**: `docs/arsitektur-modul-surat.md`
ditambah § 7 "Arsitektur Final — Referensi untuk Pengembangan Lanjutan" (2 pola reusable
didokumentasikan eksplisit: notifikasi WA satu-helper-dua-pemanggil § 7a, preview isi surat
`buildMergeContext`+`renderBody` § 7b — supaya fitur berikutnya di area ini tidak menulis ulang
pola dari nol) dan § 8 "Backlog" (5 ide konkret: attachment MediaPicker, inter-tenant,
notifikasi "surat selesai ditandatangani semua pihak" — BARU, belum diminta user, sekadar
dicatat supaya tidak hilang — preview isi surat di `/verify/[hash]`, restore batching kalau
performa jadi masalah). `docs/arsitektur-whatsapp.md` § 6.6 diupdate — tabel event ditambah
baris trigger kedua (`generateSigningTokenAction`), catatan trade-off batching-jadi-per-officer
dijelaskan eksplisit dengan alasan (bukan cuma "sudah diubah" tanpa konteks).

### [2026-07-24] Pemisahan Donasi vs Registrasi Forum — Celah Nyata Ditemukan+Difix

> Detail penuh: **`docs/arsitektur-backbone-ikpm.md` § "Pemisahan Donasi vs Registrasi Forum"**.

User minta cek: "ketika orang berdonasi SAJA, apakah otomatis dianggap ikut event/gabung forum?
seharusnya tidak — 2 hal berbeda." Dicek dua modul:

**Event + donasi — TIDAK ADA BUG.** `EventRegisterForm` selalu mewajibkan pilih tiket untuk
mendaftar; auto-create `event_registrations` (`finance/billing/actions.ts`) secara eksplisit
cuma memproses `invoice_items` bertipe `"ticket"`, tidak pernah `"donation"`. Donasi ke campaign
yang kebetulan terhubung ke event TIDAK PERNAH membuat baris pendaftaran.

**Forum + donasi wajib (`paymentRequired=true`) — CELAH NYATA.** `activateForumMembershipIfApplicable()`
(dibangun Fase D, sesi sebelumnya) menganggap SIAPA PUN yang bayar ke item syarat iuran forum —
dari jalur MANA PUN, bukan cuma `/gabung` — sebagai niat gabung. Ini disengaja saat Fase D
("reuse billing universal tanpa perlu menandai invoice") tapi konsekuensinya: donasi organik
lewat `/campaign/{slug}` (nol niat gabung) bisa tak sengaja mengaktifkan keanggotaan kalau
orangnya kebetulan eligible. Dikonfirmasi via `AskUserQuestion`: user pilih **pisahkan total**
— hanya pembayaran genuinely dari `/gabung` yang boleh aktivasi (REVERSAL dari keputusan Fase D
yang eksplisit "tanpa menandai invoice").

**Fix — penanda `for_gabung_registration` dipropagasi end-to-end**: `/gabung` (paymentRequired
=true) → link `?forGabung=1` ke `/produk/{slug}`/`/campaign/{slug}` → page.tsx baca
`searchParams.forGabung` → `ProductDetailClient`/`CampaignDetailClient` kirim flag ke
`addToCartAction` → `cart_items.for_gabung_registration` → `checkoutAction` copy ke
`invoice_items.for_gabung_registration` → `activateForumMembershipIfApplicable` WAJIB flag ini
`true` (bukan cuma itemId cocok). Migration `0046` (boolean DEFAULT false di 2 tabel, per-tenant
loop) — default aman untuk semua data lama. Link "dukungan sukarela" (`paymentRequired=false`)
SENGAJA TIDAK ditandai (fungsi sudah `return` duluan di kondisi itu, menandai tidak ada
gunanya). `addToCartAction`'s cabang update-qty-existing-item ikut menandai retroaktif kalau
`forGabung=true` — TIDAK PERNAH meng-UN-tandai baris yang sudah `true`.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart). Migration `0046`
dijalankan+diverifikasi di lokal. **Belum dijalankan di VPS. Belum diverifikasi visual/end-to-
end** — user perlu coba: donasi biasa ke campaign forum TANPA lewat `/gabung` → pastikan tidak
jadi anggota meski eligible; lalu klik link dari `/gabung` → bayar → pastikan tetap aktif seperti
sebelumnya.

**Aturan yang ditegaskan**: kalau instruksi user tampak MEMBALIK keputusan arsitektur yang
sudah eksplisit dikunci di sesi sebelumnya (di sini: "reuse billing universal tanpa menandai
invoice" → sekarang "wajib ditandai"), JANGAN diam-diam ubah — konfirmasi dulu via
`AskUserQuestion` dengan menyebutkan eksplisit bahwa ini reversal dari keputusan sebelumnya,
baru eksekusi setelah dikonfirmasi (persis yang dilakukan di sesi ini).

### [2026-07-25] Import Anggota — Bulk Import Excel/CSV, Rancangan Matang Dulu Baru Eksekusi

> Arsitektur lengkap: **`docs/arsitektur-import-anggota.md`** (baru, § 11 mencatat penyesuaian
> implementasi vs rancangan awal).

User punya database Excel lengkap 749 anggota resmi Forcreator (`docs/template/
database-forbis.xlsx`) dan minta arsitektur import ke sistem SEBELUM eksekusi — instruksi
eksplisit diulang 2× ("mari kita eksekusi, baca claude.md dan pastikan selalu mengikuti sop"
baru diberikan di GILIRAN TERPISAH setelah dokumen arsitektur selesai dan dikonfirmasi via 2
putaran `AskUserQuestion`).

**Riset file dilakukan tanpa tool xlsx terinstal** — tidak ada `openpyxl`/`pandas`/npm `xlsx`
di environment riset; file `.xlsx` dibongkar manual (`unzip`) dan diparse langsung dari XML
mentahnya (`xl/sharedStrings.xml` + `xl/worksheets/sheet1.xml`) pakai Python stdlib
(`zipfile`+`xml.etree`) — tidak perlu install apa pun untuk sekadar membaca isi file.

**Temuan kunci yang mengarahkan seluruh desain**: kolom "Forbis ID" (`2017.00001`) ternyata
PERSIS format Nomor Keanggotaan Forum yang sudah dibangun sesi sebelumnya — verifikasi urutan
sequence per tahun (2017 berakhir 260, 2018 lanjut 261→323, dst) MEMBUKTIKAN counter memang
tidak pernah reset di data historis asli, mengonfirmasi keputusan lama itu bukan cuma preferensi
tapi cocok kenyataan. Ditemukan juga masalah data nyata yang harus ditangani eksplisit, bukan
diasumsikan bersih: non-breaking space di nama provinsi, notasi ilmiah Excel yang merusak
permanen nomor HP (presisi digit hilang, tidak bisa dipulihkan), kolom yang bergeser di sebagian
baris, dan field enum ketat (`category`/`sector` di `member_businesses`, keduanya NOT NULL) yang
vokabulernya beda total dari isi Excel.

**2 putaran klarifikasi sebelum menulis dokumen** — bukan basa-basi, keduanya mengubah desain
secara substantif:
1. Salah paham awal saya soal `sector` (dikira harus dipetakan dari "Kategori Usaha", ternyata
   dari "Jenis Usaha" — kolom MULTI-value yang juga jadi sumber `businessFields`) dikoreksi user
   secara eksplisit sebelum kode ditulis.
2. Konsekuensi nyata "tetap cek `checkMemberEligibility()`" (6 dari 8 field wajib eligibility
   sama sekali tidak ada di Excel → 0 dari 749 baris akan langsung "aktif") ditemukan+
   dipresentasikan SEBELUM diasumsikan — user tetap pilih opsi ketat itu, dikonfirmasi paham
   konsekuensinya.

**Kelas bug client/server boundary muncul lagi — dicegah, bukan ditemukan setelah build gagal**:
type besar `ImportRowPreview` (dipakai bersama server engine dan client preview table) awalnya
didefinisikan di `lib/import-anggota.server.ts` (`import "server-only"`). Karena dibutuhkan juga
oleh client component, dipindah ke `lib/import-anggota-mapping.ts` (client-safe, zero dependency
`@jalajogja/db`) — pola split yang identik dengan `tenant-timezone.ts`/`forum-membership-
number.ts` sebelumnya. Ini kelas bug KE-4 di project ini — kali ini ditangkap secara proaktif
sebelum `next build` sempat gagal (bukan reaktif setelah error muncul).

**`import_batches`/`import_batch_rows` berkembang jadi draft-store, bukan cuma audit log** —
keputusan ini diambil SAAT implementasi (bukan direncanakan sejak awal): mengirim ratusan baris
preview bolak-balik lewat argumen Server Action berisiko payload besar + tidak tahan reload
browser. Solusi: begitu file diparse, hasilnya langsung disimpan ke DB (`status='draft'`),
commit membaca-ulang dari sana (bukan dari apa yang dikirim balik client) — `import_batch_rows.
data` (JSONB) menyimpan SELURUH bentuk preview per baris, bukan cuma catatan singkat.

**Reuse pola existing, bukan reimplementasi dari nol**: sebelum menulis `commitImportAction`,
dibaca dulu `createMemberAction`/`upsertMemberContactAction`/`saveMemberBusinessesAction` di
`members/actions.ts` untuk memastikan urutan insert (contact→address→member, lalu update FK)
dan nama field PERSIS sama — bukan ditebak dari ingatan (sempat ketahuan salah: `members.
fullName` tidak ada, kolom sebenarnya `name` — ditangkap `tsc`, langsung difix).

**Duplicate detection reuse pola JOIN yang benar** dari lesson lama ("Bug Sesungguhnya:
lookup-member Ambil Contact Sembarang") — `members INNER JOIN contacts`, bukan
`contacts.findFirst()` yang pernah salah pilih baris contact yang tidak terhubung member.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart, dua route baru
`/app/{slug}/members/import` + `/api/members/import/template` terkonfirmasi muncul di build
output). Migration `0047` dijalankan+diverifikasi di lokal (sempat di-drop+recreate sekali
karena skema direvisi mid-implementasi — aman karena tabel masih kosong, belum ada data nyata).
**Belum di-commit/push, belum dijalankan di VPS, belum diverifikasi visual di browser — upload
file `database-forbis.xlsx` yang sesungguhnya belum pernah dicoba end-to-end.** Gap yang
dicatat eksplisit (bukan lupa): tombol "resume draft" belum ada di UI meski action-nya sudah
dibangun, belum ada halaman riwayat import, dan potensi duplikasi `member_businesses` untuk
member yang di-link (bukan dibuat baru) belum ada kebijakannya — lihat `docs/arsitektur-
import-anggota.md` § 11 untuk daftar lengkap.

**Audit bug susulan (giliran sama, sebelum user testing lokal)** — user eksplisit minta "cek
bug dulu" sebelum mencoba upload. Review logika manual (bukan cuma `tsc`) menemukan+memperbaiki
3 bug + 1 race condition, detail lengkap di `docs/arsitektur-import-anggota.md` § 12:
1. **Escalation bug** — baris `if (status==="ready" && notes.length>0) status="review_needed"`
   mengeskalasi HAMPIR SEMUA baris ber-usaha ke "Perlu Review" karena `mapEmployees()`/
   `mapRevenue()` SENGAJA selalu `matched:false` (transparansi aproksimasi) → selalu nambah
   note begitu field itu terisi (~61% baris). Fix: hanya `category`/`sector` (NOT NULL) yang
   boleh memaksa status, field nullable lain cuma masuk `notes` tanpa ubah status — sesuai
   kebijakan § 6 yang SUDAH DITULIS di rancangan tapi kelewat di implementasi.
2. **Kecamatan gagal match tersembunyi** kalau kabupatennya sendiri juga gagal (`regencyId
   !== null` guard yang keliru di kondisi `flagged`) — dihapus, sekarang selalu ke-flag.
3. **Duplikat antar-baris DALAM SATU FILE tidak terdeteksi** — dua baris Excel dengan
   HP/email sama tapi belum ada di DB lolos independen jadi 2 member terpisah dengan kontak
   identik (`findExistingMemberByContact` cuma cek DB, tidak cek sesama baris draft). Fix:
   `Map<string,number>` (`seenContacts`) dipertahankan sepanjang loop parsing satu file,
   di-thread lewat parameter baru `buildPreviewRow(..., seenContacts)` — baris duplikat
   ditandai `review_needed` (bukan hard-skip, karena bisa jadi 2 orang beda berbagi 1 nomor
   keluarga) dengan catatan eksplisit sebut nomor baris duplikatnya.
4. **Race condition double-submit** — `commitImportAction` sebelumnya SELECT lalu cek status
   sebelum proses (pola "cek di luar transaction = cuma early-exit UX" yang sudah berkali-kali
   jadi sumber bug di project ini: checkout, payment confirm, event registration). Fix: klaim
   atomic (`UPDATE ... WHERE status='draft' RETURNING id`, bukan held-lock sepanjang loop 749
   baris) — request kedua yang telat dapat 0 baris ter-update, berhenti dengan pesan jelas.

Ditemukan juga 2 dead-code comparison (`status !== "error"`) yang TypeScript sendiri tandai
"no overlap" setelah bug #3 ditambahkan — dihapus (bukan di-suppress), karena `status` memang
tidak mungkin `"error"` di titik itu (baris kosong-nama sudah `return` lebih awal). `tsc`+build
diverifikasi ulang bersih setelah semua fix, dev server direstart. **Keempat fix ini murni
hasil membaca logika kode — belum satu pun dikonfirmasi lewat upload file sungguhan.**

**Bug #5 — ditemukan dari pertanyaan user, bukan dari audit sendiri**: user tanya balik
"apakah nomor id anggota forum udah masuk blm yak dalam import?" — jawabannya SEBAGIAN benar:
Forbis ID memang benar ditulis ke `tenant_memberships.membership_number` (diverifikasi ulang
end-to-end via grep di 3 file), TAPI `forum_membership_sequences` (counter dipakai
`generateForumMembershipNumber()` untuk join `/gabung` BERIKUTNYA) tidak pernah disentuh oleh
import — kalau tenant belum punya baris counter, join pertama pasca-import akan mulai dari
`seq=1` LAGI, menabrak seq yang sudah dipakai anggota pertama yang diimport ("2017.00001").
Ini melanggar prinsip inti fitur nomor keanggotaan forum ("counter tidak reset, jalan terus")
yang sudah dikunci sebelumnya (2026-07-24) — gap ini SUDAH tertulis di rencana dokumen
arsitektur sejak awal (§ 2: "`last_number` di-set ke 749 setelah import") tapi KELEWAT saat
implementasi kode, dan lolos dari audit bug pertama karena audit itu fokus ke logika status/
duplikasi, bukan ke integrasi lintas-fitur (import ↔ sistem nomor forum yang sudah ada).

**Fix**: `commitImportAction` melacak `maxImportedSeq` (seq tertinggi dari baris yang BENAR-
BENAR ter-insert, bukan semua baris file) sepanjang loop commit, lalu setelah loop selesai
UPDATE-jika-lebih-besar (GREATEST, tidak pernah mundur) ke `forum_membership_sequences` —
locking pattern (`SELECT ... FOR UPDATE`) disalin PERSIS dari `generateForumMembershipNumber()`
yang sudah ada, bukan pola baru. `tsc`+build diverifikasi ulang bersih, dev server direstart.

**Aturan yang ditegaskan**: kalau sebuah fitur BARU (import) menulis data yang overlap dengan
sistem counter/sequence yang SUDAH ADA (nomor forum), integrasi keduanya harus dicek eksplisit
sebagai bagian audit — "apakah fitur baru ini menulis nilai yang counter existing perlu tahu
supaya tidak tabrakan nanti?" — bukan cuma cek logika internal fitur baru itu sendiri. Audit
bug pertama sesi ini terlalu fokus ke dalam (status/duplikasi/race), melewatkan titik temu
dengan fitur lain yang dibangun sesi sebelumnya.

### [2026-07-25] Import Anggota — Pivot Arsitektur: Template = Struktur Kita, Bukan Struktur Eksternal

> Detail lengkap: **`docs/arsitektur-import-anggota.md` § 13** (menggantikan § 4e/4f/6/bagian
> template § 7-8, semua ditandai superseded dengan pointer ke § 13).

Dua pertanyaan susulan user mengubah arsitektur secara fundamental — sesi diskusi murni dulu
(bukan langsung eksekusi), sesuai SOP "confirm sebelum ubah keputusan besar".

**1. "Nomor id forum berarti hanya berlaku ketika forum saja ya?"** — pertanyaan konfirmasi
yang TERNYATA membongkar bug nyata: `commitImportAction` hardcode `membershipType: "forum"` +
`forumStatus: "pending"` + `membershipNumber` untuk SEMUA tenant, padahal tool ini eksplisit
dirancang reusable lintas tipe tenant (cabang/marhalah/forum). Fix: `isForumTenant =
access.tenant.tenantType === "forum"` dihitung sekali, `membershipType` ikut
`access.tenant.tenantType` sebenarnya, `forumStatus`/`membershipNumber`/tracking counter
forum HANYA aktif kalau `isForumTenant`. Kalau tidak ditanyakan, bug ini baru ketahuan saat
tool dipakai pertama kali untuk tenant cabang/marhalah — jauh setelah deploy.

**2. "Kenapa gak insert yang ada saja, kita insert tidak lewat proses save"** — user
keberatan dengan pendekatan awal (§ 4e/4f lama): tabel alias/terjemahan untuk memaksa-cocokkan
istilah historis Forcreator ("Trader"→"Trading", sector diturunkan dari tag "Jenis Usaha",
omzet dipaksa masuk skala lebih kecil). Argumen intinya: file yang dikirim cuma **satu contoh**
database eksternal — bukan sesuatu yang tool ini harus "pintar" beradaptasi. Prinsip yang
dikunci: **template = struktur kita sendiri persis; siapa pun yang punya database lama wajib
reformat manual dulu sebelum upload; kalau kosong/tidak cocok → biarkan kosong, jangan pernah
ditebak.**

**Kendala teknis yang butuh 1 putaran diskusi tambahan**: prinsip "biarkan kosong" langsung
menabrak `category`/`sector` yang waktu itu `NOT NULL` di `member_businesses` — tidak bisa
dikosongkan di level database apa pun filosofinya. User awalnya curiga ini "berbahaya" —
sebelum mengeksekusi apa pun, dicek dulu KENAPA constraint ini ada (bukan diasumsikan
sembarangan): ternyata bukan aturan khusus import — `saveMemberBusinessesAction` (admin) dan
`POST /api/akun/member-business` (self-service) **sudah lama** memfilter/membuang entri usaha
tanpa category/sector, konsisten dipakai untuk direktori+statistik+rencana pencocokan usaha.

**Resolusi — user menunjuk pola yang SUDAH ADA**: `members.gender`/`birthDate`,
`contacts.phone`/`whatsapp` semuanya nullable di DATABASE, wajibnya cuma ditegakkan di FORM.
Keputusan: terapkan pola SAMA PERSIS ke category/sector — migration `0048` melonggarkan NOT
NULL, form self-service+admin TIDAK DISENTUH (tetap jadi penegak "wajib" untuk data manual).

**Audit blast-radius SEBELUM eksekusi** (bukan asumsi aman) — grep semua pemakaian
`.category`/`.sector`: hasilnya jauh lebih kecil dari dikira, karena hampir semua tempat
TAMPILAN sudah defensif (`{entry.category && (...)}`). `tsc` setelah relaksasi skema HANYA
menghasilkan 2 error nyata (satu construction type, satu 2× groupBy statistik) — persis
sejumlah yang perlu difix, tidak lebih. 2 tempat LAINNYA lolos dari `tsc` (interpolasi
string `{b.category} · {b.sector}` — akan cetak literal "null · null" tanpa error TYPE)
ditemukan via grep manual terpisah dan difix sekalian — pengingat bahwa `tsc` tidak
menangkap SEMUA kelas regresi dari pelonggaran nullable, terutama di dalam template string.

**Simplifikasi besar di `lib/import-anggota-mapping.ts`**: SEMUA tabel alias/derivasi untuk
klasifikasi usaha dihapus total (category aliases, `deriveSector`+`JENIS_USAHA_TO_SECTOR`,
legality/position/employees/branches/revenue aliases) — diganti SATU helper generik
`exactMatch<T>(raw, allowed)` (toleran spasi+kapitalisasi saja, bukan sinonim) dipakai
7 fungsi mapper yang semuanya jadi `(raw) => T | null`. `MappingResult<T>` wrapper (field
`matched`/`rawValue`) juga dihapus — sudah tidak perlu konsep "matched vs default" sama
sekali. Status baris (`ready`/`review_needed`/dll) TIDAK LAGI dipengaruhi field usaha apa
pun (baik yang dulu NOT NULL maupun nullable) — cuma dipengaruhi duplikat dan error nama
kosong, field lain murni informasional di `notes`.

**Template Excel didesain ulang**: 34 kolom (dari 37) — 4 kolom lama dihapus karena TIDAK
ADA field yang cocok sama sekali di skema kita ("Kepemilikan Usaha", "Konsep Peluang", "Foto
Produk atau Usaha", "Logo" — bukan tugas tool ini menyimpan data tanpa rumah), 1 kolom baru
("Sektor", exact-match terpisah — TIDAK lagi diturunkan dari kolom lain), 1 di-rename
("Jenis Usaha"→"Bidang Usaha", hindari rancu dengan "Sektor"). Sheet Panduan generate daftar
nilai baku LANGSUNG dari konstanta `lib/import-anggota-mapping.ts` — satu sumber kebenaran,
tidak diketik ulang manual.

**Konsekuensi yang diterima secara sadar**: kalau `database-forbis.xlsx` ASLI (belum
direformat) diupload apa adanya sekarang, banyak baris usaha akan punya category/sector
KOSONG (istilah lama "Trader"/turunan "Jenis Usaha" tidak lagi dikenali) — ini SESUAI DESAIN
baru, bukan regresi. Data Forcreator perlu direformat manual dulu supaya masuk lengkap.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+dibersihkan+direstart tiap tahap,
dilakukan bertahap mengikuti 7 task terpisah: migration+schema, mapping, server engine,
commitImportAction, template, 2 fix tampilan+statistik, verifikasi final). Migration `0048`
dijalankan+diverifikasi di lokal. **Masih murni verifikasi statis — belum ada satu pun upload
file sungguhan yang dicoba di browser**, baik untuk fix bug §12 sebelumnya maupun pivot ini.

**Aturan yang ditegaskan**: kalau user menantang sebuah keputusan arsitektur dengan "kenapa
X harus begini, sementara Y tidak" — JANGAN langsung membela/mempertahankan X tanpa
verifikasi. Cek dulu kode aktual untuk memahami ALASAN X ada (di sini: constraint NOT NULL
ternyata konsisten dengan aturan pre-existing di 2 tempat lain, bukan sembarangan) — baru
dari situ cari pola yang SUDAH established di codebase (gender/birthDate/phone: nullable-di-
DB + wajib-di-form) untuk diterapkan konsisten, bukan menciptakan solusi ad-hoc baru khusus
untuk kasus ini.

### [2026-07-25] Import Anggota — Pivot Kedua: Audit Skema dari Nol, Bukan Reshuffle Excel

> Detail lengkap: `docs/arsitektur-import-anggota.md` § 14 (menggantikan bagian daftar kolom
> di § 13 — prinsip "category/sector nullable" di § 13 TETAP berlaku, cuma daftar kolomnya
> yang diganti).

Setelah "pivot arsitektur" sebelumnya (entri di atas) dianggap selesai, user mengoreksi LAGI,
lebih tajam: *"kita akhirnya malah focus ke sector bukan memperbaiki alur import... template
yang kamu buat lebih banyak mengikuti data excel yang bikin, bukan mengikuti existing database
yang harus diisi... KAMU TERALIHKAN OLEH database luar yang seharusnya MEREKA YANG IKUT KITA,
bukan kita ikut mereka... termasuk penamaan dalam template, id forbis, forbis itu nama forum...
kalau kamu kasih template nama forum, habis kita."*

**Bukti paling telak yang lolos dari pivot sebelumnya**: kolom **"Forbis ID"** — nama internal
SATU forum (Forcreator) — tetap ada persis di template yang diklaim "generik untuk semua
tenant forum". Pivot § 13 memang benar soal PRINSIP (jangan tebak-nebak, jangan alias), tapi
EKSEKUSINYA tetap menyusun kolom dari "apa yang kebetulan ada di Excel sumber" (kurangi 4,
tambah 1) — bukan dari audit independen "skema kita butuh field apa saja".

**Fix**: baca ULANG penuh 7 file schema (`members.ts`, `contacts.ts`, `addresses.ts`,
`social-medias.ts`, `member-businesses.ts`, `member-professionals.ts`,
`member-owned-pesantren.ts`, `tenant-memberships.ts`) disilangkan dengan
`lib/member-eligibility.ts` (`checkMemberEligibility()`, 11 field syarat kelengkapan profil
generik semua tipe tenant). Ditemukan: template 34-kolom sama sekali tidak punya 6 dari 11
field eligibility — `birthDate`, `waliSantri`, `domicileStatus`, `professionId`,
`graduationYear`/`graduationPeriod` (relevan untuk 1999) — semua hilang murni karena Excel
sumbernya tidak punya kolom itu, bukan keputusan sadar.

**"Forbis ID" → "Nomor Keanggotaan"** (generik) — dan format-nya TIDAK LAGI divalidasi ketat
(`^\d{4}\.\d+$`). `parseForbisId()` dihapus, diganti `extractYearSeqFromMembershipNumber()`
yang HANYA best-effort melanjutkan counter `forum_membership_sequences` kalau nomornya
kebetulan berformat itu (preset default `lib/forum-membership-number.ts`) — nilai kolom itu
sendiri diterima verbatim apa adanya, karena setiap tenant forum bisa pakai preset penomoran
berbeda (3 pilihan) dan tool import tidak berhak memaksa satu format "benar" untuk semua.

**10 kolom baru ditambahkan** (template 34→44 kolom), semuanya field `members`/`addresses`
nyata: NIK, Tanggal Lahir (`parseBirthDate()` — terima ISO atau `DD/MM/YYYY`, validasi kalender
asli), Tempat Lahir (teks bebas, `birthPlaceText`), Periode Angkatan 1999, No Stambuk Gontor,
**Profesi** (FK ke `public.ref_professions` — 26 baris seed, matching baru `matchProfession()`
via ILIKE exact, DB query async seperti `matchWilayah`), Wali Santri (label PERSIS sama dengan
`step1-identity.tsx`), Status Domisili (label PERSIS sama dengan `/akun/lengkapi`),
Desa/Kelurahan (`matchWilayah()` diperluas — scope oleh `districtId` yang sudah resolve, sama
pola kabupaten/kecamatan), Kode Pos (kolom eksplisit menang, fallback ke
`ref_villages.postal_code` desa yang ter-match). `REQUIRED_HEADERS` disederhanakan jadi
`["nama"]` saja — field lain boleh kosong per prinsip "jika kosong, kosongkan" yang sudah
dikunci, jadi tidak masuk akal memaksa kolomnya WAJIB ADA kalau isinya sendiri boleh kosong.

**Keputusan scope dinyatakan EKSPLISIT kali ini** (supaya tidak terulang jadi "diam-diam
dipotong lagi"): media sosial pribadi anggota, email/kecamatan/sosmed-penuh usaha, dan
`primaryCabangRefId` (field eligibility ke-11, butuh matching ke 136 PC IKPM resmi) SENGAJA
tidak ditambahkan — masing-masing dengan alasan tersendiri di dokumen. Scope TETAP
business-only (professional/pesantren, dua directory lain yang juga bisa penuhi syarat
"directory" eligibility, belum didukung) — dicatat eksplisit sebagai keputusan scope
mengingat "banyak forum akan datang, tidak semua berorientasi usaha", bukan kelupaan.

**Verifikasi**: `tsc --noEmit` bersih di kedua package (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol
migrasi DB tambahan — 10 kolom baru semuanya menulis ke kolom `members`/`addresses` yang
SUDAH ADA sejak awal. **Belum diverifikasi manual di browser** — sama seperti pivot
sebelumnya, murni hasil membaca kode + `tsc`/build.

**Pelajaran meta — paling penting dari seluruh rangkaian sesi ini**: instruksi "buat sesuai
struktur KITA, jangan ikut struktur eksternal" sempat dijalankan SETENGAH HATI dua kali
berturut-turut sebelum benar-benar genuine — kali pertama (§ 13) masih anchor ke sumber Excel
(reshuffle kolom, bukan audit independen). **Aturan untuk instruksi serupa ke depan**: kalau
diminta membuat sesuatu "sesuai struktur kita, bukan struktur X", verifikasi SEBELUM
menganggap selesai — apakah hasil akhirnya (nama kolom, field, istilah) bisa ditelusuri balik
ke SATU sumber spesifik (satu forum, satu file, satu tenant)? Kalau ya, itu tanda belum
benar-benar schema-first — ulangi dari audit skema penuh, jangan dari reshuffle sumber yang
sama.

### [2026-07-25] Bug: Nomor ID IKPM Ter-cetak Permanen dengan Placeholder Kalau Tanggal Lahir Kosong

> Detail lengkap: `docs/arsitektur-import-anggota.md` § 15.

Dari pertanyaan klarifikasi user soal mekanisme Nomor ID IKPM (global, `members.memberNumber`)
saat import — ditemukan bug nyata (user sendiri yang menyimpulkan "itu bug bro"):
`commitImportAction` memanggil `generateMemberNumber(db, birthDate)` **unconditional** untuk
setiap member baru. Kalau `birthDate` kosong (umum untuk database historis lama), bagian
DDMMYYYY nomor terisi placeholder `"00000000"` — dan nomor itu **permanen selamanya**, tidak
pernah diperbaiki lagi meski orangnya nanti login dan mengisi tanggal lahir asli via
`/akun/lengkapi`. Root cause: `PATCH /api/akun/member-data` punya guard
`if (!member.memberNumber)` untuk generate ulang, tapi karena import sudah kadung mengisi
nomor (walau placeholder), guard itu tidak akan pernah `true` lagi.

**Fix — TIDAK bikin mekanisme baru, cukup samakan dengan pola yang SUDAH ADA di 2 tempat
lain**: `grep insert(members)` di seluruh app menemukan `api/akun/register/route.ts`
(registrasi self-service) dan platform `createFirstOwnerAction` (buat owner pertama) **KEDUANYA
SUDAH** membuat member baru TANPA field `memberNumber` sama sekali (dibiarkan `null` — kolom
memang nullable, tidak ada `.notNull()`). Guard `if (!member.memberNumber)` di
`member-data/route.ts` justru DIRANCANG untuk skenario ini. Fix: `commitImportAction` sekarang
`preview.member.birthDate ? await generateMemberNumber(...) : null` — kalau tanggal lahir ada,
generate segera seperti biasa; kalau kosong, biarkan `null`, guard existing akan menghasilkan
nomor yang BENAR begitu orangnya sendiri melengkapi data.

**Verifikasi tampilan aman tanpa sentuh UI**: 3 titik display (`members/[id]/page.tsx`,
`akun/page.tsx`, `anggota/[id]/page.tsx`) semuanya SUDAH pakai guard
`{row.memberNumber && (...)}`/komponen `Row` yang otomatis sembunyikan baris kalau `null` —
pola yang sudah lama dikunci ("jangan tampilkan 'Belum diterbitkan'"), jadi member yang
sementara belum punya nomor tidak menampilkan apa pun aneh. `tsc`+build bersih.

**Aturan yang ditegaskan**: sebelum bilang "bisa" untuk permintaan user mengubah timing
generate suatu ID/nomor, cek dulu apakah kode sudah punya pola serupa di tempat lain — di
sini, dua jalur pembuatan member LAIN (register self-service, platform first-owner) SUDAH
menerapkan persis pola yang diminta user, dan mekanisme "generate belakangan" (guard
`!member.memberNumber` di endpoint completion) SUDAH ADA, cuma import yang belum
memanfaatkannya. Jangan bikin mekanisme paralel baru kalau infrastrukturnya sudah ada.

### [2026-07-25] Import Anggota — Duplikat Tidak Lagi Di-skip, Selalu Dilengkapi Datanya (§ 16)

> Detail lengkap: `docs/arsitektur-import-anggota.md` § 16.

User menemukan skenario berbahaya dari perilaku lama "duplikat = skip total": anggota forum
yang SUDAH terdaftar di tenant tertentu, tapi Nomor Keanggotaan Forumnya masih kosong (mis.
admin baru atur format penomoran belakangan) — kalau ada batch import susulan yang kebetulan
punya nomor untuk orang itu, baris itu SELALU di-skip tanpa pernah melengkapi nomor yang
sebenarnya sudah tersedia. Kalimat kunci user: *"ketika saya import data di sebuah tenant,
otomatis kita berbicara tentang data tenant bersangkutan"* — jadi field TENANT-SCOPED (bukan
cuma field pribadi member) juga harus ikut dilengkapi.

**Prinsip baru**: baris yang cocok member existing (via HP/WA/email) — baik sudah jadi anggota
tenant ini maupun belum — SELALU diproses untuk melengkapi field yang di database masih
kosong. Field yang sudah terisi TIDAK PERNAH ditimpa. Skip HANYA untuk nama kosong atau
override manual admin.

**Implementasi**: `computeMemberMergeCandidate()` baru di `lib/import-anggota.server.ts` —
fetch snapshot `members`+`contacts`+`tenant_memberships` TERKINI dari DB, pakai helper murni
baru `fillEmpty<T>(existing, incoming)` (client-safe, di `import-anggota-mapping.ts`) yang isi
HANYA key yang di `existing` masih null. Dipanggil KEDUANYA oleh preview (informasional,
tampilkan "akan melengkapi: X, Y" di Catatan) DAN commit (dipanggil ULANG, bukan percaya hasil
preview yang bisa basi kalau draft didiamkan lama — benar-benar menulis UPDATE). Cakupan:
`members` (10 field identitas), `contacts` (phone/whatsapp/email), DAN
`tenant_memberships.membershipNumber` (satu-satunya field tenant-scoped yang relevan,
HANYA kalau forum + baris sudah ada + nomornya masih null + data import punya nilai).

**Yang SENGAJA tidak disentuh**: `tenant_memberships.status`/`forumStatus` (lifecycle/moderasi
— bulk import tidak boleh diam-diam mengaktifkan kembali member yang sengaja di-suspend admin);
`member_businesses` duplikasi (list, bukan scalar — beda kelas masalah, tetap gap terbuka dari
§ 11); Nomor ID IKPM global (`members.memberNumber`, punya aturannya sendiri di § 15 — generate
sekali oleh guard terpisah, sengaja tidak dicampur ke logic `fillEmpty` generik).

**Turunan**: `maxImportedSeq` (lanjutan counter forum, lesson bug #5 sebelumnya) diperbaiki
sekalian — sekarang melacak `writtenMembershipNumber` (nomor yang BENAR-BENAR tertulis, baik
dari insert baru MAUPUN update-backfill), bukan `preview.membershipNumber` mentah — supaya
jalur backfill baru ini juga ikut dihitung untuk lanjutan counter, bug kelas yang sama dengan
§ 12 bug #5 dicegah sekaligus di titik yang sama.

**UI**: badge "Duplikat" (menyiratkan dibuang) diganti "Sudah Ada — Dilengkapi" (biru), checkbox
skip manual sekarang tetap tampil untuk baris ini (sebelumnya disembunyikan karena toh selalu
di-skip). `CommitImportResult` dapat field baru `merged: number` terpisah dari `inserted` —
laporan akhir bedakan "N anggota BARU" vs "N anggota SUDAH ADA dilengkapi". Nol migrasi DB.

**Aturan yang ditegaskan**: kalau user menjelaskan skenario konkret ("begini kalau di-skip
semua... maka yang terjadi...") alih-alih menjawab pilihan ganda yang saya tawarkan
(`AskUserQuestion` sempat ditolak user di titik ini, diminta jelaskan dulu) — pahami dulu
skenario itu SEUTUHNYA sebelum kembali ke opsi terstruktur; kadang penjelasan bebas
mengandung poin krusial (di sini: dimensi tenant-scoped) yang tidak tercakup pertanyaan
pilihan-ganda yang sudah disiapkan sebelumnya.

### [2026-07-25] Bug: Platform Tenant Detail Tidak Tampilkan Login + Redirect Nyasar ke "Pendaftaran Ditutup"

User laporkan kesulitan login ke tenant `forcreator` (testing lokal). Investigasi (bukan
tebak) menemukan 2 masalah nyata:

**1. Halaman `/platform/tenants/[slug]` tidak pernah menampilkan SIAPA pengurus tenant** —
query lama cuma `LIMIT 1` + cek existence (`hasOwner: boolean`), tidak pernah fetch nama/email.
Platform admin tidak ada cara tahu email login tenant tanpa query DB manual. Dicek langsung ke
DB lokal: `forcreator` TERNYATA SUDAH punya owner (`forcreator@gmail.com`) — masalahnya murni
platform admin tidak bisa MELIHAT ini dari UI. **Fix**: query diperluas fetch SEMUA
`tenant.users` + JOIN manual ke `public.user` (pola disalin dari `settings/users/page.tsx` —
`inArray(authUser.id, betterAuthIds)`, FK tidak didefinisikan Drizzle untuk tenant tables jadi
join dilakukan di application code, bukan SQL JOIN satu query). Section baru "Pengurus / Login
Tenant" menampilkan nama+email+role tiap pengurus. Sekalian ditemukan+difix: tombol "Buka
Tenant" di atas halaman masih pakai URL lama `{slug}/dashboard` (sisa migrasi URL admin
Fase 1-4, seharusnya `/app/{slug}/dashboard` — link LAIN di halaman yang sama, di bawah,
sudah benar sejak awal, jadi ini murni 1 titik yang kelewat).

**2. `/app/forcreator/dashboard` (logged in, tapi akun TIDAK punya akses tenant.users di
`forcreator`) berujung ke `/register?error=no-tenant` → "Pendaftaran Ditutup Sementara"** —
alur lengkap ditelusuri: `(dashboard)/app/[tenant]/layout.tsx`'s `getTenantAccess(slug)` null →
`redirect("/dashboard-redirect")` → `getFirstTenantForUser()` null (akun ini TIDAK punya
tenant.users di MANA PUN, bukan cuma forcreator) → fallback lama `redirect("/register?error=
no-tenant")`. Pesan "Pendaftaran Ditutup" MENYESATKAN untuk kasus ini — user tidak sedang
mencoba mendaftarkan tenant BARU, mereka mencoba akses tenant yang SUDAH ADA dengan akun yang
tidak diberi akses. Registrasi tenant baru sendiri sudah dinonaktifkan PERMANEN
(`REGISTRATION_OPEN=false`) — jadi skenario asli fallback ini didesain untuk ("partial tenant
registration state", lesson lama 2025-04) sudah tidak mungkin terjadi lagi; SEMUA traffic yang
sampai ke fallback ini sekarang adalah kasus "logged in, no tenant access anywhere".

**Fix — halaman baru, BUKAN redirect ke `/app/login`**: sempat dipertimbangkan redirect ke
`/app/login?error=...` untuk pesan lebih jelas, tapi ini akan bikin INFINITE LOOP —
middleware.ts punya aturan `if (pathname === "/app/login" && isLoggedIn) redirect
("/dashboard-redirect")` (mencegah user yang sudah login melihat form login lagi). Kalau
`/dashboard-redirect` balik lagi ke `/app/login` untuk kasus SESI VALID tanpa akses tenant,
middleware akan lempar balik ke `/dashboard-redirect` lagi — loop tak henti, persis kelas bug
lama "Auth gate diduplikasi di middleware DAN layout tanpa koordinasi". Solusi: halaman BARU
`app/no-tenant-access/page.tsx` (di LUAR `/app/*`, jadi tidak kena aturan bounce-back itu sama
sekali) — tampilkan email akun yang sedang login + pesan jelas ("belum terdaftar sebagai
pengurus di tenant mana pun, hubungi admin platform") + tombol "Keluar & Coba Akun Lain"
(`sign-out-button.tsx`, pakai `window.location.href` setelah `signOut()` — bukan `router.push`,
sesuai aturan lama "window.location.href wajib setelah operasi yang menghancurkan sesi").
`dashboard-redirect/page.tsx` diarahkan ke sini, bukan `/register?error=no-tenant`.

**Cleanup sekalian**: `error=no-tenant` handling di `(auth)/register/page.tsx` (pesan inline
"Pendaftaran sebelumnya tidak lengkap") dihapus — sudah 100% dead code (grep konfirmasi nol
caller lain, dan bahkan SEBELUM fix ini pesan itu tidak pernah terlihat user karena
`REGISTRATION_OPEN=false` short-circuit ke pesan "Pendaftaran Ditutup" SEBELUM form+error state
sempat dirender). `useSearchParams` import ikut dihapus (sudah tidak dipakai apa pun lagi di
file itu). 2 link "Masuk di sini" di halaman itu diarahkan langsung ke `/app/login` (sebelumnya
`/login` — file itu sendiri cuma stub redirect ke `/app/login`, BUKAN bug, tapi hop tambahan
yang tidak perlu, dirapikan sekalian).

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan+`.next` dibersihkan+direstart), route
`/no-tenant-access` terkonfirmasi muncul di build output. Nol migrasi DB. **Belum diverifikasi
visual di browser** — user diminta coba ulang `/app/forcreator/dashboard` dengan akun yang
BUKAN `forcreator@gmail.com` untuk konfirmasi halaman baru muncul dengan benar (bukan loop),
dan login dengan `forcreator@gmail.com` untuk konfirmasi akses tenant berhasil normal.

**Aturan yang ditegaskan**: setiap kali menambah/mengubah target redirect untuk kasus "sesi
valid tapi tidak diizinkan", WAJIB cek dulu apakah tujuan baru itu sendiri punya aturan
redirect-balik untuk kondisi "sudah login" (pola `if (isLoggedIn) redirect(X)` yang sudah
berulang kali muncul di middleware/layout project ini) — kalau ya, JANGAN arahkan ke situ,
cari/buat tujuan yang benar-benar netral terhadap status login.

### [2026-07-25] Bug Kritis Import Anggota: Merge Patch Bocor `fullName` — SEMUA Baris Match-Existing Gagal Commit

> Detail lengkap: `docs/arsitektur-import-anggota.md` § 17. Ditemukan dari testing SUNGGUHAN
> pertama kali — upload file nyata, bukan cuma `tsc`/build hijau.

User laporkan: upload `database-forbis-kecil.xlsx`, "Wawan Sugianto" (HP+email cocok member
existing) tidak muncul di tenant forum meski pesan preview bilang "akan ditambahkan sebagai
anggota tenant ini." Diagnosa LANGSUNG ke data (query `import_batches`/`import_batch_rows`,
bukan tebak): batch pertama 128 inserted + **1 skipped** (Wawan). Dua batch re-upload file yang
SAMA sesudahnya (menit kemudian, karena batch 1 sudah insert 128 member baru → SEMUA baris di
batch 2/3 sekarang match existing) — **129/129 skipped**. `notes` JSONB baris Wawan berisi
bukti pasti: `"Gagal insert: syntax error at or near \"where\""` — SQL error sungguhan di
dalam transaction, ketangkap `catch`, ditandai skip diam-diam meski notes lain di baris yang
sama sudah bilang "akan diproses."

**Root cause**: `commitImportAction` (§ 16, dibuat sesi sebelumnya) memanggil
`computeMemberMergeCandidate` dengan **`preview.member` APA ADANYA** (objek utuh, punya field
`fullName`) — padahal `fullName` BUKAN bagian `MemberFieldPatch` (kolom DB-nya `members.name`,
tidak pernah kosong). `fillEmpty()` awalnya iterasi `for (const key in incoming)` (runtime,
bukan dijamin TypeScript) — `fullName` ikut ter-scan, `existing["fullName"]` (dari SELECT yang
TIDAK PERNAH ambil kolom `name`) jadi `undefined` → dianggap "kosong" → masuk patch →
`.set({fullName:...})` → Drizzle buang key tak dikenal skema → SQL `SET` kosong →
`UPDATE ... SET WHERE ...` → syntax error. `buildPreviewRow` (preview) SUDAH BENAR sejak awal
(pakai objek eksplisit dari variabel lokal, tanpa `fullName`) — asimetri preview-vs-commit
inilah sumber bug: preview "berjanji", commit gagal tepati.

**Dampak**: SETIAP baris yang match member existing (`linkOnly` maupun sudah jadi anggota
tenant, keduanya lewat jalur § 16) SELALU gagal commit — bukan cuma 1 orang. Transaction gagal
BERSIH (rollback Postgres otomatis) — nol korupsi data, cuma niat yang tidak tereksekusi.

**Fix — 2 lapis**: (1) `commitImportAction` sekarang bangun objek `incomingMember` eksplisit
(10 field, tanpa `fullName`), sama persis pola `buildPreviewRow`. (2) **Hardening `fillEmpty()`
sendiri** supaya kelas bug ini TIDAK BISA terulang lagi di pemanggil manapun ke depan: diubah
dari `for (const key in incoming)` jadi `for (const key in existing)` — karena `existing`
SELALU hasil `SELECT` eksplisit (ground truth kolom yang benar-benar ada), field ekstra apa pun
di `incoming` yang tidak dikenal `existing` otomatis diabaikan, terlepas caller berikutnya
teliti atau tidak.

**Verifikasi**: `tsc`+build bersih (percobaan pertama), dev server direstart. Nol migrasi.
**Fix-nya SENDIRI belum diverifikasi lewat upload ulang** — user diminta coba
`database-forbis-kecil.xlsx` sekali lagi untuk konfirmasi Wawan (dan baris match-existing lain)
benar-benar masuk sekarang.

**Aturan yang ditegaskan**: kalau dua fungsi (preview vs commit) SAMA-SAMA memanggil helper
yang sama dengan parameter yang SEHARUSNYA identik bentuknya, verifikasi KEDUANYA benar-benar
membangun parameter itu dengan cara yang SAMA — jangan asumsikan "preview sudah benar berarti
commit juga pasti benar", karena keduanya ditulis di titik kode terpisah dan bisa diam-diam
divergen (persis yang terjadi di sini). Untuk helper generik yang menerima "objek existing" +
"objek incoming" untuk dibandingkan field-per-field, SELALU iterasi berdasarkan `existing`
(sumber kebenaran skema/SELECT), BUKAN `incoming` (bisa saja punya field ekstra di luar
kontrol) — pola ini reusable untuk helper serupa manapun ke depan di project ini.

### [2026-07-25] Bug: Edit Anggota via Admin Tidak Generate No. Anggota Saat Tanggal Lahir Diisi

**Bukan bug import** — dilaporkan user di giliran yang sama saat minta re-verifikasi § 17 di
atas, tapi sumbernya file berbeda total: `updateMemberAction` (`members/actions.ts`), dipakai
halaman admin `/app/{slug}/members/{id}/edit`. Dicatat berdampingan karena root cause-nya
berhubungan langsung dengan pola "generate No. Anggota begitu tanggal lahir pertama kali
diketahui" yang sudah dikunci untuk 2 jalur lain (lihat lesson lama "Auto-generate No. Anggota
di `PATCH /api/akun/member-data`" dan § 15 `docs/arsitektur-import-anggota.md`).

**Root cause**: `members.memberNumber` bisa null untuk member yang dibuat via self-service
register, buat-owner-pertama platform admin, atau import massal (§ 15) — ketiganya sengaja
MENUNDA generate sampai tanggal lahir benar-benar ada (supaya tidak mencetak nomor dengan
placeholder `00000000` permanen). Satu-satunya titik yang dirancang "menyusulkan" generate itu
adalah `PATCH /api/akun/member-data` (guard `if (!member.memberNumber) {...}`) — tapi
`updateMemberAction` (jalur ADMIN edit, beda file/beda alur sama sekali dari self-service) TIDAK
PERNAH punya guard yang sama sejak fitur nomor anggota dibuat: cuma `db.update(members).set({
...sanitize(data), updatedAt})`, tidak menyentuh `memberNumber` sama sekali. `createMemberAction`
(admin BUAT baru) aman karena SELALU generate unconditional saat insert — cuma jalur UPDATE yang
bolong.

**Fix**: `updateMemberAction` sekarang SELECT `memberNumber` existing dulu; kalau masih null,
`generateMemberNumber(db, data.birthDate ?? null)` dimasukkan ke patch — persis pola
`PATCH /api/akun/member-data`, `data.birthDate` di sini datang dari FormData form edit (selalu
terisi begitu field-nya diisi admin, karena form submit seluruh nilai input, bukan partial
patch). Member yang sudah punya nomor tidak pernah disentuh — nomor yang sudah digenerate tetap
permanen.

**Verifikasi**: `tsc`+build bersih di `apps/web`, dev server direstart. Nol migrasi. **Belum
diverifikasi lewat edit sungguhan di browser** — user diminta coba edit anggota tanpa No.
Anggota (mis. hasil import tanpa tanggal lahir), isi Tanggal Lahir, simpan, cek nomornya terisi.

**Aturan yang ditegaskan**: pola "guard `if (!field) generate...`" yang sudah dikunci di SATU
jalur mutasi (self-service) tidak otomatis berlaku di jalur mutasi LAIN untuk entitas yang sama
(admin edit) — setiap kali sebuah field punya banyak titik mutasi (create-admin, edit-admin,
self-service PATCH, import, dst), audit SEMUA titik itu satu per satu untuk pola serupa, jangan
asumsikan satu fix di satu tempat otomatis menutup seluruh kelas masalah.

### [2026-07-25] Bug: Kabupaten Tempat Lahir Tampak "Tidak Tersimpan" di Form Edit Admin — Sebenarnya Bug Tampilan

User laporkan (giliran sama dengan bug No. Anggota di atas, saat cek form sebelum mulai import
sungguhan): pilih kabupaten tempat lahir di form edit anggota, simpan, tapi field itu tampak
kosong lagi saat form dibuka ulang.

**Root cause — data TERSIMPAN benar, bug ada di TAMPILAN form, bukan penyimpanan**: ditelusuri
seluruh jalur tulis (`updateMemberAction`→`sanitize()`→`db.update`) dan dikonfirmasi benar
sejak awal — `birthRegencyId` selalu ikut ter-update. Bukti tambahan: halaman detail anggota
sudah lama benar menampilkan nama kabupaten (query-nya SELECT `refRegencies.name` — kalau data
benar-benar hilang, halaman itu juga akan kosong, padahal tidak). Root cause sesungguhnya:
`RegencyCombobox` butuh DUA nilai untuk menampilkan pilihan awal — `value` (ID) DAN
`displayName` (nama, untuk ditampilkan sebagai teks input) — lihat constructor
`useState(() => value && displayName ? {...} : null)`. Form edit sebelumnya menginisialisasi
state nama SELALU `null` (tidak pernah dibaca dari `defaultValues`), sementara halaman edit
sendiri TIDAK PERNAH men-select `refRegencies.name` ke server props — hanya
`refRegencies.provinceId` (dipakai field `birthProvinceId` yang ternyata dead code, tidak
dibaca komponennya sama sekali). Combobox jadi SELALU render kosong setiap form edit dibuka,
meski ID internalnya sudah terisi benar — user mengira data hilang, padahal kalau form langsung
disubmit tanpa disentuh, nilai lama tetap terkirim dan tersimpan utuh.

**Fix — 3 titik**: (1) edit page tambah `birthRegencyName: refRegencies.name` ke select,
diteruskan ke `defaultStep1`; (2) `Step1DefaultValues` type tambah field
`birthRegencyName?: string`; (3) state di form sekarang diinisialisasi
`defaultValues?.birthRegencyName ?? null`, bukan selalu `null`. `birthProvinceId` (dead code
lama, tidak berbahaya) sengaja dibiarkan, di luar scope.

**Verifikasi**: `tsc`+build bersih (percobaan pertama), dev server direstart. Nol migrasi —
murni bug tampilan, tidak ada perubahan skema. **Belum diverifikasi lewat edit sungguhan di
browser** — user diminta buka form edit anggota yang sudah punya tempat lahir tersimpan,
konfirmasi combobox sekarang menampilkan nama kabupatennya.

**Aturan yang ditegaskan**: kalau sebuah combobox/autocomplete butuh MENAMPILKAN pilihan awal
dari data server (bukan cuma menyimpan ID), field DISPLAY NAME-nya harus di-select eksplisit di
query server DAN diteruskan sampai ke state komponen — ID saja tidak cukup untuk re-render
pilihan yang sudah dipilih. Kalau laporan bug berbunyi "data tidak tersimpan" untuk field
combobox, cek DULU apakah datanya benar-benar hilang di DB (lewat halaman detail/query
langsung) sebelum menyimpulkan bug ada di jalur tulis — sering kali gejalanya "tampak tidak
tersimpan" padahal bug sesungguhnya di jalur BACA/DISPLAY saat form dibuka ulang.

### [2026-07-26] Bug Kritis Kedua Import Anggota: Baris "Duplicate" Ikut Bikin Member Baru Ganda

**Ditemukan dari audit ulang menyeluruh** — permintaan user "cek dulu sebelum eksekusi lanjutan"
sebelum benar-benar upload file sungguhan, BUKAN dari testing browser. Detail lengkap:
`docs/arsitektur-import-anggota.md` § 21.

**Root cause**: `ImportRowPreview.linkOnly` hanya `true` untuk SATU dari tiga skenario match
member ("member baru"/"link-only, belum jadi anggota tenant ini"/"duplicate, sudah jadi anggota
tenant ini") — HANYA skenario "link-only" yang `linkOnly=true`. `commitImportAction` menggate
blok "insert member+contact+address baru" dengan `if (!preview.linkOnly)` — kondisi ini SALAH
bernilai `true` juga untuk skenario "duplicate" (existingMemberId terisi, linkOnly=false),
padahal skenario itu seharusnya SKIP insert sama sekali dan reuse member yang sudah ada. Efek:
setiap kali file yang sama di-import ULANG (member-nya sudah jadi anggota tenant), kode ini
salah membuat `contacts`+`addresses`+`members` BARU yang identik — bisa membakar Nomor ID IKPM
global baru (`member_number_seq`) kalau Tanggal Lahir terisi, dan member ganda ini jadi ORPHAN
(tidak pernah dapat `tenant_memberships` karena blok itu sudah benar menggate berdasarkan
`preview.existingMemberId`, bukan member ganda yang baru dibuat).

**Kenapa belum pernah menghasilkan data ganda nyata**: pola testing user sebelumnya ("upload →
sebagian sukses → upload file SAMA lagi untuk verifikasi") persis skenario yang memicu bug ini,
TAPI bug § 17 (SQL syntax error di merge patch) sudah lebih dulu menggagalkan transaction
SEBELUM sempat commit apa pun untuk baris duplicate — murni kebetulan urutan penemuan bug,
BUKAN bukti bug ini aman diabaikan.

**Fix**: kondisi gate diubah `if (!preview.linkOnly)` → `if (!preview.existingMemberId)` — HANYA
insert member baru kalau BENAR-BENAR tidak ada member existing yang cocok sama sekali.

**Gap terkait TIDAK ikut difix (dicatat eksplisit)**: blok insert `member_businesses` TIDAK
digate berdasarkan existingMemberId/linkOnly — berjalan untuk SEMUA baris yang punya "Nama
Usaha" terisi, termasuk "duplicate". Re-import file yang sama untuk member yang sudah punya data
usaha akan menambah baris `member_businesses` BARU yang duplikat setiap kali — gap ini SUDAH
tercatat sejak § 11 ("belum ada kebijakan"), TIDAK diperbaiki sekarang karena butuh keputusan
produk (skip/update/tetap tambah untuk kasus multi-usaha) yang belum dikonfirmasi user.

**Verifikasi**: `tsc`+build bersih di kedua package (percobaan pertama), dev server direstart.
Nol migrasi — murni perbaikan 1 kondisi boolean. **Belum diverifikasi lewat upload sungguhan** —
murni hasil audit baca-kode sebelum testing dimulai.

**Aturan yang ditegaskan**: kalau sebuah alur punya LEBIH dari 2 skenario status yang mungkin
(di sini: 3 — baru/link-only/duplicate), JANGAN gate logic pakai satu boolean yang cuma
membedakan SATU pasang skenario (`linkOnly`) — pastikan kondisi if/else benar-benar menutup
SEMUA kombinasi yang mungkin, idealnya gate langsung dari sumber kebenaran paling primitif
(`existingMemberId` — null/tidak-null) bukan dari flag turunan yang cuma valid untuk sebagian
kasus. Audit "baca ulang seluruh alur dari nol sebelum testing" (bukan cuma verifikasi fix
sebelumnya) terbukti berharga di sini — bug ini tidak akan pernah tertangkap `tsc`/build,
hanya oleh membaca logika baris-per-baris.

### [2026-07-26] Audit Editor Tiptap dari Agent Lain — 1 Bug Data-Breaking + 1 Bug Minor + Klaim Berlebihan

User minta cek ringkasan eksekusi dari agent LAIN yang mengklaim fitur editor baru (Fase 1-4:
Block "Baca Juga", Enhanced Blockquote+citation, YouTube/Instagram embed responsif, spacing
`.prose-jalakarta`) selesai + `tsc --noEmit` 0 error. Setiap klaim diverifikasi ke kode aktual
satu per satu (bukan dipercaya begitu saja) — detail lengkap: `docs/arsitektur-editor.md` § 5.

**Bug #1 (data-breaking, SUDAH DIFIX)**: block "Baca Juga" pakai `<PublicLinkPicker>` yang selalu
kembalikan URL path-mode (`/{slug}/post/...`) — disimpan apa adanya, di-render `letter-render.ts`
(dipakai bersama Post/Page/Produk/Campaign/Event) sebagai `<a href>` TANPA `stripTenantPrefix()`.
Persis kelas bug yang sudah berulang kali difix untuk fitur lain (nav menu, Hero CTA, CTA
section) — fitur baru ini luput. Dampak: link internal rusak (404 ganda-slug) di tenant custom
domain aktif. Fix: `RenderContext` (`letter-render.ts` + `post-body-segments.ts`) diperluas
`tenantSlug?`+`baseUrl?` (semantik sama `resolveBaseUrl()`), helper `resolveInternalHref()`
menerapkan `stripTenantPrefix()` hanya untuk URL non-eksternal. 7 titik render diupdate:
`post/[slug]`, `campaign/[slug]`, `produk/[productSlug]`, `agenda/[slug]`, `default-template.tsx`
(+2 pemanggilnya: homepage & `[pageSlug]`), `sign/[token]`, `api/akun/legal/route.ts`. Sengaja
TIDAK disentuh: `profesional/[id]`+`usaha/[id]` (description-nya `<textarea>` polos, bukan
TiptapEditor — bug tidak relevan di sana) dan halaman admin Surat (route `(dashboard)` tidak
pernah diserve custom domain, fix di situ selalu no-op).

**Bug #2 (minor, SUDAH DIFIX)**: `EmbedBlockView`'s loader script Instagram (`embed.js`) tanpa
cleanup + tanpa cek "sedang loading" → 2 embed Instagram mount bersamaan (atau React StrictMode
dev-mode double-invoke) bisa inject script dobel. `.process()` juga tidak pernah dipanggil
eksplisit setelah script load — cuma andalkan auto-scan implisit Instagram. Fix: loader diubah
jadi singleton module-level (`loadInstagramScript()`, `Promise<void>` di-cache) — satu script tag
untuk seluruh halaman, `.process()` dipanggil eksplisit via `.then()`.

**Gap #3 — `.prose-jalakarta` dead CSS, DIHAPUS (bukan diwiring)**: klaim "update letter-
render.ts untuk konsistensi spacing" SALAH — file itu nol referensi ke string itu, dan grep
seluruh app/components = nol pemakaian di mana pun sejak commit pertama. Ditanya ke user (beda
kelas risiko dari bug #1/#2 — ini perubahan visual ke 5 halaman publik LIVE, tidak bisa
diverifikasi visual dari sesi ini). User jawab: front-end SUDAH konsisten via mekanisme lama
(class `prose` + inline style dari `renderBody()` — SATU sumber kebenaran untuk semua titik
render karena semua lewat fungsi yang sama), tidak perlu sistem baru — cukup hapus CSS matinya.
Diverifikasi dulu (5 titik render dibandingkan, memang sudah pola sama) sebelum eksekusi hapus.

**Klaim #4 — "kompatibilitas WordPress WXR import/export", DIABAIKAN sesuai arahan user**:
`docs/arsitektur-import-export-post-wordpress.md` berstatus eksplisit "RANCANGAN", belum
diimplementasikan — grep kode WXR = nihil. Satu-satunya elemen nyata: `parseHTML()` di
`related-link-ext.ts` mengenali `<p class="wp-block-callout">` kalau di-paste manual (fitur
paste-compatibility kecil, jauh dari klaim "export ke WXR XML"). Tidak dieksekusi sesi ini.

**Verifikasi**: `tsc --noEmit` bersih (3 putaran) + `bun run build --filter=@jalajogja/web`
sukses (3 putaran, dev server dimatikan+`.next` dibersihkan+direstart tiap kali). Nol migrasi
DB. **Belum diverifikasi visual di browser** — bug #1 dan #2 butuh dicoba langsung: buat "Baca
Juga" ke artikel internal di tenant custom domain aktif, cek console Network tab untuk
`embed.js` cuma fetch sekali meski ada 2+ embed Instagram.

**Aturan yang ditegaskan**: ringkasan eksekusi dari agent LAIN (atau sesi lain) — termasuk klaim
"tsc 0 error" yang MEMANG benar — TIDAK BOLEH dipercaya sebagai bukti "tidak ada bug". `tsc`
cuma menangkap type error, bukan bug logic (link custom domain), bukan bug runtime (script race
condition), dan bukan "klaim fitur yang ternyata tidak terhubung ke mana pun" (dead CSS). Setiap
klaim spesifik ("X sudah di-update", "Y terintegrasi ke Z") WAJIB diverifikasi dengan membaca
file yang disebut dan grep pemakaiannya — bukan dipercaya dari narasi ringkasan.

### [2026-07-26] Peningkatan Block "Baca Juga" — Auto-fill Judul, Label Bebas, Fix Overflow

Susulan langsung dari audit editor di atas — 3 permintaan user, detail lengkap
`docs/arsitektur-editor.md` § 6.

**Klarifikasi dulu, bukan bug**: user awalnya mengira `<PublicLinkPicker>` "belum terintegrasi"
dengan post/donasi/event — dicek ke `/api/ref/public-links/route.ts`, TERNYATA SUDAH ADA (query
`ilike` ke judul, ditampilkan grouped). Kesalahpahamannya murni UX: konten yang bisa banyak
(post/produk/event/campaign) SENGAJA tidak tampil sebelum admin mengetik — kalau popover dibuka
tanpa ketik apa pun, kelihatannya "cuma ada laman & modul". False alarm, dikonfirmasi ke user
SEBELUM eksekusi apa pun (bukan langsung dipercaya/langsung "diperbaiki" tanpa verifikasi).

**Fix 1 — auto-fill judul**: `<PublicLinkPicker>`'s `onChange` sebelumnya cuma kirim `url`,
padahal API sudah kembalikan `label` (judul asli) dan komponen bahkan menampilkannya di
dropdown — cuma dibuang di `handleSelect()`. Diperluas jadi `onChange: (url, label?) => void`
(parameter kedua OPSIONAL — 6 caller lama otomatis tetap valid tanpa disentuh, TypeScript izinkan
callback singkat untuk signature yang lebih panjang). `RelatedLinkDialog` sekarang isi field
"Judul Artikel/Tautan" otomatis dari `label` — HANYA kalau terisi (dipilih dari daftar, bukan
ketik manual sebagai URL eksternal, supaya tidak menimpa judul manual dengan string kosong).

**Fix 2 — Label Awalan jadi teks bebas**: `<select>` 4 pilihan tetap diganti `<Input>` bebas,
default tetap "Baca Juga:" (`useState` tidak berubah, cuma cara input-nya).

**Fix 3 — popup melebar saat URL panjang**: dua `<span className="flex-1 truncate">` di
`PublicLinkPicker` (trigger button + dropdown item) tidak punya `min-w-0` — flex item dengan
`flex-1` TANPA `min-w-0` tidak benar-benar truncate (default `min-width:auto` pada flex item
menolak menyusut di bawah ukuran konten intrinsiknya), jadi URL panjang memaksa tombol/dialog di
sekelilingnya melebar. Fix: tambah `min-w-0` di kedua span.

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol migrasi DB. **Belum
diverifikasi visual di browser** — user diminta coba: cari post/donasi/event by judul (konfirmasi
sudah bekerja, bukan bug), pilih satu, cek judul auto-terisi; ketik Label Awalan custom; coba URL
sangat panjang, cek popup tidak melebar.

**Aturan yang ditegaskan**: `flex-1`/`flex-grow` PADA elemen dengan `truncate` (`overflow:hidden;
text-overflow:ellipsis; white-space:nowrap`) di dalam flex container SELALU butuh `min-w-0`
eksplisit — default CSS flexbox `min-width:auto` membuat elemen menolak menyusut di bawah ukuran
konten intrinsiknya, sehingga `truncate` diam-diam tidak pernah bekerja tanpa `min-w-0`. Ini
kelas bug CSS yang sudah muncul (dan sengaja dicegah) di komponen lain project ini (`kolom kiri
min-w-0 wajib` — lihat lesson lama "Mobile Layout Overflow"), sekarang confirmed berlaku juga
untuk popover/dialog trigger button manapun yang menampilkan teks panjang dinamis (URL, nama
file, dst) — cek `min-w-0` setiap kali ada laporan "popup/tombol melebar aneh saat teksnya panjang".

### [2026-07-26] Penulis & Editor Post — Byline System Terpisah dari `authorId`

> Arsitektur lengkap: **`docs/arsitektur-penulis-post.md`**

Post/Halaman punya kolom `authorId` sejak awal (FK ke `tenant.users`), tapi TIDAK PERNAH ada UI
untuk memilihnya — selalu auto-terisi ke pengurus yang sedang login saat draft pertama dibuat,
dan `updatePostAction` tidak pernah menyentuhnya lagi. Diverifikasi dulu (bukan diasumsikan):
modul `website` di `lib/permissions.ts` cuma punya level `full`/`read`/`none` (tidak ada `"own"`
seperti modul `surat`) — jadi `authorId` dipastikan TIDAK dipakai untuk access-control apa pun,
aman menambah mekanisme byline baru tanpa menyentuhnya sama sekali.

**Prinsip kunci — `authorId` (existing, immutable) TIDAK DIUBAH SAMA SEKALI.** Byline publik
("siapa yang tampil ke pembaca sebagai penulis/editor") adalah konsep BARU, terpisah total:
2 kolom nullable baru di `posts` — `display_author_id`, `editor_id` — sama-sama menunjuk ke
entitas baru `tenant.post_authors` (id, member_id nullable tanpa FK constraint — cross-schema
ke `public.members`, pola sama `tenant.users.member_id` — name, bio, avatar_url, created_at,
updated_at). **`display_author_id = NULL` → fallback ke resolusi `authorId` LAMA** yang sudah
ada di halaman publik (tidak diubah) — jadi post lama yang field Penulis-nya tidak pernah
disentuh admin otomatis tetap tampil benar, **nol migrasi data** untuk post existing.

**Satu entitas untuk dua peran (Penulis DAN Editor)** — bukan dua tabel terpisah. Satu profil
`post_authors` bisa jadi Penulis di satu post, Editor di post lain; keduanya butuh field yang
identik (nama, foto, bio opsional, bisa tertaut member atau berdiri sendiri sebagai profil
tamu). `avatar_url` pakai URL langsung (bukan `media_id` FK) — pola sama
`member_businesses.cover_url`/`member_owned_pesantren.cover_url`, bukan pola `posts.cover_id`.

**"Find or create" idempotent untuk penulis dari Anggota** — `findOrCreatePostAuthorFromMemberAction`
cek dulu apakah tenant ini sudah pernah punya `post_authors` untuk `member_id` tsb (SATU query
`WHERE member_id = X`) sebelum insert — mencegah duplikat kalau admin pilih anggota yang sama
berkali-kali di post berbeda. Pola SAMA PERSIS dengan `computeMemberMergeCandidate`/
`syncAutoTenantMemberships` dari fitur Import Anggota sesi sebelumnya — "cek dulu sebelum
insert" ini sudah jadi pola berulang di project ini untuk entitas apa pun yang bisa dipakai
ulang lintas record.

**"Recall" untuk penulis TAMU (bukan anggota)** — `GET /api/ref/post-authors?slug=&q=` cari
`post_authors WHERE member_id IS NULL` (jadi HANYA profil tamu, anggota tidak ikut nyasar ke
list ini karena mereka selalu dicari dari `/api/ref/tenant-members` yang sudah ada). Admin bisa
ketik nama yang belum match apa pun → opsi "+ Buat penulis baru" → mini-form inline (nama+bio
opsional+foto opsional) → tersimpan, bisa dipakai lagi di post lain via search yang sama tanpa
mengetik ulang dari nol.

**Edit bio/foto adalah SHARED ROW, bukan snapshot per-post** — perubahan bio/foto penulis
lewat "Edit Bio/Foto" memengaruhi SEMUA post yang memakai penulis itu (karena semuanya
menunjuk `post_authors.id` yang sama). Ini SESUAI DESAIN prinsip "recall" yang diminta user —
bukan bug. Beda dengan `name`/`avatarUrl` snapshot member-linked SAAT PERTAMA dipilih (tidak
live-sync ke data member terbaru) — dua semantik berbeda: snapshot untuk data yang datang DARI
member, live-shared untuk data yang di-EDIT langsung di konteks post_authors.

**Avatar upload pakai `MediaPicker` admin (`module="website"`), BUKAN `CoverImageField` self-
service member** — sempat jadi pertimbangan salah di awal karena `CoverImageField`
(`components/media/member-media-picker.tsx`) tampak seperti pola yang pas ("URL langsung,
bukan media_id", cocok dengan `avatar_url`). Tapi `CoverImageField` terikat ke `/api/akun/
media/*` — endpoint yang scoped ke SESI MEMBER YANG SEDANG LOGIN SENDIRI (self-service). Admin
yang membuat/edit profil penulis TAMU (atau penulis anggota lain) bukan mengupload ke media
library dirinya sendiri — konteksnya admin tenant, bukan member self-service. `MediaPicker`
admin (`components/media/media-picker.tsx`, dipakai juga untuk Featured Image post di file yang
sama) adalah komponen yang benar untuk konteks ini.

**Hint default Penulis beda isi antara create-mode dan edit-mode (halaman BUKAN komponen yang
menghitung ini)** — create-mode (`posts/new/page.tsx`): "Default: {nama YANG SEDANG LOGIN}"
(`access.userId → public.user.name`, akurat karena `authorId` post baru PASTI di-set ke
`access.tenantUser.id`, alias diri sendiri). Edit-mode (`posts/[id]/edit/page.tsx`): "Default:
{nama PEMBUAT DRAFT ASLI}", diresolve dari `post.authorId` (bisa orang LAIN dari yang sedang
mengedit sekarang) via 2-langkah `schema.users → public.user` — pola resolusi yang SAMA PERSIS
dipakai halaman publik untuk fallback. Kalau hint di edit-mode disamakan dengan create-mode
(selalu "nama yang login"), hint itu akan BOHONG untuk kasus admin A mengedit post yang
dulunya dibuat admin B — fallback SESUNGGUHNYA yang akan dipakai (kalau field Penulis dibiarkan
kosong) tetaplah `authorId` asli (admin B), bukan siapa pun yang kebetulan sedang membuka form.

**Bio menggantikan "Tim Redaksi" (bukan baris tambahan) di halaman publik** —
`{authorBio ?? "Tim Redaksi"}` di caption bawah nama penulis. Untuk byline lama (fallback
`authorId`, `authorBio` selalu `null`) — perilaku 100% tidak berubah, teks generik "Tim
Redaksi" tetap tampil seperti sebelumnya. Untuk byline baru yang bio-nya sudah diisi admin —
teks itu OTOMATIS menggantikan placeholder generik, tanpa perlu baris visual baru atau
percabangan tampilan tambahan.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (dicek bertahap per fase:
schema → server actions → komponen+integrasi form → resolusi render publik) + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan, direstart
setelah build) — route baru `/api/ref/post-authors` terkonfirmasi muncul di build output.
Migration `packages/db/migrations/0049_post_authors.sql` dijalankan+diverifikasi di lokal
(tabel+FK dikonfirmasi via `\d`). **Belum dijalankan di VPS. Belum diverifikasi visual di
browser** — user perlu coba: pilih penulis dari Anggota (cek find-or-create tidak duplikat
kalau dipilih 2x), ketik nama baru → buat penulis tamu → isi bio+foto, buka lagi post LAIN →
cari nama yang sama → pastikan muncul di "Penulis Tersimpan" (recall bekerja), isi field Editor
(opsional) → cek byline "Disunting oleh X" tampil di halaman publik, kosongkan Editor → cek
baris itu hilang total (bukan tampil kosong).

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
