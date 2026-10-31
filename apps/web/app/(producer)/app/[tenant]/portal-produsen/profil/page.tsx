// Profil produsen — ringkasan BACA-SAJA (data usaha/pesantren/profesional & kontak milik anggota; ubah di halaman Akun) +
// kartu Gudang Pengiriman yang bisa diedit (alamat utama format RajaOngkir → kota asal ongkir produk). Doc: arsitektur-portal-produsen.md § 20.
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { resolveProducers } from "@/lib/producer.server";
import { WarehouseForm } from "@/components/producer/warehouse-form";

const SOURCE_LABEL: Record<string, string> = { usaha: "Usaha", pesantren: "Pesantren", profesional: "Profesional" };

export default async function ProducerProfilePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tenantClient = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantClient;
  const [views, [wh]] = await Promise.all([
    resolveProducers(tenantClient, access.tenant, [access.producer.id]),
    db.select().from(schema.producerWarehouses)
      .where(and(eq(schema.producerWarehouses.producerId, access.producer.id), eq(schema.producerWarehouses.isDefault, true))).limit(1),
  ]);
  const view = views.get(access.producer.id);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || "—"}</dd>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profil Produsen</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Ringkasan data Anda sebagai produsen di {access.tenant.name}.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Data Produsen</h2>
        <dl className="divide-y divide-border rounded-lg border border-border bg-card px-4">
          <Row label="Nama">{view?.name ?? access.producer.displayName}</Row>
          <Row label="Jenis">{view?.sourceType ? SOURCE_LABEL[view.sourceType] ?? view.sourceType : "—"}{view?.subtitle ? ` · ${view.subtitle}` : ""}</Row>
          <Row label="Pemilik">{view?.owner?.name}</Row>
          <Row label="Kontak">{view?.phone?.value}</Row>
          <Row label="Alamat">{view?.address?.text}</Row>
        </dl>
        <p className="text-xs text-muted-foreground">
          Data ini milik akun anggota Anda. Untuk mengubahnya buka{" "}
          <a href={`/${slug}/akun`} className="text-primary hover:underline">halaman Akun</a> (Usaha / Pesantren / Profesional).
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Gudang Pengiriman</h2>
          <p className="text-xs text-muted-foreground">
            Alamat asal pengiriman produk Anda (format RajaOngkir). Menentukan kota asal ongkir saat pelanggan checkout —
            mengganti kolom &ldquo;Kota Asal&rdquo; yang sebelumnya diisi per produk.
          </p>
        </div>
        {!wh && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum ada gudang. Selama kosong, ongkir memakai kota asal yang diatur admin pada produk atau toko.
          </p>
        )}
        <div className="rounded-lg border border-border bg-card p-4">
          <WarehouseForm slug={slug} initial={{
            label: wh?.label ?? "", addressDetail: wh?.addressDetail ?? "", cityId: wh?.rajaongkirCityId ?? null,
            cityLabel: wh?.rajaongkirCityLabel ?? "", postalCode: wh?.postalCode ?? "",
          }} />
        </div>
      </section>
    </div>
  );
}
