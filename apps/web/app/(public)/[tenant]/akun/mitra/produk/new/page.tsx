import { redirect } from "next/navigation";
import { headers  } from "next/headers";
import { auth }     from "@/lib/auth";
import { MitraProductForm } from "../mitra-product-form";

type Params = Promise<{ tenant: string }>;

export default async function MitraProdukNewPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login`);

  // Fetch settings untuk kalkulasi harga
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/mitra/status?slug=${slug}`,
    { headers: await headers(), cache: "no-store" },
  );
  const data = await res.json() as { settings: { minKomisiMitra: number; mitraMaxProducts: number } };

  return <MitraProductForm slug={slug} settings={data.settings} />;
}
