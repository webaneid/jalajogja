# Arsitektur Add-on Ongkos Kirim — jalakarta × RajaOngkir

Dokumen ini mendefinisikan add-on **Ongkos Kirim** berbasis RajaOngkir untuk sistem
dropship mitra jalakarta. Dibuat sebelum implementasi — bukan rekap perubahan.

**Keterkaitan dokumen:**
- `docs/arsitektur-mitra.md` — sistem mitra, seller_type, business_id
- `docs/arsitektur-billing.md` — cart, checkout, invoice universal
- `docs/arsitektur-product.md` — produk tenant + variasi

---

## Konsep Inti

```
Dropship model:
┌─────────────────────────────────────────────────────────────┐
│  Customer bayar ke TENANT (satu invoice, satu transaksi)    │
│  Mitra kirim LANGSUNG ke customer (per seller group)        │
│  Resi diinput mitra di /akun/mitra/pesanan                  │
└─────────────────────────────────────────────────────────────┘

Cart dengan multi-seller:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Produk Tenant   │    │ Produk Mitra A  │    │ Produk Mitra B  │
│ (gudang tenant) │    │ (Yogyakarta)    │    │ (Sleman)        │
│ Ongkir: Rp X    │    │ Ongkir: Rp Y   │    │ Ongkir: Rp Z   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                     │                      │
         └─────────────────────┴──────────────────────┘
                               │
                    SATU INVOICE ke customer
                    Total = items + sum(semua ongkir)
```

---

## Positioning: Add-on, API Key per Tenant

- **Tipe**: Add-on (tidak semua tenant butuh ongkir)
- **Slug**: `rajaongkir`
- **Tier**: Paid (ikut quota API RajaOngkir per tenant)
- **API key**: Per tenant — tenant daftar RajaOngkir sendiri, input key di settings add-on
- **Security**: API key disimpan di `tenant_addon_installations.config` (server-side only)
  Semua request ke RajaOngkir dilakukan dari server jalakarta, **tidak pernah expose ke browser**

```
Frontend → POST /api/ongkir/cost?slug=X → Server baca API key dari DB → RajaOngkir → return hasil
```

---

## Perbedaan Kode Wilayah — Masalah Kritis

BPS (yang dipakai jalakarta) dan RajaOngkir menggunakan sistem penomoran yang **berbeda**:

| Sistem | Contoh Yogyakarta Kota | Format |
|--------|------------------------|--------|
| BPS `regency_id` | 3471 | Integer, kode BPS nasional |
| RajaOngkir `city_id` | 501 | Integer, kode internal RajaOngkir |

**Solusi yang dipilih**: Simpan `rajaongkir_city_id` secara eksplisit di dua tempat:
1. **Config add-on tenant** — kota asal default tenant (untuk produk tenant sendiri)
2. **Data mitra** — kolom `rajaongkir_city_id` di tabel `mitras` (untuk produk mitra)

Tidak membuat tabel mapping BPS ↔ RajaOngkir karena:
- Mapping tidak 1:1 sempurna (beberapa kota BPS tidak ada di RajaOngkir dan sebaliknya)
- Admin/mitra pilih langsung dari dropdown kota RajaOngkir saat setup — lebih akurat

---

## Perubahan Schema yang Dibutuhkan

### 1. Tabel `mitras` — tambah kolom origin

```sql
-- Tambah kolom kota asal pengiriman mitra
ALTER TABLE "{tenant_schema}".mitras
  ADD COLUMN IF NOT EXISTS rajaongkir_city_id INTEGER,     -- kota asal pengiriman
  ADD COLUMN IF NOT EXISTS rajaongkir_city_name TEXT;      -- nama kota (cache, agar tidak query API tiap saat)
```

Diisi saat mitra disetujui atau mitra edit profil di `/akun/mitra/profil`.
Nullable — jika null, ongkir tidak bisa dihitung untuk produk mitra tersebut.

### 2. Tabel baru `invoice_shipping_lines` — ongkir per seller group

```sql
CREATE TABLE IF NOT EXISTS "{tenant_schema}".invoice_shipping_lines (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID           NOT NULL,    -- FK → invoices(id)
  seller_type     TEXT           NOT NULL     -- 'tenant' | 'mitra'
                                 CHECK (seller_type IN ('tenant', 'mitra')),
  seller_id       UUID,                       -- NULL jika tenant, mitra_id jika mitra
  seller_name     TEXT           NOT NULL,    -- snapshot nama (tenant.name atau mitra.business_name)
  origin_city_id  INTEGER        NOT NULL,    -- RajaOngkir city_id asal
  origin_city_name TEXT          NOT NULL,    -- nama kota asal (snapshot)
  courier         TEXT           NOT NULL,    -- 'jne' | 'pos' | 'tiki' | 'sicepat' dll
  service         TEXT           NOT NULL,    -- 'REG' | 'YES' | 'OKE' dll
  service_desc    TEXT,                       -- deskripsi layanan
  etd             TEXT,                       -- estimasi tiba '1-2 hari'
  weight_gram     INTEGER        NOT NULL,    -- total berat (gram)
  cost            NUMERIC(15,2)  NOT NULL,    -- ongkir (Rp)
  tracking_number TEXT,                       -- resi — diisi mitra setelah kirim
  shipped_at      TIMESTAMPTZ,               -- waktu mitra input resi
  delivered_at    TIMESTAMPTZ,               -- waktu konfirmasi terima (opsional)
  status          TEXT           NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','shipped','delivered')),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_shipping_invoice ON invoice_shipping_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shipping_seller  ON invoice_shipping_lines(seller_type, seller_id);
```

### 3. Tabel `ref_rajaongkir_cities` — cache daftar kota (public schema)

```sql
-- Disimpan di public schema — shared semua tenant, cukup sync sekali
CREATE TABLE IF NOT EXISTS public.ref_rajaongkir_cities (
  city_id     INTEGER  PRIMARY KEY,
  province_id INTEGER  NOT NULL,
  city_name   TEXT     NOT NULL,
  postal_code TEXT,
  type        TEXT     NOT NULL   -- 'Kabupaten' | 'Kota'
);
```

Di-seed dari RajaOngkir `/city` endpoint — dijalankan platform admin sekali,
update periodik jika ada kota baru. Tidak butuh API key per tenant
(endpoint `/city` bisa pakai API key platform di ENV).

---

## Drizzle Schema (tenant)

```typescript
// packages/db/src/schema/tenant/shipping.ts

export function createInvoiceShippingLinesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("invoice_shipping_lines", {
    id:           uuid("id").primaryKey().defaultRandom(),
    invoiceId:    uuid("invoice_id").notNull(),
    sellerType:   text("seller_type", { enum: ["tenant", "mitra"] }).notNull(),
    sellerId:     uuid("seller_id"),
    sellerName:   text("seller_name").notNull(),
    originCityId:   integer("origin_city_id").notNull(),
    originCityName: text("origin_city_name").notNull(),
    courier:      text("courier").notNull(),
    service:      text("service").notNull(),
    serviceDesc:  text("service_desc"),
    etd:          text("etd"),
    weightGram:   integer("weight_gram").notNull(),
    cost:         numeric("cost", { precision: 15, scale: 2 }).notNull(),
    trackingNumber: text("tracking_number"),
    shippedAt:    timestamp("shipped_at", { withTimezone: true }),
    deliveredAt:  timestamp("delivered_at", { withTimezone: true }),
    status:       text("status", { enum: ["pending","shipped","delivered"] }).notNull().default("pending"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}
```

---

## Config Add-on per Tenant

Disimpan di `tenant_addon_installations.config` (JSONB):

```json
{
  "api_key": "rajaongkir-api-key-tenant-xxx",
  "origin_city_id": 501,
  "origin_city_name": "Yogyakarta",
  "couriers": ["jne", "pos", "tiki", "sicepat"],
  "weight_unit": "gram",
  "default_weight_gram": 500
}
```

- `api_key` — API key tenant di RajaOngkir (Pro account untuk akses semua kurir)
- `origin_city_id` — kota asal produk tenant sendiri (bukan mitra)
- `couriers` — kurir yang ditawarkan (dari yang tersedia di RajaOngkir)
- `default_weight_gram` — berat default per item jika produk tidak ada berat

---

## Berat Produk — Schema Tambahan

Produk perlu field berat untuk hitung ongkir:

```sql
-- Tambah di products + product_variations
ALTER TABLE "{tenant_schema}".products
  ADD COLUMN IF NOT EXISTS weight_gram INTEGER DEFAULT 500;  -- berat dalam gram

ALTER TABLE "{tenant_schema}".product_variations
  ADD COLUMN IF NOT EXISTS weight_gram INTEGER;  -- override berat per variasi (nullable = pakai produk)
```

---

## API Endpoints

### `GET /api/ongkir/cities?q=yogya`
Cari kota untuk dropdown. Query dari `public.ref_rajaongkir_cities`.
Tidak butuh API key tenant — data lokal di DB.

```json
[
  { "cityId": 501, "cityName": "Yogyakarta", "type": "Kota", "postalCode": "55111" },
  { "cityId": 389, "cityName": "Sleman", "type": "Kabupaten", "postalCode": "55511" }
]
```

### `POST /api/ongkir/cost?slug=X`
Hitung ongkir. Dipanggil dari checkout untuk setiap seller group.

**Request:**
```json
{
  "origin": 501,
  "destination": 23,
  "weight": 1500,
  "couriers": ["jne", "tiki"]
}
```

**Flow server:**
1. Ambil API key dari `tenant_addon_installations WHERE addon_slug = 'rajaongkir'`
2. Call RajaOngkir `POST /cost` dengan key tersebut
3. Return hasil — tidak pernah return API key ke client

**Response:**
```json
{
  "results": [
    {
      "courier": "jne",
      "services": [
        { "service": "REG", "desc": "Layanan Reguler", "cost": 14000, "etd": "2-3 hari" },
        { "service": "YES", "desc": "Yakin Esok Sampai", "cost": 38000, "etd": "1-1 hari" }
      ]
    }
  ]
}
```

### `POST /api/ongkir/sync-cities`
Platform admin endpoint — sync daftar kota dari RajaOngkir ke `ref_rajaongkir_cities`.
Pakai API key dari ENV platform (`RAJAONGKIR_PLATFORM_KEY`), bukan API key tenant.
Jalankan manual atau cron mingguan.

---

## Alur Checkout — Perubahan

### Sebelum (sekarang)
```
Cart → Checkout (isi nama/HP/email) → Invoice → Pilih metode bayar
```

### Sesudah (dengan ongkir)
```
Cart → Checkout Step 1 (nama/HP/email + kota tujuan)
     → Checkout Step 2 (pilih kurir per seller group)
     → Invoice → Pilih metode bayar
```

### Detail Step 2 — Pilih Kurir

Checkout mengelompokkan cart items per seller:
```
┌─────────────────────────────────────────────┐
│ Paket dari: Toko IKPM (Yogyakarta)          │
│ • Baju Batik × 2    Rp 240.000              │
│ Pilih pengiriman: [JNE REG Rp 14.000 ▼]    │
├─────────────────────────────────────────────┤
│ Paket dari: Batik Bu Sari (Sleman)          │
│ • Kain Lurik × 1    Rp 85.000               │
│ Pilih pengiriman: [TIKI REG Rp 12.000 ▼]   │
└─────────────────────────────────────────────┘

Subtotal produk:  Rp 325.000
Ongkos kirim:     Rp  26.000
─────────────────────────────
Total:            Rp 351.000
```

### Seller Groups — Logic

```typescript
type SellerGroup = {
  sellerType:  "tenant" | "mitra";
  sellerId:    string | null;  // null jika tenant
  sellerName:  string;
  originCityId: number;
  items:        CartItem[];
  totalWeight:  number;        // gram, sum dari semua item × weight per item
};

function groupCartBySeller(items: CartItem[], mitras: MitraInfo[]): SellerGroup[] {
  // Group by sellerType + sellerId
  // Untuk "tenant" group: originCityId dari add-on config
  // Untuk "mitra" group: originCityId dari mitras.rajaongkir_city_id
  // Skip seller group yang rajaongkir_city_id-nya null → tampilkan warning
}
```

### Edge Cases

| Situasi | Handling |
|---------|----------|
| Mitra belum set `rajaongkir_city_id` | Tampilkan warning "Produk ini tidak tersedia pengiriman otomatis, hubungi admin" |
| Add-on tidak aktif (tenant belum install) | Tidak tampil dropdown kurir, user input ongkir manual atau checkout tanpa ongkir |
| Kota tujuan tidak ditemukan di RajaOngkir | Fallback ke input manual nominal ongkir |
| API RajaOngkir down | Fallback ke input manual, tampil pesan "Cek ongkir manual di website kurir" |

---

## Invoice — Perubahan

### Total invoice sekarang
```
subtotal + discount → total
```

### Total invoice dengan ongkir
```
subtotal + shipping_total - discount → total
```

Perlu tambah kolom `shipping_total NUMERIC(15,2) NOT NULL DEFAULT 0` di tabel `invoices`.

`invoice_shipping_lines` dibuat bersamaan dengan invoice saat checkout submit.
Satu baris per seller group yang dipilih kurir-nya.

---

## Mitra Dashboard — Tambahan

### `/akun/mitra/pesanan` (update)

Tampilkan pesanan yang relevan dengan mitra ini (dari `invoice_shipping_lines WHERE seller_id = mitra.id`):

| Kolom | Data |
|-------|------|
| No. Invoice | `invoices.invoice_number` |
| Customer | `invoices.customer_name` + alamat tujuan |
| Produk | item list dari `invoice_items` filter seller |
| Kurir | `shipping_lines.courier` + `service` |
| Status | `shipping_lines.status` |
| Resi | Input field (jika status pending/shipped) |

**Tombol "Input Resi"** → modal input nomor resi → update `tracking_number` + `shipped_at` + `status = 'shipped'`

### `/akun/mitra/profil` (update)

Tambah section **Pengaturan Pengiriman**:
- Kota asal pengiriman: Combobox cari dari `ref_rajaongkir_cities`
- Simpan ke `mitras.rajaongkir_city_id` + `rajaongkir_city_name`

---

## Admin Dashboard — Tambahan

### `/toko/pesanan/[id]` (update)

Tambah section **Pengiriman** di bawah items:
```
┌──────────────────────────────────────────────────────┐
│ Pengiriman                                           │
├──────────────────────────────────────────────────────┤
│ Toko IKPM → JNE REG → Rp 14.000 → ⏳ Belum kirim   │
│ Batik Bu Sari → TIKI REG → Rp 12.000 → ✅ Terkirim  │
│                              Resi: JD1234567890      │
└──────────────────────────────────────────────────────┘
```

Admin bisa override input resi untuk semua seller group.

### `/toko/pengaturan` (update)

Tambah sub-section **Ongkos Kirim** (hanya muncul jika add-on aktif):
- Kota asal tenant
- Kurir yang ditawarkan (multi-select)
- Berat default per item

---

## Settings Add-on di Platform

Di `/platform/tenants/[slug]` (detail tenant):
- Tombol "Install Add-on" → pilih `rajaongkir` dari katalog
- Setelah install → tenant bisa input API key di `/settings/addons/rajaongkir`

Tenant route baru:
```
/{slug}/settings/addons/
├── page.tsx          → list add-on yang terinstall + tersedia
└── rajaongkir/
    └── page.tsx      → form API key + kota asal + kurir + berat default
```

---

## Phase 1 — Scope Implementasi Awal

Yang dibangun di Phase 1:

**Backend:**
- [ ] Seed `public.ref_rajaongkir_cities` via endpoint sync platform
- [ ] Kolom `rajaongkir_city_id` + `rajaongkir_city_name` di `mitras`
- [ ] Kolom `weight_gram` di `products` + `product_variations`
- [ ] Tabel `invoice_shipping_lines`
- [ ] Kolom `shipping_total` di `invoices`
- [ ] `POST /api/ongkir/cost?slug=` — proxy ke RajaOngkir
- [ ] `GET /api/ongkir/cities?q=` — search kota lokal

**Frontend:**
- [ ] Checkout multi-step: tambah step pilih kurir per seller group
- [ ] `checkoutAction` update: terima `shippingLines[]`, buat `invoice_shipping_lines`
- [ ] Mitra profil: section kota asal pengiriman
- [ ] Mitra pesanan: tampil list + input resi
- [ ] Admin pesanan detail: section pengiriman per seller
- [ ] `/settings/addons/rajaongkir`: form konfigurasi

**Platform:**
- [ ] Endpoint sync kota RajaOngkir (`/api/platform/rajaongkir/sync-cities`)
- [ ] UI install add-on di tenant detail

**Yang DITUNDA (Phase 2+):**
- Tracking status otomatis (polling ke API kurir)
- Notifikasi WhatsApp ke customer saat resi diinput
- COD (bayar di tempat)
- Asuransi pengiriman
- Return/retur barang
- Dropship label (print label pengiriman atas nama tenant, bukan mitra)

---

## Open Questions

1. **Berat produk** — apakah admin WAJIB isi berat, atau boleh pakai default? Jika default dipakai tanpa konfirmasi, ongkir bisa tidak akurat.

2. **Tujuan pengiriman** — sekarang invoice tidak simpan alamat tujuan customer secara terstruktur (hanya `customer_name`, `customer_phone`). Perlu tambah `destination_city_id` + `destination_address` ke invoice, atau simpan terpisah?

3. **Seller group tanpa ongkir** — jika mitra belum set kota asal, apakah checkout tetap bisa dilanjutkan (skip ongkir untuk produk itu) atau diblokir?

4. **RajaOngkir tier** — API `/cost` butuh akun Pro (berbayar). Apakah jalakarta mau bundel akun Pro platform → semua tenant pakai → biaya ongkir ditagihkan ke add-on fee? Atau masing-masing tenant daftar sendiri (lebih mandiri)?

---

## Diagram Alur Lengkap

```
[Customer]
    │
    ▼
Buka /keranjang
    │ klik Checkout
    ▼
[Step 1: Info Pemesan]
    • Nama, HP, Email
    • Kota tujuan (Combobox → ref_rajaongkir_cities)
    │
    ▼
[Step 2: Pilih Kurir]
    • Server groupBySeller(cartItems)
    • Tiap group: call /api/ongkir/cost
    • Customer pilih kurir per group
    │
    ▼
[Submit checkoutAction]
    • Buat invoice (dengan shipping_total)
    • Buat invoice_shipping_lines per group
    • Hapus cart
    │
    ▼
[Invoice Page]
    • Customer bayar (transfer/QRIS)
    • Admin konfirmasi → status 'waiting_verification' → 'paid'
    │
    ▼
[Notifikasi ke Mitra]
    • WA/email: "Ada pesanan baru untuk kamu"
    • Mitra buka /akun/mitra/pesanan
    • Mitra kemas + kirim
    • Mitra input resi → status 'shipped'
    │
    ▼
[Customer terima barang]
    • Konfirmasi terima (opsional Phase 2)
```
