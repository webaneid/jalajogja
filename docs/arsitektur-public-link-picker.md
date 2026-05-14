# Arsitektur Public Link Picker

Komponen autocomplete universal untuk memilih URL front-end publik.
Dipakai di mana saja admin perlu mengisi link ke halaman website organisasi.

---

## 1. Latar Belakang & Tujuan

Admin sering perlu memilih URL front-end — saat membangun nav menu, mengisi CTA landing section,
mengatur widget sidebar, atau mengisi link di mana saja. Saat ini admin harus hafal atau mengetik URL
manual, rawan typo, dan tidak tahu halaman mana yang tersedia.

**`PublicLinkPicker`** adalah combobox autocomplete yang:
- Menampilkan semua URL front-end yang tersedia (statis + konten dari DB)
- Dapat dicari berdasarkan nama/judul konten
- Mengelompokkan hasil berdasarkan tipe (Halaman, Postingan, Produk, dst)
- Mengembalikan URL siap pakai (path relatif terhadap domain)

---

## 2. Inventaris URL Front-end

### 2a. Rute Statis (tidak butuh DB, selalu tersedia)

| Label | URL Pattern | Grup |
|-------|-------------|------|
| Beranda | `/{slug}/` | Halaman Utama |
| Arsip Postingan | `/{slug}/post` | Halaman Utama |
| Agenda / Event | `/{slug}/agenda` | Halaman Utama |
| Direktori Produk | `/{slug}/produk` | Halaman Utama |
| Donasi & Campaign | `/{slug}/campaign` | Halaman Utama |
| Direktori Anggota | `/{slug}/anggota` | Direktori |
| Direktori Pesantren | `/{slug}/pesantren` | Direktori |
| Direktori Usaha | `/{slug}/usaha` | Direktori |
| Statistik | `/{slug}/statistik` | Direktori |
| Keranjang Belanja | `/{slug}/keranjang` | Transaksi |
| Login | `/{slug}/login` | Akun |
| Register | `/{slug}/register` | Akun |
| Dashboard Akun | `/{slug}/akun` | Akun |
| Riwayat Transaksi | `/{slug}/akun/transaksi` | Akun |

### 2b. Konten Dinamis (difetch dari DB saat pencarian)

| Tipe Konten | URL Pattern | Search Field | Sumber DB |
|-------------|-------------|--------------|-----------|
| Halaman (Page) | `/{slug}/{pageSlug}` | title, slug | `tenant.pages WHERE status='published'` |
| Post individual | `/{slug}/post/{postSlug}` | title, slug | `tenant.posts WHERE status='published'` |
| Post by Kategori | `/{slug}/post?category={catSlug}` | category name | `tenant.post_categories` |
| Post by Tag | `/{slug}/post?tag={tagSlug}` | tag name | `tenant.post_tags` |
| Produk | `/{slug}/produk/{productSlug}` | name, slug | `tenant.products WHERE status='active'` |
| Kategori Produk | `/{slug}/produk/kategori/{catSlug}` | name, slug | `tenant.product_categories` |
| Campaign / Donasi | `/{slug}/campaign/{campaignSlug}` | title, slug | `tenant.campaigns WHERE status='active'` |
| Pesantren | `/{slug}/pesantren/{id}` | name | `public.member_owned_pesantren` |
| Usaha / Bisnis | `/{slug}/usaha/{id}` | name | `public.member_businesses WHERE is_active=true` |

### 2c. Rute Sistem (ditampilkan di picker khusus konteks, bukan di general picker)

Rute-rute di bawah ini bersifat sistem — tidak dimasukkan ke general picker karena berisi slug/token dinamis
yang tidak bisa dipilih tanpa data spesifik:

| URL | Keterangan |
|-----|------------|
| `/{slug}/sign/{token}` | Halaman TTD surat — token unik per slot |
| `/{slug}/verify/{hash}` | Verifikasi TTD surat — hash unik per signature |
| `/{slug}/invite` | Terima undangan pengurus — hanya dari email |
| `/{slug}/invoice/{id}` | Invoice publik — ID unik per transaksi |
| `/{slug}/dokumen/view/{id}` | Dokumen publik — ID unik per dokumen |
| `/{slug}/produk/{productSlug}/...` | Varian produk — dihandle oleh detail produk |
| `/{slug}/anggota/{id}` | Profil pribadi anggota — auth-protected, owner only |
| `/{slug}/akun/...` | Sub-halaman akun — tidak dilink dari nav |

---

## 3. API Endpoint

### `GET /api/ref/public-links?slug={tenantSlug}&q={query}`

**Auth**: Tidak butuh auth — hanya dipakai di admin dashboard, API key-nya implisit dari session middleware.
Namun untuk keamanan, gunakan `getTenantAccess(slug)` di route handler.

**Query params:**
- `slug` (required) — tenant slug
- `q` (optional) — search query, min 1 karakter. Jika kosong, hanya rute statis yang dikembalikan.
- `types` (optional) — comma-separated filter tipe: `page,post,product,campaign,pesantren,usaha`

**Response:**
```typescript
type PublicLink = {
  label:    string;   // nama tampil, e.g. "Panduan Anggota Baru"
  url:      string;   // full path, e.g. "/ikpm/post/panduan-anggota-baru"
  group:    string;   // nama grup, e.g. "Postingan"
  type:     PublicLinkType;
  meta?:    string;   // info tambahan, e.g. nama kategori, tanggal publish
};

type PublicLinksResponse = {
  links:  PublicLink[];
  total:  number;
};
```

**`PublicLinkType`:**
```typescript
type PublicLinkType =
  | "static"          // rute statis (beranda, post, agenda, dll)
  | "page"            // halaman statis tenant
  | "post"            // post individual
  | "post-category"   // filter post by kategori
  | "post-tag"        // filter post by tag
  | "product"         // produk individual
  | "product-category"// kategori produk
  | "campaign"        // campaign/donasi individual
  | "pesantren"       // pesantren detail
  | "usaha";          // usaha detail
```

**Logika pencarian:**
1. Selalu sertakan rute statis yang match (filter by label, case-insensitive)
2. Jika `q` ada → query DB parallel untuk semua tipe konten:
   - `ILIKE '%{q}%'` pada title/name
   - `LIMIT 5` per tipe untuk performa
3. Total hasil max: 5 statis + 5×8 tipe = ~45 baris per response
4. Urutkan: statis dulu, lalu per grup alphabetical

**Contoh response untuk `q=panduan`:**
```json
{
  "links": [
    { "label": "Arsip Postingan", "url": "/ikpm/post", "group": "Halaman Utama", "type": "static" },
    { "label": "Panduan Anggota Baru", "url": "/ikpm/post/panduan-anggota-baru", "group": "Postingan", "type": "post", "meta": "12 Jan 2025" },
    { "label": "Panduan Daftar Mitra", "url": "/ikpm/post/panduan-daftar-mitra", "group": "Postingan", "type": "post", "meta": "3 Feb 2025" },
    { "label": "Panduan Usaha", "url": "/ikpm/campaign/panduan-usaha", "group": "Donasi", "type": "campaign" }
  ],
  "total": 4
}
```

---

## 4. Komponen: `PublicLinkPicker`

**Lokasi:** `components/ui/public-link-picker.tsx`

**Interface:**
```typescript
type PublicLinkPickerProps = {
  slug:          string;            // tenant slug
  value?:        string;            // URL yang sedang dipilih
  onChange:      (url: string) => void;
  placeholder?:  string;            // default: "Cari halaman atau konten..."
  types?:        PublicLinkType[];  // filter tipe (opsional)
  className?:    string;
  disabled?:     boolean;
};
```

**UX Behavior:**
- Input berisi URL yang dipilih (editable) — user bisa ketik URL manual
- Klik input → Popover terbuka dengan list rute statis
- Ketik ≥ 1 karakter → debounce 300ms → fetch `/api/ref/public-links`
- Hasil dikelompokkan per `group` dengan header grup (separator di Command)
- Keyboard: ↑↓ navigate list, Enter pilih, Escape tutup
- Ikon: setiap tipe punya ikon lucide yang berbeda (lihat tabel di bawah)
- Pilih item → onChange dipanggil dengan URL → Popover tutup

**Ikon per tipe:**
| Type | Icon | Lucide |
|------|------|--------|
| static | sesuai rute | Globe / Home / List |
| page | FileText | `FileText` |
| post | Newspaper | `Newspaper` |
| post-category | Tag | `Tag` |
| post-tag | Hash | `Hash` |
| product | ShoppingBag | `ShoppingBag` |
| product-category | Layers | `Layers` |
| campaign | Heart | `Heart` |
| pesantren | School | `School` |
| usaha | Briefcase | `Briefcase` |

**UI Wireframe:**
```
┌────────────────────────────────────────────┐
│ 🔗 /ikpm/post/panduan-anggota-baru    ✕   │ ← input (editable URL)
└────────────────────────────────────────────┘
  ┌──────────────────────────────────────────┐
  │ Cari halaman atau konten...               │ ← search input dalam popover
  ├──────────────────────────────────────────┤
  │ HALAMAN UTAMA                             │
  │   🏠 Beranda                    /ikpm/    │
  │   📰 Arsip Postingan           /ikpm/post │
  │   📅 Agenda / Event          /ikpm/agenda │
  ├──────────────────────────────────────────┤
  │ POSTINGAN                                 │
  │   📄 Panduan Anggota Baru    12 Jan 2025  │
  │   📄 Info Musyawarah         3 Feb 2025   │
  ├──────────────────────────────────────────┤
  │ KATEGORI POST                             │
  │   🏷 Pengumuman              4 post       │
  │   🏷 Kegiatan                12 post      │
  └──────────────────────────────────────────┘
```

---

## 5. File Structure

```
apps/web/
├── app/api/ref/
│   └── public-links/
│       └── route.ts              ← GET /api/ref/public-links?slug=&q=
├── lib/
│   └── public-url-registry.ts   ← daftar rute statis + helper buildPublicUrl()
└── components/ui/
    └── public-link-picker.tsx    ← komponen combobox
```

---

## 6. `lib/public-url-registry.ts`

Mendefinisikan semua rute statis dan helper membangun URL konten dinamis.

```typescript
export type StaticRoute = {
  label:  string;
  path:   (slug: string) => string;
  group:  string;
  icon:   string; // nama ikon lucide
};

export const STATIC_ROUTES: StaticRoute[] = [
  { label: "Beranda",              path: s => `/${s}/`,             group: "Halaman Utama", icon: "Home" },
  { label: "Arsip Postingan",      path: s => `/${s}/post`,         group: "Halaman Utama", icon: "Newspaper" },
  { label: "Agenda / Event",       path: s => `/${s}/agenda`,       group: "Halaman Utama", icon: "Calendar" },
  { label: "Direktori Produk",     path: s => `/${s}/produk`,       group: "Halaman Utama", icon: "ShoppingBag" },
  { label: "Donasi & Campaign",    path: s => `/${s}/campaign`,     group: "Halaman Utama", icon: "Heart" },
  { label: "Direktori Anggota",    path: s => `/${s}/anggota`,      group: "Direktori",     icon: "Users" },
  { label: "Direktori Pesantren",  path: s => `/${s}/pesantren`,    group: "Direktori",     icon: "School" },
  { label: "Direktori Usaha",      path: s => `/${s}/usaha`,        group: "Direktori",     icon: "Briefcase" },
  { label: "Statistik",            path: s => `/${s}/statistik`,    group: "Direktori",     icon: "BarChart2" },
  { label: "Keranjang Belanja",    path: s => `/${s}/keranjang`,    group: "Transaksi",     icon: "ShoppingCart" },
  { label: "Login",                path: s => `/${s}/login`,        group: "Akun",          icon: "LogIn" },
  { label: "Register",             path: s => `/${s}/register`,     group: "Akun",          icon: "UserPlus" },
  { label: "Dashboard Akun",       path: s => `/${s}/akun`,         group: "Akun",          icon: "LayoutDashboard" },
  { label: "Riwayat Transaksi",    path: s => `/${s}/akun/transaksi`, group: "Akun",        icon: "Receipt" },
];

// Helpers untuk URL konten dinamis
export function buildPostUrl(slug: string, postSlug: string)           { return `/${slug}/post/${postSlug}`; }
export function buildPostCategoryUrl(slug: string, catSlug: string)    { return `/${slug}/post?category=${catSlug}`; }
export function buildPostTagUrl(slug: string, tagSlug: string)         { return `/${slug}/post?tag=${tagSlug}`; }
export function buildProductUrl(slug: string, productSlug: string)     { return `/${slug}/produk/${productSlug}`; }
export function buildProductCategoryUrl(slug: string, catSlug: string) { return `/${slug}/produk/kategori/${catSlug}`; }
export function buildCampaignUrl(slug: string, campaignSlug: string)   { return `/${slug}/campaign/${campaignSlug}`; }
export function buildPageUrl(slug: string, pageSlug: string)           { return `/${slug}/${pageSlug}`; }
export function buildPesantrenUrl(slug: string, id: string)            { return `/${slug}/pesantren/${id}`; }
export function buildUsahaUrl(slug: string, id: string)                { return `/${slug}/usaha/${id}`; }
```

---

## 7. Penggunaan

### Di nav menu builder (`/settings/navigation`)

```tsx
// Sebelum: dropdown pilih type (page/post/event/toko/donasi/custom)
// Sesudah: PublicLinkPicker untuk semua type yang bisa dinavigasi
<PublicLinkPicker
  slug={tenantSlug}
  value={item.href}
  onChange={(url) => updateItem(item.id, { href: url })}
/>
```

### Di section editor (CTA / "Lihat Semua" link)

```tsx
<PublicLinkPicker
  slug={tenantSlug}
  value={section.data.viewAllHref}
  onChange={(url) => updateSection({ ...section.data, viewAllHref: url })}
  placeholder="URL tombol 'Lihat Semua'..."
  types={["page", "post", "post-category", "static"]}
/>
```

### Di widget area builder

```tsx
<PublicLinkPicker
  slug={tenantSlug}
  value={widget.linkHref}
  onChange={(url) => updateWidget({ ...widget, linkHref: url })}
  placeholder="Link 'Lihat Semua'..."
/>
```

---

## 8. Rencana Implementasi

### Phase 1 — Data Layer
- [ ] `lib/public-url-registry.ts` — daftar statis + helper URL builder
- [ ] `GET /api/ref/public-links/route.ts` — endpoint pencarian

### Phase 2 — Komponen
- [ ] `components/ui/public-link-picker.tsx` — combobox Command + Popover

### Phase 3 — Integrasi
- [ ] Nav menu builder di `/settings/navigation` (saat diimplementasikan)
- [ ] Section editor CTA links
- [ ] Widget area builder
- [ ] Semua field `href` / `url` di admin yang menunjuk ke front-end

---

## 9. Catatan Desain

### URL manual tetap bisa diketik
Input adalah editable text field — user tidak dipaksa pilih dari dropdown.
Ini penting untuk URL eksternal, URL dengan anchor (`#section`), atau URL custom.

### Tidak validasi URL di komponen
Validasi (URL valid/tidak, halaman exist/tidak) dilakukan di level yang lebih tinggi.
Komponen hanya mengembalikan string yang dipilih atau diketik user.

### Kelompok post-category dan post-tag menggunakan query param — bukan path
`/{slug}/post?category={catSlug}` — bukan `/{slug}/post/kategori/{catSlug}`.
Ini sesuai implementasi actual di `PostsSection` — jangan buat route baru untuk ini.

### Scope query ke tenant aktif
API endpoint wajib `getTenantAccess(slug)` — hanya admin tenant ini yang bisa cari konten tenant ini.
Endpoint tidak perlu auth level super-admin.

### Revalidasi tidak diperlukan
API ini real-time (no-cache) — konten DB bisa berubah kapan saja.
Gunakan `cache: "no-store"` di fetch component.

### Nama grup harus konsisten di seluruh aplikasi

| Grup | Isi |
|------|-----|
| Halaman Utama | Rute statis utama (homepage, post, agenda, produk, campaign) |
| Halaman | Pages dari CMS (tenant.pages) |
| Postingan | Posts individual |
| Kategori Post | Filter post berdasarkan kategori |
| Tag Post | Filter post berdasarkan tag |
| Produk | Produk individual |
| Kategori Produk | Filter produk berdasarkan kategori |
| Donasi | Campaign/donasi individual |
| Direktori | Rute direktori statis + konten direktori |
| Transaksi | Keranjang, invoice, checkout |
| Akun | Login, register, dashboard akun |
