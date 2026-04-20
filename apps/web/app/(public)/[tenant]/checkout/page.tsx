import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { CheckoutForm } from "@/components/billing/checkout-form";
import type { CartData, CartItem } from "@/app/(public)/[tenant]/cart/actions";

type Props = { params: Promise<{ tenant: string }> };

export default async function CheckoutPage({ params }: Props) {
  const { tenant: slug } = await params;

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  // Baca keranjang
  const cookieStore = await cookies();
  const token = cookieStore.get("cart_session")?.value ?? null;

  if (!token) redirect(`/${slug}/keranjang`);

  let cart: CartData | null = null;

  try {
    const { db: tenantDb, schema } = createTenantDb(slug);

    const [cartRow] = await tenantDb
      .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (!cartRow || cartRow.expiresAt <= new Date()) {
      redirect(`/${slug}/keranjang`);
    }

    const items = await tenantDb
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cartRow.id))
      .orderBy(schema.cartItems.sortOrder, schema.cartItems.createdAt);

    if (items.length === 0) redirect(`/${slug}/keranjang`);

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
  } catch {
    redirect(`/${slug}/keranjang`);
  }

  if (!cart) redirect(`/${slug}/keranjang`);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <a
            href={`/${slug}/keranjang`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Kembali ke Keranjang
          </a>
        </div>
        <h1 className="text-xl font-semibold mb-6">Checkout</h1>
        <CheckoutForm slug={slug} cart={cart} />
      </div>
    </main>
  );
}
