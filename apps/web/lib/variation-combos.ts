// Bagian MURNI: kombinasi variasi dari atribut (cartesian product) — dipakai form produsen (klien) dan setara dengan
// generateVariationsAction milik admin (yang butuh akses tenant). Kombinasi yang sudah ada dipertahankan apa adanya.
import type { VariationLocal } from "@/components/toko/variation-table";

export type AttrGroup = { name: string; values: string[] };

export function buildVariationCombos(groups: AttrGroup[], existing: VariationLocal[]): VariationLocal[] {
  const combos = groups.reduce<Record<string, string>[]>((acc, g) => {
    if (acc.length === 0) return g.values.map((v) => ({ [g.name]: v }));
    return acc.flatMap((c) => g.values.map((v) => ({ ...c, [g.name]: v })));
  }, []);
  const byKey = new Map(existing.map((v) => [JSON.stringify(v.attributeCombo), v]));
  return combos.map((combo) => byKey.get(JSON.stringify(combo)) ?? {
    _key: crypto.randomUUID(), sku: "", price: "", publicPrice: "", memberPrice: "", stock: "0", weightGram: "",
    images: [], attributeCombo: combo, isActive: true,
  });
}

/** Foto Media Library anggota → bentuk foto produk di form. URL hanya untuk pratinjau; server me-resolve ulang dari id. */
export function memberMediaToImage(item: { id: string; url: string; variants?: Record<string, string> | null; originalName?: string }, order: number) {
  return { id: item.id, url: item.url, variants: item.variants ?? null, alt: "", order };
}
