// SATU sumber pengelompokan paket pengiriman per penjual/produsen/kota-asal (kota asal, berat, gratis-ongkir, ambil-sendiri, COD).
// Dipakai halaman checkout publik DAN verifikasi ongkir server (lib/shipping-verify.server.ts) — DIEKSTRAK PERSIS dari
// checkout/page.tsx supaya hasil yang ditampilkan ke pembeli = hasil yang diverifikasi server. Doc: docs/arsitektur-portal-produsen.md § 26.
import "server-only";
import { inArray, eq, and } from "drizzle-orm";
import { db, createTenantDb, memberBusinesses, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { loadOriginIndex } from "@/lib/shipping-origins.server";
import { resolveProductOrigin } from "@/lib/shipping-origins";
import { shortCityName, publicCityLabel } from "@/lib/city-label";
import type { TokoSettings } from "@/lib/toko-settings";
import type { SellerGroup } from "@/app/(public)/[tenant]/cart/actions";

export type ShippingCartItem = { id: string; itemType: string; itemId: string | null; name: string; quantity: number };

export async function buildSellerGroups(a: {
  slug: string;
  tenantName: string;
  cartItems: ShippingCartItem[];
  tokoSettings: TokoSettings;
  /** Tidak lagi memuat asal kirim (pindah ke shipping_origins, § 20); dipertahankan agar pemanggil tak berubah. */
  config?: unknown;
}): Promise<SellerGroup[]> {
  const { slug, tenantName, cartItems, tokoSettings } = a;
  const { db: tdb, schema: ts } = createTenantDb(slug);
  const productItemIds = cartItems
    .filter((i) => i.itemType === "product" && i.itemId)
    .map((i) => i.itemId!);
  if (productItemIds.length === 0) return [];

  // Produk VARIABLE: cart_items.item_id adalah product_variations.id (bukan products.id
  // — lihat komponen add-to-cart di halaman detail produk), jadi harus di-translate dulu
  // ke parent product-nya SEBELUM lookup mitra/kota-asal/berat. Tanpa ini, seluruh
  // shipping group (termasuk opsi COD & Ambil Sendiri) diam-diam kosong untuk produk
  // variasi — bukan bug baru, celah ini sudah dicatat sejak Fase 1 Voucher (docs/
  // arsitektur-voucher.md) tapi baru sekarang genuinely memblokir fitur.
  const variationRows = await tdb
    .select({
      id:         ts.productVariations.id,
      productId:  ts.productVariations.productId,
      weightGram: ts.productVariations.weightGram,
    })
    .from(ts.productVariations)
    .where(inArray(ts.productVariations.id, productItemIds));

  const variationMap: Record<string, { productId: string; weightGram: number | null }> = {};
  for (const v of variationRows) variationMap[v.id] = { productId: v.productId, weightGram: v.weightGram };

  // productId sesungguhnya per cart item: kalau itemId adalah variation id, pakai
  // parent product-nya; kalau bukan (produk simple), itemId ITU SENDIRI = productId.
  const resolvedProductIds = [...new Set(
    productItemIds.map(id => variationMap[id]?.productId ?? id)
  )];

  // Fetch product + mitra detail sekaligus (termasuk opsi COD/pickup milik mitra)
  const productDetails = await tdb
    .select({
      productId:       ts.products.id,
      weightGram:      ts.products.weightGram,
      mitraId:         ts.products.mitraId,
      productProducerId: ts.products.producerId, // gudang produsen → kota asal (prioritas di atas override per-produk)
      // Override kota asal per-produk — KHUSUS produk tenant sendiri, tidak pernah
      // dipakai untuk produk mitra (mitra selalu pakai originCityId mitranya sendiri,
      // lihat resolusi di bawah). docs/arsitektur-addon-ongkir.md § "RENCANA — Kota
      // Asal Pengiriman per Produk Tenant".
      productOriginId:       ts.products.originId,
      // Gratis ongkir per-produk — KHUSUS produk tenant sendiri, sama scope kota asal
      // di atas (mitra tidak pernah baca ini). docs/arsitektur-addon-ongkir.md §
      // "RENCANA — Gratis Ongkir per Produk".
      freeShippingMode:      ts.products.freeShippingMode,
      freeShippingProvinces: ts.products.freeShippingProvinces,
      freeShippingCities:    ts.products.freeShippingCities,
      // Lokasi Ambil Sendiri override per-produk — KHUSUS produk tenant sendiri, sama
      // scope kota asal di atas (mitra tidak pernah baca ini, sudah punya solusi sendiri
      // di mitras.pickupLocationName dst). Fallback ke default toko kalau kosong. Lihat
      // docs/arsitektur-billing.md § 14.5.
      productPickupLocationName: ts.products.pickupLocationName,
      productPickupAddress:      ts.products.pickupAddress,
      productPickupMapsUrl:      ts.products.pickupMapsUrl,
      mitraOriginCityId:     ts.mitras.rajaongkirCityId,
      mitraOriginCityName:   ts.mitras.rajaongkirCityName,
      businessId:      ts.mitras.businessId,
      mitraCodEnabled:         ts.mitras.codEnabled,
      mitraPickupEnabled:      ts.mitras.pickupEnabled,
      mitraPickupLocationName: ts.mitras.pickupLocationName,
      mitraPickupAddress:      ts.mitras.pickupAddress,
      mitraPickupMapsUrl:      ts.mitras.pickupMapsUrl,
    })
    .from(ts.products)
    .leftJoin(ts.mitras, eq(ts.mitras.id, ts.products.mitraId))
    .where(inArray(ts.products.id, resolvedProductIds));

  // Asal kirim produk TENANT (bukan mitra): products.origin_id → asal utama produsen → asal utama toko (shipping_origins, § 20).
  // Produk mitra tidak disentuh (selalu kota mitra). Asal produsen nonaktif tak masuk indeks.
  // strict: galat baca asal = checkout GAGAL (aman), bukan paket dilewati lalu ongkir Rp0 (audit P4).
  const originIndex = await loadOriginIndex(createTenantDb(slug), { strict: true });

  // Ambil nama usaha mitra dari public.member_businesses
  const bizIds = [...new Set(
    productDetails.filter(p => p.businessId).map(p => p.businessId!)
  )];
  const bizMap: Record<string, string> = {};
  if (bizIds.length > 0) {
    const rows = await db
      .select({ id: memberBusinesses.id, name: memberBusinesses.name })
      .from(memberBusinesses)
      .where(inArray(memberBusinesses.id, bizIds));
    for (const r of rows) bizMap[r.id] = r.name;
  }

  const detailMap: Record<string, typeof productDetails[0]> = {};
  for (const d of productDetails) detailMap[d.productId] = d;

  const groupMap: Record<string, SellerGroup> = {};

  for (const item of cartItems.filter(i => i.itemType === "product" && i.itemId)) {
    const variation     = variationMap[item.itemId!];
    const realProductId = variation?.productId ?? item.itemId!;
    const d             = detailMap[realProductId];
    // Berat variasi (kalau diisi admin) meng-override berat produk induk — kolom
    // product_variations.weight_gram memang didesain sebagai override per-variasi.
    const weightGram = variation?.weightGram ?? d?.weightGram ?? null;
    if (!d || !weightGram) continue;

    let sellerType: "tenant" | "mitra";
    let sellerId: string | null;
    let sellerName: string;
    let originCityId: number;
    let originCityName: string;
    let codEnabled: boolean;
    let pickupEnabled: boolean;
    let pickupLocationName: string | null;
    let pickupAddress: string | null;
    let pickupMapsUrl: string | null;

    const tenantOrigin = d.mitraId ? null : resolveProductOrigin(originIndex, { originId: d.productOriginId, producerId: d.productProducerId });

    if (d.mitraId && d.mitraOriginCityId) {
      // Produk mitra — SELALU pakai kota asal mitra sendiri. product.originCityId
      // TIDAK PERNAH dibaca di sini, bahkan kalau terisi (mitra wajib jual produk
      // sendiri, satu lokasi tunggal — bukan skenario yang butuh override per-produk).
      sellerType    = "mitra";
      sellerId      = d.mitraId;
      sellerName    = d.businessId ? (bizMap[d.businessId] ?? "Mitra") : "Mitra";
      originCityId  = d.mitraOriginCityId;
      originCityName = d.mitraOriginCityName ?? "";
      codEnabled          = d.mitraCodEnabled ?? false;
      pickupEnabled       = d.mitraPickupEnabled ?? false;
      pickupLocationName  = d.mitraPickupLocationName ?? null;
      pickupAddress       = d.mitraPickupAddress ?? null;
      pickupMapsUrl       = d.mitraPickupMapsUrl ?? null;
    } else if (!d.mitraId && tenantOrigin) {
      // Produk tenant sendiri: asal dari shipping_origins (lihat resolveProductOrigin).
      sellerType    = "tenant";
      sellerId      = null;
      sellerName    = tenantName;
      originCityId  = tenantOrigin.cityId;
      // Label AMAN untuk pembeli ("KOTA, PROVINSI") — kelurahan & kode pos gudang produsen bisa rumah perorangan (city-label.ts).
      originCityName = publicCityLabel(tenantOrigin.fullLabel);
      codEnabled          = tokoSettings.codEnabled;
      pickupEnabled       = tokoSettings.pickupEnabled;
      // Lokasi ambil sendiri override per-produk (independen dari asal kirim), fallback default toko.
      pickupLocationName  = d.productPickupLocationName || tokoSettings.pickupLocationName || null;
      pickupAddress       = d.productPickupAddress       || tokoSettings.pickupAddress       || null;
      pickupMapsUrl       = d.productPickupMapsUrl       || tokoSettings.pickupMapsUrl       || null;
    } else {
      continue; // kota asal tidak diketahui, skip
    }

    // PENGIRIMAN PER PRODUSEN (ADR-0005): produk tenant milik produsen X selalu satu paket sendiri — terpisah dari produsen lain
    // dan dari barang toko — walau gudangnya sekota. Produsen = dari DB (products.producer_id), produk mitra tak pernah punya produsen.
    const producerId = d.mitraId ? null : (d.productProducerId ?? null);
    // Ambil di tempat produsen = asal UTAMA produsen (sama dengan yang diturunkan server saat checkout — loadDefaultWarehouses)
    const warehouse  = producerId ? originIndex.producerDefault.get(producerId) : undefined;
    if (producerId) {
      // Judul paket untuk pelanggan = kota asal (identitas produsen tidak diperlihatkan; keputusan user 2026-11-01)
      const city = shortCityName(originCityName);
      if (city) sellerName = `${tenantName} (${city})`;
      // Ambil di tempat ikut gudang produsen (bila ada gudang); selain itu lokasi produk/toko seperti sebelumnya
      // HANYA bila toko mengaktifkan ambil-sendiri: alamat lengkap gudang tak boleh dikirim ke setiap pengunjung checkout
      // bila fitur pickup mati (audit F2). Server tetap menurunkan alamat dari gudang saat checkout (bukan dari klien).
      if (warehouse && pickupEnabled) {
        pickupLocationName = warehouse.name;
        pickupAddress      = `${warehouse.addressDetail}, ${warehouse.fullLabel}`;
        pickupMapsUrl      = null;
      }
    }

    // groupKey ikut produsen + origin — produsen berbeda = paket berbeda; produk tanpa produsen/produsen tanpa gudang
    // dengan kota asal beda tetap terpisah per kota (perilaku lama).
    const groupKey = `${sellerType}:${sellerId ?? "tenant"}:${producerId ?? "-"}:${originCityId}`;
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        key: groupKey, sellerType, sellerId, producerId, sellerName,
        originCityId, originCityName, items: [], totalWeightGram: 0,
        codEnabled, pickupEnabled, pickupLocationName, pickupAddress, pickupMapsUrl,
      };
    }

    groupMap[groupKey].items.push({
      cartItemId: item.id,
      productId:  realProductId,
      name:       item.name,
      quantity:   item.quantity,
      weightGram: weightGram,
      // Gratis ongkir — TIDAK PERNAH dibaca untuk produk mitra (d.mitraId truthy),
      // sama scope decision seperti kota asal.
      freeShippingMode:      d.mitraId ? "none" : (d.freeShippingMode ?? "none"),
      freeShippingProvinces: d.mitraId ? [] : (d.freeShippingProvinces ?? []),
      freeShippingCities:    d.mitraId ? [] : (d.freeShippingCities ?? []),
    });
    groupMap[groupKey].totalWeightGram += weightGram * item.quantity;
  }

  return Object.values(groupMap);
}

export type RajaOngkirConfig = { couriers?: string[] }; // asal kirim kini di shipping_origins (docs/arsitektur-alamat.md § 20)

/** Konfigurasi add-on RajaOngkir tenant (null = add-on tidak terpasang/nonaktif). */
export async function loadRajaOngkirConfig(slug: string): Promise<RajaOngkirConfig | null> {
  const [row] = await db
    .select({ config: tenantAddonInstallations.config, status: tenantAddonInstallations.status })
    .from(tenants)
    .innerJoin(tenantAddonInstallations, eq(tenantAddonInstallations.tenantId, tenants.id))
    .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
    .where(and(eq(tenants.slug, slug), eq(addons.slug, "rajaongkir")))
    .limit(1);
  if (!row || row.status === "expired" || row.status === "inactive") return null;
  return row.config as RajaOngkirConfig;
}
