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
