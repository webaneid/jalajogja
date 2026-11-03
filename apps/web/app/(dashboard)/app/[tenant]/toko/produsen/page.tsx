// Halaman Produsen — ADMIN-ONLY (hasFullAccess toko). Data berisi WhatsApp pribadi anggota → tidak ada
// versi publik. Doc: docs/arsitektur-produsen.md.
import { redirect } from "next/navigation";
import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db as publicDb, createTenantDb, members, producerLogins } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { sanitizeCouriers } from "@/lib/producer-couriers";
import { resolveProducers, resolveInternalProducer } from "@/lib/producer.server";
import { pgErrorCode } from "@/lib/pg-error";
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

  // Status akses portal: siapa yang sudah diberi akses login + apakah pemilik punya akun (tombol "Beri akses")
  const grantedRows = await publicDb.select({ producerId: producerLogins.producerId }).from(producerLogins)
    .where(eq(producerLogins.tenantId, access.tenant.id));
  const grantedSet = new Set(grantedRows.map((g) => g.producerId));
  const ownerIds = [...new Set(rows.map((r) => r.memberId).filter((x): x is string => !!x))];
  const accountRows = ownerIds.length
    ? await publicDb.select({ id: members.id, acc: members.betterAuthUserId }).from(members).where(inArray(members.id, ownerIds))
    : [];
  const hasAccount = new Set(accountRows.filter((m) => !!m.acc).map((m) => m.id));

  // Riwayat persentase bagi hasil (K20): 5 perubahan terakhir per produsen + nama pengubah (pengurus → anggota). Tenant yang belum
  // menjalankan migration 0095 → tabel tak ada → riwayat kosong (halaman tetap jalan).
  type Hist = { oldPercent: string | null; newPercent: string; at: string; by: string | null };
  const historyMap = new Map<string, Hist[]>();
  try {
    // Per produsen (5 terbaru masing-masing) supaya produsen yang sering berubah tidak menghabiskan jatah produsen lain.
    const perProducer = await Promise.all(rows.map((r) =>
      db.select().from(schema.producerPercentHistory).where(eq(schema.producerPercentHistory.producerId, r.id))
        .orderBy(desc(schema.producerPercentHistory.createdAt)).limit(5)));
    const hist = perProducer.flat();
    const byIds = [...new Set(hist.map((h) => h.changedBy).filter((x): x is string => !!x))];
    const nameOf = new Map<string, string>();
    if (byIds.length) {
      const us = await db.select({ id: schema.users.id, memberId: schema.users.memberId }).from(schema.users).where(inArray(schema.users.id, byIds));
      const mIds = us.map((u) => u.memberId).filter((x): x is string => !!x);
      const ms = mIds.length ? await publicDb.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, mIds)) : [];
      const mName = new Map(ms.map((m) => [m.id, m.name]));
      for (const u of us) if (u.memberId && mName.has(u.memberId)) nameOf.set(u.id, mName.get(u.memberId)!);
    }
    for (const h of hist) {
      const list = historyMap.get(h.producerId) ?? [];
      list.push({ oldPercent: h.oldPercent === null ? null : String(Number(h.oldPercent)), newPercent: String(Number(h.newPercent)), at: h.createdAt.toISOString(), by: h.changedBy ? nameOf.get(h.changedBy) ?? null : null });
      historyMap.set(h.producerId, list);
    }
  } catch (e) {
    if (pgErrorCode(e) !== "42P01") throw e;   // hanya "tabel belum ada" (0095 belum jalan) yang dimaklumi
  }

  const items: ProducerItem[] = rows.flatMap((r) => {
    const view = views.get(r.id);
    if (!view) return [];
    return [{
      view,
      productCount: countMap.get(r.id) ?? 0,
      couriers: sanitizeCouriers(r.couriers),
      shareHistory: historyMap.get(r.id) ?? [],
      terms: { productLimit: r.productLimit ?? null, sharePercent: r.revenueSharePercent != null ? String(Number(r.revenueSharePercent)) : null, brand: r.brandName ?? null },
      portal: r.type === "member" ? { granted: grantedSet.has(r.id), ownerHasAccount: !!r.memberId && hasAccount.has(r.memberId) } : null,
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
