// Penentuan produsen untuk tiap baris pengiriman saat checkout/pesanan manual — ADR-0005 (pengiriman per produsen).
// Baris pengiriman datang dari KLIEN; produsen yang sah untuk sebuah baris HANYA yang memang memiliki barang tenant di keranjang
// (produsen tiap item diturunkan SERVER dari products.producer_id lewat resolveProductCartItem). Murni fungsi — mudah diuji.
export type LineProducerInput = { sellerType: "tenant" | "mitra"; producerId?: string | null };

export type LineProducersResult = { ok: true; producerIds: (string | null)[] } | { ok: false; error: string };

/**
 * @param lines                 baris pengiriman dari klien
 * @param tenantItemProducerIds producerId (server) tiap item produk penjual TENANT di keranjang; null = barang toko/internal
 */
export function resolveLineProducers(lines: LineProducerInput[], tenantItemProducerIds: (string | null)[]): LineProducersResult {
  const allowed = new Set<string | null>(tenantItemProducerIds);
  const producerIds: (string | null)[] = [];
  for (const line of lines) {
    if (line.sellerType === "mitra") { producerIds.push(null); continue; } // pengiriman mitra tak pernah punya produsen
    const p = line.producerId ?? null;
    if (!allowed.has(p)) {
      return { ok: false, error: "Data pengiriman tidak sesuai isi keranjang. Muat ulang halaman checkout lalu coba lagi." };
    }
    producerIds.push(p);
  }
  return { ok: true, producerIds };
}
