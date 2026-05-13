import { redirect } from "next/navigation";
import { headers  } from "next/headers";
import { auth }     from "@/lib/auth";
import { MitraProductForm } from "../../mitra-product-form";
import type { GalleryItem } from "@/lib/gallery";

type Params = Promise<{ tenant: string; id: string }>;

export default async function MitraProdukEditPage({ params }: { params: Params }) {
  const { tenant: slug, id: productId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login`);

  const [statusRes, prodRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mitra/status?slug=${slug}`,
      { headers: await headers(), cache: "no-store" }),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mitra/products?slug=${slug}`,
      { headers: await headers(), cache: "no-store" }),
  ]);

  if (!statusRes.ok || !prodRes.ok) redirect(`/${slug}/akun/mitra/produk`);

  const { settings } = await statusRes.json() as { settings: { minKomisiMitra: number; mitraMaxProducts: number } };
  const { products } = await prodRes.json() as {
    products: Array<{
      id: string; name: string; slug: string; price: string;
      memberPrice: string | null; stock: number; weightGram: number | null;
      description: string | null; images: GalleryItem[];
    }>;
  };

  const product = products.find(p => p.id === productId);
  if (!product) redirect(`/${slug}/akun/mitra/produk`);

  return <MitraProductForm slug={slug} settings={settings} product={product} />;
}
