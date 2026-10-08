// Halaman Produsen — ADMIN-ONLY (hasFullAccess toko). Data berisi WhatsApp pribadi anggota → tidak ada
// versi publik. Doc: docs/arsitektur-produsen.md.
import { redirect } from "next/navigation";
import { desc, isNotNull, sql } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { resolveProducers, resolveInternalProducer } from "@/lib/producer.server";
import { ProducerManageClient, type ProducerItem } from "@/components/toko/producer-manage-client";

export default async function ProdusenPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  if (!hasFullAccess(access.tenantUser, "toko")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Produsen</h1>
        <p className="text-sm text-muted-foreground mt-2">Anda tidak punya akses penuh ke modul Toko, jadi data produsen tidak ditampilkan.</p>
      </div>
    );
  }

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;
  const tenant = { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType };

  const rows = await db.select().from(schema.producers).orderBy(desc(schema.producers.createdAt));
  const counts = await db
    .select({ producerId: schema.products.producerId, n: sql<number>`COUNT(*)::int` })
    .from(schema.products)
    .where(isNotNull(schema.products.producerId))
    .groupBy(schema.products.producerId);
  const countMap = new Map(counts.map((c) => [c.producerId as string, c.n]));

  const [views, internal] = await Promise.all([
    resolveProducers(tenantClient, tenant, rows.map((r) => r.id)),
    resolveInternalProducer(tenantClient, tenant),
  ]);

  const items: ProducerItem[] = rows.flatMap((r) => {
    const view = views.get(r.id);
    if (!view) return [];
    return [{
      view,
      productCount: countMap.get(r.id) ?? 0,
      edit: {
        name: r.customName ?? "", whatsapp: r.customWhatsapp ?? "", addressDetail: r.customAddressDetail ?? "",
        provinceId: r.customProvinceId ?? undefined, regencyId: r.customRegencyId ?? undefined,
        districtId: r.customDistrictId ?? undefined, villageId: r.customVillageId ? Number(r.customVillageId) : undefined,
        postalCode: r.customPostalCode ?? "", notes: r.notes ?? "",
      },
    }];
  });

  const internalProductCount = await db
    .select({ n: sql<number>`COUNT(*)::int` }).from(schema.products)
    .where(sql`${schema.products.producerId} IS NULL AND ${schema.products.mitraId} IS NULL`)
    .then((r) => r[0]?.n ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Produsen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Siapa yang memproduksi/memasok barang. Hanya terlihat oleh admin — tidak pernah tampil di halaman publik.
        </p>
      </div>
      <ProducerManageClient slug={slug} internal={internal} internalProductCount={internalProductCount} items={items} />
    </div>
  );
}
