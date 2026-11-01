// Profil produsen — ringkasan BACA-SAJA (data usaha/pesantren/profesional & kontak milik anggota; ubah di halaman Akun) +
// Asal Kirim (gudang/pabrik, banyak alamat) + kurir pilihan yang bisa diedit. Doc: arsitektur-alamat.md § 20.
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { resolveProducers } from "@/lib/producer.server";
import { OriginManager } from "@/components/address/origin-manager";
import { listOrigins } from "@/lib/shipping-origins.server";
import { CourierForm } from "@/components/producer/courier-form";
import { sanitizeCouriers } from "@/lib/producer-couriers";
import { saveProducerCouriersAction, saveOriginAction, deleteOriginAction, setDefaultOriginAction } from "./actions";

const SOURCE_LABEL: Record<string, string> = { usaha: "Usaha", pesantren: "Pesantren", profesional: "Profesional" };

export default async function ProducerProfilePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tenantClient = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantClient;
  const [views, origins, [prodRow]] = await Promise.all([
    resolveProducers(tenantClient, access.tenant, [access.producer.id]),
    listOrigins(tenantClient, { producerId: access.producer.id }),
    db.select({ couriers: schema.producers.couriers }).from(schema.producers)
      .where(eq(schema.producers.id, access.producer.id)).limit(1),
  ]);
  const couriers = sanitizeCouriers(prodRow?.couriers);
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
          <h2 className="text-sm font-semibold">Asal Kirim (Gudang / Pabrik)</h2>
          <p className="text-xs text-muted-foreground">
            Alamat asal pengiriman produk Anda. Boleh lebih dari satu (mis. gudang dan pabrik); yang berstatus <b>Utama</b> dipakai
            untuk semua produk Anda kecuali admin memilih asal lain per produk. Menentukan kota asal ongkir saat pelanggan checkout.
          </p>
        </div>
        {origins.length === 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum ada asal kirim. Selama kosong, ongkir memakai asal kirim toko.
          </p>
        )}
        <OriginManager
          initial={origins}
          emptyHint="Tambahkan alamat gudang/pabrik Anda."
          actions={{
            save: saveOriginAction.bind(null, slug),
            remove: deleteOriginAction.bind(null, slug),
            makeDefault: setDefaultOriginAction.bind(null, slug),
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Kurir Pengiriman</h2>
          <p className="text-xs text-muted-foreground">
            Pilih kurir yang Anda pakai (mis. yang terdekat dari gudang). Hanya kurir ini yang ditawarkan ke pembeli untuk paket Anda.
          </p>
        </div>
        {couriers === null && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum diatur — saat ini memakai daftar kurir dari admin.
          </p>
        )}
        <div className="rounded-lg border border-border bg-card p-4">
          <CourierForm initial={couriers} onSave={saveProducerCouriersAction.bind(null, slug)} />
        </div>
      </section>
    </div>
  );
}
