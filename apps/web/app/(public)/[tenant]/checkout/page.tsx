import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, tenants, tenantAddonInstallations, addons, memberBusinesses } from "@jalajogja/db";
import { eq, and, inArray } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getAkunIdentity } from "@/lib/akun-identity";
import { CheckoutForm } from "@/components/billing/checkout-form";
import type { CartData, CartItem, SellerGroup } from "@/app/(public)/[tenant]/cart/actions";
import type { CheckoutDefaults } from "@/components/billing/checkout-form";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ tenant: string }> };

type RajaOngkirConfig = {
  origin_city_id?:   number;
  origin_city_name?: string;
  couriers?:         string[];
};

// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — sebelumnya tidak punya generateMetadata sama sekali.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "checkout");
  return buildMetadata({
    title:         override?.metaTitle || "Checkout",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/checkout`,
    robots:        override?.robots || undefined,
  });
}

export default async function CheckoutPage({ params }: Props) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get("cart_session")?.value ?? null;

  if (!token) redirect(`/${slug}/keranjang`);

  // Ambil data user yang login untuk pre-fill form
  let defaults: CheckoutDefaults = { name: "", email: "", phone: "" };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const identity = await getAkunIdentity(session.user.id);
      if (identity) {
        defaults = {
          name:  identity.name  ?? "",
          email: identity.email ?? "",
          phone: identity.phone ?? identity.whatsapp ?? "",
        };
      }
    }
  } catch { /* tidak login */ }

  let cart: CartData | null = null;
  let cartItems: CartItem[] = [];

  try {
    const { db: tenantDb, schema } = createTenantDb(slug);

    const [cartRow] = await tenantDb
      .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (!cartRow || cartRow.expiresAt <= new Date()) redirect(`/${slug}/keranjang`);

    const items = await tenantDb
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cartRow.id))
      .orderBy(schema.cartItems.sortOrder, schema.cartItems.createdAt);

    if (items.length === 0) redirect(`/${slug}/keranjang`);

    cartItems = items.map((it) => ({
      id:        it.id,
      itemType:  it.itemType as CartItem["itemType"],
      itemId:    it.itemId,
      name:      it.name,
      unitPrice: parseFloat(String(it.unitPrice)),
      quantity:  it.quantity,
      notes:     it.notes,
      sortOrder: it.sortOrder,
    }));

    const subtotal = cartItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

    cart = {
      cartId:    cartRow.id,
      items:     cartItems,
      subtotal,
      expiresAt: cartRow.expiresAt.toISOString(),
    };
  } catch {
    redirect(`/${slug}/keranjang`);
  }

  if (!cart) redirect(`/${slug}/keranjang`);

  // ── Cek add-on ongkir + bangun seller groups ──────────────────────────────
  let sellerGroups: SellerGroup[] = [];
  let addonCouriers: string[] = [];

  const productItemIds = cartItems
    .filter(i => i.itemType === "product" && i.itemId)
    .map(i => i.itemId!);

  if (productItemIds.length > 0) {
    try {
      const installation = await db
        .select({
          config: tenantAddonInstallations.config,
          status: tenantAddonInstallations.status,
        })
        .from(tenantAddonInstallations)
        .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
        .where(and(
          eq(tenantAddonInstallations.tenantId, tenant.id),
          eq(addons.slug, "rajaongkir"),
        ))
        .limit(1)
        .then(r => r[0]);

      if (installation && installation.status !== "expired" && installation.status !== "inactive") {
        const config = installation.config as RajaOngkirConfig;

        if (config.couriers?.length) {
          addonCouriers = config.couriers;

          const { db: tdb, schema: ts } = createTenantDb(slug);

          // Fetch product + mitra detail sekaligus
          const productDetails = await tdb
            .select({
              productId:       ts.products.id,
              weightGram:      ts.products.weightGram,
              mitraId:         ts.products.mitraId,
              originCityId:    ts.mitras.rajaongkirCityId,
              originCityName:  ts.mitras.rajaongkirCityName,
              businessId:      ts.mitras.businessId,
            })
            .from(ts.products)
            .leftJoin(ts.mitras, eq(ts.mitras.id, ts.products.mitraId))
            .where(inArray(ts.products.id, productItemIds));

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
            const d = detailMap[item.itemId!];
            if (!d?.weightGram) continue;

            let sellerType: "tenant" | "mitra";
            let sellerId: string | null;
            let sellerName: string;
            let originCityId: number;
            let originCityName: string;

            if (d.mitraId && d.originCityId) {
              sellerType    = "mitra";
              sellerId      = d.mitraId;
              sellerName    = d.businessId ? (bizMap[d.businessId] ?? "Mitra") : "Mitra";
              originCityId  = d.originCityId;
              originCityName = d.originCityName ?? "";
            } else if (!d.mitraId && config.origin_city_id) {
              sellerType    = "tenant";
              sellerId      = null;
              sellerName    = tenant.name;
              originCityId  = config.origin_city_id;
              originCityName = config.origin_city_name ?? "";
            } else {
              continue; // kota asal tidak diketahui, skip
            }

            const groupKey = `${sellerType}:${sellerId ?? "tenant"}`;
            if (!groupMap[groupKey]) {
              groupMap[groupKey] = {
                key: groupKey, sellerType, sellerId, sellerName,
                originCityId, originCityName, items: [], totalWeightGram: 0,
              };
            }

            groupMap[groupKey].items.push({
              cartItemId: item.id,
              productId:  item.itemId!,
              name:       item.name,
              quantity:   item.quantity,
              weightGram: d.weightGram,
            });
            groupMap[groupKey].totalWeightGram += d.weightGram * item.quantity;
          }

          sellerGroups = Object.values(groupMap);
        }
      }
    } catch (e) {
      console.error("[checkout] Error fetching shipping groups:", e);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6">
          <a href={`/${slug}/keranjang`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Kembali ke Keranjang
          </a>
        </div>
        <h1 className="text-xl font-semibold mb-6">Checkout</h1>
        <CheckoutForm
          slug={slug}
          cart={cart}
          defaults={defaults}
          sellerGroups={sellerGroups}
          addonCouriers={addonCouriers}
        />
      </div>
    </main>
  );
}
