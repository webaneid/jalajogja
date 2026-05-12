import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db, tenants, getSettings } from "@jalajogja/db";
import { eq, inArray, and } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { CartClient } from "@/components/billing/cart-client";
import type { CartData, CartItem } from "@/app/(public)/[tenant]/cart/actions";
import { DonationBannerCart } from "@/components/event/public/donation-banner-cart";
import { ShoppingCart } from "lucide-react";

type CampaignBanner = { campaignId: string; campaignTitle: string; amounts: number[] };

type Props = { params: Promise<{ tenant: string }> };

export default async function KeranjangPage({ params }: Props) {
  const { tenant: slug } = await params;

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  // Baca session cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("cart_session")?.value ?? null;

  let cart: CartData | null = null;

  if (token) {
    try {
      const { db: tenantDb, schema } = createTenantDb(slug);

      const [cartRow] = await tenantDb
        .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
        .from(schema.carts)
        .where(eq(schema.carts.sessionToken, token))
        .limit(1);

      if (cartRow && cartRow.expiresAt > new Date()) {
        const items = await tenantDb
          .select()
          .from(schema.cartItems)
          .where(eq(schema.cartItems.cartId, cartRow.id))
          .orderBy(schema.cartItems.sortOrder, schema.cartItems.createdAt);

        const cartItems: CartItem[] = items.map((it) => ({
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
      }
    } catch {
      // cart kosong jika error
    }
  }

  // Cari campaign untuk banner donasi — hanya jika ada tiket berbayar di cart
  const donationBanners: CampaignBanner[] = [];
  const ticketItems = cart?.items.filter((i) => i.itemType === "ticket") ?? [];

  if (ticketItems.length > 0) {
    try {
      const { db: tenantDb, schema } = createTenantDb(slug);

      // Cari eventId dari tiket — filter null agar inArray tidak error
      const ticketIds = ticketItems.map((i) => i.itemId).filter(Boolean) as string[];
      if (ticketIds.length === 0) throw new Error("no tickets");

      const ticketRows = await tenantDb
        .select({ eventId: schema.eventTickets.eventId })
        .from(schema.eventTickets)
        .where(inArray(schema.eventTickets.id, ticketIds));

      const eventIds = [...new Set(ticketRows.map((r) => r.eventId).filter(Boolean))] as string[];

      if (eventIds.length > 0) {
        const eventRows = await tenantDb
          .select({
            id:              schema.events.id,
            linkedCampaignId: schema.events.linkedCampaignId,
          })
          .from(schema.events)
          .where(
            and(
              inArray(schema.events.id, eventIds),
              eq(schema.events.showDonationPrompt, true),
            )
          );

        const campaignIds = eventRows
          .map((e) => e.linkedCampaignId)
          .filter(Boolean) as string[];

        if (campaignIds.length > 0) {
          const campaigns = await tenantDb
            .select({ id: schema.campaigns.id, title: schema.campaigns.title })
            .from(schema.campaigns)
            .where(
              and(
                inArray(schema.campaigns.id, campaignIds),
                eq(schema.campaigns.status, "active"),
              )
            );

          const donasiSettings = await getSettings(createTenantDb(slug), "donasi");
          const dc = donasiSettings.donation_config as { recommended_amounts?: number[] } | undefined;
          const amounts = dc?.recommended_amounts ?? [10000, 25000, 50000, 100000];

          for (const campaign of campaigns) {
            donationBanners.push({
              campaignId:    campaign.id,
              campaignTitle: campaign.title,
              amounts,
            });
          }
        }
      }
    } catch {
      // banner diabaikan jika error
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Keranjang Belanja</h1>
          {cart && cart.items.length > 0 && (
            <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
              {cart.items.length} item
            </span>
          )}
        </div>

        <CartClient slug={slug} cart={cart} />

        {donationBanners.length > 0 && (
          <div className="mt-4">
            <DonationBannerCart tenantSlug={slug} campaigns={donationBanners} />
          </div>
        )}
      </div>
    </main>
  );
}
