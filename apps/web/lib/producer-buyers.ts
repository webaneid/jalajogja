// Proyeksi data pembeli untuk PRODUSEN — ALLOW-LIST (memilih field yang diizinkan, BUKAN membuang yang sensitif), dijalankan
// di server sebelum data menyentuh komponen/props apa pun. Doc: docs/arsitektur-portal-produsen.md § 17.
//
// Boleh: nomor invoice, tanggal, nama pembeli, nomor HP, item + varian + jumlah, metode pengiriman, ALAMAT CHECKOUT (alamat tujuan
// transaksi ini). TIDAK PERNAH: uang apa pun (harga, subtotal, voucher, kode unik, total dibayar, ongkir, modal/laba), "Alamat User"
// (alamat rumah profil anggota), id internal (invoiceId/memberId), item produk lain dalam invoice yang sama.
// Hanya pesanan LUNAS — produsen tidak boleh mengirim barang yang belum dibayar. Fungsi ini juga menyaring ulang (defense in depth)
// walau pemanggil sudah memakai resolveProductBuyers({ includeAll: false }).
import type { ProductBuyerRow } from "@/lib/product-buyers.server";

export type ProducerBuyerRow = {
  invoiceNumber: string;
  createdAt:     Date;
  customerName:  string;
  customerPhone: string | null;
  itemName:      string;
  variantLabel:  string;
  quantity:      number;
  shippingLabel: string;
  address:       string;
};

export function toProducerBuyerRows(rows: ProductBuyerRow[]): ProducerBuyerRow[] {
  return rows
    .filter((r) => r.paymentStatusLabel === "Lunas")
    .map((r): ProducerBuyerRow => ({
      invoiceNumber: r.invoiceNumber,
      createdAt:     r.createdAt,
      customerName:  r.customerName,
      customerPhone: r.customerPhone,
      itemName:      r.itemName,
      variantLabel:  r.variantLabel,
      quantity:      r.quantity,
      shippingLabel: r.shippingLabel,
      address:       r.checkoutAddress,
    }));
}
