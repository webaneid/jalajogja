"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Package } from "lucide-react";
import { deleteProductAction } from "@/app/(dashboard)/app/[tenant]/toko/actions";

export type ProductRow = {
  id:          string;
  name:        string;
  sku:         string | null;
  thumbUrl:    string | null;
  priceLabel:  string;
  stock:       number;
  productType: string;
  status:      string;
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active:   { label: "Aktif",      variant: "default"   },
  draft:    { label: "Draft",      variant: "secondary" },
  archived: { label: "Diarsipkan", variant: "outline"   },
};

const TYPE_MAP: Record<string, string> = {
  simple:   "Simple",
  variable: "Variasi",
};

export function ProductTable({ slug, products: initialProducts }: { slug: string; products: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [delId,    setDelId]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(productId: string, name: string) {
    if (!confirm(`Hapus produk "${name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelId(productId);
    startTransition(async () => {
      const res = await deleteProductAction(slug, productId);
      if (res.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        alert(res.error);
      }
      setDelId(null);
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">Belum ada produk</p>
        <p className="text-xs text-muted-foreground mt-1">Klik &quot;Produk Baru&quot; untuk mulai.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3" />
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produk</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Harga</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stok</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipe</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((p) => {
            const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "outline" as const };
            return (
              <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="h-12 w-12 rounded-md border border-border bg-muted/30 overflow-hidden shrink-0">
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium truncate max-w-[280px]">{p.name}</div>
                  {p.sku && <div className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{p.priceLabel}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.stock}</td>
                <td className="px-4 py-3 text-muted-foreground">{TYPE_MAP[p.productType] ?? p.productType}</td>
                <td className="px-4 py-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Link href={`/app/${slug}/toko/produk/${p.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Lihat pembeli">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link href={`/app/${slug}/toko/produk/${p.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit produk">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id, p.name)}
                      disabled={isPending && delId === p.id}
                      title="Hapus produk"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
