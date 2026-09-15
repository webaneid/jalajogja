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

> **⚠️ SUPERSEDED (2026-08-25)**: desain di section ini adalah rencana v1 dan **tidak pernah
> dieksekusi permanen** — implementasi aktual (lihat § "Perubahan dari Arsitektur Awal v1 → v2"
> di bawah) memakai search realtime ke API v2, bukan tabel cache. Tabel ini sempat dibuat via
> `docs/migration-ongkir.sql` tapi nol pemakai di kode (dikonfirmasi grep) — file migration
> dan schema Drizzle-nya (`packages/db/src/schema/public/ref-rajaongkir-cities.ts`) sudah
> dihapus. Section di bawah dipertahankan sebagai catatan sejarah rencana awal, bukan panduan
> implementasi.

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
  "origin_city_id": 12345,
  "origin_city_name": "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243",
  "couriers": ["jne", "pos", "tiki", "sicepat"]
}
```

- **`api_key` TIDAK ada di config tenant** — API key ada di `RAJAONGKIR_PLATFORM_KEY` ENV server
- `origin_city_id` — ID kelurahan asal (dari RajaOngkir v2, bukan kode kota v1)
- `origin_city_name` — label lengkap dari RajaOngkir (disimpan sebagai cache display)
- `couriers` — kurir yang ditawarkan di checkout (dari yang tersedia di RajaOngkir)
- `default_weight_gram` — **dihapus** dari config, karena sekarang wajib isi per produk

**Daftar lengkap 16 kurir valid untuk akun RajaOngkir tenant ini** (dikonfirmasi langsung dari
API produksi, BUKAN dokumentasi resmi yang kontradiktif — submit kode kurir sengaja salah
bersama kandidat lain, respons 422 API RajaOngkir sendiri berisi daftar valid): `jne`,
`sicepat`, `ide` (ID Express), `sap`, `jnt`, `ninja`, `tiki`, `lion`, `anteraja`, `pos`, `ncs`
(NCS Express), `rex` (REX/Royal Express Indonesia), `rpx`, `sentral` (Sentral Cargo), `star`
(Star Cargo), `wahana` (Wahana). Checkbox setting `COURIER_OPTIONS` (`config-form.tsx`)
mencakup ke-16 ini sejak 2026-08-14 (sebelumnya cuma 10). Catatan: `ncs`/`sentral`/`star` valid
menurut API tapi tidak selalu mengembalikan hasil biaya untuk semua rute (kemungkinan tidak
melayani rute tsb / tidak aktif untuk tier akun tertentu) — bukan berarti kode salah.

Metodologi (untuk audit serupa ke depan): untuk pertanyaan "apakah daftar kita lengkap sesuai
penyedia eksternal X", jangan percaya dokumentasi pihak ketiga begitu saja (apalagi kalau
daftar tergantung tier akun/versi API) — kalau API punya mekanisme validasi (submit kode salah
→ error message berisi daftar valid), itu sumber kebenaran paling otoritatif untuk
kredensial/akun yang dipakai.

**Keputusan dikunci:** API key adalah platform-level, bukan per-tenant. Alasannya:
- Menyederhanakan setup tenant (tidak perlu daftar RajaOngkir sendiri)
- Satu key platform untuk semua tenant jalakarta
- Tenant hanya perlu set kota asal + kurir di settings add-on

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

### `GET /api/ongkir/cities?q=yogya&limit=15`

Cari kota/kelurahan untuk dropdown di checkout dan settings add-on.

**SEKARANG (v2):** Proxy realtime ke RajaOngkir v2. Tidak ada tabel lokal.
- Min 2 karakter query
- API key: `RAJAONGKIR_PLATFORM_KEY` dari ENV server — tidak pernah ke browser
- Endpoint RajaOngkir: `GET /destination/domestic-destination?search=&limit=&offset=0`
- RajaOngkir v2 return HTTP 404 (bukan array kosong) saat tidak ada hasil — route menangani ini sebagai `{ cities: [] }` bukan error

```json
{
  "cities": [
    {
      "id": 12345,
      "label": "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243",
      "cityName": "YOGYAKARTA",
      "districtName": "TEGALREJO",
      "subdistrictName": "BENER",
      "provinceName": "DI YOGYAKARTA",
      "zipCode": "55243"
    }
  ]
}
```

> **Berbeda dari v1:** Kode ID adalah ID kelurahan (subdistrict level), bukan kode kota.
> Label sudah dalam format `KELURAHAN, KECAMATAN, KOTA, PROVINSI, KODEPOS`.

### `POST /api/ongkir/cost?slug=X`

Hitung ongkir. Dipanggil dari checkout untuk setiap seller group.

**SEKARANG (v2):** Menggunakan endpoint `POST /calculate/domestic-cost` dengan FormData.

**Request (dari checkout-form ke route):**
```json
{
  "origin":      12345,
  "destination": 67890,
  "weight":      1500,
  "couriers":    ["jne", "tiki"]
}
```

**Flow server:**
1. Baca `RAJAONGKIR_PLATFORM_KEY` dari ENV (bukan dari DB tenant)
2. Cek addon terinstall di tenant (`tenant_addon_installations WHERE addon_slug = 'rajaongkir'`)
3. Build FormData: `origin`, `destination`, `weight`, `courier` (colon-separated: `"jne:tiki"`)
4. Call RajaOngkir `POST /calculate/domestic-cost`
5. Return hasil flat — tidak pernah return API key ke client

**Response (flat — berbeda dari v1):**
```json
{
  "results": [
    { "courier": "JNE", "code": "jne", "service": "REG", "description": "Layanan Reguler", "cost": 14000, "etd": "2-3" },
    { "courier": "JNE", "code": "jne", "service": "YES", "description": "Yakin Esok Sampai", "cost": 38000, "etd": "1-1" },
    { "courier": "TIKI", "code": "tiki", "service": "REG", "description": "Regular Service", "cost": 12000, "etd": "3-4" }
  ]
}
```

> v1 response: nested `results[].costs[].cost[]`. v2: flat array, satu object per service.
> `checkout-form.tsx` pakai `flattenCourierOptions()` untuk sort by cost ascending.

### `GET /api/platform/rajaongkir/sync-cities` (sudah diubah)

**SEKARANG:** Endpoint ini diubah menjadi **test connection ping**, bukan sync kota.

- Endpoint `/sync-cities` sekarang test apakah `RAJAONGKIR_PLATFORM_KEY` valid dengan query `search=jakarta&limit=1`
- **Tidak ada lagi tabel `ref_rajaongkir_cities`** — kota di-search realtime
- Tampilan di platform settings: ENV key status + tombol "Test Koneksi" (Wifi icon)

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

## Status Implementasi

### ✅ Selesai

**Backend:**
- [x] Kolom `rajaongkir_city_id` + `rajaongkir_city_name` di `mitras`
- [x] Kolom `weight_gram` di `products` (diisi admin di product form sidebar)
- [x] Tabel `invoice_shipping_lines` (DDL + Drizzle schema)
- [x] Kolom `shipping_total` di `invoices`
- [x] `POST /api/ongkir/cost?slug=` — proxy ke RajaOngkir **v2** (`/calculate/domestic-cost`)
- [x] `GET /api/ongkir/cities?q=` — search realtime ke RajaOngkir **v2** (bukan lokal DB)
- [x] `GET /api/platform/rajaongkir/sync-cities` — diubah jadi test connection ping

**Frontend:**
- [x] Checkout multi-step 3 langkah (data → kota tujuan → kurir per seller group)
- [x] `checkoutAction` — terima `CheckoutShippingData`, insert `invoice_shipping_lines`, hitung `shippingTotal`
- [x] Mitra pesanan (`/akun/mitra/pesanan`) — list pesanan + input resi per shipping line
- [x] `updateShippingTrackingAction` — update resi + status pengiriman
- [x] Invoice publik — tampilkan breakdown ongkir per seller + tracking number + status badge
- [x] `/settings/addons/rajaongkir` — form konfigurasi (kota asal + kurir, tanpa api_key)

**Platform:**
- [x] Settings platform — status ENV key + tombol "Test Koneksi" (ganti "Sync Kota")

### Perubahan dari Arsitektur Awal (v1 → v2)

| Aspek | Rencana Awal (v1) | Implementasi Aktual (v2) |
|-------|-------------------|--------------------------|
| API base URL | `api.rajaongkir.com` | `rajaongkir.komerce.id/api/v1` |
| API key | Per-tenant di config | Platform-level `RAJAONGKIR_PLATFORM_KEY` ENV |
| Daftar kota | Tabel `ref_rajaongkir_cities` di DB | Search realtime ke API v2 |
| Level kota | Kota/kabupaten | Kelurahan (lebih granular) |
| Format city ID | Integer kode kota | Integer ID kelurahan |
| Response cost | Nested `results[].costs[].cost[]` | Flat array per service |
| No results | Return `{data: []}` | Return HTTP 404 — ditangani sebagai empty array |
| Platform endpoint | "Sync Cities" ke DB | "Test Connection" ping |

### Ditunda (Phase 2+)
- Tracking status otomatis (polling ke API kurir)
- Notifikasi WhatsApp ke customer saat resi diinput
- COD (bayar di tempat)
- Asuransi pengiriman
- Return/retur barang
- Dropship label (print label pengiriman atas nama tenant, bukan mitra)

**Koreksi (2026-09-15):** `weight_gram` di `product_variations` SUDAH ADA sejak lama (dikonfirmasi
di kode, `packages/db/src/schema/tenant/shop.ts:150`, dipakai sebagai override per-variasi di
`checkout/page.tsx:223`) — baris "Ditunda" untuk ini di versi dokumen sebelumnya keliru/basi.

---

## Kota Asal Pengiriman per Produk Tenant — ✅ Kode SELESAI (2026-09-15)

> Status: `bun run type-check` 0 error di semua workspace. Migration `0065` sudah dijalankan
> di dev lokal (kolom terverifikasi ada). **Belum diverifikasi visual di browser** (perlu login
> admin — tidak ada kredensial di sesi ini, sama seperti keterbatasan yang dicatat di fitur stok
> sebelumnya). Belum di-commit/push, menunggu instruksi user. Konten di bawah dipertahankan apa
> adanya sebagai rencana yang sudah dieksekusi persis sesuai isinya (bukan rekap ulang) — semua
> "RENCANA"/"BARU" di bawah artinya "sudah dikerjakan sesuai rencana ini", bukan lagi rencana.

### Masalah

Saat ini kota asal pengiriman untuk produk **milik tenant sendiri** (bukan mitra) SATU untuk
SEMUA produk — diambil dari satu config `/settings/addons/rajaongkir`
(`tenant_addon_installations.config.origin_city_id`, dibaca di `checkout/page.tsx:248-253` dan
`toko/pesanan/new/page.tsx` versi admin). Produk **mitra** sudah bisa beda kota asal (per mitra,
`mitras.rajaongkir_city_id`) — tapi produk tenant sendiri tidak bisa, meski kenyataannya tenant
bisa saja kirim sebagian produk dari gudang berbeda (mis. sebagian dropship dari supplier lain,
sebagian dari gudang sendiri).

Konfirmasi dari baca kode (bukan asumsi): tidak ada kolom kota-asal apa pun di tabel `products` —
hanya `weight_gram` yang per-produk. Query `checkout/page.tsx:181-197` cuma JOIN `mitras` untuk
origin, tidak pernah baca origin dari `products` itu sendiri.

### Solusi

Tambah kolom **opsional** `origin_city_id`/`origin_city_name` di tabel `products` — kalau diisi
admin, override kota asal default tenant KHUSUS untuk produk itu; kalau kosong, fallback ke
default tenant seperti sekarang. Pola INI PERSIS meniru `mitras.rajaongkir_city_id` yang sudah
terbukti jalan — bukan desain baru.

**Keputusan user (2026-09-15) — field ini KHUSUS produk tenant sendiri, TIDAK berlaku untuk
produk mitra.** Alasan: mitra wajib jual produk buatan/milik sendiri, bukan dropship produk
pihak lain — jadi kota asal mitra sudah pasti tunggal (lokasi mitra itu sendiri,
`mitras.rajaongkir_city_id`), tidak ada skenario "satu mitra, produk beda gudang" yang perlu
diakomodasi. Konsekuensi teknis: `product.originCityId` HANYA pernah dibaca kalau
`product.mitraId IS NULL` — kalau suatu produk ternyata match ke mitra, override produk
diabaikan sama sekali (defense-in-depth; secara UI pun field ini memang tidak pernah muncul
untuk produk mitra karena `product-form.tsx` — form yang dipakai field ini — dikonfirmasi HANYA
dipakai untuk produk tenant, tidak pernah untuk produk mitra, lihat § 5).

**Urutan resolusi origin per item cart** (baru):
```
Produk milik mitra (product.mitraId IS NOT NULL):
  1. mitra.rajaongkirCityId                            ← sudah ada, TIDAK berubah
  (product.originCityId TIDAK PERNAH dicek untuk produk mitra)

Produk milik tenant sendiri (product.mitraId IS NULL):
  1. product.originCityId (kalau diisi admin)          ← BARU
  2. tenant default (config.origin_city_id)             ← sudah ada, fallback terakhir
```

### 1. Schema — `packages/db/src/schema/tenant/shop.ts`

Tambah 2 kolom nullable di `createProductsTable()`, tepat setelah `weightGram` (baris ~86):
```typescript
originCityId:   integer("origin_city_id"),
originCityName: text("origin_city_name"),
```

### 2. DDL tenant baru — `packages/db/src/helpers/create-tenant-schema.ts`

Tambah 2 baris setelah `weight_gram INTEGER,` di definisi tabel `products` (baris ~952).

### 3. Migration tenant existing — `packages/db/migrations/0065_product_origin_city.sql`

Pola sama persis `0058_shipping_cod_pickup.sql` (loop tenant aktif, `ALTER TABLE ... ADD COLUMN
IF NOT EXISTS`):
```sql
DO $$
DECLARE r RECORD; t TEXT;
BEGIN
  FOR r IN SELECT slug FROM public.tenants WHERE is_active = true LOOP
    t := 'tenant_' || r.slug;
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS origin_city_id INTEGER', t);
    EXECUTE format('ALTER TABLE %I.products ADD COLUMN IF NOT EXISTS origin_city_name TEXT', t);
  END LOOP;
END;
$$;
```

### 4. Komponen baru — `apps/web/components/ui/rajaongkir-city-picker.tsx`

**Temuan penting**: combobox pencarian kota RajaOngkir (debounced fetch ke `/api/ongkir/cities`)
sudah DIDUPLIKASI independen 2×: `settings/addons/rajaongkir/config-form.tsx` (kota asal
default tenant) dan `akun/mitra/apply/page.tsx` (kota asal mitra saat daftar). Menambah field
ini di `product-form.tsx` akan jadi duplikat ke-3 kalau ditulis inline lagi — pola persis yang
sudah pernah bikin masalah di project ini (kode-unik/voucher, 3× implementasi independen,
`docs/arsitektur-voucher.md` § 16-18).

**Keputusan user (2026-09-15) — konsolidasi sekalian, bukan ditunda.** Ekstrak jadi SATU
komponen reusable (`<RajaOngkirCityPicker value={cityId} valueName={cityName} onChange={...} />`,
controlled, sama sekali tidak tahu soal produk/mitra/tenant — cuma cari+pilih kota), dipakai di
LOGIC BARU (`product-form.tsx`) DAN 2 tempat existing di-refactor dari inline ke komponen ini:
- `product-form.tsx` (BARU — pemicu ekstraksi ini)
- `settings/addons/rajaongkir/config-form.tsx` (refactor dari inline, baris ~56-71)
- `akun/mitra/apply/page.tsx` (refactor dari inline, baris ~37-63)

Risiko refactor 2 tempat existing: RENDAH — keduanya cuma UI (state cityId/cityName + hasil
pencarian), tidak menyentuh logic simpan/validasi apa pun. Selama komponen baru mempertahankan
behavior identik (debounce, minimal 2 karakter, endpoint `/api/ongkir/cities` yang sama), hasil
akhirnya sama persis dari sudut pandang admin/mitra yang memakainya — cuma sumber kode yang
disatukan.

### 5. Form produk — `apps/web/components/toko/product-form.tsx`

Tambah field baru "Kota Asal Pengiriman (opsional)" di bawah card "Stok & Berat" (baris ~516-544)
— pakai `<RajaOngkirCityPicker>`, placeholder "Pakai kota asal default toko". State baru
`originCityId`/`originCityName`, dikirim di `saveProductAction` (perlu tambah 2 field di payload
+ type `ProductFormValues` yang relevan).

### 6. Resolusi origin saat checkout — 2 titik (duplikasi pre-existing, BUKAN diperkenalkan sesi ini)

Dua tempat independen sudah membangun `SellerGroup` dengan logic identik (pre-existing
duplication, sudah begitu sebelum rencana ini — bukan sesuatu yang baru diperkenalkan):
- **Publik**: `apps/web/app/(public)/[tenant]/checkout/page.tsx` baris 181-261
- **Admin manual order**: `apps/web/app/(dashboard)/app/[tenant]/toko/pesanan/new/page.tsx` +
  `apps/web/components/toko/order-create-client.tsx`

Kedua tempat perlu patch YANG SAMA:
1. Query produk tambah `originCityId`/`originCityName` dari `products` (bukan cuma dari JOIN
   `mitras`).
2. Urutan resolusi (baris ~237-261 di `checkout/page.tsx`) — **produk mitra TIDAK PERNAH baca
   `product.originCityId`**, urutan mitra sama sekali tidak berubah dari sekarang:
   ```typescript
   if (d.mitraId && d.mitraOriginCityId) {
     // Produk mitra — SAMA PERSIS seperti sekarang, product.originCityId diabaikan
     sellerType = "mitra"; originCityId = d.mitraOriginCityId; originCityName = d.mitraOriginCityName ?? "";
   } else if (!d.mitraId && d.originCityId) {
     // BARU — produk tenant sendiri, override per-produk
     sellerType = "tenant"; originCityId = d.originCityId; originCityName = d.originCityName ?? "";
   } else if (!d.mitraId && config.origin_city_id) {
     // (sama seperti sekarang) fallback ke default toko
     sellerType = "tenant"; originCityId = config.origin_city_id; originCityName = config.origin_city_name ?? "";
   } else {
     continue; // kota asal tidak diketahui, skip (sama seperti sekarang)
   }
   ```
3. **`groupKey` WAJIB ikut memasukkan `originCityId`** (baris ~263), bukan cuma
   `sellerType:sellerId` — supaya 2 produk tenant dengan kota asal beda otomatis jadi 2
   `SellerGroup` terpisah (2 kartu "Paket dari..." di UI checkout), bukan tergabung salah:
   ```typescript
   const groupKey = `${sellerType}:${sellerId ?? "tenant"}:${originCityId}`;
   ```

**Tidak perlu ada perubahan** di `checkoutAction` (`cart/actions.ts`) — sudah generik menerima
`shipping.lines[]` apa adanya tanpa asumsi "cuma 1 seller-group tenant per invoice" (dikonfirmasi
baca kode, `sellerId` sudah nullable + tidak ada unique constraint di `invoice_shipping_lines`
yang membatasi baris `seller_type='tenant'` cuma boleh satu per invoice).

### Konsolidasi duplikasi checkout/admin-order (opsional, di luar scope fitur ini)

Dua tempat di atas SUDAH duplikat sebelum rencana ini (bukan pre-existing tapi memang sengaja
ditulis 2× waktu fitur COD/pickup & mitra origin dibangun). Menambah patch yang sama 2× lagi
menambah utang duplikasi, tapi mengonsolidasi jadi satu helper (`resolveSellerGroups()` di
`packages/db/src/helpers/shipping.ts`, dipakai kedua sisi) adalah refactor terpisah yang lebih
besar dan berisiko menyentuh 2 alur yang sudah jalan sekaligus. **Rekomendasi**: terima
duplikasi untuk sekarang (patch 2× seperti pola yang sudah ada), catat sebagai technical debt
di `docs/lessons-learned.md` kalau dieksekusi — konsolidasi penuh sebagai task terpisah nanti.

### Catatan di luar scope (ditemukan saat riset, bukan bagian rencana ini)

`checkoutAction` **mempercayai `line.cost` dari client apa adanya** (`cart/actions.ts`,
`cost: Math.max(0, line.cost).toFixed(2)`) — hanya re-validasi COD/pickup eligibility
server-side, TIDAK re-panggil RajaOngkir untuk verifikasi nominal ongkir. Ini gap pre-existing,
tidak berhubungan dengan per-produk origin, TIDAK termasuk scope rencana ini.

**Update (2026-09-15, security review sebelum push)**: `Math.max(0, ...)` ditambahkan
(`cart/actions.ts` + `toko/actions.ts` `createOrderAction`) untuk cegah `cost` negatif
mengurangi total invoice — mitigasi PARSIAL, bukan fix penuh (client masih bisa kirim `cost`
lebih kecil dari harga RajaOngkir sungguhan, cuma tidak bisa negatif). Detail:
`docs/lessons-learned.md` [2026-09-15]. Fix penuh (rekomputasi cost server-side ke RajaOngkir)
tetap belum dikerjakan.

### File yang Akan Tersentuh

```
packages/db/src/schema/tenant/shop.ts                                → +2 kolom products
packages/db/src/helpers/create-tenant-schema.ts                      → DDL tenant baru
packages/db/migrations/0065_product_origin_city.sql                  → BARU, migration tenant existing
apps/web/components/ui/rajaongkir-city-picker.tsx                    → BARU, komponen shared
apps/web/components/toko/product-form.tsx                            → field baru + payload
apps/web/app/(dashboard)/app/[tenant]/toko/actions.ts                → createProductAction/updateProductAction terima+simpan 2 field baru
apps/web/app/(public)/[tenant]/checkout/page.tsx                     → resolusi origin + groupKey
apps/web/app/(dashboard)/app/[tenant]/toko/pesanan/new/page.tsx      → sama, sisi admin
apps/web/components/toko/order-create-client.tsx                     → sama, sisi admin
docs/arsitektur-addon-ongkir.md                                      → dokumen ini
```

### Keputusan Final (user, 2026-09-15) — semua pertanyaan terbuka sudah dijawab

1. **Konsolidasi city-picker: YA, sekalian.** Komponen `<RajaOngkirCityPicker>` dipakai di 3
   tempat (product-form.tsx BARU + refactor config-form.tsx + refactor mitra/apply/page.tsx) —
   lihat § 4.
2. **Override HANYA berlaku produk tenant sendiri, TIDAK untuk produk mitra.** Alasan bisnis:
   mitra wajib jual produk milik/buatan sendiri (bukan dropship produk pihak lain), jadi satu
   mitra = satu kota asal tunggal, tidak ada kasus "produk mitra yang sama, gudang beda-beda"
   yang perlu diakomodasi. `product.originCityId` tidak pernah dibaca untuk produk yang
   `mitraId`-nya terisi — lihat § "Urutan resolusi" dan § 6.
3. **Per-produk saja, TIDAK per-variasi.** Semua variasi dari satu produk ikut kota asal produk
   induknya — tidak ada perluasan ke `product_variations` di rencana ini.

Rencana ini SUDAH FINAL secara desain, siap dieksekusi — menunggu sinyal eksekusi terpisah dari
user (belum diminta mulai kode di pesan yang menghasilkan revisi ini).

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

---

## Gratis Ongkir per Produk — ✅ Kode SELESAI (2026-09-15)

> Status: `bun run type-check` 0 error di semua workspace. Migration `0066` sudah dijalankan
> di dev lokal (kolom + CHECK constraint terverifikasi ada). **Belum diverifikasi visual di
> browser** (tidak ada kredensial login admin di sesi eksekusi). Belum di-commit/push. Konten
> di bawah dipertahankan apa adanya sebagai rencana yang sudah dieksekusi persis sesuai isinya —
> semua "RENCANA"/"BARU" di bawah artinya "sudah dikerjakan", bukan lagi rencana.

### Konsep

Admin bisa tandai produk (tenant sendiri) "Gratis Ongkir" dengan 2 mode:
1. **Semua daerah** — ongkir produk ini selalu gratis, ke mana pun.
2. **Daerah tertentu** — gratis hanya kalau tujuan customer ada di provinsi/kabupaten yang
   dipilih admin (harus cocok kode RajaOngkir, bukan kode BPS — konsisten dengan prinsip yang
   sudah dikunci di dokumen ini).

**Verifikasi API (2026-09-15, dites langsung ke endpoint produksi, bukan cuma dokumentasi
pihak ketiga)** — RajaOngkir v2 (Komerce) ternyata punya 2 endpoint list bersih terpisah dari
search kelurahan yang sudah dipakai untuk kota asal:
```
GET /destination/province            → [{id, name}], 34 provinsi. Dites: id=19 "DI YOGYAKARTA"
GET /destination/city/{province_id}  → [{id, name}], kabupaten/kota. Dites province_id=19 →
                                        id=260 "BANTUL", id=261 "SLEMAN", dst.
```
Berbeda dari `/destination/domestic-destination` (search kelurahan yang dipakai kota asal/tujuan
checkout) — endpoint itu **tidak** mengembalikan `province_id`/`city_id` numerik, cuma
`province_name`/`city_name` sebagai string. Dites juga (search "bantul"):
`{"id":31442,...,"province_name":"DI YOGYAKARTA","city_name":"BANTUL",...}` — tidak ada
`city_id`. Jadi **pencocokan tujuan customer vs daerah gratis-ongkir yang dipilih admin WAJIB
lewat NAMA** (bukan ID) — tapi ini aman, dua-duanya dari dataset RajaOngkir yang sama (bukan
lintas-sumber BPS vs RajaOngkir yang sudah jadi masalah kritis di dokumen ini sebelumnya),
dikonfirmasi nama identik persis ("BANTUL" di kedua endpoint).

### Desain: diskon proporsional-berat, BUKAN grup terpisah

Ongkir tetap dihitung NORMAL untuk seluruh berat SellerGroup (tetap satu paket fisik), lalu
dipotong sebesar porsi berat item yang gratis-ongkir untuk tujuan itu:
```
freeWeightShare = Σ(berat item gratis-ongkir yang eligible) / totalWeightGram grup
ongkirFinal      = round(ongkirNormal × (1 − freeWeightShare))
```
Kenapa ini lebih baik dari "grup dipisah jadi Rp0 kalau ada produk gratis": rumus yang sama
otomatis menangani KEDUA kasus tanpa cabang logic terpisah — keranjang campur produk gratis +
biasa → ongkir tetap ada tapi lebih murah (bukan 0 penuh, bukan diabaikan); keranjang isinya
SEMUA produk gratis-ongkir → `freeWeightShare = 1` → ongkir otomatis Rp0, dari rumus yang sama.

**Keputusan scope (default, konsisten dengan kota asal)**: fitur ini KHUSUS produk tenant
sendiri — `product-form.tsx` (tempat field ini ditambahkan) memang HANYA pernah dipakai untuk
produk tenant (dikonfirmasi tidak pernah dipakai render/edit produk mitra), jadi otomatis
ter-scope tanpa perlu guard `mitraId` eksplisit — sama seperti kota asal. **Belum ditanyakan
eksplisit ke user apakah mitra juga perlu fitur ini** — kalau nanti diminta, itu perluasan
terpisah (form produk mitra sendiri yang perlu field serupa).

### 1. Schema — `packages/db/src/schema/tenant/shop.ts`

Tambah di `createProductsTable()`, setelah `originCityName`:
```typescript
export const FREE_SHIPPING_MODES = ["none", "all", "regions"] as const;
export type  FreeShippingMode    = typeof FREE_SHIPPING_MODES[number];
export type  FreeShippingRegion  = { id: number; name: string }; // id = RajaOngkir province/city id

// ... di createProductsTable():
freeShippingMode:      text("free_shipping_mode", { enum: FREE_SHIPPING_MODES }).notNull().default("none"),
freeShippingProvinces: jsonb("free_shipping_provinces").$type<FreeShippingRegion[]>(),
freeShippingCities:    jsonb("free_shipping_cities").$type<FreeShippingRegion[]>(),
```

Tambah juga 1 kolom nullable di `createInvoiceShippingLinesTable()` (`packages/db/src/schema/tenant/billing.ts`) — nominal yang dihemat, untuk transparansi tampilan ("Hemat RpX"), TIDAK dipakai untuk hitung ulang apa pun (murni display, `cost` yang dikirim tetap angka final):
```typescript
freeShippingDiscount: numeric("free_shipping_discount", { precision: 15, scale: 2 }),
```

### 2. DDL tenant baru + Migration `0066_product_free_shipping.sql`

Pola sama `0065`. Tambah ke `create-tenant-schema.ts` (tabel `products`) DAN migration baru
(loop tenant aktif, `products` + `invoice_shipping_lines`).

### 3. API baru — proxy list provinsi/kabupaten (BUKAN search kelurahan yang sudah ada)

```
GET /api/ongkir/provinces                     → proxy GET /destination/province
GET /api/ongkir/cities-by-province?provinceId= → proxy GET /destination/city/{provinceId}
```
Penamaan sengaja dibedakan dari `/api/ongkir/cities` yang sudah ada (itu search kelurahan) —
supaya tidak ambigu. Pola sama persis `cities/route.ts` (baca `RAJAONGKIR_PLATFORM_KEY` dari
ENV, tidak pernah ke browser, `cache: "no-store"`).

### 4. UI admin — komponen baru `apps/web/components/toko/free-shipping-picker.tsx`

Dipakai di `product-form.tsx`, section baru di bawah "Kota Asal Pengiriman":
- Radio 3 opsi: **Tidak** / **Semua Daerah** / **Daerah Tertentu**
- Kalau "Daerah Tertentu":
  - Checkbox list Provinsi — fetch penuh 34 provinsi sekali (`/api/ongkir/provinces`), filter
    client-side by teks (dataset kecil, tidak perlu debounce server).
  - Kabupaten/Kota — dropdown "pilih provinsi untuk browse" (single-select) → fetch
    `/api/ongkir/cities-by-province?provinceId=`, tampil checkbox kota-kota provinsi itu.
    Kota yang dicentang terkumpul di state terpisah (chip list, bisa browse provinsi lain tanpa
    kehilangan pilihan kota dari provinsi sebelumnya — akumulatif, bukan reset per provinsi).
- State: `{id,name}[]` untuk provinsi & kota, dikirim apa adanya ke `originCityId`-sibling
  pattern (id+name disimpan bareng, sama seperti kota asal).

### 5. Form produk + actions — `product-form.tsx`, `toko/actions.ts`, edit/new page

Sama pola field kota asal: state baru di `ProductForm`, masuk `ProductData` payload, disimpan di
`createProductAction`/`updateProductAction`, di-fetch balik di halaman edit.

### 6. Checkout — bawa config gratis-ongkir per item, hitung diskon di client

**`checkout/page.tsx`** (server) — tambah 3 kolom baru ke query `productDetails` (dari
`ts.products`), teruskan ke `SellerGroup.items[]` (tipe `CartItem` di `cart/actions.ts` perlu
field `freeShippingMode`/`freeShippingProvinces`/`freeShippingCities` juga). **Grouping/groupKey
TIDAK berubah** — diskon ini murni post-processing cost, bukan pemisah grup (beda dari kota
asal yang memang harus split grup).

**`checkout-form.tsx`** (client) — di `fetchCouriers`, setelah dapat `options` mentah dari
`/api/ongkir/cost`, hitung `freeShippingRatio(group, destCity)`:
```typescript
function isItemFree(item: SellerGroupItem, dest: { provinceName: string; cityName: string }): boolean {
  if (item.freeShippingMode === "all") return true;
  if (item.freeShippingMode !== "regions") return false;
  const up = (s: string) => s.toUpperCase();
  return !!(
    item.freeShippingProvinces?.some(p => up(p.name) === up(dest.provinceName)) ||
    item.freeShippingCities?.some(c => up(c.name) === up(dest.cityName))
  );
}
function freeShippingRatio(group: SellerGroup, dest: {provinceName:string; cityName:string}): number {
  if (group.totalWeightGram <= 0) return 0;
  const freeWeight = group.items.reduce((s, it) =>
    s + (isItemFree(it, dest) ? it.weightGram * it.quantity : 0), 0);
  return freeWeight / group.totalWeightGram;
}
```
Terapkan rasio ini ke SEMUA opsi kurir sebelum disimpan ke `groupStates` (bukan cuma yang
terpilih) — supaya harga yang tampil di daftar pilihan kurir SUDAH final/diskon, customer
membandingkan harga yang benar:
```typescript
const ratio   = freeShippingRatio(group, dest);
const options = ratio > 0
  ? rawOptions.map(o => ({ ...o, cost: Math.round(o.cost * (1 - ratio)), rawCost: o.cost }))
  : rawOptions.map(o => ({ ...o, rawCost: o.cost }));
```
`CourierOption` tipe tambah field `rawCost?: number` (harga sebelum diskon, buat tampilan
coret "~~Rp20.000~~ Rp12.000 · Hemat Rp8.000"). `CheckoutShippingLine` tambah field
`freeShippingDiscount?: number` = `rawCost - cost` (kalau ada), diteruskan ke `checkoutAction`
→ disimpan di kolom baru `invoice_shipping_lines.free_shipping_discount` (murni display,
TIDAK dipakai validasi apa pun server-side — sama seperti `cost` yang memang sudah dipercaya
dari client, dicatat sebagai gap pre-existing di rencana sebelumnya).

**Butuh perubahan kecil**: `destCity` state di `checkout-form.tsx` saat ini cuma simpan
`{id, name}` (label gabungan) — perlu diperluas jadi `{id, name, provinceName, cityName}` biar
bisa dipakai match (`city.provinceName`/`city.cityName` sudah ada di `CityResult`, tinggal
disimpan juga saat `setDestCity(...)` dipanggil).

### 7. Admin manual order — `order-create-client.tsx` (untuk konsistensi, pola sama)

`destCity` di sini SUDAH menyimpan `CityResult` penuh (beda dari checkout publik) — jadi
`provinceName`/`cityName` sudah tersedia tanpa perlu ubah state. Tambah `originCityId`-sibling
fields ke `ProductOption` (freeShippingMode/Provinces/Cities), terapkan `freeShippingRatio` yang
sama di `fetchCouriers` lokal. Variasi (synthetic `ProductOption` dari `PickedVariation`) ikut
config produk induk — sama seperti kota asal.

### File yang Akan Tersentuh

```
packages/db/src/schema/tenant/shop.ts                                → +3 kolom products
packages/db/src/schema/tenant/billing.ts                              → +1 kolom invoice_shipping_lines
packages/db/src/helpers/create-tenant-schema.ts                       → DDL tenant baru (2 tabel)
packages/db/migrations/0066_product_free_shipping.sql                 → BARU
apps/web/app/api/ongkir/provinces/route.ts                            → BARU
apps/web/app/api/ongkir/cities-by-province/route.ts                   → BARU
apps/web/components/toko/free-shipping-picker.tsx                     → BARU
apps/web/components/toko/product-form.tsx                             → field baru
apps/web/app/(dashboard)/app/[tenant]/toko/actions.ts                 → ProductData + create/update
apps/web/app/(dashboard)/app/[tenant]/toko/produk/[id]/edit/page.tsx  → initialData
apps/web/app/(dashboard)/app/[tenant]/toko/produk/new/page.tsx        → initialData
apps/web/app/(public)/[tenant]/cart/actions.ts                        → SellerGroup.items[] tipe baru
apps/web/app/(public)/[tenant]/checkout/page.tsx                      → query + teruskan field baru
apps/web/components/billing/checkout-form.tsx                         → hitung diskon, destCity diperluas
apps/web/app/(dashboard)/app/[tenant]/toko/pesanan/new/page.tsx       → sama, sisi admin
apps/web/components/toko/order-create-client.tsx                      → sama, sisi admin
docs/arsitektur-addon-ongkir.md                                       → dokumen ini
```

### Di luar scope (dicatat, bukan dikerjakan)

- Tampilan "Hemat RpX" di halaman invoice publik/admin (kolom DB sudah ada, render-nya belum —
  follow-up cepat kalau diminta).
- Berlaku untuk produk mitra — belum diputuskan, default TIDAK (lihat § scope di atas).
- Voucher + gratis-ongkir bersamaan — dua mekanisme independen (voucher potong harga barang,
  ini potong ongkir), tidak ada interaksi khusus yang perlu ditangani, tapi belum dites kombinasi
  keduanya secara eksplisit.
