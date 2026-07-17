# Arsitektur Modul Produk (Toko) — jalakarta

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
  price:       string;          // tier 1: harga dasar
  publicPrice: string | null;   // tier 2: harga untuk akun login ✅
  memberPrice: string | null;   // tier 3: harga anggota IKPM ✅
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
/{tenantSlug}/produk                           → archive / listing produk
/{tenantSlug}/produk?category={slug}           → filter by kategori (query param)
/{tenantSlug}/produk/kategori/{categorySlug}   → arsip per kategori (dedicated URL)
/{tenantSlug}/produk/{productSlug}             → detail produk
```

> **Catatan**: Dashboard admin tetap `/{slug}/toko` — tidak ada konflik dengan front-end publik
> karena keduanya ada di route group berbeda (`(dashboard)` vs `(public)`).
> URL front-end memilih `/produk` bukan `/toko` untuk menghindari konflik ini.

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

## Perencanaan Halaman Publik Toko

Tiga halaman publik yang perlu dibangun di bawah `app/(public)/[tenant]/toko/`.

---

### 1. Halaman Arsip Produk — `/{slug}/toko`

**Route:** `app/(public)/[tenant]/produk/page.tsx`

**Fungsi:** Listing semua produk aktif milik tenant + mitra aktif, dengan filter dan pagination.

#### Route Structure

```
app/(public)/[tenant]/produk/
├── page.tsx                         → archive + search + filter + pagination
├── kategori/
│   └── [categorySlug]/page.tsx      → dedicated category archive
└── [productSlug]/page.tsx           → product detail
```

#### Data yang Dibutuhkan

```typescript
// Di page.tsx (server component)
const products: ProductCardData[]     // fetch dari DB
const categories: { id, name, slug }[] // untuk sidebar filter
const totalCount: number              // untuk pagination
const sessionType: SessionType        // untuk resolvePrice() di client
```

#### Fetch Strategy

```typescript
// Query produk
const rows = await db
  .select({ ... })
  .from(schema.products)
  .leftJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
  .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
  .where(and(
    eq(schema.products.status, "active"),
    // jika ada filter categoryId: eq(schema.products.categoryId, categoryId)
    // jika ada filter search: sql`${schema.products.name} ILIKE ${'%' + search + '%'}`
    // seller_type=tenant selalu tampil, seller_type=mitra hanya jika mitras.status='active'
  ))
  .orderBy(desc(schema.products.createdAt))
  .limit(PAGE_SIZE)
  .offset((page - 1) * PAGE_SIZE);

// Resolve businessName untuk produk mitra (pattern sama dengan products-section.tsx)
// Aggregate priceMin/priceMax untuk variable products
```

#### Resolusi SessionType

```typescript
// Di page.tsx server component
import { auth }         from "@/lib/auth";
import { headers }      from "next/headers";
import { db, members }  from "@jalajogja/db";

async function resolveSessionType(session: Session | null): Promise<SessionType> {
  if (!session?.user?.id) return "none";
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.betterAuthUserId, session.user.id))
    .limit(1);
  return member ? "member" : "public";
}
```

`sessionType` dikirim sebagai prop ke client component — tidak boleh di-resolve di client
karena butuh DB query ke `public.members`.

#### Query Params

| Param | Tipe | Fungsi |
|-------|------|--------|
| `category` | `string` (slug) | Filter by kategori |
| `mitra` | `string` (slug) | Filter by mitra (opsional, fase 2) |
| `search` | `string` | Full-text search by nama produk |
| `page` | `number` | Halaman pagination (default 1) |
| `sort` | `terbaru\|termurah\|termahal` | Urutan (default terbaru) |

#### Layout

```
┌───────────────────────────────────────────────────────────┐
│  Toko — Produk Kami              [🔍 Cari produk...]      │
├─────────────────┬─────────────────────────────────────────┤
│  KATEGORI       │  Filter: [Semua] [Kaos] [Aksesoris]...  │
│  • Semua        │                                          │
│  • Kaos (12)    │  [Grid: Card 4 kolom — ProductCard grid] │
│  • Aksesoris    │                                          │
│  • Buku (5)     │  [Card] [Card] [Card] [Card]            │
│                 │  [Card] [Card] [Card] [Card]            │
│  MITRA          │                                          │
│  • Semua        │  [← 1  2  3  →]  (pagination)           │
│  • Nama Mitra   │                                          │
└─────────────────┴─────────────────────────────────────────┘
```

Pada mobile: sidebar kategori diganti chip scroll horizontal di atas grid.

#### Komponen

```
components/toko/public/
├── product-archive-client.tsx   → filter chips + search input (client component)
└── product-archive-grid.tsx     → grid 2×2 (mobile), 3×N (tablet), 4×N (desktop)
```

`ProductCard` (dari `components/website/public/product-cards/product-card.tsx`) dipakai langsung.

#### Metadata SEO

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `Toko — ${tenant.name}`,
    description: `Produk dari ${tenant.name}`,
    openGraph: { ... },
  };
}
```

#### Container & Styling

```tsx
<section className="py-10 px-4">
  <div className="max-w-7xl mx-auto">
    {/* filter + grid */}
  </div>
</section>
```

#### Konstanta

```typescript
const PAGE_SIZE = 20; // 4 kolom × 5 baris
```

---

### 2. Halaman Arsip Kategori — `/{slug}/toko/kategori/{categorySlug}`

**Route:** `app/(public)/[tenant]/produk/kategori/[categorySlug]/page.tsx`

**Fungsi:** Identik dengan archive utama tapi pre-filter by kategori. URL-nya bisa di-share dan di-index Google secara terpisah.

#### Perbedaan dari Archive Utama

- Server component langsung SELECT kategori by `slug` → 404 jika tidak ditemukan
- Title halaman = nama kategori (`"Kaos — Toko IKPM"`)
- Breadcrumb: `Toko > Kaos`
- Filter kategori lain tetap tampil di sidebar sebagai navigasi
- Query params yang masih berlaku: `search`, `page`, `sort`
- `category` tidak perlu di query param — sudah tersirat dari URL

#### Fetch Tambahan

```typescript
// Resolve kategori dari slug
const [category] = await db
  .select({ id: schema.productCategories.id, name: schema.productCategories.name })
  .from(schema.productCategories)
  .where(eq(schema.productCategories.slug, categorySlug))
  .limit(1);

if (!category) notFound();

// Produk di-filter langsung by category.id
```

#### Metadata SEO

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${category.name} — Toko ${tenant.name}`,
    description: `Produk kategori ${category.name} dari ${tenant.name}`,
  };
}
```

---

### 3. Halaman Detail Produk — `/{slug}/toko/{productSlug}`

**Route:** `app/(public)/[tenant]/produk/[productSlug]/page.tsx`

**Fungsi:** Halaman lengkap satu produk — gallery, info harga, variasi picker (untuk variable product), dan tombol tambah ke keranjang.

#### Data yang Dibutuhkan

```typescript
const product: ProductDetail   // produk + semua kolom
const variations: ProductVariationData[]  // jika variable product
const sessionType: SessionType           // untuk harga yang tepat
const relatedProducts: ProductCardData[] // produk kategori sama (max 4)
const primaryColor: string               // dari tenant settings → warna tombol CTA
```

#### Fetch Strategy

```typescript
// Step 1: fetch produk
const [row] = await db
  .select({ ...allProductColumns, categoryName, categorySlug })
  .from(schema.products)
  .leftJoin(schema.productCategories, ...)
  .leftJoin(schema.mitras, ...)
  .where(and(
    eq(schema.products.slug, productSlug),
    eq(schema.products.status, "active"),
  ))
  .limit(1);

if (!row) notFound();

// Step 2: fetch variasi (jika variable)
let variations: ProductVariationData[] = [];
if (row.productType === "variable") {
  variations = await db
    .select()
    .from(schema.productVariations)
    .where(and(
      eq(schema.productVariations.productId, row.id),
      eq(schema.productVariations.isActive, true),
    ))
    .orderBy(schema.productVariations.createdAt);
}

// Step 3: resolve sessionType (sama seperti archive)
// Step 4: fetch related products (kategori sama, status active, limit 4, exclude current)
// Step 5: fetch businessName jika mitra (cross-schema via publicDb)
```

#### Layout Halaman

```
┌──────────────────────────────────────────────────────────────┐
│  [Breadcrumb: Toko > Kaos > Kaos Polos IKPM]                │
├──────────────────────────────────────────────────────────────┤
│  [Gallery: gambar besar + thumbnail strip]                   │
│                            │  Kaos Polos IKPM               │
│  ┌─────────────────────┐  │                                  │
│  │                     │  │  Kategori: Kaos                  │
│  │   [Gambar Utama]    │  │  Dijual oleh: Nama Mitra         │
│  │                     │  │                                  │
│  └─────────────────────┘  │  [HARGA — resolvePrice()]        │
│  [thumb1][thumb2][thumb3]  │  Rp 90.000                      │
│                            │  ~~Rp 100.000~~  (coret jika    │
│                            │  ada public/member price)        │
│                            │                                  │
│                            │  [Simple product:]              │
│                            │  Kuantitas: [- 1 +]  Stok: 8   │
│                            │                                  │
│                            │  [Variable product:]            │
│                            │  Ukuran: [S][M][L][XL]          │
│                            │  Warna:  [●Putih][○Hitam]       │
│                            │  Harga: Rp 90.000  Stok: 8     │
│                            │  Kuantitas: [- 1 +]             │
│                            │                                  │
│                            │  [+ Tambah ke Keranjang]        │
│                            │  [→ Beli Sekarang]  (opsional)  │
├──────────────────────────────────────────────────────────────┤
│  Deskripsi Produk                                            │
│  [render Tiptap HTML — dangerouslySetInnerHTML]              │
├──────────────────────────────────────────────────────────────┤
│  Produk Lainnya dari Kategori Ini                            │
│  [ProductCard grid × 4]                                      │
└──────────────────────────────────────────────────────────────┘
```

#### Gallery

Menggunakan komponen `<Gallery>` dari sistem gallery yang sudah ada
(`components/gallery/` — lightbox + keyboard + touch swipe).

```typescript
// Convert ProductImage[] ke format Gallery
const galleryImages = images.map((img, i) => ({
  id:  img.id,
  src: img.variants?.["square-large"] ?? img.url,
  alt: img.alt || product.name,
  thumb: img.variants?.square ?? img.url,
}));
```

#### Pemisahan Server / Client

```typescript
// page.tsx — server component
// Fetch semua data, resolve sessionType, siapkan variations array

// product-detail-client.tsx — client component
// Menerima: product, variations, sessionType, galleryImages
// State internal:
//   - selectedAttributes: Record<string, string>    // { "Ukuran": "M", "Warna": "Hitam" }
//   - quantity: number                              // default 1
//   - activeVariation: ProductVariationData | null  // computed dari selectedAttributes
//   - isAddingToCart: boolean                       // loading state

// Computed dari selectedAttributes + variations:
//   - activeVariation → harga + stok + foto yang aktif
//   - displayPrice   → resolvePrice(activeVariation ?? product, sessionType)
//   - isOutOfStock   → activeVariation?.stock === 0 || product.stock === 0
```

#### Logika Variation Picker

```typescript
// Cari variasi yang cocok dengan kombinasi atribut yang dipilih
function findVariation(
  variations: ProductVariationData[],
  selected:   Record<string, string>
): ProductVariationData | null {
  return variations.find(v =>
    Object.entries(selected).every(([key, val]) => v.attributeCombo[key] === val)
  ) ?? null;
}

// Cek apakah sebuah value atribut tersedia (ada variasi aktif + stok > 0)
function isValueAvailable(
  variations: ProductVariationData[],
  attrName:   string,
  attrValue:  string,
  current:    Record<string, string>   // atribut lain yang sudah dipilih
): boolean {
  return variations.some(v =>
    v.attributeCombo[attrName] === attrValue &&
    v.isActive && v.stock > 0 &&
    Object.entries(current).every(([k, val]) => k === attrName || v.attributeCombo[k] === val)
  );
}
```

#### Integrasi addToCartAction

```typescript
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";

async function handleAddToCart() {
  setIsAddingToCart(true);

  // Untuk simple product
  const result = await addToCartAction(slug, {
    itemType:  "product",
    itemId:    product.id,
    name:      product.name,
    unitPrice: parseFloat(displayPrice.replace(/\D/g, "")),
    quantity,
    notes:     null,
  });

  // Untuk variable product — sertakan variasi info di name/notes
  const result = await addToCartAction(slug, {
    itemType:  "product",
    itemId:    activeVariation.id,   // variasi ID sebagai itemId
    name:      `${product.name} — ${formatVariationLabel(activeVariation.attributeCombo)}`,
    unitPrice: parseFloat(resolvedPrice),
    quantity,
    notes:     null,
  });

  if (result.success) {
    // Toast sukses + link ke keranjang
  } else {
    // Toast error
  }
  setIsAddingToCart(false);
}
```

**Catatan**: `itemId` untuk variable product menggunakan `variation.id`, bukan `product.id`.
Ini penting agar di keranjang sistem bisa bedakan variasi yang berbeda dari produk yang sama.
Validasi stok real-time dilakukan server-side di `addToCartAction` (V8 — belum diimplementasi).

#### Display Harga di Detail Page

```
Simple:
  Rp 85.000                                  ← tier 1 (tidak login)
  Rp 75.000  ~~Rp 85.000~~                   ← tier 2/3 (ada diskon)

Variable (sebelum pilih variasi):
  Mulai dari Rp 85.000                        ← priceMin variasi aktif

Variable (setelah pilih variasi):
  Rp 90.000  ~~Rp 100.000~~                  ← harga variasi terpilih
```

#### Metadata SEO

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const og = product.ogImageId
    ? await resolveOgImage(tenantClient, product.ogImageId)
    : pickProductCover(productCardData, "square-large");

  return {
    title:       product.metaTitle ?? `${product.name} — ${tenant.name}`,
    description: product.metaDesc ?? product.description?.slice(0, 160),
    openGraph: {
      title:  product.ogTitle ?? product.name,
      description: product.ogDescription ?? product.description?.slice(0, 160),
      images: og ? [{ url: og }] : undefined,
    },
  };
}
```

#### File Komponen Baru

```
components/toko/public/
├── product-detail-client.tsx    → UTAMA — variation picker + quantity + add to cart
├── product-gallery-strip.tsx    → thumbnail strip di bawah gambar utama (client)
├── product-price-display.tsx    → display harga dengan coret (server-safe, props only)
├── product-attributes-picker.tsx → tombol atribut S/M/L per group (bagian dari detail-client)
└── product-related.tsx          → grid 4 produk terkait (server component)
```

---

### Ringkasan Route + File

```
app/(public)/[tenant]/produk/
├── page.tsx                              → archive utama (server component)
├── kategori/
│   └── [categorySlug]/page.tsx          → archive per kategori (server component)
└── [productSlug]/page.tsx               → detail produk (server component, pass ke client)

components/toko/public/
├── product-archive-client.tsx           → filter chips + search input
├── product-archive-grid.tsx             → grid card dengan pagination
├── product-detail-client.tsx            → variation picker + qty + add-to-cart
├── product-gallery-strip.tsx            → thumbnail strip
├── product-price-display.tsx            → harga + coret
├── product-attributes-picker.tsx        → tombol atribut per group
└── product-related.tsx                  → grid 4 produk terkait
```

---

### Urutan Implementasi

```
Phase P — Halaman Publik Toko
  Step P1: archive utama (/{slug}/toko) — server component, filter + grid + pagination
  Step P2: archive kategori (/{slug}/toko/kategori/{slug}) — sama + SEO per kategori
  Step P3: detail simple product — gallery + harga + qty + add to cart
  Step P4: variation picker — ProductDetailClient + atribut picker + stok check
  Step P5: V7 — variasi di cart + V8 — validasi stok server-side saat add to cart
  Step P6: SEO metadata lengkap + JSON-LD (Product schema)
  Step P7: "Beli Sekarang" shortcut (add to cart → langsung ke checkout)
```

**Dependensi**:
- Step P3–P4 butuh V1–V6 (Produk Variasi) yang sudah selesai
- Step P5 butuh `addToCartAction` yang sudah ada
- Step P6 butuh `generateProductJsonLd` dari `lib/seo.ts`

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

## Produk Variasi (Variable Product)

> **Status**: Perencanaan selesai. Implementasi **⏸ ditunda**.

### Latar Belakang

Produk saat ini adalah **simple product** — satu harga, satu stok, satu set gambar.
Banyak produk nyata (kaos, sepatu, pelek motor) punya variasi seperti ukuran atau warna,
di mana tiap variasi punya harga, stok, dan foto yang berbeda.

Sistem variasi ini **dinamis** — tenant dan mitra bebas mendefinisikan group atribut
sendiri (ukuran, warna, material, dll) tanpa perlu hardcode di kode.

---

### Dua Tipe Produk

```
product_type = "simple"    → produk saat ini (tidak berubah)
product_type = "variable"  → produk dengan variasi
```

Pergantian tipe dilakukan via toggle di form editor.
Saat switch ke "variable", field harga/stok di-disable dan digantikan oleh harga per variasi.

---

### Konsep: Atribut + Variasi

```
Produk: "Kaos Polos IKPM"  (product_type = "variable")
│
├── Atribut Groups (attribute_groups JSONB di products):
│   ├── { name: "Ukuran",  values: ["S", "M", "L", "XL", "XXL"] }
│   └── { name: "Warna",   values: ["Putih", "Hitam", "Navy"] }
│
└── Variasi (product_variations table):
    ├── { ukuran: "S",  warna: "Putih", price: 85000, stock: 10, images: [...] }
    ├── { ukuran: "M",  warna: "Putih", price: 85000, stock: 15, images: [...] }
    ├── { ukuran: "L",  warna: "Hitam", price: 90000, stock: 8,  images: [...] }
    └── ... (semua kombinasi yang aktif)
```

---

### Schema DB

#### Perubahan `tenant_{slug}.products`

```sql
ALTER TABLE "{s}".products
  ADD COLUMN IF NOT EXISTS product_type      TEXT NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'variable')),
  ADD COLUMN IF NOT EXISTS attribute_groups  JSONB;
  -- attribute_groups: [{ name: "Ukuran", values: ["S","M","L"] }, ...]
  -- Saat simple: null. Saat variable: diisi admin.
  -- price/stock/images di products tetap ada tapi diabaikan saat variable.
```

#### Tabel Baru `tenant_{slug}.product_variations`

```sql
CREATE TABLE IF NOT EXISTS "{s}".product_variations (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID          NOT NULL REFERENCES "{s}".products(id) ON DELETE CASCADE,
  sku            TEXT,                         -- SKU per variasi (opsional)
  price          NUMERIC(15,2) NOT NULL,        -- tier 1
  public_price   NUMERIC(15,2),                -- tier 2: harga akun login
  member_price   NUMERIC(15,2),                -- tier 3: harga anggota IKPM
  stock          INTEGER       NOT NULL DEFAULT 0,
  images         JSONB         NOT NULL DEFAULT '[]',  -- ProductImage[]
  attribute_combo JSONB        NOT NULL,        -- { "Ukuran": "M", "Warna": "Hitam" }
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variations_product_id
  ON "{s}".product_variations (product_id);
```

#### Drizzle Schema

```typescript
// Tambah ke shop.ts — createProductVariationsTable()
export function createProductVariationsTable(s: ReturnType<typeof pgSchema>) {
  return s.table("product_variations", {
    id:             uuid("id").primaryKey().defaultRandom(),
    productId:      uuid("product_id").notNull(),  // FK via DDL
    sku:            text("sku"),
    price:          numeric("price",        { precision: 15, scale: 2 }).notNull(),
    publicPrice:    numeric("public_price", { precision: 15, scale: 2 }),
    memberPrice:    numeric("member_price", { precision: 15, scale: 2 }),
    stock:          integer("stock").notNull().default(0),
    images:         jsonb("images").notNull().default([]),
    attributeCombo: jsonb("attribute_combo").notNull().$type<Record<string, string>>(),
    isActive:       boolean("is_active").notNull().default(true),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}
```

---

### Tipe Data

```typescript
// lib/product-card-templates.ts — update ProductCardData
export type ProductCardData = {
  // ... existing fields ...
  productType:  "simple" | "variable";
  priceMin:     string;  // simple → price; variable → MIN(variation.price)
  priceMax:     string | null;  // null jika simple; MAX jika variable
  // publicPrice + memberPrice tetap ada untuk simple product
  // Untuk variable: display "Mulai dari Rp X" + "Pilih Variasi"
};

// Tipe untuk variasi
export type ProductVariationData = {
  id:             string;
  sku:            string | null;
  price:          string;
  publicPrice:    string | null;
  memberPrice:    string | null;
  stock:          number;
  images:         ProductImage[];
  attributeCombo: Record<string, string>;  // { "Ukuran": "M", "Warna": "Hitam" }
  isActive:       boolean;
};

// Tipe untuk attribute group
export type AttributeGroup = {
  name:   string;         // "Ukuran"
  values: string[];       // ["S", "M", "L", "XL"]
};
```

---

### Admin UX — Form Editor Produk

```
┌──────────────────────────────────────────────────────┐
│  Tipe Produk                                         │
│  ○ Produk Simple   ● Produk Variasi                 │
└──────────────────────────────────────────────────────┘

[Saat Variasi dipilih]

┌──────────────────────────────────────────────────────┐
│  Atribut Produk                                      │
│  ┌──────────────────────┬───────────────────────┐   │
│  │ Group: [Ukuran_____] │ Nilai: S, M, L, XL [x]│   │
│  │        [Warna______] │ Nilai: Merah, Biru  [x]│   │
│  └──────────────────────┴───────────────────────┘   │
│  [+ Tambah Atribut]  [⚡ Generate Semua Variasi]     │
└──────────────────────────────────────────────────────┘

[Setelah generate — tiap kombinasi muncul sebagai row]

┌──────────────────────────────────────────────────────┐
│  Variasi (6 variasi dari 2 ukuran × 3 warna)         │
│  ┌────────────┬──────────┬──────────┬──────────────┐ │
│  │ Ukuran/Warna│ Harga   │ Stok     │ Aktif        │ │
│  ├────────────┼──────────┼──────────┼──────────────┤ │
│  │ M / Merah  │ [85.000] │ [10____] │ [✓]  [foto]  │ │
│  │ M / Biru   │ [85.000] │ [8_____] │ [✓]  [foto]  │ │
│  │ L / Merah  │ [90.000] │ [5_____] │ [✓]  [foto]  │ │
│  └────────────┴──────────┴──────────┴──────────────┘ │
└──────────────────────────────────────────────────────┘
```

**"Generate Semua Variasi"** — buat semua kombinasi (cartesian product) dari
attribute_groups. Kombinasi yang sudah ada tidak di-overwrite.

---

### Front-end Publik — Halaman Detail Produk

```
┌──────────────────────────────────────────────────────┐
│  [Foto Variasi Terpilih]                             │
│                                                      │
│  Kaos Polos IKPM                                     │
│  Mulai dari Rp 85.000                               │
│                                                      │
│  Ukuran:                                             │
│  [S] [M] [L] [XL] [XXL]                             │
│                                                      │
│  Warna:                                             │
│  [● Putih] [○ Hitam] [○ Navy]                       │
│                                                      │
│  Harga: Rp 90.000     Stok: 8                       │
│  [- Kuantitas +]                                    │
│  [+ Tambah ke Keranjang]                            │
└──────────────────────────────────────────────────────┘
```

- Saat variasi dipilih → update foto, harga, stok secara real-time (client-side)
- Data semua variasi di-load saat page render (server component pass ke client)
- Variasi tidak aktif (`is_active = false`) atau stok 0 → disabled/greyed out

---

### Harga di ProductCard untuk Variable Product

```
Simple:   Rp 85.000
Variable: Mulai dari Rp 85.000   ← MIN(price) dari variasi aktif
          Rp 85.000 – Rp 120.000  ← jika ada range harga
```

`priceMin` = MIN dari semua variasi aktif — dihitung di fetch layer, disimpan ke
`ProductCardData` agar tidak perlu JOIN saat render card.

---

### Constraint Komisi untuk Produk Mitra Variable

Untuk setiap variasi mitra, berlaku constraint yang sama:
```
variation.member_price ≤ variation.price × (1 - commission_rate)
```

Validasi dilakukan per variasi saat save, bukan di level produk.

---

### Urutan Implementasi (Ditunda)

```
Phase V — Produk Variasi
  Step V1:  Drizzle schema — createProductVariationsTable() + product_type + attribute_groups
  Step V2:  DDL create-tenant-schema.ts — product_variations table
  Step V3:  Admin form — toggle simple/variable + AttributeGroupEditor + VariationTable
  Step V4:  Server actions — saveVariationsAction, generateVariationsAction
  Step V5:  ProductCardData update — productType + priceMin + priceMax
  Step V6:  Fetch layer update — JOIN product_variations untuk priceMin
  Step V7:  Halaman detail publik — variasi picker (client component)
  Step V8:  Keranjang/checkout — validasi variasi saat add to cart
  Step V9:  Mitra product form — variasi support + validasi komisi per variasi
```

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| Dashboard: CRUD Produk (simple) | ✅ Selesai |
| Dashboard: CRUD Pesanan + konfirmasi bayar | ✅ Selesai |
| Dashboard: CRUD Kategori | ✅ Selesai |
| `ProductImage.variants` disimpan + dipakai | ✅ Selesai |
| Sistem Harga Berlapis (price + public_price + member_price) | ✅ Selesai |
| ProductCard (grid, list, ringkas) + SessionType + resolvePrice() | ✅ Selesai |
| ProductsSection (Design 1, 2, 3) | ✅ Selesai |
| **Produk Variasi** (product_type, attribute_groups, product_variations) | ✅ V1–V6+V9 Selesai |
| Produk Variasi V7 — halaman detail publik (variasi picker) | ✅ Selesai (Phase P4) |
| Produk Variasi V8 — keranjang/checkout validasi variasi | ⏸ Ditunda (stok check server-side) |
| **Halaman Publik** — perencanaan (3 halaman) | ✅ Perencanaan selesai |
| Phase P1 — `/{slug}/produk` archive utama | ✅ Selesai |
| Phase P2 — `/{slug}/produk/kategori/{slug}` | ✅ Selesai |
| Phase P3 — `/{slug}/produk/{slug}` detail simple | ✅ Selesai |
| Phase P4 — detail variasi picker + add to cart variasi | ✅ Selesai |
| Phase P5 — SEO metadata per halaman | ✅ Selesai |
| **Registry Desain Kartu Arsip** (§ di bawah) | ✅ Selesai |

---

## Registry Desain Kartu Arsip (Grid Desktop / List Mobile)

> **Status: SELESAI — diimplementasikan 2026-07-17.** Mengikuti pola yang sudah selesai dibangun
> untuk modul Donasi (`docs/arsitektur-donasi.md` § 14j–14m — bentuk final) dan Event
> (`docs/arsitektur-event.md`, section serupa), dikerjakan sekaligus dalam satu sesi. Tidak ada
> migration DB baru — grup setting `toko` sudah ada sejak Sistem Mitra.

**Latar belakang**: `ProductCard` (`components/website/public/product-cards/product-card.tsx`)
sudah punya 3 variant — `grid` | `list` | `ringkas` (`lib/product-card-templates.ts`). **3 titik**
publik hardcode `variant="grid"`, lebih banyak dari Donasi (2 titik) maupun Event (1 titik):
- `/produk` (arsip utama) — `produk/page.tsx` baris ~236
- `/produk/kategori/{slug}` (arsip per kategori) — `produk/kategori/[categorySlug]/page.tsx` baris ~242
- `/produk/{slug}` bagian "Produk Lainnya" (related products) — `produk/[productSlug]/page.tsx` baris ~340

Ketiganya pakai grid **4 kolom di desktop** (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4`) — beda
dari Campaign/Event yang 3 kolom. Desain 1 Produk **mempertahankan 4 kolom** (bukan diseragamkan
ke 3) — kepadatan grid per modul adalah keputusan visual existing yang sudah tepat untuk konteksnya
masing-masing (produk biasanya lebih banyak & lebih kecil daripada campaign/event), tidak perlu
diubah hanya karena sedang menyeragamkan pola RESPONSIF-nya.

**Keputusan yang dibawa dari § 14m Donasi (bukan didesain ulang)**:
- Setting **tetap ada** — registry bernomor ("Desain 1", nanti "Desain 2" dst) di halaman
  `/toko/pengaturan`, BUKAN pilihan Grid/List/Ringkas langsung, dan BUKAN dihapus.
- **Aturan wajib untuk SETIAP desain di registry ini, sekarang dan nanti**: grid di desktop, list
  di mobile — baseline konstrain untuk seluruh keluarga desain.
- Dual-render CSS breakpoint (`hidden md:grid` + `md:hidden`), SSR-safe, tanpa `"use client"`.

**Tidak ada gap infrastruktur** (beda dari Event): grup setting `"toko"` **sudah ada** di
`SETTING_GROUPS` sejak Sistem Mitra dibangun — tidak perlu migration DDL baru, cukup key baru
`product_archive_design` di grup yang sudah ada.

**Halaman pengaturan sudah ada, tapi pola form-nya berbeda dari Donasi** — `/toko/pengaturan`
(`toko/pengaturan/page.tsx` + `toko-settings-form.tsx` + `toko/pengaturan/actions.ts`) pakai SATU
form besar dengan SATU state object (`TokoSettings`) dan SATU tombol simpan untuk semua field
sekaligus (Sistem Mitra + Info Toko) — beda dari Donasi yang punya beberapa `<section>` independen
masing-masing dengan state dan tombol simpan sendiri. **Keputusan**: TIDAK memaksakan section baru
masuk ke `TokoSettings` object yang sudah ada (itu akan memaksa refactor form yang sudah berjalan
baik) — section "Desain Kartu Arsip" ditambah sebagai `<section>` BARU yang independen di bawah
`<TokoSettingsForm>` di `toko/pengaturan/page.tsx`, dengan komponen + action + state-nya sendiri,
persis pola yang dipakai Donasi. Dua gaya form (satu form besar vs beberapa section independen)
boleh hidup berdampingan di halaman yang sama — tidak perlu diseragamkan.

**File yang akan dibuat**:
```
lib/product-archive-card-designs.ts                                      → registry
components/website/public/product-cards/product-archive-cards-design-1.tsx → Desain 1: grid 4 kolom desktop / list mobile
components/website/public/product-cards/product-archive-cards.tsx        → dispatcher (perlu terusin sessionType)
app/(dashboard)/app/[tenant]/toko/pengaturan/product-archive-design-form.tsx → picker client component (colocated, pola toko-settings-form.tsx)
```

**File yang akan diubah**:
```
app/(dashboard)/app/[tenant]/toko/pengaturan/actions.ts  → tambah saveProductArchiveDesignAction
app/(dashboard)/app/[tenant]/toko/pengaturan/page.tsx    → tambah section baru di bawah TokoSettingsForm
app/(public)/[tenant]/produk/page.tsx                     → baca setting, dispatch via ProductArchiveCards
app/(public)/[tenant]/produk/kategori/[categorySlug]/page.tsx → sama
app/(public)/[tenant]/produk/[productSlug]/page.tsx       → sama, untuk "Produk Lainnya"
```

**Setting** — group `toko` (sudah ada), key baru:
```json
key   = "product_archive_design"
group = "toko"
value = { "design": "1" }
```

**Dispatcher perlu terusin `sessionType`** (beda dari Campaign/Event yang tidak punya prop ini) —
`ProductArchiveCards` props: `{ design, products, tenantSlug, sessionType }`, diteruskan apa
adanya ke `<ProductCard sessionType={sessionType}>` di dalam Desain 1 — tier harga (price/
publicPrice/memberPrice) tetap resolve dengan benar di kedua breakpoint (grid dan list sama-sama
butuh `sessionType`, bukan cuma salah satu).

**Urutan implementasi**:
```
Step PR1: Registry + dispatcher (dengan sessionType) + Desain 1 (copy pola campaign, 4 kolom bukan 3)
Step PR2: product-archive-design-form.tsx + saveProductArchiveDesignAction + section baru di
          toko/pengaturan/page.tsx (di bawah TokoSettingsForm yang sudah ada, tidak diubah)
Step PR3: 3 titik publik (produk/page.tsx, kategori/[slug]/page.tsx, [productSlug]/page.tsx)
          — baca setting sekali, dispatch via ProductArchiveCards, ganti hardcode variant="grid"
Step PR4: tsc --noEmit + build, verifikasi 0 error
```

**Realisasi**: rencana di atas diikuti tanpa deviasi. `product-archive-design-form.tsx` colocated
di folder `toko/pengaturan/` (bukan `components/toko/`) — pola sama `toko-settings-form.tsx` yang
sudah ada di situ. `hasFullAccess(access.tenantUser, "toko")` dipakai untuk guard
`saveProductArchiveDesignAction` (bukan `canManageUsers` yang dipakai `saveTokoSettingsAction` —
setting tampilan tidak sesensitif konfigurasi komisi mitra, jadi tidak perlu dibatasi ke
owner/ketua saja). Tidak ada migration DB — grup `toko` sudah ada.

### Coupling ke Landing Section "Grid Produk" + Fix Mobile Slider (§ menyusul § 14o Donasi)

> **Status: SELESAI — diimplementasikan 2026-07-17.** Menerapkan prinsip § 14o
> (`docs/arsitektur-donasi.md`): setting "Desain Kartu Arsip" satu sumber kebenaran, landing
> section "Grid X" otomatis ikut.

**Dua perubahan sekaligus di `ProductsDesign1` ("Grid Produk", landing section)**:

1. **Coupling** — terima prop `cardDesign` (fetch dari `product_archive_design`, sama seperti
   Event). Registry arsip Produk baru 1 desain ("Klasik") — dispatch untuk sekarang selalu 1
   cabang, murni plumbing untuk desain masa depan (identik alasan dengan Event).
2. **Fix mobile — bug nyata, bukan cuma plumbing**: `ProductsDesign1` SEBELUM perubahan ini
   TIDAK PUNYA treatment mobile sama sekali — satu `<div className="grid grid-cols-2 sm:grid-cols-3
   lg:grid-cols-4">` tanpa pemisahan breakpoint, persis bug "grid sempit di HP" yang sama seperti
   yang dulu dialami Campaign sebelum § 14l. Dikonfirmasi user: disamakan dengan Campaign — **grid
   desktop / slider mobile** (bukan list seperti Event, yang sengaja dipertahankan berbeda).

**Kolom grid desktop dipertahankan 4** (bukan diseragamkan ke 3 seperti Campaign/Event) — sama
alasan dengan § "Registry Desain Kartu Arsip" di atas: kepadatan grid adalah keputusan visual
per-modul yang independen dari mekanisme responsifnya.

**File yang diubah**: `lib/products-section-designs.ts` (`ProductsSectionProps += cardDesign`),
`products-section.tsx` (fetch `product_archive_design`, pass `cardDesign`), `products-design-1.tsx`
(terima `cardDesign` + tambah blok `hidden md:grid` desktop / `md:hidden` slider mobile,
pola sama persis `campaigns-design-1.tsx`).

**Drive-by fix di luar scope literal permintaan**: `ProductsEditor` (`section-editors.tsx`) juga
punya bug pre-existing sama persis — tidak pernah destructure `variant`/`onVariantChange`, admin
tidak pernah bisa pilih "Showcase"/"Carousel Produk" dari UI. Difix bersamaan (tambah "Design
Layout" picker, pola identik `CampaignsEditor`/`EventsEditor`).
