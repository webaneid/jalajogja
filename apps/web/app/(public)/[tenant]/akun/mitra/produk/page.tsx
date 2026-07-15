import { redirect } from "next/navigation";
import { headers  } from "next/headers";
import { auth }     from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { Package, Plus } from "lucide-react";

type Params = Promise<{ tenant: string }>;

type Product = {
  id: string; name: string; slug: string;
  price: string; memberPrice: string | null;
  stock: number; status: string;
  images: Array<{ url: string; variants?: Record<string, string> | null }>;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif", draft: "Draft", archived: "Diarsipkan",
};

export default async function MitraProdukPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/mitra/produk`);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/mitra/products?slug=${slug}`,
    { headers: { cookie: hdrs.get("cookie") ?? "" }, cache: "no-store" },
  );

  if (!res.ok) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Akses ditolak. Pastikan Anda sudah terdaftar sebagai mitra aktif.</p>
        <a href={`${baseUrl}/akun/mitra`} className="text-sm text-primary hover:underline mt-2 block">Kembali ke Mitra</a>
      </div>
    );
  }

  const { products } = await res.json() as { products: Product[] };

  const fmt = (n: string) => `Rp ${Number(n).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Produk Saya</h1>
        </div>
        <a
          href="new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Tambah Produk
        </a>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground text-sm">Belum ada produk.</p>
          <a href="new" className="text-primary text-sm hover:underline mt-1 block">
            + Tambah produk pertama
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const thumb = p.images?.[0]?.variants?.square ?? p.images?.[0]?.url;
            return (
              <a
                key={p.id}
                href={`${p.id}/edit`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors"
              >
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted">
                  {thumb
                    ? <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(p.price)}
                    {p.memberPrice && <span className="ml-2 text-primary">{fmt(p.memberPrice)} (anggota)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  p.status === "active" ? "bg-green-100 text-green-700" :
                  p.status === "draft"  ? "bg-muted text-muted-foreground" :
                  "bg-orange-100 text-orange-700"
                }`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
