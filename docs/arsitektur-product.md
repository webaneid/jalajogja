# Arsitektur Modul Produk (Toko) — jalajogja

Dokumen ini mendefinisikan arsitektur lengkap modul Toko: dashboard admin (CRUD produk,
pesanan, kategori) dan front-end publik (listing + detail produk).

**Keterkaitan dokumen:**
- `docs/arsitektur-mitra.md` — sistem mitra: anggota IKPM yang berjualan di toko tenant
- `docs/arsitektur-image.md` — sistem gambar, variant, autocrop, module-aware generation
- `docs/arsitektur-card-section.md` — card + section front-end untuk produk (ProductCard, ProductsSection)
- `docs/arsitektur-keuangan.md` — integrasi pembayaran pesanan → jurnal keuangan

---

## Database Schema

Tabel di `tenant_{slug}`:

```
productCategories   → kategori produk (id, slug, name, parentId, createdAt)
products            → produk (id, slug, name, sku, description, price, stock, images JSONB,
                              categoryId, status, seo columns, ogImageId)
orders              → pesanan (id, orderNumber, customerName, status, totalAmount, ...)
orderItems          → item per pesanan (productId snapshot, productName, priceAtOrder, qty)
payments            → pembayaran pesanan (source_type='order', source_id=orderId)
```

**`productCategories` — kolom yang ada:**
```
id, slug, name, parentId, createdAt
```
Tidak ada kolom `description` — jangan tambahkan di query atau komponen.

---

## Route Structure — Dashboard Admin

```
app/(dashboard)/[tenant]/toko/
├── actions.ts          → SEMUA server actions (produk + pesanan + kategori)
├── layout.tsx          → toko shell: TokoNav (sub-nav kiri) + slot konten kanan
├── page.tsx            → redirect ke /toko/produk
├── produk/
│   ├── page.tsx        → list produk: grid 5 kolom + filter status + search + pagination
│   ├── new/page.tsx    → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx → full editor: ProductForm (Tiptap + MediaPicker + SeoPanel)
├── pesanan/
│   ├── page.tsx        → list pesanan: tabel + filter status + search + pagination
│   ├── new/page.tsx    → buat pesanan manual (fetch produk aktif → OrderCreateClient)
│   └── [id]/page.tsx   → detail pesanan: info + items + pembayaran + OrderActions
└── kategori/
    └── page.tsx        → CRUD kategori produk (inline create)
```

---

## Komponen

```
components/toko/
├── toko-nav.tsx              → sub-nav kiri: Dashboard, Produk, Pesanan, Kategori
├── product-form.tsx          → full editor produk (Tiptap + MediaPicker + SeoPanel + sidebar)
├── product-list-client.tsx   → tombol pre-create produk baru
├── order-create-client.tsx   → UI keranjang pesanan manual admin
├── order-detail-client.tsx   → OrderActions + AddPaymentForm (status transitions)
└── category-manage-client.tsx → CRUD kategori inline
```

---

## Server Actions (toko/actions.ts)

```typescript
// Produk
createProductDraftAction(slug)                          → pre-create draft → return productId
updateProductAction(slug, productId, data: ProductData) → full update + SEO
toggleProductStatusAction(slug, productId)              → draft → active → archived → draft
deleteProductAction(slug, productId)                    → delete

// Pesanan
createOrderAction(slug, data: OrderData)                → buat pesanan + nomor ORD-YYYYMM-NNNNN
addPaymentToOrderAction(slug, orderId, paymentData)     → input pembayaran manual
confirmOrderPaymentAction(slug, paymentId)              → konfirmasi → kurangi stok → recordIncome()
cancelOrderAction(slug, orderId)                        → cancel → kembalikan stok jika sudah terbayar
updateOrderStatusAction(slug, orderId, newStatus)       → processing | shipped | done

// Kategori
createProductCategoryAction(slug, { name, slug })       → buat kategori baru
```

---

## Sistem Harga Berlapis

Setiap produk memiliki **tiga tingkat harga** berdasarkan identitas pembeli.
Sistem ini berlaku untuk produk tenant maupun mitra.

### Tiga Tier Harga

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1 — Harga Dasar (price)                               │
│  Berlaku: pembeli tidak login                               │
├─────────────────────────────────────────────────────────────┤
│  Tier 2 — Harga Publik (public_price)                       │
│  Berlaku: siapapun yang punya akun login                    │
│           termasuk public.profiles (orang umum)             │
│           dan anggota IKPM                                  │
├─────────────────────────────────────────────────────────────┤
│  Tier 3 — Harga Anggota IKPM (member_price)                 │
│  Berlaku: anggota IKPM dari cabang MANAPUN di dunia         │
│           (public.members dengan better_auth_user_id)       │
│           bukan hanya anggota cabang ini                    │
└─────────────────────────────────────────────────────────────┘
```

### "Anggota IKPM Seluruh Dunia"

`member_price` berlaku untuk **semua** anggota IKPM yang sudah aktivasi login,
terlepas dari cabang mana mereka terdaftar.

```
Cek: session.user.id → public.members.better_auth_user_id
     Jika ketemu → user adalah anggota IKPM → dapat member_price
     Jika tidak → cek public.profiles → dapat public_price
     Jika tidak ada akun → dapat price (harga dasar)
```

Ini berbeda dari sistem mitra yang terikat cabang. Member discount adalah
**benefit keanggotaan IKPM global**, bukan hak eksklusif cabang tertentu.

### Logika Display Harga

```typescript
function resolvePrice(product: ProductCardData, sessionType: "none" | "public" | "member"): string {
  if (sessionType === "member" && product.memberPrice) return product.memberPrice;
  if (sessionType !== "none"   && product.publicPrice)  return product.publicPrice;
  return product.price;
}
```

Fallback chain: `member_price → public_price → price`

### Tanggung Jawab Penentuan Harga

Diskon adalah **hak product owner** (tenant atau mitra) — bukan kewajiban yang
dipaksa sistem. Tenant/mitra bebas menentukan besaran diskon di tiap tier.

Pengecualian: untuk **produk mitra**, `member_price` tunduk pada aturan komisi:
```
member_price ≤ price × (1 - commission_rate)
```
Detail di `docs/arsitektur-mitra.md` bagian Model Harga & Komisi.

Untuk **produk tenant internal**: `public_price` dan `member_price` bebas
diset admin tanpa constraint komisi.

### Schema DB — Kolom yang Dibutuhkan

```sql
-- Tambah ke tenant_{slug}.products
ALTER TABLE "{s}".products
  ADD COLUMN IF NOT EXISTS public_price NUMERIC(15,2);
  -- member_price sudah ada (ditambah di Phase 1 Sistem Mitra)
  -- public_price = harga untuk public.profiles + anggota IKPM (tier 2)
  -- member_price = harga untuk anggota IKPM saja (tier 3)
```

```typescript
// Drizzle schema — tambah ke createProductsTable()
publicPrice: numeric("public_price", { precision: 15, scale: 2 }),
// member_price sudah ada
```

### ProductCardData — field yang Dibutuhkan

```typescript
export type ProductCardData = {
  // ... existing fields ...
  price:       string;          // harga dasar (tier 1)
  publicPrice: string | null;   // harga publik (tier 2) — ⏸ belum ada di type
  memberPrice: string | null;   // harga anggota IKPM (tier 3) — sudah ada
};
```

> **Status**: ✅ Selesai diimplementasikan. `public_price` + `member_price` ada di
> schema Drizzle, DDL, form admin, dan ProductCard (semua 3 variant). `resolvePrice()`
> helper di `lib/product-card-templates.ts` handle logika 3 tier.

---

## Tipe Data Kunci

### ProductImage

```typescript
// Disimpan sebagai JSONB array di products.images
export type ProductImage = {
  id:       string;                            // media.id
  url:      string;                            // URL primary (square-large untuk upload shop)
  variants?: Record<string, string> | null;   // resolved URLs per variant: { square, "square-large" }
  alt:      string;                            // alt text dari media.altText
  order:    number;                            // urutan tampil, 0-based
};
```

**Penggunaan variant:**
- Admin grid produk list → `variants?.square` (400×400) — lebih ringan untuk thumbnail kecil
- Form editor preview → `variants?.["square-large"]` atau `url` (800×800)
- Front-end product card → `variants?.["square-large"]` (card besar) / `variants?.square` (grid padat)

Lihat `docs/arsitektur-image.md` untuk detail sistem variant dan module-aware generation.

### ProductData

```typescript
export type ProductData = {
  name:         string;
  slug:         string;
  sku?:         string | null;
  description?: string | null;   // Tiptap HTML
  price:        number;
  stock:        number;
  images:       ProductImage[];  // dari MediaPicker, bukan URL manual
  categoryId?:  string | null;
  status:       "draft" | "active" | "archived";
  // SEO
  metaTitle?, metaDesc?, ogTitle?, ogDescription?, ogImageId?,
  twitterCard?, focusKeyword?, canonicalUrl?, robots?
};
```

---

## Alur Status Produk

```
draft → active → archived → draft (cycle via toggleProductStatusAction)
```

| Status | Tampil di front-end | Bisa dipesan |
|--------|--------------------|-|
| `draft` | ❌ | ❌ |
| `active` | ✅ | ✅ |
| `archived` | ❌ | ❌ |

---

## Alur Status Pesanan + Pembayaran

```
Order:   pending → paid → processing → shipped → done
                    ↓
                cancelled (dari status apapun kecuali done)

Payment: pending → paid (setelah konfirmasi admin)
```

- `confirmOrderPaymentAction`: validasi stok → `recordIncome()` → kurangi stok → `order.status = 'paid'`
- `cancelOrderAction`: jika order sudah `paid/processing/shipped` → kembalikan stok

### Nomor Pesanan

Format: `ORD-YYYYMM-NNNNN` — via COUNT query per bulan.
Tidak pakai `financial_sequences` enum — menghindari DDL `ALTER TYPE` di tenant existing.

---

## Sistem Gambar Produk

Mengacu penuh ke **`docs/arsitektur-image.md`**. Ringkasan yang relevan untuk produk:

### Module = `shop`

Upload produk via MediaPicker dengan `module="shop"`. Ini mengaktifkan:
- Hanya generate variant: `original`, `square` (400×400), `square-large` (800×800)
- **Tidak** generate `large`, `medium`, `thumbnail`, `profile`
- Primary path (`media.url`) = `square-large` (dipilih via `PATH_PRIORITY`)

### Pemetaan Variant untuk Produk

| Konteks | Variant | Ukuran |
|---------|---------|--------|
| Admin grid produk (thumbnail) | `square` | 400×400 |
| Form editor preview | `square-large` / `url` | 800×800 |
| Front-end card besar (ProductCard `grid`) | `square-large` | 800×800 |
| Front-end card kecil (ProductCard `list`/`ringkas`) | `square` | 400×400 |

### Aturan Gambar Produk

- Semua gambar **wajib via MediaPicker** — tidak boleh URL manual
- `ProductImage.variants` wajib disimpan saat `handleSelect` — agar tiap konteks bisa pilih ukuran yang tepat
- `getFirstImage(images)` di admin list: prioritas `variants.square` → fallback `url`
- Prevent duplicate: cek `images.some(img => img.id === media.id)` sebelum add
- Reorder via tombol naik/turun (swap adjacent), bukan drag-drop
- `order` field di-reset ulang saat simpan: `images.map((img, i) => ({ ...img, order: i }))`

### Autocrop

Upload baru otomatis menggunakan `position: "attention"` (libvips smart crop — face/saliency detection).
Admin bisa override via tombol **Crop** di Media Detail Panel (`docs/arsitektur-image.md` Phase D2).

---

## Front-end Publik

Detail arsitektur card dan section front-end ada di **`docs/arsitektur-card-section.md`**.

### URL

```
/{tenantSlug}/toko              → archive / listing produk  ⬜ Belum
/{tenantSlug}/toko/{slug}       → detail produk             ⬜ Belum
```

Filter di archive: `?category={slug}`

### Card Variants (dipakai di Section)

| Variant | Deskripsi | Gambar |
|---------|-----------|--------|
| `grid` | Gambar + nama + harga + kategori | `square-large` |
| `list` | Horizontal: thumbnail + info | `square` |
| `ringkas` | Gambar + nama + harga, padat | `square` |

### Section Designs

| Design | Label | Deskripsi |
|--------|-------|-----------|
| 1 | Grid Produk | 4 kolom `product-card-grid`, count default 8 |
| 2 | Showcase | 1 featured besar (inline) + 4 kecil (`product-card-grid`) |
| 3 | Carousel | Scroll horizontal `product-card-ringkas`, aspect 1:1 |

---

## Integrasi Keuangan

Setiap `confirmOrderPaymentAction` memanggil `recordIncome()` dari `packages/db/src/helpers/finance.ts`.
Detail: `docs/arsitektur-keuangan.md`.

Rekening/QRIS kategori `toko` dipakai di checkout front-end.
Fallback ke kategori `general` jika tidak ada rekening berlabel `toko`.

---

## Lessons Learned

### Fungsi utilitas tidak boleh di-export dari file "use server"
`slugify` sempat di-export dari `actions.ts` → jadi server action proxy di client → return `Promise`.
**Fix**: fungsi utilitas lokal di client, atau file terpisah non-`"use server"`.

### Dev server cache stale setelah edit client component
Fix: restart dev server + hard reload browser. Terjadi saat ada perubahan import/export boundary.

### Sidebar path harus konsisten dengan route folder
Route folder `[tenant]/toko/` → sidebar path `"toko"`, bukan `"shop"`.

### ProductImage.variants wajib disimpan
Sebelumnya hanya simpan `url` (primary = square-large 800×800) → thumbnail admin grid muat
gambar besar untuk display kecil. Fix: simpan `media.variants` di `handleSelect` → pakai
`variants.square` (400×400) untuk thumbnail, `url`/`square-large` untuk display penuh.

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| Dashboard: CRUD Produk | ✅ Selesai |
| Dashboard: CRUD Pesanan + konfirmasi bayar | ✅ Selesai |
| Dashboard: CRUD Kategori | ✅ Selesai |
| `ProductImage.variants` disimpan + dipakai | ✅ Selesai |
| Front-end: `/{slug}/toko` (archive) | ⏸ Ditunda |
| Front-end: `/{slug}/toko/{slug}` (detail) | ⏸ Ditunda |
| ProductCard (grid, list, ringkas) | ✅ Selesai |
| ProductsSection (Design 1, 2, 3) | ⏸ Ditunda |
