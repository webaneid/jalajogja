import { createTenantDb, db as publicDb, tenants, tenantAddonInstallations, addons, memberBusinesses } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { getTokoSettings } from "@/lib/toko-settings";
import { redirect } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OrderCreateClient } from "@/components/toko/order-create-client";

type RajaOngkirConfig = {
  origin_city_id?:   number;
  origin_city_name?: string;
  couriers?:         string[];
};

export default async function PesananNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const { db, schema } = createTenantDb(slug);

  const [tenantRow] = await publicDb
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow) redirect("/app/login");

  // Ambil produk aktif — sertakan info seller (tenant/mitra) + berat, dibutuhkan untuk
  // menghitung opsi pengiriman per grup penjual (SellerGroup), sama pola checkout publik.
  const products = await db
    .select({
      id:          schema.products.id,
      name:        schema.products.name,
      sku:         schema.products.sku,
      price:       schema.products.price,
      stock:       schema.products.stock,
      weightGram:  schema.products.weightGram,
      mitraId:     schema.products.mitraId,
      sellerType:  schema.products.sellerType,
      productType: schema.products.productType,
    })
    .from(schema.products)
    .where(eq(schema.products.status, "active"))
    .orderBy(schema.products.name);

  const productList = products.map((p) => ({
    id:          p.id,
    name:        p.name,
    sku:         p.sku,
    price:       typeof p.price === "string" ? parseFloat(p.price) : (p.price as number),
    stock:       typeof p.stock === "number" ? p.stock : Number(p.stock),
    weightGram:  p.weightGram ?? 0,
    mitraId:     p.mitraId,
    sellerType:  p.sellerType as "tenant" | "mitra",
    productType: p.productType as "simple" | "variable",
  }));

  // ── Konfig ongkir tenant (add-on RajaOngkir) — sama pola checkout/page.tsx ────────
  let tenantShipping: {
    originCityId:       number;
    originCityName:     string;
    codEnabled:         boolean;
    pickupEnabled:      boolean;
    pickupLocationName: string | null;
    pickupAddress:      string | null;
    pickupMapsUrl:      string | null;
  } | null = null;
  let addonCouriers: string[] = [];

  try {
    const installation = await publicDb
      .select({ config: tenantAddonInstallations.config, status: tenantAddonInstallations.status })
      .from(tenantAddonInstallations)
      .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
      .where(and(eq(tenantAddonInstallations.tenantId, tenantRow.id), eq(addons.slug, "rajaongkir")))
      .limit(1)
      .then((r) => r[0]);

    if (installation && installation.status !== "expired" && installation.status !== "inactive") {
      const cfg = installation.config as RajaOngkirConfig;
      addonCouriers = cfg.couriers ?? [];
      if (cfg.origin_city_id) {
        const tokoSettings = await getTokoSettings(slug);
        tenantShipping = {
          originCityId:   cfg.origin_city_id,
          originCityName: cfg.origin_city_name ?? "",
          codEnabled:         tokoSettings.codEnabled,
          pickupEnabled:      tokoSettings.pickupEnabled,
          pickupLocationName: tokoSettings.pickupLocationName || null,
          pickupAddress:      tokoSettings.pickupAddress || null,
          pickupMapsUrl:      tokoSettings.pickupMapsUrl || null,
        };
      }
    }
  } catch (e) {
    console.error("[pesanan/new] Gagal ambil konfig RajaOngkir:", e);
  }

  // ── Konfig mitra untuk semua produk mitra yang tampil di daftar ──────────────────
  const mitraIds = [...new Set(productList.filter((p) => p.mitraId).map((p) => p.mitraId as string))];
  const mitraConfigMap: Record<string, {
    sellerName:          string;
    originCityId:        number | null;
    originCityName:      string | null;
    codEnabled:          boolean;
    pickupEnabled:       boolean;
    pickupLocationName:  string | null;
    pickupAddress:       string | null;
    pickupMapsUrl:       string | null;
  }> = {};

  if (mitraIds.length > 0) {
    const mitraRows = await db
      .select({
        id:                  schema.mitras.id,
        businessId:          schema.mitras.businessId,
        originCityId:        schema.mitras.rajaongkirCityId,
        originCityName:      schema.mitras.rajaongkirCityName,
        codEnabled:          schema.mitras.codEnabled,
        pickupEnabled:       schema.mitras.pickupEnabled,
        pickupLocationName:  schema.mitras.pickupLocationName,
        pickupAddress:       schema.mitras.pickupAddress,
        pickupMapsUrl:       schema.mitras.pickupMapsUrl,
      })
      .from(schema.mitras)
      .where(inArray(schema.mitras.id, mitraIds));

    const bizIds = [...new Set(mitraRows.map((m) => m.businessId))];
    const bizRows = bizIds.length > 0
      ? await publicDb.select({ id: memberBusinesses.id, name: memberBusinesses.name }).from(memberBusinesses).where(inArray(memberBusinesses.id, bizIds))
      : [];
    const bizMap = new Map(bizRows.map((b) => [b.id, b.name]));

    for (const m of mitraRows) {
      mitraConfigMap[m.id] = {
        sellerName: bizMap.get(m.businessId) ?? "Mitra",
        originCityId:       m.originCityId,
        originCityName:     m.originCityName,
        codEnabled:         m.codEnabled,
        pickupEnabled:      m.pickupEnabled,
        pickupLocationName: m.pickupLocationName,
        pickupAddress:      m.pickupAddress,
        pickupMapsUrl:      m.pickupMapsUrl,
      };
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/app/${slug}/toko/pesanan`}
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

      <OrderCreateClient
        slug={slug}
        tenantName={tenantRow.name}
        products={productList}
        tenantShipping={tenantShipping}
        mitraConfigMap={mitraConfigMap}
        addonCouriers={addonCouriers}
      />
    </div>
  );
}
