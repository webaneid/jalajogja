# Arsitektur Order Fulfillment

> **Dokumen terkait:**
> - `docs/arsitektur-billing.md` — alur invoice, payment, verifikasi bukti
> - `docs/arsitektur-addon-ongkir.md` — RajaOngkir v2 integration, seller groups, ongkir
> - `docs/arsitektur-mitra.md` — mitra fulfillment (sellerType='mitra', dikelola mitra sendiri)

## Latar Belakang

Setelah pembayaran lunas, pesanan produk fisik harus melalui alur fulfillment:
diproses → dikemas → dikirim (input resi) → diterima pelanggan.

Dokumen ini mencakup:
- 5-stage fulfillment status
- Halaman admin fulfillment
- Tracking di sisi pelanggan (front-end)
- Rencana notifikasi WhatsApp
- Rencana integrasi RajaOngkir tracking

---

## 1. 5-Stage Fulfillment Flow

Status disimpan di kolom `status` tabel `invoice_shipping_lines` per tenant schema.

```
pending → processing → packed → shipped → delivered
```

| Status | Label Admin | Arti | Timestamp |
|--------|------------|------|-----------|
| `pending` | Menunggu | Belum diproses | — |
| `processing` | Diproses | Admin sedang menyiapkan item | — |
| `packed` | Dikemas | Barang sudah dikemas, siap pickup | — |
| `shipped` | Dikirim | Resi sudah diinput, barang di tangan kurir | `shippedAt` |
| `delivered` | Diterima | Pelanggan mengonfirmasi penerimaan | `deliveredAt` |

**Aturan transisi:**
- Hanya boleh maju satu langkah (tidak boleh skip)
- Transisi ke `shipped` wajib ada `trackingNumber` (resi AWB)
- Transisi hanya diizinkan jika invoice sudah berstatus `paid`
- Hanya shipping lines dengan `sellerType = 'tenant'` yang dikelola dari dashboard ini
- Shipping lines `sellerType = 'mitra'` dikelola oleh mitra dari `/akun/mitra/pesanan`

---

## 2. Tabel Schema

Tidak ada tabel baru. Semua state disimpan di `invoice_shipping_lines` yang sudah ada:

```sql
-- Kolom yang relevan:
status        TEXT CHECK (status IN ('pending','processing','packed','shipped','delivered'))
tracking_number TEXT                       -- resi AWB
shipped_at    TIMESTAMP WITH TIME ZONE    -- diisi saat status → shipped
delivered_at  TIMESTAMP WITH TIME ZONE    -- diisi saat status → delivered
updated_at    TIMESTAMP WITH TIME ZONE    -- diupdate setiap transisi
```

---

## 3. Server Actions

File: `apps/web/app/(dashboard)/[tenant]/finance/billing/actions.ts`

### `updateFulfillmentStatusAction(slug, shippingLineId, newStatus, trackingNumber?)`

Validasi:
1. Cek `sellerType = 'tenant'`
2. Cek invoice sudah `paid`
3. Cek transisi valid (hanya maju satu langkah)
4. Jika `shipped`: wajib `trackingNumber`

Side effects:
- Set `shippedAt` saat `shipped`
- Set `deliveredAt` saat `delivered`
- `revalidatePath` untuk pesanan list + billing

### `updateAdminShippingTrackingAction(slug, shippingLineId, trackingNumber)`

Khusus update resi tanpa trigger stage transition.
Dipakai di: admin invoice detail (billing) dan edit resi setelah shipped.

---

## 4. Route Admin

### List Pesanan (`/toko/pesanan`)
- Tabel atas: old `orders` (sistem lama) → link ke `/toko/pesanan/[id]`
- Tabel bawah "Pesanan via Keranjang": cart invoices → link ke **`/toko/pesanan/invoice/[invoiceId]`**

### Fulfillment Page (`/toko/pesanan/invoice/[invoiceId]`)

File: `apps/web/app/(dashboard)/[tenant]/toko/pesanan/invoice/[invoiceId]/page.tsx`

Menampilkan:
- Info pelanggan + alamat kirim
- Daftar item yang dipesan (produk + thumbnail)
- Rincian biaya (subtotal + ongkir + diskon + total)
- **Fulfillment Cards** — satu kartu per shipping line dengan timeline visual
- Link ke invoice detail billing untuk keperluan pembayaran

Hanya untuk `sourceType = 'cart'`. Invoice non-cart di-redirect ke `/finance/billing/invoice/[id]`.

### Fulfillment Client Component

File: `apps/web/components/toko/fulfillment-client.tsx`

Komponen `FulfillmentCard` berisi:
- **`FulfillmentTimeline`** — 5 langkah visual (filled/active/pending)
- **`FulfillmentActions`** — tombol aksi sesuai stage saat ini:
  - `pending` → tombol "Proses Pesanan"
  - `processing` → tombol "Selesai Packing"
  - `packed` → input resi + tombol "Kirim"
  - `shipped` → edit resi + tombol "Konfirmasi Diterima"
  - `delivered` → pesan selesai

---

## 5. Tracking di Sisi Pelanggan (Front-End)

### Status saat ini ✅
Halaman `/akun/transaksi` sudah menampilkan:
- Daftar item yang dibeli (per invoice)
- Shipping lines per invoice: status (`pending/shipped/delivered`), nama kurir, resi AWB

File: `apps/web/app/(public)/[tenant]/akun/transaksi/page.tsx`
API: `apps/web/app/api/akun/transaksi/route.ts`

**Yang perlu ditambahkan (belum):**
- Status `processing` dan `packed` di peta visual pelanggan
- Tombol "Konfirmasi Terima" di sisi pelanggan
- Link tracking kurir external (Tokopedia/Shopee style)

### Rencana: RajaOngkir Tracking (belum diimplementasi)

**Endpoint RajaOngkir v2:** `POST https://rajaongkir.komerce.id/api/v1/track/waybill`

```
Headers: key: {RAJAONGKIR_PLATFORM_KEY}
Body: { waybill: "{resi}", courier: "{courier_code}" }
Response: { status, summary, manifest[] }
```

**Implementasi rencana:**
- Route handler: `GET /api/ongkir/track?waybill={resi}&courier={courier}` — proxy server-side
- Dipanggil dari halaman publik `/akun/transaksi` atau halaman invoice publik
- Cache hasil 10 menit (Next.js `fetch` dengan `revalidate: 600`)
- Tampilkan: status terkini + manifest riwayat pengiriman

**Aturan keamanan:**
- `RAJAONGKIR_PLATFORM_KEY` TIDAK PERNAH dikirim ke browser
- Semua request ke RajaOngkir via proxy server-side
- Rate limit per IP di route handler (belum diimplementasi)

**Format response untuk pelanggan:**
```typescript
type TrackingResult = {
  status:    "pending" | "in_transit" | "delivered" | "problem";
  summary:   string;           // "Paket dalam perjalanan"
  lastUpdate: string;          // ISO timestamp
  history:   {
    date:        string;
    time:        string;
    description: string;
    city:        string;
  }[];
};
```

---

## 6. Notifikasi WhatsApp (Rencana — Belum Diimplementasi)

Notifikasi WA dikirim pada setiap transisi status fulfillment yang relevan.

**Dependency:** Add-on WhatsApp harus aktif di tenant.

### Tabel notifikasi yang direncanakan

| Event | Penerima | Pesan |
|-------|---------|-------|
| `processing` | Pelanggan | "Pesanan Anda {no} sedang kami siapkan." |
| `packed` | Pelanggan | "Pesanan Anda {no} sudah dikemas, segera kami kirim." |
| `shipped` | Pelanggan | "Pesanan Anda {no} sudah dikirim via {kurir} {service}. Resi: {resi}." |
| `delivered` (by admin) | Pelanggan | "Pesanan Anda {no} sudah diterima. Terima kasih!" |
| Baru masuk (paid) | Admin | "Pesanan baru {no} dari {nama} — Rp {total}" |

### Implementasi rencana

```typescript
// lib/whatsapp-notification.ts (belum ada)
async function notifyFulfillment(
  tenantDb: TenantDb,
  slug: string,
  invoiceId: string,
  newStatus: ShippingStatus,
  trackingNumber?: string,
) {
  // 1. Cek addon WA aktif + quota
  // 2. Fetch customer phone dari invoice.customerPhone
  // 3. Build pesan dari template
  // 4. POST ke {WHATSAPP_SERVICE_URL}/send (go-whatsapp-web-multidevice)
  // 5. Update addon_usage count
}
```

Dipanggil dari `updateFulfillmentStatusAction` setelah update DB berhasil (fire-and-forget).

---

## 7. Diagram Alur Lengkap

```
Pelanggan checkout → Invoice created (status=pending)
                  ↓
Pelanggan upload bukti → Payment submitted → Invoice waiting_verification
                  ↓
Admin verifikasi → Invoice paid
                  ↓
                  ┌─────────────────────────────────────────────────────┐
                  │  Admin: /toko/pesanan/invoice/{id}                  │
                  │                                                      │
                  │  [Proses Pesanan]  → shipping.status = processing   │
                  │  [Selesai Packing] → shipping.status = packed        │
                  │  [Input Resi]      → shipping.status = shipped       │
                  │  [Konfirmasi Terima] → shipping.status = delivered   │
                  └─────────────────────────────────────────────────────┘
                  ↓ setiap transisi
        Notifikasi WA ke pelanggan (jika addon aktif)
                  ↓
                  ┌─────────────────────────────────────────────────────┐
                  │  Pelanggan: /akun/transaksi                         │
                  │  - Lihat status: Menunggu / Dikirim / Diterima      │
                  │  - Lihat resi + nama kurir                          │
                  │  - Tracking detail via RajaOngkir (rencana)         │
                  └─────────────────────────────────────────────────────┘
```

---

## 8. Status Implementasi

| Fitur | Status |
|-------|--------|
| Schema `invoice_shipping_lines` 5 status | ✅ SELESAI |
| `updateFulfillmentStatusAction` | ✅ SELESAI |
| Admin fulfillment page | ✅ SELESAI |
| `FulfillmentCard` + Timeline UI | ✅ SELESAI |
| Link pesanan list → fulfillment page | ✅ SELESAI |
| Tracking pelanggan di `/akun/transaksi` (status + resi) | ✅ SELESAI |
| Status `processing` + `packed` di UI pelanggan | ⬜ BELUM |
| Tombol "Konfirmasi Terima" di sisi pelanggan | ⬜ BELUM |
| RajaOngkir tracking proxy (`/api/ongkir/track`) | ⬜ BELUM |
| Notifikasi WhatsApp per stage | ⬜ BELUM |
| Rate limit tracker API | ⬜ BELUM |
