# ADR-0005: Pengiriman per Produsen — Satu Pengiriman (Baris Pengiriman) per Produsen per Invoice

**Status:** Accepted (keputusan user 2026-11-01; belum dieksekusi — fase di `docs/arsitektur-portal-produsen.md` § 24)
**Tanggal:** 2026-11-01

## Context
Produsen = gudang tenant (`docs/arsitektur-portal-produsen.md` § 18): tiap produsen menyimpan dan MENGIRIM barangnya sendiri dari gudang sendiri.
Satu pesanan pelanggan bisa memuat barang dari lebih dari satu produsen (A dari produsen 1, B dari produsen 2) → harus dikirim terpisah:
ongkir masing-masing, resi masing-masing, status masing-masing. Model lama mengelompokkan ongkir menurut `penjual:id:kota-asal` sehingga:
- dua produsen di kota gudang yang sama / sama-sama tanpa gudang digabung jadi SATU paket (salah);
- baris pengiriman (`invoice_shipping_lines`) tidak mencatat produsennya, sehingga fitur portal (batch, label, resi, daftar Pesanan) menganggap
  satu invoice hanya punya satu baris pengiriman tenant → invoice multi-produsen ditandai "Campuran" dan TIDAK BISA diproses produsen mana pun;
- tautan batch `producer_shipment_invoices` UNIQUE(invoice_id) → satu invoice tak bisa masuk dua batch produsen berbeda.

## Decision
- **Satuan operasional = pengiriman (satu baris `invoice_shipping_lines`) per produsen**, bukan invoice. Pembayaran tetap SATU invoice (pelanggan membayar sekali).
- `invoice_shipping_lines.producer_id` dan `invoice_items.producer_id` (nullable; NULL = barang toko sendiri/internal atau produk mitra) dicatat sebagai SNAPSHOT
  saat checkout (turunan `products.producer_id` dihitung SERVER, bukan dipercaya dari klien).
- **Kelompok ongkir saat checkout = produsen** (selalu terpisah, walau gudang sekota/segudang — keputusan user); barang tanpa produsen = satu kelompok toko.
  Judul paket untuk pelanggan tetap "Paket dari {kota asal}" (identitas produsen tak diperlihatkan).
- **Batch berisi PENGIRIMAN**, bukan invoice: `producer_shipment_invoices` mendapat `shipping_line_id` (UNIQUE) menggantikan UNIQUE(invoice_id).
- Status, resi, foto resi, label, COD, notifikasi bekerja per pengiriman (compare-and-set berdasarkan `shipping_line_id`).
- "Campuran" hanya berarti: invoice juga memuat barang yang bukan milik produsen itu DAN dikirim lewat baris pengiriman yang sama (kasus lama) atau penjual mitra.
- **Ambil di tempat** mengikuti gudang produsen per paket (fallback: lokasi produk/toko seperti sekarang).
- **Pesanan lama tidak dimigrasi penuh:** baris lama diisi `producer_id` otomatis hanya bila semua item produk di baris itu milik tepat satu produsen; selebihnya tetap
  dianggap campuran dan ditangani admin.

## Alternatif yang Dipertimbangkan
- **Memecah invoice per produsen** — ditolak: pelanggan membayar berkali-kali, verifikasi pembayaran & jurnal berlipat.
- **Mempertahankan satu baris pengiriman per invoice** — ditolak: tidak bisa mencerminkan dua gudang/dua resi.
- **Memakai `sellerId` sebagai id produsen (sellerType='tenant')** — ditolak: `sellerId` NULL bermakna "tenant" di perhitungan COD/laporan dan logika mitra; kolom
  `producer_id` terpisah tidak menabrak semantik lama.
- **Menggabung pengiriman bila gudang persis sama** — ditolak (keputusan user): siapa yang mengirim/resi/label menjadi ambigu.

## Konsekuensi
- Perubahan besar lintas: checkout publik, pesanan manual admin, fulfillment admin, tabel batch (migration), loader portal, label, resi, laporan/ekspor, notifikasi PJ.
- Migration additif (kolom nullable + kolom link batch + indeks); aman dijalankan sebelum kode.
- Checkout adalah jalur uang → tiap fase diuji dengan matriks skenario + audit keamanan sebelum commit.
