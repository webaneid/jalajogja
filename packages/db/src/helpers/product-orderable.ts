import { sql, type SQL } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";

// Produk BOLEH dipesan/ditampilkan publik hanya bila produsennya tidak dinonaktifkan admin.
// Aturan (keputusan user 2026-10-31, docs/arsitektur-portal-produsen.md § 8 + § 14):
//   products.producer_id NULL            → produsen internal (tenant sendiri) → selalu boleh
//   producers.is_active = true           → boleh
//   producers.is_active = false          → TIDAK boleh: hilang dari etalase, ditolak di keranjang/checkout
// Dihitung saat dibaca (bukan menulis ulang status tiap produk) → mengaktifkan kembali langsung memulihkan.
// Pemakaian: tambahkan ke WHERE query publik atas `schema.products`:  and(..., producerActiveSql(schema)).
// NOT EXISTS (bukan JOIN): produk tanpa produsen / produsen aktif tetap lolos tanpa mengubah bentuk query.
export function producerActiveSql(schema: TenantDb["schema"]): SQL {
  return sql`NOT EXISTS (SELECT 1 FROM ${schema.producers} WHERE ${schema.producers.id} = ${schema.products.producerId} AND ${schema.producers.isActive} = false)`;
}
