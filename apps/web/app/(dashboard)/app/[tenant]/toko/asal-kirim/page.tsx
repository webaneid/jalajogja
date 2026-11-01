// Asal Kirim (admin): asal kirim toko/internal + kelola atas nama produsen. Doc: docs/arsitektur-alamat.md § 20.
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { listProducerOptions } from "@/lib/producer.server";
import { listAllOrigins } from "@/lib/shipping-origins.server";
import { AsalKirimClient } from "./asal-kirim-client";

export default async function AsalKirimPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  if (!hasFullAccess(access.tenantUser, "toko")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Asal Kirim</h1>
        <p className="text-sm text-muted-foreground mt-2">Anda tidak punya akses penuh ke modul Toko, jadi asal kirim tidak ditampilkan.</p>
      </div>
    );
  }

  const tc = createTenantDb(slug);
  const [all, producers] = await Promise.all([listAllOrigins(tc), listProducerOptions(tc)]);
  const sections = [
    { key: "tenant", title: `${access.tenant.name} (toko / produk internal)`, producerId: null as string | null, origins: all.filter((o) => o.producerId === null) },
    ...producers.map((p) => ({ key: p.id, title: `Produsen: ${p.name}`, producerId: p.id as string | null, origins: all.filter((o) => o.producerId === p.id) })),
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Asal Kirim</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Alamat gudang / pabrik / toko tempat barang dikirim. Kota asal ongkir diambil dari sini: asal yang dipilih pada produk, lalu asal <b>Utama</b> produsen,
          lalu asal <b>Utama</b> toko. Produsen juga bisa mengelola asalnya sendiri di portalnya.
        </p>
      </div>
      <AsalKirimClient slug={slug} sections={sections} />
    </div>
  );
}
