// Tab "Detail Produk" — foto, harga, stok, variasi, deskripsi. BACA-SAJA, dipakai admin & produsen (data produk milik
// produsen terbuka seluruhnya baginya — keputusan user D3). Deskripsi dirender lewat renderBody (disanitasi).
import { Package } from "lucide-react";
import { renderBody } from "@/lib/letter-render";
import type { ProductDetailData } from "@/lib/product-detail.server";
import { rupiah } from "./format";

// `showCost` = tampilkan Harga Dasar (MODAL). Admin: hanya hasFullAccess(toko) (modal = rahasia bisnis, pengguna baca-saja tidak
// boleh melihatnya); produsen: true (itu harga kesepakatannya sendiri — keputusan D3).
export function TabDetail({ product, tenantSlug, showCost }: { product: ProductDetailData; tenantSlug: string; showCost: boolean }) {
  const dt = (d: Date) => d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const rows: [string, string][] = [
    ...(showCost ? [["Harga Dasar", rupiah(product.price)] as [string, string]] : []),
    ["Harga Publik", rupiah(product.publicPrice)],
    ["Harga Anggota", product.memberPrice != null ? `${rupiah(product.memberPrice)}${product.memberPriceTenantOnly ? " (khusus anggota tenant ini)" : " (semua anggota IKPM)"}` : "—"],
    ["Stok", String(product.stock)],
    ["Berat", product.weightGram ? `${product.weightGram} gram` : "—"],
    ["Kategori", product.categoryName ?? "—"],
    ["Tipe", product.productType === "variable" ? "Bervariasi" : "Biasa"],
    ["Diperbarui", dt(product.updatedAt)],
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-2 content-start">
        {product.images.length === 0 ? (
          <div className="col-span-full flex aspect-square items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground/40"><Package className="h-10 w-10" /></div>
        ) : product.images.map((img, i) => {
          const src = img.variants?.["square-large"] ?? img.variants?.square ?? img.url;
          return src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={img.alt || product.name} className={`w-full rounded-lg border border-border object-cover aspect-square ${i === 0 ? "col-span-full" : ""}`} />
          ) : null;
        })}
      </div>

      <div className="space-y-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1 last:border-0 sm:[&:nth-last-child(2)]:border-0">
              <dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {product.description && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Deskripsi</h2>
            <div className="prose prose-sm max-w-none rounded-lg border border-border bg-card p-4"
              dangerouslySetInnerHTML={{ __html: renderBody(product.description, {
                imageBaseUrl: `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${tenantSlug}`,
                tenantSlug,
                baseUrl: `/${tenantSlug}`,
              }) }} />
          </section>
        )}

        {product.variations.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Variasi ({product.variations.length})</h2>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr><th className="p-3">Variasi</th><th className="p-3">SKU</th>{showCost && <th className="p-3">Harga Dasar</th>}<th className="p-3">Harga Publik</th><th className="p-3">Stok</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody>
                  {product.variations.map((v) => (
                    <tr key={v.id} className={`border-t border-border ${v.isActive ? "" : "opacity-60"}`}>
                      <td className="p-3">{Object.values(v.attributeCombo).join(" / ") || "—"}</td>
                      <td className="p-3">{v.sku ?? "—"}</td>
                      {showCost && <td className="p-3 whitespace-nowrap">{v.price != null ? rupiah(v.price) : "ikut produk"}</td>}
                      <td className="p-3 whitespace-nowrap">{v.publicPrice != null ? rupiah(v.publicPrice) : "ikut produk"}</td>
                      <td className="p-3">{v.stock}</td>
                      <td className="p-3">{v.isActive ? "Aktif" : "Nonaktif"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
