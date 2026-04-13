import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OrderCreateClient } from "@/components/toko/order-create-client";

export default async function PesananNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Ambil produk aktif yang masih punya stok
  const products = await db
    .select({
      id:    schema.products.id,
      name:  schema.products.name,
      sku:   schema.products.sku,
      price: schema.products.price,
      stock: schema.products.stock,
    })
    .from(schema.products)
    .where(eq(schema.products.status, "active"))
    .orderBy(schema.products.name);

  // Konversi price (bisa string dari numeric DB) ke number
  const productList = products.map((p) => ({
    ...p,
    price: typeof p.price === "string" ? parseFloat(p.price) : (p.price as number),
    stock: typeof p.stock === "number" ? p.stock : Number(p.stock),
  }));

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/toko/pesanan`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pesanan
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Buat Pesanan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Buat pesanan manual untuk pelanggan
        </p>
      </div>

      <OrderCreateClient slug={slug} products={productList} />
    </div>
  );
}
