"use server";

import { cookies } from "next/headers";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, resolveIdentity } from "@jalajogja/db";
import { createTenantDb, generateFinancialNumber } from "@jalajogja/db";
import { tenants } from "@jalajogja/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CartItemType = "product" | "ticket" | "donation" | "custom";

export type CartItemInput = {
  itemType:    CartItemType;
  itemId?:     string;
  name:        string;
  unitPrice:   number;
  quantity?:   number;
  notes?:      string;
};

export type CartItem = {
  id:        string;
  itemType:  CartItemType;
  itemId:    string | null;
  name:      string;
  unitPrice: number;
  quantity:  number;
  notes:     string | null;
  sortOrder: number;
};

export type CartData = {
  cartId:    string;
  items:     CartItem[];
  subtotal:  number;
  expiresAt: string;
};

export type CheckoutCustomerData = {
  phone?:  string;
  email?:  string;
  name?:   string;
  method:  "cash" | "transfer" | "qris";
  notes?:  string;
};

// ─── Cookie helper ────────────────────────────────────────────────────────────

const COOKIE_NAME = "cart_session";
const CART_TTL_HOURS = 24;

async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

async function setSessionToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   CART_TTL_HOURS * 60 * 60,
    path:     "/",
  });
}

// ─── getOrCreateCart ──────────────────────────────────────────────────────────
// Internal: resolve or create cart by session token. Returns cart ID.

async function getOrCreateCart(
  db: ReturnType<typeof createTenantDb>["db"],
  schema: ReturnType<typeof createTenantDb>["schema"]
): Promise<string> {
  const token = await getSessionToken();

  if (token) {
    const [existing] = await db
      .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (existing && existing.expiresAt > new Date()) {
      return existing.id;
    }
  }

  // Create new cart
  const newToken   = crypto.randomUUID();
  const expiresAt  = new Date(Date.now() + CART_TTL_HOURS * 60 * 60 * 1000);

  const [cart] = await db
    .insert(schema.carts)
    .values({ sessionToken: newToken, expiresAt })
    .returning({ id: schema.carts.id });

  await setSessionToken(newToken);
  return cart.id;
}

// ─── getCartAction ────────────────────────────────────────────────────────────

export async function getCartAction(slug: string): Promise<ActionResult<CartData | null>> {
  try {
    const token = await getSessionToken();
    if (!token) return { success: true, data: null };

    const { db: tenantDb, schema } = createTenantDb(slug);

    const [cart] = await tenantDb
      .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (!cart || cart.expiresAt <= new Date()) return { success: true, data: null };

    const items = await tenantDb
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cart.id))
      .orderBy(schema.cartItems.sortOrder, schema.cartItems.createdAt);

    const cartItems: CartItem[] = items.map((it) => ({
      id:        it.id,
      itemType:  it.itemType as CartItemType,
      itemId:    it.itemId,
      name:      it.name,
      unitPrice: parseFloat(String(it.unitPrice)),
      quantity:  it.quantity,
      notes:     it.notes,
      sortOrder: it.sortOrder,
    }));

    const subtotal = cartItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

    return {
      success: true,
      data: {
        cartId:    cart.id,
        items:     cartItems,
        subtotal,
        expiresAt: cart.expiresAt.toISOString(),
      },
    };
  } catch (err) {
    console.error("[getCartAction]", err);
    return { success: false, error: "Gagal memuat keranjang." };
  }
}

// ─── addToCartAction ──────────────────────────────────────────────────────────

export async function addToCartAction(
  slug: string,
  item: CartItemInput
): Promise<ActionResult<{ cartItemId: string }>> {
  if (!item.name?.trim()) return { success: false, error: "Nama item tidak boleh kosong." };
  if ((item.unitPrice ?? 0) < 0) return { success: false, error: "Harga tidak boleh negatif." };

  try {
    const { db: tenantDb, schema } = createTenantDb(slug);
    const cartId = await getOrCreateCart(tenantDb, schema);

    // Jika item_id sama sudah ada → update qty saja
    if (item.itemId) {
      const [existing] = await tenantDb
        .select({ id: schema.cartItems.id, quantity: schema.cartItems.quantity })
        .from(schema.cartItems)
        .where(and(
          eq(schema.cartItems.cartId, cartId),
          eq(schema.cartItems.itemId, item.itemId)
        ))
        .limit(1);

      if (existing) {
        await tenantDb
          .update(schema.cartItems)
          .set({ quantity: existing.quantity + (item.quantity ?? 1) })
          .where(eq(schema.cartItems.id, existing.id));

        revalidatePath(`/${slug}/keranjang`);
        return { success: true, data: { cartItemId: existing.id } };
      }
    }

    // Count existing items untuk sort_order
    const [{ cnt }] = await tenantDb
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cartId));

    const [cartItem] = await tenantDb
      .insert(schema.cartItems)
      .values({
        cartId,
        itemType:  item.itemType,
        itemId:    item.itemId ?? null,
        name:      item.name.trim(),
        unitPrice: item.unitPrice.toFixed(2),
        quantity:  item.quantity ?? 1,
        notes:     item.notes?.trim() ?? null,
        sortOrder: Number(cnt),
      })
      .returning({ id: schema.cartItems.id });

    revalidatePath(`/${slug}/keranjang`);
    return { success: true, data: { cartItemId: cartItem.id } };
  } catch (err) {
    console.error("[addToCartAction]", err);
    return { success: false, error: "Gagal menambahkan item." };
  }
}

// ─── updateCartItemQtyAction ──────────────────────────────────────────────────

export async function updateCartItemQtyAction(
  slug: string,
  cartItemId: string,
  quantity: number
): Promise<ActionResult> {
  if (quantity < 1) return { success: false, error: "Kuantitas minimal 1." };

  try {
    const { db: tenantDb, schema } = createTenantDb(slug);
    await tenantDb
      .update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, cartItemId));

    revalidatePath(`/${slug}/keranjang`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateCartItemQtyAction]", err);
    return { success: false, error: "Gagal update kuantitas." };
  }
}

// ─── removeCartItemAction ─────────────────────────────────────────────────────

export async function removeCartItemAction(
  slug: string,
  cartItemId: string
): Promise<ActionResult> {
  try {
    const { db: tenantDb, schema } = createTenantDb(slug);
    await tenantDb
      .delete(schema.cartItems)
      .where(eq(schema.cartItems.id, cartItemId));

    revalidatePath(`/${slug}/keranjang`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[removeCartItemAction]", err);
    return { success: false, error: "Gagal menghapus item." };
  }
}

// ─── clearCartAction ──────────────────────────────────────────────────────────

export async function clearCartAction(slug: string): Promise<ActionResult> {
  try {
    const token = await getSessionToken();
    if (!token) return { success: true, data: undefined };

    const { db: tenantDb, schema } = createTenantDb(slug);
    const [cart] = await tenantDb
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (cart) {
      await tenantDb.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));
    }

    revalidatePath(`/${slug}/keranjang`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[clearCartAction]", err);
    return { success: false, error: "Gagal mengosongkan keranjang." };
  }
}

// ─── checkoutAction ───────────────────────────────────────────────────────────
// Buat invoice dari cart. Harga di-re-fetch dari DB (tidak percaya snapshot).
// Untuk item custom (donation/manual), pakai harga snapshot karena tidak ada produk di DB.

export async function checkoutAction(
  slug: string,
  customer: CheckoutCustomerData
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  if (!customer.phone?.trim() && !customer.email?.trim()) {
    return { success: false, error: "Nomor HP atau email wajib diisi." };
  }

  try {
    const token = await getSessionToken();
    if (!token) return { success: false, error: "Keranjang tidak ditemukan." };

    const tenantDb = createTenantDb(slug);
    const { db: tdb, schema } = tenantDb;

    // Ambil cart
    const [cart] = await tdb
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (!cart) return { success: false, error: "Keranjang tidak ditemukan atau sudah kadaluarsa." };

    const cartItems = await tdb
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cart.id))
      .orderBy(schema.cartItems.sortOrder);

    if (!cartItems.length) return { success: false, error: "Keranjang kosong." };

    // ── Lookup identitas via resolveIdentity ─────────────────────────────────
    // Urutan: session login → public.profiles → public.members → guest
    const identity = await resolveIdentity(db, {
      phone: customer.phone?.trim() || null,
      email: customer.email?.trim() || null,
    });

    const memberId  = identity.memberId;
    const profileId = identity.profileId;
    let customerName = customer.name?.trim() || identity.resolvedName || "";

    if (!customerName) {
      customerName = customer.phone?.trim() || customer.email?.trim() || "Guest";
    }

    // ── Re-fetch harga untuk item dengan itemId (produk/tiket) ──────────────
    const resolvedItems: Array<{
      itemType:    string;
      itemId:      string | null;
      name:        string;
      unitPrice:   number;
      quantity:    number;
    }> = [];

    for (const item of cartItems) {
      let unitPrice = parseFloat(String(item.unitPrice));

      if (item.itemId) {
        if (item.itemType === "product") {
          const [prod] = await tdb
            .select({ price: schema.products.price, name: schema.products.name })
            .from(schema.products)
            .where(eq(schema.products.id, item.itemId))
            .limit(1);
          if (prod) { unitPrice = parseFloat(String(prod.price)); }
        } else if (item.itemType === "ticket") {
          const [ticket] = await tdb
            .select({ price: schema.eventTickets.price, name: schema.eventTickets.name })
            .from(schema.eventTickets)
            .where(eq(schema.eventTickets.id, item.itemId))
            .limit(1);
          if (ticket) { unitPrice = parseFloat(String(ticket.price)); }
        }
      }

      resolvedItems.push({
        itemType:  item.itemType,
        itemId:    item.itemId,
        name:      item.name,
        unitPrice,
        quantity:  item.quantity,
      });
    }

    // ── Buat invoice ─────────────────────────────────────────────────────────
    const invoiceNumber = await generateFinancialNumber(tenantDb, "invoice");
    const subtotal  = resolvedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const total     = subtotal;

    const dueDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    })();

    const [invoice] = await tdb
      .insert(schema.invoices)
      .values({
        invoiceNumber,
        sourceType:    "cart",
        sourceId:      cart.id,
        customerName,
        customerPhone: customer.phone?.trim() ?? null,
        customerEmail: customer.email?.trim() ?? null,
        memberId,
        profileId,
        subtotal:      subtotal.toFixed(2),
        discount:      "0",
        total:         total.toFixed(2),
        paidAmount:    "0",
        status:        "pending",
        dueDate,
        notes:         customer.notes?.trim() ?? null,
        createdBy:     null,
      })
      .returning({ id: schema.invoices.id });

    // Insert invoice items
    await tdb.insert(schema.invoiceItems).values(
      resolvedItems.map((item, i) => ({
        invoiceId:   invoice.id,
        itemType:    item.itemType as "product" | "ticket" | "donation" | "custom",
        itemId:      item.itemId ?? null,
        name:        item.name,
        unitPrice:   item.unitPrice.toFixed(2),
        quantity:    item.quantity,
        total:       (item.unitPrice * item.quantity).toFixed(2),
        sortOrder:   i,
      }))
    );

    // Hapus cart setelah checkout berhasil
    await tdb.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));
    await tdb.delete(schema.carts).where(eq(schema.carts.id, cart.id));

    // Hapus cookie cart
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    return { success: true, data: { invoiceId: invoice.id, invoiceNumber } };
  } catch (err) {
    console.error("[checkoutAction]", err);
    return { success: false, error: "Gagal membuat invoice. Coba lagi." };
  }
}

// ─── submitPaymentProofAction ─────────────────────────────────────────────────
// Customer upload bukti bayar → payment status jadi 'submitted'

export async function submitPaymentProofAction(
  slug: string,
  invoiceId: string,
  data: {
    method:       "cash" | "transfer" | "qris";
    payerName?:   string;
    payerBank?:   string;
    transferDate?: string;
    proofUrl?:    string;
    notes?:       string;
  }
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const tenantDb = createTenantDb(slug);
    const { db: tdb, schema } = tenantDb;

    const [inv] = await tdb
      .select({ id: schema.invoices.id, customerName: schema.invoices.customerName,
                total: schema.invoices.total, paidAmount: schema.invoices.paidAmount,
                invoiceNumber: schema.invoices.invoiceNumber, status: schema.invoices.status })
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId))
      .limit(1);

    if (!inv)                          return { success: false, error: "Invoice tidak ditemukan." };
    if (inv.status === "paid")         return { success: false, error: "Invoice sudah lunas." };
    if (inv.status === "cancelled")    return { success: false, error: "Invoice sudah dibatalkan." };

    const remaining = parseFloat(String(inv.total)) - parseFloat(String(inv.paidAmount));
    if (remaining <= 0) return { success: false, error: "Invoice sudah lunas." };

    const payNumber = await generateFinancialNumber(tenantDb, "payment");

    const [payment] = await tdb
      .insert(schema.payments)
      .values({
        number:       payNumber,
        sourceType:   "invoice",
        sourceId:     invoiceId,
        amount:       remaining.toFixed(2),
        uniqueCode:   0,
        method:       data.method,
        status:       "submitted",
        transferDate: data.transferDate ?? null,
        proofUrl:     data.proofUrl ?? null,
        payerName:    data.payerName?.trim() ?? inv.customerName,
        payerBank:    data.payerBank?.trim() ?? null,
        payerNote:    data.notes?.trim() ?? null,
        submittedAt:  new Date(),
      })
      .returning({ id: schema.payments.id });

    // Link ke invoice
    await tdb.insert(schema.invoicePayments).values({
      invoiceId,
      paymentId: payment.id,
      amount:    remaining.toFixed(2),
    });

    // Update status invoice → waiting_verification
    await tdb
      .update(schema.invoices)
      .set({ status: "waiting_verification", updatedAt: new Date() })
      .where(eq(schema.invoices.id, invoiceId));

    return { success: true, data: { paymentId: payment.id } };
  } catch (err) {
    console.error("[submitPaymentProofAction]", err);
    return { success: false, error: "Gagal mengirim konfirmasi pembayaran." };
  }
}
