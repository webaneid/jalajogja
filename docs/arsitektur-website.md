# Arsitektur Website — jalakarta

Dokumen ini mencakup dua hal berbeda yang saling berkaitan:
1. **Dashboard CMS** — modul admin untuk kelola konten (posts, pages, kategori, tag)
2. **Front-end Publik** — website yang dibuka oleh pengunjung umum

---

## Bagian 1: Dashboard CMS (Sudah Selesai)

Modul website di dashboard tenant — tempat admin buat dan kelola konten.

### Struktur Route Dashboard
```
app/(dashboard)/[tenant]/website/
├── layout.tsx              → website shell: WebsiteNav (sub-nav kiri) + slot konten kanan
├── page.tsx                → /website — dashboard: stats + 5 post terbaru
├── actions.ts              → SEMUA server actions website (posts + pages)
├── posts/
│   ├── page.tsx            → list posts: filter status + search + pagination
│   ├── new/page.tsx        → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx  → full editor: fetch post + tags + categories → render PostForm
└── pages/
    ├── page.tsx            → list pages: sorted by `order` asc
    ├── new/page.tsx        → pre-create draft → redirect ke edit
    └── [id]/edit/page.tsx  → full editor: fetch page → render PageForm
```

### Server Actions (website/actions.ts)
```
Posts:
  createPostDraftAction(slug, title?)      → pre-create + return postId
  updatePostAction(slug, postId, data)     → full update + tag sync diff
  updatePostStatusAction(slug, postId, s)  → quick status change
  deletePostAction(slug, postId)           → delete pivot dulu, baru post

Pages:
  createPageDraftAction(slug, title?)      → pre-create + return pageId
  updatePageAction(slug, pageId, data)     → full update
  updatePageStatusAction(slug, pageId, s)  → quick status change
  deletePageAction(slug, pageId)           → delete
```

### Pre-create Pattern
User klik "Post Baru" → action buat draft kosong di DB → redirect ke `/posts/{id}/edit`.
Tidak ada modal input judul dulu — judul bisa diisi langsung di form editor.

### Tags Sync: Replace-All Diff
Bukan delete-all + insert-all. Hitung diff:
- `toRemove` = tag lama yang tidak ada di list baru → `DELETE WHERE tagId IN (...)`
- `toAdd` = tag baru yang belum ada di pivot → `INSERT batch`

### PostForm / PageForm Layout
```
[Header: ← Posts | StatusBadge]  ← sticky top
[Main area]          [Sidebar 288px]
  Judul (h1-style)     Status (select full width)
  Slug (font-mono)     ────────────
  Excerpt (post only)  Featured Image (aspect-video)
  TiptapEditor         ────────────
  SeoPanel             Kategori (post only)
                       Tags pills (post only)
                       Urutan / Order (pages only)
                       ────────────
                       [Simpan ...]   ← sticky bottom
                       [Publikasikan]
```

### Logika Label Tombol
| Status aktif | Button 1 (outline) | Button 2 |
|---|---|---|
| `draft` | "Simpan Draft" | "Publikasikan" (primary, Globe) |
| `published` | "Simpan Perubahan" | "Jadikan Draft" (outline, EyeOff) |
| `archived` | "Arsipkan" (Archive icon) | "Publikasikan" (primary, Globe) |

### Berita Unggulan (isFeatured)

Kolom `is_featured BOOLEAN NOT NULL DEFAULT false` di tabel `posts`.

- Toggle di sidebar form (antara Status dan Featured Image)
- `PostsSection` bisa filter hanya post `is_featured = true` via `PostsSectionData.onlyFeatured`
- Tersedia di `PostCardData.isFeatured` — design section bisa gunakan untuk styling khusus (badge, highlight)
- Tidak mempengaruhi status publish — post draft bisa di-mark featured, tapi tidak tampil publik sampai published

### Perbedaan Posts vs Pages
| | Posts | Pages |
|---|---|---|
| Excerpt | ✓ | ✗ |
| Kategori | ✓ | ✗ |
| Tags | ✓ | ✗ |
| Berita Unggulan | ✓ | ✗ |
| Urutan (order) | ✗ | ✓ |
| Sort list | updatedAt desc | order asc, title asc |
| schemaType | Article/NewsArticle/BlogPosting | WebPage/AboutPage/ContactPage/FAQPage |
| twitterCard default | summary_large_image | summary |

### Komponen Client
```
components/website/
├── post-list-client.tsx   → CreateButton, SearchInput, PostsTable (named exports)
├── page-list-client.tsx   → CreatePageButton, PagesTable
├── post-form.tsx          → full editor form untuk posts
├── page-form.tsx          → full editor form untuk pages
└── website-nav.tsx        → sub-nav kiri
```

**Aturan export client components**: selalu individual named exports — namespace object
`export const X = { A, B }` tidak kompatibel dengan Next.js App Router client boundary.

### Lessons Learned — Block Editor (Tiptap v3)
- Tiptap v3 breaking changes: BubbleMenu di `@tiptap/react/menus`, `immediatelyRender: false` wajib untuk SSR, named import `{ TextStyle }` dan `{ Table }`
- `atom: true` di custom Node → leaf node → renderHTML TIDAK boleh ada `0` (content hole)
- oEmbed universal via `noembed.com/embed?url=` — 300+ platform, tanpa package tambahan
- EmbedBlockView: `dangerouslySetInnerHTML` tidak re-execute `<script>` → pakai `useEffect` re-inject scripts

---

## Bagian 2: Domain Routing (3 Fase)

### Konsep
Tiga fase hidup bersamaan — tidak saling menggantikan. Tenant bisa punya ketiganya aktif sekaligus.

| Fase | URL | Status | Catatan |
|------|-----|--------|---------|
| 1 — Path | `app.jalakarta.com/{slug}` | **Aktif sekarang** | Default, selalu ada |
| 2 — Subdomain | `{subdomain}.jalakarta.com` | Implementasi saat Front-end | Wildcard DNS `*.jalakarta.com` |
| 3 — Custom Domain | `ikpm.or.id` | Implementasi saat Front-end | A record → VPS IP, SSL via Caddy |

### Cara Kerja Custom Domain (White-label)
```
Tenant pointing DNS:
  ikpm.or.id  →  A record  →  123.45.67.89 (IP VPS)

Request flow:
  Browser buka ikpm.or.id
  → Caddy terima request, auto-provision SSL (Let's Encrypt)
  → Forward ke Next.js app
  → Middleware baca Host header: "ikpm.or.id"
  → DB lookup: SELECT slug FROM tenants WHERE custom_domain = 'ikpm.or.id'
  → Render tenant "ikpm" — jalakarta.com tidak terlihat sama sekali
```

**Tidak perlu NS server sendiri** — cukup minta tenant ganti A record di Cloudflare/Niagahoster/dll.

### Logika Middleware
```typescript
const host = request.headers.get("host")

if (host === "app.jalakarta.com") {
  slug = pathname.split("/")[1]              // Fase 1: dari path
} else if (host.endsWith(".jalakarta.com")) {
  slug = host.replace(".jalakarta.com", "")  // Fase 2: dari subdomain
} else {
  slug = await db.query(                     // Fase 3: lookup DB
    "SELECT slug FROM tenants WHERE custom_domain = $1", [host])
}
```

### Schema DB di `public.tenants`
```
slug                       → Fase 1, path-based, selalu ada
subdomain                  → Fase 2, null = fallback ke slug
custom_domain              → Fase 3, null = belum set
custom_domain_status       → none | pending | active | failed
custom_domain_verified_at  → timestamp saat verifikasi berhasil
```

### Alur Setup Custom Domain
```
1. Tenant buka /{slug}/settings/domain
2. Isi form: "ikpm.or.id"
3. jalakarta simpan → custom_domain_status = 'pending'
4. Tampilkan instruksi: "Tambahkan A record: ikpm.or.id → A → {IP_VPS}"
5. Background job verifikasi DNS
6. Jika OK → custom_domain_status = 'active', custom_domain_verified_at = now()
7. Caddy auto-provision SSL saat first request masuk
```

---

## Bagian 3: Front-end Publik — Page Template System

### Filosofi

Website publik dikontrol penuh oleh tenant. Admin pilih **template** untuk setiap halaman.
Template yang lebih sederhana langsung render. Landing page punya **section builder** drag & drop.

Semua preview menggunakan **wireframe CSS/Tailwind** (skeleton abu-abu). Setelah dipilih,
design asli yang render. Tidak ada gambar PNG — murni Tailwind untuk performa.

---

### 5 Template Halaman

| Template | Deskripsi | Body Format |
|----------|-----------|-------------|
| `default` | Tiptap body + featured image | Tiptap JSON (sudah ada) |
| `landing` | Section builder drag & drop | `{ sections: SectionItem[] }` |
| `contact` | Form + info kontak + Google Maps | `{ showForm, mapEmbedUrl, customTitle }` |
| `about` | Tiptap body, layout beda | Tiptap JSON |
| `linktree` | Link list mobile-optimized | `{ profileImage, bio, links: LinkItem[] }` |

---

### DB Schema: Kolom Baru di `pages`

```sql
-- Tambah ke DDL create-tenant-schema.ts + migration manual tenant existing
ALTER TABLE pages ADD COLUMN template TEXT NOT NULL DEFAULT 'default';
```

Drizzle schema update:
```typescript
template: text("template", {
  enum: ["default", "landing", "contact", "about", "linktree"]
}).notNull().default("default"),
```

---

### Tabel Baru: `contact_submissions`

Form Contact Page menyimpan pesan masuk ke DB — bukan hanya email.
Jadi ada "Inbox Pesan" di dashboard.

```sql
CREATE TABLE contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL,            -- FK → pages.id
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Dashboard: `/{slug}/website/pesan` — list submissions dengan badge unread count.

---

### Template: Landing Page — Section Builder

#### Konsep Alur Admin

```
Edit halaman (template=landing)
  ↓
[Section List — drag & drop menggunakan @dnd-kit/sortable]
  ⠿  [Wireframe Hero]       Hero              [Ganti Design] [Edit] [Hapus]
  ⠿  [Wireframe Posts]      Postingan Terbaru [Ganti Design] [Edit] [Hapus]
  ⠿  [Wireframe Gallery]    Galeri            [Ganti Design] [Edit] [Hapus]
  
  [+ Tambah Section]
```

- **Ganti Design** → popup picker: wireframe grid semua variant section type itu → klik → langsung apply
- **Edit** → panel/drawer edit konten section (field sesuai type)
- **Drag** → reorder urutan

#### Format Data `body` untuk Landing

```typescript
type SectionItem = {
  id:      string;        // UUID lokal (nanoid), untuk React key + drag
  type:    SectionType;   // "hero" | "posts" | "gallery" | ...
  variant: string;        // "1" | "2" | ... (design variant)
  data:    Record<string, unknown>; // konten spesifik per type
}

type LandingBody = {
  sections: SectionItem[];
}
```

#### Section Types (mulai 1 variant per type, siap tambah lebih)

| Type | Label | Data Fields | Auto-data |
|------|-------|-------------|-----------|
| `hero` | Hero Banner | title, subtitle, ctaLabel, ctaUrl, bgImageUrl, bgColor | — |
| `posts` | Postingan Terbaru | title, eyebrow, headerDesc, titleAlign, count(2-12), categoryId/tagId | Ambil dari DB otomatis — 6 Varian Desain (1: Hero 3 Kolom, 2: Klasik, 3: Twin Columns, 4: Trio Column, 5: Post Carousel, 6: Forcreator 2 Kolom Portrait 4:5) |
| `events` | Event Mendatang | title, count(3) | Ambil dari DB otomatis |
| `gallery` | Galeri Foto | title, images[{url,alt}] | — |
| `about_text` | Tentang Kami | title, body, imageUrl, imagePosition(left\|right) | — |
| `features` | Keunggulan / Layanan | title, items[{icon,title,desc}] max 6 | — |
| `cta` | Call to Action | title, subtitle, ctaLabel, ctaUrl, bgColor | — |
| `contact_info` | Info Kontak | — | Dari settings otomatis |
| `stats` | Statistik | items[{number,label}] max 4 | — |
| `divider` | Pemisah / Spacer | height, bgColor | — |
| `instagram_post` | Instagram Feed / Linimasa | mode(repost\|post, label saja), accountName, accountUrl, count(4,8,12,16), showBorderTop, postUrls[] | Feed OTOMATIS via OAuth Instagram Graph API — lihat `docs/arsitektur-instagram-embed.md`. NOL fallback data — kosong kalau belum terhubung. |
| `directory` | Direktori Organisasi | directoryType(usaha\|profesional\|pesantren), titleStyle(default\|simple), title, eyebrow, headerDesc, count(2-8), gridCols(2\|3\|4), cardDesign(default\|custom) | Auto fetch dari DB public, DI-SCOPE ke tenant via `tenant_memberships` (pola sama `/usaha`,`/profesional`,`/pesantren`). NOL fallback data. |
| `quote` | Quote & Impact Counter | quoteText, authorName, authorTitle, authorSub, authorAvatarUrl, statLabel, ctaLabel, ctaUrl | Auto fetch `COUNT(*)` dari DB `tenant_memberships`, auto generate date real-time saat halaman dibuka, 100% dinamis. |

> **Section Quote & Impact Counter (`quote`) (Ditambahkan 2026-07-30)**:
> Modul section baru di Section Builder landing page untuk menampilkan quote/kutipan tokoh/anggota di sisi kiri dan counter statistik jumlah anggota terdaftar di sisi kanan:
> 1. **Kolom Kiri (Quote & Sitasi Tokoh)**: Teks quote utama (`quoteText`), foto avatar 1:1 rounded full (`authorAvatarUrl`), nama & profesi berwarna **Secondary** (`authorName`, `authorTitle`), serta info alumni (`authorSub`).
> 2. **Kolom Kanan (Angka Stat & Real-Time Date)**: Angka statistik besar berwarna **Secondary** (`memberCount` dari DB `tenant_memberships` per tenant), `statLabel`, link CTA berwarna **Secondary** (`ctaLabel`, `ctaUrl`), serta teks update waktu real-time yang dihasilkan otomatis saat runtime server (`"Berdasarkan data bulan [Bulan] [Tahun]"`).
> 3. **100% Multi-Tenant Dinamis**: Nama organisasi ter-resolve otomatis via `getTenantSeoBase(slug)`, angka terdaftar riil dari DB tenant, tanpa data palsu/hardcoded.
> File: `lib/quote-section-designs.ts`, `lib/quote-feed.server.ts`, `components/website/public/sections/quote/quote-section.tsx`, `section-editors.tsx` (`QuoteEditor`).

> **Section Directory Organisasi (`directory`) (Ditambahkan 2026-07-30, DIROMBAK 2026-07-30 setelah**
> audit)**:
> Modul section baru di Section Builder landing page untuk menampilkan Direktori Organisasi (Usaha,
> Praktik Profesional, atau Pesantren Alumni) milik ANGGOTA TENANT INI (bukan lintas tenant):
> 1. **Tipe Direktori (`directoryType`)**: `usaha` (Usaha & Bisnis Anggota), `profesional` (Komunitas
>    & Praktik Profesional), atau `pesantren` (Pesantren Alumni).
> 2. **Gaya Judul Section (`titleStyle`)**: `default` (Title block standar `eyebrow` + `title` +
>    `description`) vs `simple` (Judul simpel kiri + link *"Direktori [Type] [Nama Organisasi]→"*
>    berwarna **Secondary** — nama organisasi DINAMIS dari `getTenantSeoBase(slug).siteName`
>    [`settings.general.site_name` → `tenants.name` → slug], bukan hardcode tenant tertentu).
> 3. **Layout Grid Kolom (`gridCols`)**: `4` (4 kolom 1 row), `3` (3 kolom 1 row), atau `2` (2 kolom
>    1 row terpusat `max-w-4xl mx-auto`, layout mirip Post Design 6).
> 4. **Desain Kartu Directory (`cardDesign`)**: `default` (Card bawaan halaman arsip) vs `custom`
>    (foto cover `aspect-[16/9] rounded-none`, aksen diamond melayang `bg-secondary rotate-45`,
>    2 baris deskripsi `line-clamp-2`, alamat berwarna Secondary, badge kategori, border bottom
>    tipis, avatar bulat pemilik + nama). Foto/avatar kosong → placeholder ikon/inisial (BUKAN
>    foto stok orang lain).
> 5. **Server-Side Feed Aggregator (`lib/directory-feed.server.ts`)**: Query `member_businesses`/
>    `member_professionals`/`member_owned_pesantren` DI-SCOPE via `INNER JOIN tenant_memberships
>    WHERE tenantId={tenant ini} AND status IN (active,alumni)` — pola identik `/usaha`, `/profesional`,
>    `/pesantren` archive pages. **NOL fallback mock/fake data** — kalau item real kurang dari
>    `count` yang diminta, section cukup tampilkan yang ada (atau `return null` kalau nol sama
>    sekali), tidak pernah diisi data karangan.
> File: `lib/directory-section-designs.ts`, `lib/directory-feed.server.ts`, `components/website/
> public/sections/directory/directory-section.tsx`, `section-editors.tsx` (`DirectoryEditor`).
>
> **Audit + rombak total (2026-07-30)** — versi PERTAMA fitur ini (dibangun agen lain) diklaim
> "SELESAI dengan sempurna" tapi ternyata punya 2 bug FATAL, ditemukan lewat verifikasi kode
> langsung (bukan percaya laporan): (1) **fallback ke mock data karangan** — nama usaha/dokter/
> notaris/pesantren fiktif + foto stok Unsplash disamarkan sebagai anggota asli, salah satunya
> bahkan memakai nama tokoh Gontor sungguhan yang dilekatkan ke pesantren fiktif; (2) **nol tenant
> scoping** — parameter `tenantClient` diterima tapi tidak pernah dipakai, query langsung ke tabel
> public tanpa `JOIN tenant_memberships` sama sekali, artinya section ini akan menampilkan usaha/
> profesional/pesantren milik anggota TENANT LAIN secara acak. Plus hardcode nama tenant
> "Forcreator" di label publik dan UI admin generik yang dipakai semua tenant. Ketiganya sudah
> DIPERBAIKI TOTAL — tenant scoping diverifikasi empiris (query terhadap 2 tenant real lokal,
> nol data lintas-tenant yang tidak sah), mock data dihapus seluruhnya (bukan disembunyikan),
> semua label sekarang dinamis dari data aktual. `tsc --noEmit` 0 error kedua package + `bun run
> build --filter=@jalajogja/web` genuine sukses.

> **Section Instagram Post (`instagram_post`) (Ditambahkan 2026-07-30, DIBONGKAR TOTAL 2026-07-30)**:
> Versi PERTAMA fitur ini (agen lain, kehabisan kuota di tengah jalan) memakai upload foto manual
> via MediaPicker dan fallback ke post blog tenant sendiri yang disamarkan sebagai konten
> Instagram — SEMUA itu sudah dibongkar total dan diganti feed OTOMATIS sungguhan via OAuth
> Instagram Graph API (produk "Instagram API with Instagram Login"). Field `items`/MediaPicker
> upload custom SUDAH DIHAPUS TOTAL dari tipe data maupun UI editor. `mode` sekarang murni label
> header ("Post dari"/"Reposted dari" — repost Instagram native mempublish ke timeline akun
> sendiri, jadi satu fetch API sudah mencakup keduanya). `postUrls` (tempel URL post publik →
> embed resmi Instagram) tetap dipertahankan sebagai opsi sekunder independen dari OAuth. Detail
> arsitektur LENGKAP (alur OAuth, kredensial platform vs tenant, refresh token, prasyarat Meta App)
> ada di dokumen terpisah: **`docs/arsitektur-instagram-embed.md`** — jangan duplikasi detail itu
> di sini, ini cuma ringkasan pointer.

> ⚠️ **Tabel di atas dan § "Wireframe Tiap Section" di bawah adalah dokumen perencanaan lama —
> field name aktual sudah berbeda** (mis. `hero` field asli: `eyebrow, title, subtitle, ctaLabel,
> ctaUrl, ctaSecondaryLabel, ctaSecondaryUrl, imageUrl, showModuleStrip` — bukan `bgImageUrl,
> bgColor` seperti tertulis). Sumber kebenaran field data: `lib/hero-section-designs.ts` (`type
> HeroSectionData`) dan file setara untuk tipe lain (`lib/posts-section-designs.ts`, dst).
>
> **Hero sekarang punya 2 desain** (ditambahkan 2026-07-16, lihat lesson CLAUDE.md tanggal sama):
> `1` Klasik (desain asli, sebelumnya satu-satunya) dan `2` Full-Bleed Modern. File:
> `components/website/public/sections/hero/{hero-section,hero-design-1,hero-design-2}.tsx`, picker
> desain di `HeroEditor` (`components/website/section-editors.tsx`) — pola identik dengan picker
> `posts`/`products`/`events`/`campaigns` yang sudah lebih dulu ada.
>
> **`showModuleStrip` beda arti per desain** (ditambahkan 2026-07-16, sesi sama): Desain 1 = strip
> kartu modul (`HERO_MODULES`, tetap seperti sebelumnya, tidak berubah). Desain 2 = Funfact —
> statistik live dari DB (`FUNFACT_CATALOG`, maks 4 dipilih admin), bukan diketik manual. Strip
> modul yang tadinya cuma bisa hidup di hero sekarang JUGA tersedia sebagai section landing
> independen (`modules`, `lib/module-strip-designs.ts`, katalog 8 modul, 2 desain) — detail penuh
> di `docs/arsitektur-strip-modul.md`.
>
> **Funfact punya 2 posisi tampilan** (`funfactStyle`, ditambahkan 2026-07-16, sesi sama): `inline`
> (default) — mengalir normal di bawah gambar hero. `floating` — kartu menggantung menimpa batas
> bawah gambar hero via negative margin (`-mt-14 md:-mt-20`), sumber ide stat-bar-overlap di
> `design-refs/jalakarta-v2/`. Toggle di `HeroEditor`, cuma muncul saat Funfact aktif.
>
> **Pengembangan Hero Desain 1 (Klasik) (Ditambahkan 2026-07-30)**:
> 1. **Custom Warna Judul (`titleColor`)**: `default` (Gelap `text-foreground`), `primary` (`text-primary`), atau `secondary` (`text-secondary`).
> 2. **Varian Gaya Tombol (`ctaVariant` & `ctaSecondaryVariant`)**: Integrasi ke `PublicButton` (`primary`, `secondary`, `outline-primary`, `outline-dark`, `dark`, `ghost`).
> 3. **Rasio Gambar Asli & Opsi Bingkai (`imageBorder`)**: Menghapus crop paksa (`aspect-[3/4]`),
>    gambar tampil `w-full h-auto` (ukuran asli, tanpa cap tinggi apa pun — cap tinggi sempat
>    ditambah lalu di-revert, lihat catatan di bawah). Opsi `imageBorder`: `bordered` (border,
>    shadow, glow) vs `none` (Clean — tanpa border/shadow/glow).
> 4. **Embed Video YouTube Bersih & Format Rasio Dinamis**: Field `youtubeUrl` mendukung ekstraksi ID bersih (`lib/youtube.ts` — `modestbranding=1`, `rel=0`, tanpa overlay saat play), `youtubeAutoplay` (boolean), `youtubePlayMode` (`inline` pemutaran di tempat vs `popup` Lightbox modal), serta deteksi format rasio dinamis (`youtubeAspect`: `auto` deteksi otomatis YouTube Shorts `9:16` vs `16:9` landscape vs `1:1` square). Saat video diputar (inline), seluruh overlay/kartu disembunyikan sehingga murni menampilkan layar video bersih.
> 5. **Toggle Floating Hero Card (`showHeroCard`)**: Checkbox kontrol boolean untuk menampilkan/menyembunyikan floating card (Event / Donasi / Berita Terbaru).
>
> **Audit `hero-design-1.tsx` (2026-07-30)** — 2 bug nyata ditemukan+difix (fitur ini dibangun
> sesi/agen lain):
> 1. **Autoplay YouTube via config selalu gagal diam-diam** — `buildYouTubeEmbedUrl` tidak kirim
>    `mute=1`; browser blokir autoplay ber-suara tanpa user gesture. Fix: parameter `mute` baru,
>    state `userInitiatedPlay` membedakan "mulai sendiri via config" (mute) dari "user klik
>    Putar Video/buka popup" (boleh bersuara).
> 2. **Iframe YouTube ter-mount 2× bersamaan** — pola render media 2× (mobile+desktop, cuma
>    `display` di-toggle CSS) membuat 2 iframe identik dimuat bersamaan saat video diputar. Fix:
>    satu `renderMedia()`, posisi diatur via CSS Grid `order` — bukan duplikasi DOM.
>
> **Catatan scope (2026-07-30)**: sempat ditambah cap tinggi `max-h-[500px]` pada gambar dengan
> alasan "cegah foto potret ekstrem mendominasi hero" — ini KELIRU, bukan bug fix, melainkan
> perubahan desain yang tidak diminta. Selain itu caranya sendiri buggy (`width:100%; height:
> auto; max-height:Npx` pada `<img>` membuat browser mengorbankan WIDTH demi menjaga rasio asli
> begitu max-height mengikat — img jadi lebih sempit dari frame/glow-nya, celah kosong terlihat
> di sampingnya). User menegur langsung — **di-revert total**, kembali ke `w-full h-auto` polos
> tanpa cap tinggi apa pun, sesuai state sebelum disentuh. **Aturan yang ditegaskan**: perbaikan
> yang diminta adalah audit BUG, bukan lisensi untuk menambah keputusan desain baru — kalau
> menemukan potensi masalah UX di luar apa yang diminta, tanyakan dulu, jangan langsung ubah.
>
> Setelah fix: `tsc --noEmit` 0 error. Belum diverifikasi visual di browser (keterbatasan
> environment sesi ini).

#### Default Sections saat Template Dipilih

Saat admin pilih template `landing` untuk pertama kali, langsung ada 3 section default:
```
[Hero v1] → [Posts Terbaru v1] → [Contact Info v1]
```
Admin bisa langsung edit atau tambah section lain.

#### Wireframe Tiap Section (CSS Tailwind)

Wireframe = skeleton representasi layout section. Contoh Hero v1:
```
┌────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← bg gray
│         ██████████████            │  ← title bar
│         ████████████              │  ← subtitle bar
│         ┌──────┐  ┌──────┐        │  ← CTA buttons
│         └──────┘  └──────┘        │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────┘
```
Dibuat dengan `div` bg-gray-200, rounded, animate-pulse optional.

---

### Template: Contact Page

Satu design untuk sekarang. Config di `body`:
```typescript
type ContactBody = {
  customTitle?:  string;   // default: "Hubungi Kami"
  showForm:      boolean;  // default: true
  showMap:       boolean;  // default: true
  mapEmbedUrl?:  string;   // paste dari Google Maps → Share → Embed
  successMsg?:   string;   // pesan setelah form submit
}
```

Data kontak (nama org, email, telepon, alamat) otomatis dari `settings` group `contact`.

Layout render di front-end:
```
[Judul: "Hubungi Kami" atau customTitle]
[Grid 2 kolom]
  Kiri:                    Kanan:
  - Nama (required)        - Nama organisasi
  - Email                  - Telepon
  - Telepon                - Email
  - Pesan (required)       - Alamat
  - [Kirim]                - Socials icons
[Google Maps iframe full-width bawah]
```

---

### Template: Linktree

Mobile-first (max-width 480px centered).

```typescript
type LinkItem = {
  id:      string;
  type:    LinkType;   // enum di bawah
  label:   string;     // custom label
  url:     string;
  enabled: boolean;
}

type LinktreeBody = {
  profileImageUrl?: string;
  bio?:             string;
  links:            LinkItem[];
}

// Link types dengan icon bawaan
type LinkType =
  | "instagram" | "tiktok" | "facebook" | "youtube" | "twitter"
  | "whatsapp"  | "telegram" | "linkedin" | "email" | "phone"
  | "website"   | "shopee"   | "tokopedia" | "gofood" | "grabfood"
  | "custom"    // generic link, pakai icon Globe
```

Layout:
```
[Logo/foto profil bulat]
[Nama org]
[Bio text]
[Instagram ─────────────────── →]
[TikTok ─────────────────────── →]
[Website ────────────────────── →]
[WhatsApp ───────────────────── →]
```

Admin editor: list link dengan drag reorder (juga pakai @dnd-kit), toggle enabled/disabled,
edit label + url + type.

---

### Template: About Us

Sama dengan `default` — Tiptap editor. Tapi front-end render dengan layout yang berbeda:
- Sidebar info organisasi (ambil dari settings)
- Featured image sebagai hero atas
- Body di bawahnya

Tidak ada field tambahan — beda hanya di presentasi front-end.

---

### Template: Default

Status quo — Tiptap body + featured image. Render sebagai artikel biasa.

---

### Struktur Route Front-end

```
app/(public)/[tenant]/
├── layout.tsx              → PublicLayout (header + footer dari settings)
├── page.tsx                → / → Render halaman slug="home" atau fallback
├── blog/
│   ├── page.tsx            → /blog → list posts published
│   └── [postSlug]/
│       └── page.tsx        → /blog/[slug] → detail post + SEO
├── [pageSlug]/
│   └── page.tsx            → /[slug] → router template (pilih renderer)
├── donasi/[slug]/page.tsx  → ✅ sudah ada
├── event/[slug]/page.tsx   → ✅ sudah ada
├── dokumen/[id]/page.tsx   → ✅ sudah ada
├── sign/[token]/page.tsx   → ✅ sudah ada
└── verify/[hash]/page.tsx  → ✅ sudah ada
```

Route `[pageSlug]` adalah **template router**:
```typescript
// app/(public)/[tenant]/[pageSlug]/page.tsx
const page = await fetchPage(slug, pageSlug)
if (!page || page.status !== "published") notFound()

switch (page.template) {
  case "landing":  return <LandingTemplate page={page} tenant={tenant} />
  case "contact":  return <ContactTemplate page={page} tenant={tenant} settings={contact} />
  case "linktree": return <LinktreeTemplate page={page} />
  case "about":    return <AboutTemplate page={page} tenant={tenant} />
  default:         return <DefaultTemplate page={page} />
}
```

---

### Komponen Struktur

```
components/public/
├── layout/
│   ├── public-header.tsx      → logo + nav (Pages published, sorted by order)
│   ├── public-footer.tsx      → socials + kontak + copyright
│   └── public-layout.tsx      → wrapper: inject CSS vars warna + font
├── templates/
│   ├── default-template.tsx   → Tiptap body + featured image
│   ├── about-template.tsx     → sidebar info + Tiptap body
│   ├── contact-template.tsx   → form + info + maps
│   ├── linktree-template.tsx  → mobile link list
│   └── landing-template.tsx  → loop sections → render per type+variant
├── sections/
│   ├── hero/
│   │   ├── hero-v1.tsx        → full-width hero: bg + title + subtitle + CTA
│   │   └── hero-wireframe.tsx → CSS wireframe untuk picker
│   ├── posts/
│   │   ├── posts-v1.tsx       → grid 3 kolom card
│   │   └── posts-wireframe.tsx
│   ├── gallery/
│   │   ├── gallery-v1.tsx     → masonry/grid foto
│   │   └── gallery-wireframe.tsx
│   └── ... (satu folder per section type)
├── post-card.tsx              → card post reusable
└── prose-content.tsx          → Tiptap body renderer untuk front-end
```

```
components/website/        (dashboard admin — sudah ada, tambahkan:)
├── page-template-picker.tsx   → grid wireframe pilih template
├── landing-builder.tsx        → drag & drop section list (@dnd-kit)
├── section-picker.tsx         → popup wireframe picker variant per type
├── section-editor/
│   ├── hero-editor.tsx
│   ├── posts-editor.tsx
│   ├── gallery-editor.tsx
│   └── ... (satu per type)
├── contact-page-editor.tsx    → form + toggle showMap + paste mapUrl
└── linktree-editor.tsx        → drag & drop link list
```

---

### Dashboard: Admin Landing Builder

```
PageForm (template=landing)
  ↓ bukan Tiptap editor
  ↓ render LandingBuilder

LandingBuilder (client component, @dnd-kit/sortable):
  SortableContext → DndContext
    SectionRow (draggable):
      [GripVertical] [Wireframe mini 60px] [Label] [Ganti] [Edit ▼] [Trash]
  
  [+ Tambah Section] → SectionPicker modal:
      Grid wireframe semua section types
      Klik → append ke list dengan variant "1"
  
  Section Picker per row (Ganti Design):
      Popup wireframe semua variant untuk type itu
      Klik → update variant di state

  Section Editor panel (Edit):
      Slide-in drawer dari kanan
      Field sesuai type (title, url, images, dll)
```

---

### Dashboard: Inbox Pesan (Contact Submissions)

Route baru: `/{slug}/website/pesan`

```
Sidebar nav website:
  Dashboard
  Posts
  Halaman
  Kategori
  Pesan      ← BARU (badge angka unread)
```

List page: tanggal, nama, email, pesan preview, status baca/belum.
Detail: modal atau expand inline.
Server action: `markContactSubmissionReadAction(slug, submissionId)`.

---

### Caching Strategy

| Halaman | Revalidate |
|---------|-----------|
| Beranda / | 60 detik |
| /blog list | 60 detik |
| /blog/[slug] | 300 detik |
| /[pageSlug] landing/contact/dll | 120 detik |
| Linktree | 300 detik |

Saat admin publish/update konten → `revalidatePath(`/(public)/${slug}/...`)` di server action.

---

### Dependensi Baru

```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Hanya untuk dashboard (client component). Front-end publik tidak perlu dnd-kit.

---

### Status Implementasi

| Komponen | Status |
|----------|--------|
| DB: kolom `template` di pages | ✅ Selesai |
| DB: tabel `contact_submissions` | ✅ Selesai |
| Admin: Template picker di PageForm sidebar | ✅ Selesai |
| Admin: `LandingBuilder` drag & drop (@dnd-kit) | ✅ Selesai |
| Admin: `SectionPicker` wireframe popup | ✅ Selesai |
| Admin: Section Editors 10 types | ✅ Selesai |
| Admin: `ContactPageEditor` | ✅ Selesai |
| Admin: `LinktreeEditor` drag & drop | ✅ Selesai |
| Admin: Inbox Pesan (`/website/pesan`) | ✅ Selesai |
| Admin: `/settings/website` (homepage + nav builder) | ✅ Selesai |
| Front-end: `PublicLayout` (header+footer) | ✅ Selesai |
| Front-end: `/` homepage route | ✅ Selesai |
| Front-end: Template Router `/[pageSlug]` | ✅ Selesai |
| Front-end: `DefaultTemplate` + `AboutTemplate` | ✅ Selesai |
| Front-end: `LandingTemplate` + 10 sections | ✅ Selesai |
| Front-end: `ContactTemplate` + form submit | ✅ Selesai |
| Front-end: `LinktreeTemplate` mobile-first | ✅ Selesai |
| Front-end: `/blog` list + `/blog/[slug]` detail | ✅ Selesai |
| Domain routing Fase 2-3 (subdomain + custom domain) | ⬜ Belum |
| Event list publik `/event` | ⬜ Belum |
| Toko publik `/toko` | ⬜ Belum |
| Donasi list publik `/donasi` | ⬜ Belum |

---

## Bagian 4: Nav Menu System

### Konsep

Menu navigasi header website dikelola admin di `/{slug}/settings/website`.
Data disimpan sebagai JSONB di `settings` table, bukan tabel terpisah.

### Settings yang Disimpan

```
key="nav_menu",      group="website"  → NavItem[] (JSONB array)
key="homepage_slug", group="website"  → string (slug halaman beranda)
```

### Tipe Data NavItem

```typescript
type NavItemType = "page" | "blog" | "event" | "toko" | "donasi" | "custom";

type NavItem = {
  id:        string;
  label:     string;
  type:      NavItemType;
  pageSlug?: string;   // jika type === "page"
  href?:     string;   // jika type === "custom"
  external?: boolean;  // buka di tab baru
  order:     number;
};
```

### URL Resolusi per Type

| Type | URL |
|------|-----|
| `page` | `/{slug}/{pageSlug}` |
| `blog` | `/{slug}/blog` |
| `event` | `/{slug}/event` |
| `toko` | `/{slug}/toko` |
| `donasi` | `/{slug}/donasi` |
| `custom` | value dari `href` |

### File yang Terlibat

```
lib/nav-menu.ts                                     → types + resolveNavHref + parseNavMenu
app/(dashboard)/[tenant]/settings/website/
├── page.tsx                                        → server: fetch settings + pages
└── actions.ts                                      → saveWebsiteSettingsAction
components/settings/website-settings-client.tsx     → drag & drop nav builder + homepage picker
```

---

## Bagian 5: Public Layout (Header + Footer)

> **Detail arsitektur header & footer multi-desain ada di `docs/arsitektur-header-footer-publik.md`.**
> Bagian ini hanya ringkasan; semua keputusan desain, registry, props, dan urutan eksekusi
> didokumentasikan di sana.

### PublicLayout — Server Component

`app/(public)/[tenant]/layout.tsx` — diterapkan ke SEMUA route publik:

```
(public)/[tenant]/
├── layout.tsx   ← PublicHeader + PublicFooter wrapping semua konten
├── page.tsx     ← homepage
├── blog/
├── [pageSlug]/
├── event/
├── donasi/
├── sign/        ← TODO: tidak perlu header/footer, pisahkan nanti
├── verify/      ← TODO: tidak perlu header/footer, pisahkan nanti
└── invite/      ← TODO: tidak perlu header/footer, pisahkan nanti
```

Layout fetch: `general`, `website`, `contact`, `display` (untuk `header_design` + `footer_design`).
Juga resolve `currentUser` dari session Better Auth (member atau profile publik).

### PublicHeader — Multi-Design

- Wrapper `public-header.tsx` baca `header_design` dari settings → render komponen desain terpilih
- Design registry: `lib/header-designs.ts` — saat ini: `flex` (default baru) + `classic` (lama)
- Default: `"flex"` — dua row (TopBar: logo+search+lonceng+avatar; NavBar: menu+login/daftar)
- Mobile: bottom navigation bar fixed (app-like), maks 4 item

### PublicFooter — Multi-Design

- Wrapper `public-footer.tsx` baca `footer_design` dari settings → render komponen desain terpilih
- Design registry: `lib/footer-designs.ts` — saat ini: `dark` (default, lama) + `light` (perencanaan)
- Default: `"dark"` — background gray-900, 3 kolom, copyright bar

---

## Bagian 6: Homepage Route

### Cara Kerja

`app/(public)/[tenant]/page.tsx` — serve URL `/{slug}/`:

1. Baca `homepage_slug` dari `settings` group `website`
2. Jika kosong → tampilkan placeholder "Website sedang dipersiapkan"
3. Jika ada → query page dengan slug itu
4. Jika halaman tidak published → tampilkan pesan "Halaman beranda belum tersedia"
5. Render template sesuai field `page.template`

### Konflik Route yang Sudah Diselesaikan

**Masalah**: `(dashboard)/[tenant]/page.tsx` dan `(public)/[tenant]/page.tsx` keduanya resolve ke `/{slug}` → Next.js build error.

**Solusi**: Hapus `(dashboard)/[tenant]/page.tsx` (isinya hanya redirect ke `/dashboard`).
- `/{slug}` → milik `(public)/[tenant]/page.tsx` (public homepage)
- `/{slug}/dashboard` → milik `(dashboard)/[tenant]/dashboard/page.tsx` (tetap dengan auth)
- `(dashboard)/[tenant]/layout.tsx` tetap melindungi semua sub-route dashboard

---

## Komponen File Map Lengkap

```
apps/web/
├── lib/
│   ├── page-templates.ts                    → types + parse helpers (template system)
│   └── nav-menu.ts                          → NavItem types + resolveNavHref
│
├── components/
│   ├── settings/
│   │   ├── settings-nav.tsx                 → tambah "Website" item
│   │   └── website-settings-client.tsx      → drag & drop nav builder
│   └── website/
│       ├── landing-builder.tsx              → drag & drop section admin
│       ├── section-picker.tsx               → wireframe popup pilih section
│       ├── section-editors.tsx              → editor per section type (10 types)
│       ├── section-wireframes.tsx           → CSS wireframe thumbnails
│       ├── contact-page-editor.tsx          → editor contact page
│       ├── linktree-editor.tsx              → editor linktree dengan dnd
│       ├── website-nav.tsx                  → tambah "Pesan" item
│       └── public/
│           ├── default-template.tsx         → Tiptap HTML renderer (default + about)
│           ├── landing-template.tsx         → async server, 10 section renderers
│           ├── contact-template.tsx         → "use client", form + maps + info kontak
│           ├── linktree-template.tsx        → mobile-first link list
│           └── layout/
│               ├── public-header.tsx        → sticky header, hamburger mobile
│               └── public-footer.tsx        → 3 kolom, copyright bar
│
├── app/(public)/[tenant]/
│   ├── layout.tsx                           → PublicLayout (fetch settings + render header/footer)
│   ├── page.tsx                             → homepage route (baca homepage_slug dari settings)
│   ├── [pageSlug]/
│   │   ├── page.tsx                         → template router (landing/contact/linktree/default)
│   │   └── actions.ts                       → submitContactFormAction
│   └── blog/
│       ├── page.tsx                         → list posts published (ISR 60s)
│       └── [slug]/page.tsx                  → detail post + SEO (ISR 60s)
│
├── app/(dashboard)/[tenant]/
│   ├── settings/website/
│   │   ├── page.tsx                         → homepage picker + nav builder
│   │   └── actions.ts                       → saveWebsiteSettingsAction
│   └── website/
│       └── pesan/
│           ├── page.tsx                     → inbox contact submissions
│           ├── actions.ts                   → markSubmissionReadAction
│           └── mark-read-button.tsx         → client tombol tandai dibaca
│
└── components/ui/
    └── switch.tsx                           → Switch component (baru, @radix-ui/react-switch)
```

---

## Migration SQL Tenant Existing

```sql
-- Jalankan per tenant yang sudah ada:
ALTER TABLE "tenant_{slug}".pages
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'default'
    CHECK (template IN ('default','landing','contact','about','linktree'));

CREATE TABLE IF NOT EXISTS "tenant_{slug}".contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES "tenant_{slug}".pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Migration sudah dijalankan untuk tenant `pc-ikpm-jogjakarta`.

---

## Lessons Learned — Sesi Ini

### Route group `(public)` dan `(dashboard)` tidak boleh punya `page.tsx` di segment yang sama

`(dashboard)/[tenant]/page.tsx` dan `(public)/[tenant]/page.tsx` keduanya resolve ke `/{slug}` → Next.js build error: *"You cannot have two parallel pages that resolve to the same path."*

**Fix**: Hapus `(dashboard)/[tenant]/page.tsx`. URL `/{slug}` dimiliki satu route group saja.

**Rule**: Setiap URL harus punya tepat SATU `page.tsx` di seluruh codebase, terlepas dari route group. Layouts boleh overlap, pages tidak.

### `require()` di server component crash dengan Turbopack

```typescript
// ❌ SALAH — crash di Turbopack
.where(require("drizzle-orm").inArray(schema.media.id, coverIds))

// ✅ BENAR — import di atas file
import { inArray } from "drizzle-orm";
.where(inArray(schema.media.id, coverIds))
```

`require()` adalah CommonJS — tidak diizinkan di ES Module context (Turbopack/Next.js). Selalu pakai `import` di atas file.

### `PublicLayout` saat ini wrap semua route publik termasuk sign/verify/invite

Route seperti `/(public)/[tenant]/sign/[token]`, `verify/[hash]`, `invite` tidak perlu header/footer publik. Saat ini masih wrapped oleh `PublicLayout` — tidak merusak fungsionalitas tapi menambah query DB yang tidak perlu.

**TODO**: Pindahkan route-route ini ke route group terpisah `(public-bare)` yang tidak punya layout. Lakukan saat ada waktu, bukan urgent.

### `(public)/[tenant]/layout.tsx` hanya butuh tenant aktif

Layout fetch 3 grup settings sekaligus via `Promise.all`. Jika tenant tidak aktif → `notFound()`. Pattern ini aman dan efisien — satu DB roundtrip untuk semua data layout.

---

## Bagian 5: Sidebar Publik

> Detail lengkap arsitektur, schema section, DnD builder, integrasi publik: **`docs/arsitektur-sidebar.md`**

Sidebar adalah panel konten di sisi kanan halaman publik (post archive + post detail).
Dikonfigurasi oleh admin via drag-and-drop section builder di `/{slug}/website/pengaturan`.

**Phase 1 (segera):** Hanya satu jenis section — **Select Posts** — dengan filter:
- `recent` — terbaru
- `popular` — terpopuler (ORDER BY view_count DESC, memanfaatkan view counter)
- `category` — filter by kategori
- `tag` — filter by tag

**Storage**: `settings` key `sidebar_sections`, group `website` — JSONB array `SidebarSection[]`.

**Lokasi admin**: `/{slug}/website/pengaturan` — nav item baru menggantikan Komentar (coming soon).

**Render publik**: `<PublicSidebar>` server component — muncul di `lg:` breakpoint (hidden mobile).
Layout: `flex gap-8`, konten utama `flex-1`, sidebar `w-72 shrink-0 hidden lg:block`.

**Dependency baru**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

**Status**: ⬜ Belum diimplementasikan — arsitektur selesai.

---

## Bagian 6: Import & Export Post WordPress (Rencana Masa Depan)

> **Dokumen Arsitektur & Spesifikasi Terpisah**: **`docs/arsitektur-import-export-post-wordpress.md`**
> **STATUS: ⚠️ BELUM DIEKSEKUSI / PERLU KLARIFIKASI & MATURASI LEBIH LANJUT BEFORE EXECUTION**

Perencanaan matang untuk mendukung migrasi penuh dari website berbasis WordPress (beserta plugin Yoast SEO, permalinks, featured images, dan sanitasi Gutenberg HTML):
- **Import WXR XML & REST API**: Mendukung ekspor XML WordPress standar serta API pull `/wp-json/wp/v2/`.
- **Integrasi Yoast SEO**: Pemetaan 1-to-1 dari Yoast meta key (`_yoast_wpseo_*`) ke kolom SEO Jalakarta (`posts.metaTitle`, `metaDesc`, `focusKeyword`, `ogImageId`, `robots`, `schemaType`).
- **Custom Permalinks**: Opsi struktur permalink WordPress (`/%postname%/`, `/post/%postname%/`, `/%year%/%monthnum%/%postname%/`) di `/{slug}/website/pengaturan`.
- **Klarifikasi Sebelum Eksekusi**: Belum ada kode yang ditulis. Perlu verifikasi teknis lanjutan dan persetujuan user sebelum eksekusi dimulai.

---

## Bagian 7: Arsitektur Editor Tiptap & Content Renderer Universal

> **Dokumen Arsitektur & Spesifikasi Terpisah**: **`docs/arsitektur-editor.md`**
> **STATUS: 📋 PERENCANAAN TEKNIS SELESAI — SIAP DIEKSEKUSI PER FASE**

Editor konten di seluruh modul Jalakarta (`posts`, `pages`, `products`, `campaigns`, `events`, `letters`) telah terkonsolidasi pada komponen tunggal `<TiptapEditor>` (`components/editor/tiptap-editor.tsx`). 

Spesifikasi pengembangan lanjutan meliputi:
- **Block "Baca Juga"**: Callout link internal (dengan `<PublicLinkPicker>`) & eksternal dengan custom label prefix.
- **Enhanced Block Quote**: Quote card dengan field penulis/citation (`— Nama Penulis`) dan ikon quote dekoratif.
- **Responsive YouTube Embed**: Native URL parser dengan container 16:9 (`aspect-video`) anti-overflow mobile.
- **Responsive Instagram Embed**: Parser post/reel Instagram dengan auto-script loader `instagram.com/embed.js`.
- **Frontend Spacing Standard**: Utility `.prose-jalakarta` untuk menjamin konsistensi jarak antar-block di seluruh breakpoint.


