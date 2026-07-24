"use server";

import { cookies, headers } from "next/headers";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, resolveIdentity, generateUniqueCode, generateInstallmentScheduleCode, settleInstallmentSchedules } from "@jalajogja/db";
import { createTenantDb, generateFinancialNumber, getSettings } from "@jalajogja/db";
import {
  findVoucherByCode, countCustomerRedemptions, computeVoucherDiscount,
  type VoucherApplicationResult, type ResolvedCartItemForVoucher,
} from "@jalajogja/db";
import { tenants } from "@jalajogja/db";
import { normalizePhone } from "@/lib/phone";
import { auth } from "@/lib/auth";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";
import { getTenantTimezone, anchorTodayUtc, todayInTz, formatInTz, tzLabel } from "@/lib/tenant-timezone.server";

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
  // Penanda "niat bayar untuk daftar forum" — HANYA true kalau item ditambahkan lewat link
  // ?forGabung=1 di halaman /gabung. Lihat docs/arsitektur-backbone-ikpm.md
  // § "Pemisahan Donasi vs Registrasi Forum". Default false — donasi/pembelian biasa TIDAK
  // PERNAH mengaktifkan keanggotaan forum meski itemId-nya kebetulan cocok syarat iuran.
  forGabung?:  boolean;
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

export type SellerGroup = {
  key:             string;
  sellerType:      "tenant" | "mitra";
  sellerId:        string | null;
  sellerName:      string;
  originCityId:    number;
  originCityName:  string;
  items: Array<{
    cartItemId:  string;
    productId:   string;
    name:        string;
    quantity:    number;
    weightGram:  number;
  }>;
  totalWeightGram: number;
};

export type CheckoutShippingLine = {
  sellerType:      "tenant" | "mitra";
  sellerId:        string | null;
  sellerName:      string;
  originCityId:    number;
  originCityName:  string;
  courier:         string;
  service:         string;
  serviceDesc?:    string;
  etd?:            string;
  weightGram:      number;
  cost:            number;
};

export type CheckoutShippingData = {
  cityId:    number;
  cityName:  string;
  address?:  string;
  lines:     CheckoutShippingLine[];
};

// ─── Cookie helper ────────────────────────────────────────────────────────────

const COOKIE_NAME = "cart_session";
const CART_TTL_HOURS = 24;

// Sama dengan generateRegistrationNumber di event/actions.ts / generateEventRegNumber di
// finance/billing/actions.ts — di-duplikasi agar cart tidak bergantung ke modul lain (pola
// yang sama sudah dipakai berulang di project ini). Dipakai HANYA untuk checkout Rp 0 (voucher
// 100%) yang auto-lunas tiket event tanpa lewat confirmInvoicePaymentAction.
async function generateEventRegNumber(
  tenantDb: ReturnType<typeof createTenantDb>,
): Promise<string> {
  const { db: tdb, schema } = tenantDb;
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  const nextNumber = await tdb.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.eventRegistrationSequences)
      .where(
        sql`${schema.eventRegistrationSequences.year}  = ${year}
        AND ${schema.eventRegistrationSequences.month} = ${month}
        FOR UPDATE`
      );

    if (rows.length === 0) {
      await tx.insert(schema.eventRegistrationSequences).values({ year, month, counter: 1 });
      return 1;
    }
    const next = rows[0].counter + 1;
    await tx
      .update(schema.eventRegistrationSequences)
      .set({ counter: next })
      .where(eq(schema.eventRegistrationSequences.id, rows[0].id));
    return next;
  });

  return `EVT-${yyyymm}-${String(nextNumber).padStart(5, "0")}`;
}

function formatEventDateWib(date: Date | null, timezone: string): string {
  if (!date) return "-";
  return `${formatInTz(date, timezone, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} ${tzLabel(timezone)}`;
}

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

// ─── previewVoucherAction ──────────────────────────────────────────────────────
// Preview murni untuk tampilan di halaman keranjang — TIDAK mengunci voucher row, TIDAK
// menaikkan usedCount, TIDAK mutasi apa pun. Boleh sedikit stale (race window sampai checkout
// sungguhan) — checkoutAction SELALU re-validasi dari nol di dalam transaction-nya sendiri
// (§ Alur Checkout, docs/arsitektur-voucher.md). `customer` opsional karena halaman keranjang
// biasanya belum tentu sudah tahu nomor HP/email customer (baru diisi di langkah checkout) —
// kalau kosong, validasi restrictPhone/restrictEmail/usageLimitPerCustomer di-skip untuk
// preview (tetap divalidasi penuh saat checkout sungguhan).
export type VoucherPreview = {
  valid:           boolean;
  error?:          string;
  voucherName?:    string;
  perItemDiscount?: Record<string, number>; // cartItemId -> nominal potongan
  totalDiscount?:   number;
};

export async function previewVoucherAction(
  slug: string,
  code: string,
  customer?: { phone?: string; email?: string },
): Promise<ActionResult<VoucherPreview>> {
  try {
    const token = await getSessionToken();
    if (!token) return { success: true, data: { valid: false, error: "Keranjang tidak ditemukan." } };

    const { db: tenantDb, schema } = createTenantDb(slug);

    const [cart] = await tenantDb
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);
    if (!cart) return { success: true, data: { valid: false, error: "Keranjang tidak ditemukan." } };

    const cartItems = await tenantDb
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cart.id))
      .orderBy(schema.cartItems.sortOrder);
    if (!cartItems.length) return { success: true, data: { valid: false, error: "Keranjang kosong." } };

    const voucherRow = await findVoucherByCode(tenantDb, schema, code, false);
    if (!voucherRow) return { success: true, data: { valid: false, error: "Kode voucher tidak ditemukan." } };

    const normalizedPhone = customer?.phone ? normalizePhone(customer.phone) : null;
    const emailTrim       = customer?.email?.trim() || null;

    const existingRedemptions = await countCustomerRedemptions(tenantDb, schema, voucherRow.id, {
      phone: normalizedPhone, email: emailTrim,
    });

    // Re-fetch harga + mitraId per item (SAMA seperti loop resolusi di checkoutAction) — supaya
    // preview TIDAK pernah menampilkan diskon untuk produk mitra yang nanti dikecualikan saat
    // checkout sungguhan (staleness harga boleh, staleness "berlaku/tidaknya diskon" tidak boleh).
    const voucherResolvedItems: ResolvedCartItemForVoucher[] = [];
    for (const item of cartItems) {
      let unitPrice = parseFloat(String(item.unitPrice));
      let mitraId: string | null = null;
      if (item.itemId) {
        if (item.itemType === "product") {
          const [prod] = await tenantDb
            .select({ price: schema.products.price, mitraId: schema.products.mitraId })
            .from(schema.products).where(eq(schema.products.id, item.itemId)).limit(1);
          if (prod) { unitPrice = parseFloat(String(prod.price)); mitraId = prod.mitraId ?? null; }
        } else if (item.itemType === "ticket") {
          const [ticket] = await tenantDb
            .select({ price: schema.eventTickets.price })
            .from(schema.eventTickets).where(eq(schema.eventTickets.id, item.itemId)).limit(1);
          if (ticket) unitPrice = parseFloat(String(ticket.price));
        }
      }
      voucherResolvedItems.push({ itemType: item.itemType, itemId: item.itemId, unitPrice, quantity: item.quantity, mitraId });
    }

    const result = computeVoucherDiscount(
      voucherRow, { phone: normalizedPhone, email: emailTrim }, existingRedemptions, voucherResolvedItems,
    );
    if ("error" in result) return { success: true, data: { valid: false, error: result.error } };

    const perItemDiscount: Record<string, number> = {};
    result.perItemDiscount.forEach((discount, index) => {
      perItemDiscount[cartItems[index].id] = discount;
    });

    return {
      success: true,
      data: { valid: true, voucherName: result.voucher.name, perItemDiscount, totalDiscount: result.totalDiscount },
    };
  } catch (err) {
    console.error("[previewVoucherAction]", err);
    return { success: false, error: "Gagal memeriksa voucher." };
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
          .set({
            quantity: existing.quantity + (item.quantity ?? 1),
            // Retroaktif: kalau user kembali lewat link /gabung untuk item yang sudah ada di
            // cart (ditambahkan sebelumnya lewat jalur biasa), tandai baris yang sudah ada —
            // jangan pernah UN-tandai baris yang sebelumnya sudah true hanya karena panggilan
            // ini forGabung=false.
            ...(item.forGabung ? { forGabungRegistration: true } : {}),
          })
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
        forGabungRegistration: !!item.forGabung,
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
  customer: CheckoutCustomerData,
  shipping?: CheckoutShippingData,
  voucherCode?: string,
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  if (!customer.phone?.trim() && !customer.email?.trim()) {
    return { success: false, error: "Nomor HP atau email wajib diisi." };
  }

  try {
    const token = await getSessionToken();
    if (!token) return { success: false, error: "Keranjang tidak ditemukan." };

    const tenantDb = createTenantDb(slug);
    const { db: tdb, schema } = tenantDb;

    // ── Lookup identitas via resolveIdentity ─────────────────────────────────
    // Urutan: session login → public.profiles → public.members → guest
    // Query ke public schema — di luar transaction tenant di bawah (koneksi/DB berbeda).
    const session = await auth.api.getSession({ headers: await headers() });
    const identity = await resolveIdentity(db, {
      betterAuthUserId: session?.user?.id ?? null,
      phone: normalizePhone(customer.phone),
      email: customer.email?.trim() || null,
    });

    const memberId  = identity.memberId;
    const profileId = identity.profileId;
    let customerName = customer.name?.trim() || identity.resolvedName || "";

    if (!customerName) {
      customerName = customer.phone?.trim() || customer.email?.trim() || "Guest";
    }

    const paymentSettings   = await getSettings(tenantDb, "payment");
    const uniqueCodeEnabled = paymentSettings["unique_code_enabled"] === true;
    const tenantTimezone    = await getTenantTimezone(tenantDb);

    // ── Transaction: lock cart FOR UPDATE mencegah double-checkout dari klik ganda /
    // double-tap / retry jaringan. Request kedua yang datang hampir bersamaan akan
    // menunggu lock cart ini, lalu menemukan cart_items sudah kosong (sudah diproses
    // request pertama) dan berhenti tanpa membuat invoice duplikat.
    // Pattern sama dengan lock invoice di confirmInvoicePaymentAction (billing/actions.ts).
    type TxResult =
      | { error: string }
      | { duplicate: true; invoiceId: string; invoiceNumber: string }
      | {
          invoiceId: string; invoiceNumber: string; total: number; dueDate: string;
          isFullyPaid: boolean; voucherDiscountTotal: number;
          newEventRegs: Array<{ eventId: string; regNumber: string; attendeeName: string; attendeePhone: string | null }>;
        };

    const txResult: TxResult = await tdb.transaction(async (tx) => {
      const [lockedCart] = await tx
        .select({ id: schema.carts.id })
        .from(schema.carts)
        .where(sql`${schema.carts.sessionToken} = ${token} FOR UPDATE`)
        .limit(1);

      if (!lockedCart) return { error: "Keranjang tidak ditemukan atau sudah kadaluarsa." };

      const cartItems = await tx
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, lockedCart.id))
        .orderBy(schema.cartItems.sortOrder);

      if (!cartItems.length) return { error: "Keranjang kosong atau sudah diproses." };

      // ── Deteksi duplikat registrasi tiket event ─────────────────────────────
      // Kasus nyata: customer checkout tiket, ragu berhasil, checkout ulang tiket yang
      // sama beberapa menit kemudian → 2 invoice terpisah untuk 1 tiket yang sama.
      // Dibatasi ke cart yang HANYA berisi 1 tiket (kasus paling umum) — cart campuran
      // (tiket + produk/donasi) tidak dicek, untuk hindari deadlock saat customer memang
      // ingin bayar item lain sekaligus meski tiketnya sudah pernah dibuatkan invoice.
      const soleItem = cartItems.length === 1 ? cartItems[0] : null;
      if (soleItem?.itemType === "ticket" && soleItem.itemId) {
        const normalizedPhone = normalizePhone(customer.phone);
        const emailTrim       = customer.email?.trim() || null;

        const identityConditions = [
          memberId  ? eq(schema.invoices.memberId, memberId)          : null,
          profileId ? eq(schema.invoices.profileId, profileId)        : null,
          normalizedPhone ? eq(schema.invoices.customerPhone, normalizedPhone) : null,
          emailTrim ? eq(schema.invoices.customerEmail, emailTrim)    : null,
        ].filter((c): c is NonNullable<typeof c> => c !== null);

        if (identityConditions.length > 0) {
          const [dup] = await tx
            .select({ id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber })
            .from(schema.invoices)
            .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
            .where(and(
              eq(schema.invoiceItems.itemType, "ticket"),
              eq(schema.invoiceItems.itemId, soleItem.itemId),
              inArray(schema.invoices.status, ["pending", "waiting_verification", "partial"]),
              or(...identityConditions),
            ))
            .limit(1);

          if (dup) {
            // Bersihkan cart (tiket duplikat tidak jadi dibuat) lalu arahkan ke invoice lama
            await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, lockedCart.id));
            await tx.delete(schema.carts).where(eq(schema.carts.id, lockedCart.id));
            return { duplicate: true, invoiceId: dup.id, invoiceNumber: dup.invoiceNumber };
          }
        }
      }

      // Re-fetch harga untuk item dengan itemId (produk/tiket)
      const resolvedItems: Array<{
        itemType:  string;
        itemId:    string | null;
        name:      string;
        notes:     string | null;
        unitPrice: number;
        quantity:  number;
        mitraId:   string | null;
        forGabungRegistration: boolean;
      }> = [];

      for (const item of cartItems) {
        let unitPrice = parseFloat(String(item.unitPrice));
        let mitraId: string | null = null;

        if (item.itemId) {
          if (item.itemType === "product") {
            const [prod] = await tx
              .select({ price: schema.products.price, name: schema.products.name, mitraId: schema.products.mitraId })
              .from(schema.products)
              .where(eq(schema.products.id, item.itemId))
              .limit(1);
            if (prod) {
              unitPrice = parseFloat(String(prod.price));
              mitraId   = prod.mitraId ?? null;
            }
          } else if (item.itemType === "ticket") {
            const [ticket] = await tx
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
          notes:     item.notes ?? null,
          unitPrice,
          quantity:  item.quantity,
          mitraId,
          forGabungRegistration: item.forGabungRegistration,
        });
      }

      // ── Resolusi voucher (opsional) — SETELAH resolvedItems (unitPrice FINAL) siap, jangan
      // pernah reimplement resolusi harga sendiri di sini. Lihat docs/arsitektur-voucher.md.
      // Lock voucher row (forUpdate) di dalam transaction yang sama dengan lock cart — cegah
      // race dua checkout bersamaan sama-sama lolos cek usageLimit voucher yang sama.
      let voucherApplication: VoucherApplicationResult | null = null;
      const normalizedCustomerPhone = normalizePhone(customer.phone);
      const customerEmailTrim       = customer.email?.trim() || null;

      if (voucherCode?.trim()) {
        const voucherRow = await findVoucherByCode(tx, schema, voucherCode, true);
        if (!voucherRow) return { error: "Kode voucher tidak ditemukan." };

        const existingRedemptions = await countCustomerRedemptions(tx, schema, voucherRow.id, {
          phone: normalizedCustomerPhone, email: customerEmailTrim,
        });

        const voucherResolvedItems: ResolvedCartItemForVoucher[] = resolvedItems.map((it) => ({
          itemType: it.itemType, itemId: it.itemId, unitPrice: it.unitPrice,
          quantity: it.quantity, mitraId: it.mitraId,
        }));

        const result = computeVoucherDiscount(
          voucherRow, { phone: normalizedCustomerPhone, email: customerEmailTrim },
          existingRedemptions, voucherResolvedItems,
        );
        if ("error" in result) return { error: result.error };
        voucherApplication = result;
      }

      // ── Buat invoice ─────────────────────────────────────────────────────────
      const invoiceNumber  = await generateFinancialNumber(tenantDb, "invoice");
      const subtotal       = resolvedItems.reduce((s, it, i) => {
        const discount  = voucherApplication?.perItemDiscount.get(i) ?? 0;
        const lineTotal = Math.max(0, it.unitPrice * it.quantity - discount);
        return s + lineTotal;
      }, 0);
      const shippingTotal  = shipping?.lines.reduce((s, l) => s + l.cost, 0) ?? 0;
      const total          = subtotal + shippingTotal;
      // Voucher 100% (atau kombinasi diskon+ongkir Rp 0) → invoice langsung lunas tanpa
      // langkah bayar sama sekali. Lihat docs/arsitektur-voucher.md § "Checkout Rp 0".
      const isFullyPaid    = total <= 0;

      // Anchor ke kalender timezone tenant, bukan UTC mentah — lihat lib/tenant-timezone.ts.
      const dueDate = (() => {
        const d = anchorTodayUtc(tenantTimezone);
        d.setUTCDate(d.getUTCDate() + 3);
        return d.toISOString().slice(0, 10);
      })();

      // Kode unik TIDAK PERNAH digenerate untuk tagihan Rp 0 — tidak ada apa pun yang perlu
      // ditransfer, jadi tidak ada gunanya kode identifikasi transfer. Lihat docs/arsitektur-voucher.md.
      const uniqueCode = (uniqueCodeEnabled && total > 0) ? await generateUniqueCode(tenantDb) : 0;

      const [invoice] = await tx
        .insert(schema.invoices)
        .values({
          invoiceNumber,
          sourceType:       "cart",
          sourceId:         lockedCart.id,
          customerName,
          customerPhone:    normalizedCustomerPhone,
          customerEmail:    customerEmailTrim,
          memberId,
          profileId,
          subtotal:         subtotal.toFixed(2),
          shippingTotal:    shippingTotal.toFixed(2),
          discount:         "0", // field lama, murni admin-manual — voucher TIDAK memakainya
          total:            total.toFixed(2),
          uniqueCode,
          paidAmount:       isFullyPaid ? total.toFixed(2) : "0",
          shippingCityId:   shipping?.cityId    ?? null,
          shippingCityName: shipping?.cityName  ?? null,
          shippingAddress:  shipping?.address   ?? null,
          status:           isFullyPaid ? "paid" : "pending",
          dueDate,
          notes:            customer.notes?.trim() ?? null,
          createdBy:        null,
          voucherId:            voucherApplication?.voucher.id ?? null,
          voucherCode:           voucherApplication?.voucher.code ?? null,
          voucherDiscountTotal:  (voucherApplication?.totalDiscount ?? 0).toFixed(2),
        })
        .returning({ id: schema.invoices.id });

      // Insert invoice items (dengan seller info untuk mitra + diskon per baris)
      await tx.insert(schema.invoiceItems).values(
        resolvedItems.map((item, i) => {
          const discountAmount = voucherApplication?.perItemDiscount.get(i) ?? 0;
          const lineTotal      = Math.max(0, item.unitPrice * item.quantity - discountAmount);
          return {
            invoiceId:   invoice.id,
            itemType:    item.itemType as "product" | "ticket" | "donation" | "custom",
            itemId:      item.itemId ?? null,
            name:        item.name,
            description: item.notes ?? null,
            unitPrice:   item.unitPrice.toFixed(2),
            quantity:    item.quantity,
            total:       lineTotal.toFixed(2),
            sortOrder:   i,
            sellerType:  (item.mitraId ? "mitra" : "tenant") as "tenant" | "mitra",
            sellerId:    item.mitraId ?? null,
            discountAmount: discountAmount.toFixed(2),
            voucherId:      discountAmount > 0 ? (voucherApplication?.voucher.id ?? null) : null,
            forGabungRegistration: item.forGabungRegistration,
          };
        })
      );

      // Catat pemakaian voucher — lock yang sama dari resolusi di atas mencegah race
      // dua checkout bersamaan sama-sama lolos cek usageLimit voucher yang sama.
      if (voucherApplication) {
        await tx
          .update(schema.vouchers)
          .set({ usedCount: sql`${schema.vouchers.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(schema.vouchers.id, voucherApplication.voucher.id));

        await tx.insert(schema.voucherRedemptions).values({
          voucherId:     voucherApplication.voucher.id,
          invoiceId:     invoice.id,
          customerPhone: normalizedCustomerPhone,
          customerEmail: customerEmailTrim,
          discountTotal: voucherApplication.totalDiscount.toFixed(2),
        });
      }

      // Insert shipping lines (jika ada)
      if (shipping && shipping.lines.length > 0) {
        await tx.insert(schema.invoiceShippingLines).values(
          shipping.lines.map(line => ({
            invoiceId:      invoice.id,
            sellerType:     line.sellerType,
            sellerId:       line.sellerId ?? null,
            sellerName:     line.sellerName,
            originCityId:   line.originCityId,
            originCityName: line.originCityName,
            courier:        line.courier,
            service:        line.service,
            serviceDesc:    line.serviceDesc ?? null,
            etd:            line.etd ?? null,
            weightGram:     line.weightGram,
            cost:           line.cost.toFixed(2),
            status:         "pending" as const,
          }))
        );
      }

      // ── Efek samping "invoice langsung lunas" (Rp 0) — pola SAMA PERSIS dengan blok
      // `if (newStatus === "paid")` di confirmInvoicePaymentAction (finance/billing/actions.ts),
      // duplikasi disengaja (checkoutAction tidak boleh bergantung ke modul finance/billing).
      // TIDAK ada jurnal (recordIncome) — nominal 0, tidak ada uang masuk untuk dicatat.
      const newEventRegs: Array<{ eventId: string; regNumber: string; attendeeName: string; attendeePhone: string | null }> = [];

      if (isFullyPaid) {
        // Sync collected_amount kampanye donasi — pakai resolvedItems (sudah di-hitung net-of-
        // diskon di atas), TIDAK re-query invoiceItems (item yang baru di-insert masih di
        // transaction yang sama, lebih murah pakai data yang sudah ada di memory).
        const campaignAmounts: Record<string, number> = {};
        resolvedItems.forEach((item, i) => {
          if (item.itemType !== "donation" || !item.itemId) return;
          const discountAmount = voucherApplication?.perItemDiscount.get(i) ?? 0;
          const lineTotal      = Math.max(0, item.unitPrice * item.quantity - discountAmount);
          campaignAmounts[item.itemId] = (campaignAmounts[item.itemId] ?? 0) + lineTotal;
        });
        for (const [cId, amt] of Object.entries(campaignAmounts)) {
          await tx.update(schema.campaigns)
            .set({ collectedAmount: sql`collected_amount + ${String(amt)}` })
            .where(eq(schema.campaigns.id, cId));
        }

        // Auto-create event_registrations dari tiket — attendee data ada di item.notes (JSON),
        // pola sama dengan parsing invoiceItems.description di confirmInvoicePaymentAction.
        for (const item of resolvedItems) {
          if (item.itemType !== "ticket" || !item.itemId) continue;

          let attendeeName  = item.name ?? "Peserta";
          let attendeePhone: string | null = null;
          let attendeeEmail: string | null = null;
          let extraFields:   Record<string, unknown> | null = null;
          try {
            const p = JSON.parse(item.notes ?? "{}") as Record<string, unknown>;
            attendeeName  = String(p.attendeeName ?? item.name ?? "Peserta").trim();
            attendeePhone = p.attendeePhone ? String(p.attendeePhone) : null;
            attendeeEmail = p.attendeeEmail ? String(p.attendeeEmail) : null;
            extraFields   = p.customFieldAnswers ? (p.customFieldAnswers as Record<string, unknown>) : null;
          } catch { /* gunakan default */ }

          const [ticket] = await tx
            .select({ eventId: schema.eventTickets.eventId })
            .from(schema.eventTickets)
            .where(eq(schema.eventTickets.id, item.itemId))
            .limit(1);
          if (!ticket?.eventId) continue;

          const regNumber = await generateEventRegNumber(tenantDb);

          await tx.insert(schema.eventRegistrations).values({
            eventId:            ticket.eventId,
            ticketId:           item.itemId,
            memberId:           memberId ?? null,
            profileId:          profileId ?? null,
            attendeeName,
            attendeePhone,
            attendeeEmail,
            registrationNumber: regNumber,
            status:             "confirmed",
            customFields:       { sourceInvoiceId: invoice.id, ...(extraFields ?? {}) },
          });

          newEventRegs.push({ eventId: ticket.eventId, regNumber, attendeeName, attendeePhone });
        }
      }

      // Hapus cart setelah checkout berhasil — masih dalam lock yang sama
      await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, lockedCart.id));
      await tx.delete(schema.carts).where(eq(schema.carts.id, lockedCart.id));

      return {
        invoiceId: invoice.id, invoiceNumber, total, dueDate, isFullyPaid,
        voucherDiscountTotal: voucherApplication?.totalDiscount ?? 0,
        newEventRegs,
      };
    });

    if ("error" in txResult) return { success: false, error: txResult.error };

    // Hapus cookie cart (berlaku juga untuk kasus duplikat — cart sudah dibersihkan di tx)
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    // Duplikat: arahkan ke invoice lama yang belum lunas, tidak perlu notif baru
    // (invoice lama sudah dapat notifikasi invoice_created saat pertama kali dibuat)
    if ("duplicate" in txResult) {
      return { success: true, data: { invoiceId: txResult.invoiceId, invoiceNumber: txResult.invoiceNumber } };
    }

    void (async () => {
      const invoiceUrl = await waAppUrl(slug, `/invoice/${txResult.invoiceId}`);

      if (txResult.isFullyPaid) {
        // Voucher 100% (atau kombinasi diskon+ongkir Rp 0) — invoice sudah langsung lunas,
        // TIDAK ada apa pun yang perlu dibayar. Notifikasi STANDAR (payment_confirmed), bukan
        // notifikasi baru — pola sama dengan "pelunasan penuh cicilan" yang sudah dikunci.
        void notifyWa({
          slug, tenantDb, event: "payment_confirmed",
          phone: normalizePhone(customer.phone),
          vars: {
            name:          customerName,
            invoiceNumber: txResult.invoiceNumber,
            amount:        waRupiah(0),
          },
        });

        for (const reg of txResult.newEventRegs) {
          const [eventDetail] = await tdb
            .select({ title: schema.events.title, slug: schema.events.slug, startsAt: schema.events.startsAt, location: schema.events.location })
            .from(schema.events)
            .where(eq(schema.events.id, reg.eventId))
            .limit(1);
          if (!eventDetail) continue;

          const eventUrl = await waAppUrl(slug, `/agenda/${eventDetail.slug}`);
          void notifyWa({
            slug, tenantDb, event: "event_registered",
            phone: reg.attendeePhone,
            vars: {
              name:      reg.attendeeName,
              eventName: eventDetail.title,
              eventDate: formatEventDateWib(eventDetail.startsAt, tenantTimezone),
              location:  eventDetail.location ?? "-",
              regNumber: reg.regNumber,
              eventUrl,
            },
          });
        }
      } else {
        void notifyWa({
          slug, tenantDb, event: "invoice_created",
          phone: normalizePhone(customer.phone),
          vars: {
            name:          customerName,
            invoiceNumber: txResult.invoiceNumber,
            amount:        waRupiah(txResult.total),
            dueDate:       txResult.dueDate,
            invoiceUrl,
          },
        });
      }
    })();

    return { success: true, data: { invoiceId: txResult.invoiceId, invoiceNumber: txResult.invoiceNumber } };
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
    amount:       number;   // WAJIB — nominal yang customer klaim sudah ditransfer, lihat docs/arsitektur-billing.md § "Nominal Pembayaran Terlihat + Bisa Diedit"
    method:       "cash" | "transfer" | "qris";
    payerName?:   string;
    payerBank?:   string;
    transferDate?: string;
    proofUrl?:    string;
    notes?:       string;
  }
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    if (!data.amount || data.amount <= 0)
      return { success: false, error: "Nominal transfer harus lebih dari 0." };

    const tenantDb = createTenantDb(slug);
    const { db: tdb, schema } = tenantDb;

    // Guard "sudah waiting_verification" DI LUAR transaction hanya early-exit UX cepat —
    // jaminan korektnes yang sebenarnya ada di guard KEDUA di dalam transaction setelah lock
    // (pola sama dengan checkoutAction/confirmInvoicePaymentAction — lihat lesson CLAUDE.md
    // "guard sudah ada sebelumnya WAJIB diulang di dalam transaction setelah lock").
    type TxResult =
      | { error: string }
      | { paymentId: string; customerName: string; customerPhone: string | null;
          invoiceNumber: string; amount: number; installmentPlanId: string | null };

    const txResult: TxResult = await tdb.transaction(async (tx) => {
      const [lockedInv] = await tx
        .select({ id: schema.invoices.id, customerName: schema.invoices.customerName,
                  customerPhone: schema.invoices.customerPhone,
                  total: schema.invoices.total, paidAmount: schema.invoices.paidAmount,
                  uniqueCode: schema.invoices.uniqueCode,
                  invoiceNumber: schema.invoices.invoiceNumber, status: schema.invoices.status,
                  installmentPlanId: schema.invoices.installmentPlanId })
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${invoiceId} FOR UPDATE`)
        .limit(1);

      if (!lockedInv) return { error: "Invoice tidak ditemukan." };
      if (lockedInv.status === "paid")      return { error: "Invoice sudah lunas." };
      if (lockedInv.status === "cancelled") return { error: "Invoice sudah dibatalkan." };
      if (lockedInv.status === "waiting_verification")
        return { error: "Bukti pembayaran Anda sedang diverifikasi admin. Mohon tunggu, tidak perlu kirim ulang." };

      // Cek masih ada sisa tagihan (bukan menentukan nominal payment — itu dari data.amount,
      // lihat docs/arsitektur-billing.md § "Nominal Pembayaran Terlihat + Bisa Diedit").
      // Wajib sertakan kode unik di amountDue — lihat lesson CLAUDE.md § Kode Unik Transaksi.
      const amountDue = parseFloat(String(lockedInv.total)) + (lockedInv.uniqueCode ?? 0);
      const remaining = amountDue - parseFloat(String(lockedInv.paidAmount));
      if (remaining <= 0) return { error: "Invoice sudah lunas." };

      const payNumber = await generateFinancialNumber(tenantDb, "payment");

      const [payment] = await tx
        .insert(schema.payments)
        .values({
          number:       payNumber,
          sourceType:   "invoice",
          sourceId:     invoiceId,
          amount:       data.amount.toFixed(2),
          uniqueCode:   0,
          method:       data.method,
          status:       "submitted",
          transferDate: data.transferDate ?? null,
          proofUrl:     data.proofUrl ?? null,
          payerName:    data.payerName?.trim() ?? lockedInv.customerName,
          payerBank:    data.payerBank?.trim() ?? null,
          payerNote:    data.notes?.trim() ?? null,
          submittedAt:  new Date(),
        })
        .returning({ id: schema.payments.id });

      // Link ke invoice
      await tx.insert(schema.invoicePayments).values({
        invoiceId,
        paymentId: payment.id,
        amount:    data.amount.toFixed(2),
      });

      // Update status invoice → waiting_verification
      await tx
        .update(schema.invoices)
        .set({ status: "waiting_verification", updatedAt: new Date() })
        .where(eq(schema.invoices.id, invoiceId));

      return {
        paymentId:         payment.id,
        customerName:      lockedInv.customerName,
        customerPhone:     lockedInv.customerPhone,
        invoiceNumber:     lockedInv.invoiceNumber,
        amount:            data.amount,
        installmentPlanId: lockedInv.installmentPlanId,
      };
    });

    if ("error" in txResult) return { success: false, error: txResult.error };

    const inv = { customerName: txResult.customerName, customerPhone: txResult.customerPhone,
                   invoiceNumber: txResult.invoiceNumber };
    const submittedAmount = txResult.amount;
    const payment          = { id: txResult.paymentId };

    void notifyWa({
      slug, tenantDb, event: "payment_submitted",
      phone: inv.customerPhone,
      vars: {
        name:          inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        amount:        waRupiah(submittedAmount),
      },
    });

    // Tambahan khusus cicilan — TIDAK menggantikan payment_submitted di atas.
    if (txResult.installmentPlanId) {
      const invoiceUrl = await waAppUrl(slug, `/invoice/${invoiceId}`);
      void notifyWa({
        slug, tenantDb, event: "installment_payment_submitted",
        phone: inv.customerPhone,
        vars: {
          name:          inv.customerName,
          invoiceNumber: inv.invoiceNumber,
          amount:        waRupiah(submittedAmount),
          invoiceUrl,
        },
      });
    }

    // Notifikasi terpisah untuk item donasi di invoice ini (invoice bisa campur
    // produk+tiket+donasi) — "Donasi Diterima" mengucap terima kasih per campaign,
    // di luar payment_submitted generik di atas.
    const donationItems = await tdb
      .select({ name: schema.invoiceItems.name, total: schema.invoiceItems.total })
      .from(schema.invoiceItems)
      .where(and(
        eq(schema.invoiceItems.invoiceId, invoiceId),
        eq(schema.invoiceItems.itemType, "donation"),
      ));

    for (const item of donationItems) {
      void notifyWa({
        slug, tenantDb, event: "donation_received",
        phone: inv.customerPhone,
        vars: {
          name:         inv.customerName,
          campaignName: item.name,
          amount:       waRupiah(item.total),
        },
      });
    }

    return { success: true, data: { paymentId: payment.id } };
  } catch (err) {
    console.error("[submitPaymentProofAction]", err);
    return { success: false, error: "Gagal mengirim konfirmasi pembayaran." };
  }
}

// ─── convertInvoiceToInstallmentAction (public) ───────────────────────────────
// Ubah invoice yang SUDAH ADA (dibuat via alur checkout normal, tidak berubah) menjadi
// cicilan — analog diskon/kupon: transformasi metode PEMBAYARAN, bukan jalur pendaftaran
// terpisah. Lihat docs/arsitektur-billing.md § "Program Cicilan — Konversi Invoice".
//
// Boleh dipanggil kapan saja selama invoice belum lunas — TERMASUK setelah sudah ada
// partial payment. Total selalu dipecah dari invoice.total yang SEBENARNYA (bukan
// plan.totalAmount, yang cuma saran tampilan admin saat program dibuat) — lihat keputusan
// dikunci di plan cicilan. Kalau invoice sudah pernah dibayar sebagian sebelum konversi,
// settleInstallmentSchedules dijalankan sekali pakai paidAmount saat ini, otomatis
// menandai termin awal lunas dari histori pembayaran itu.

export async function convertInvoiceToInstallmentAction(
  slug: string,
  invoiceId: string,
  planId: string,
): Promise<ActionResult<void>> {
  try {
    const tenantDb = createTenantDb(slug);
    const { db: tdb, schema } = tenantDb;
    const tenantTimezone = await getTenantTimezone(tenantDb);

    type TxResult =
      | { error: string }
      | {
          firstDueDate:      string;
          customerName:      string | null;
          customerPhone:     string | null;
          invoiceNumber:     string;
          perTermAmount:     number;
          remaining:         number;
          installmentCount:  number;
          intervalDays:      number;
        };

    const txResult: TxResult = await tdb.transaction(async (tx) => {
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${invoiceId} FOR UPDATE`)
        .limit(1);

      if (!lockedInv) return { error: "Invoice tidak ditemukan." };
      if (lockedInv.status === "paid")
        return { error: "Invoice sudah lunas, tidak bisa diubah jadi cicilan." };
      if (lockedInv.status === "cancelled")
        return { error: "Invoice sudah dibatalkan." };
      if (lockedInv.installmentPlanId)
        return { error: "Invoice ini sudah menjadi cicilan." };

      const [plan] = await tx
        .select()
        .from(schema.installmentPlans)
        .where(eq(schema.installmentPlans.id, planId))
        .limit(1);
      if (!plan) return { error: "Program cicilan tidak ditemukan." };
      if (!plan.isActive || !plan.isPublished)
        return { error: "Program cicilan sedang tidak tersedia." };
      if (plan.installmentCount < 2)
        return { error: "Program cicilan belum dikonfigurasi dengan benar." };

      // Re-cek eligibility DI DALAM lock — jangan cuma percaya hasil eligibility-check
      // sebelumnya di halaman (pola lock+guard yang berulang di project ini).
      if (plan.sourceType === "event" && plan.sourceId) {
        const [matchedItem] = await tx
          .select({ id: schema.invoiceItems.id })
          .from(schema.invoiceItems)
          .where(
            and(
              eq(schema.invoiceItems.invoiceId, invoiceId),
              eq(schema.invoiceItems.itemType, "ticket"),
              eq(schema.invoiceItems.itemId, plan.sourceId)
            )
          )
          .limit(1);
        if (!matchedItem)
          return { error: "Program cicilan ini tidak berlaku untuk invoice ini." };
      }

      // SELALU total invoice yang sebenarnya — bukan plan.totalAmount (keputusan dikunci,
      // menghindari skenario harga tiket berubah sejak program dibuat).
      const total     = parseFloat(String(lockedInv.total));
      const paidSoFar = parseFloat(String(lockedInv.paidAmount));
      const perTerm   = Math.round(total / plan.installmentCount);
      const lastTerm  = total - perTerm * (plan.installmentCount - 1); // serap sisa pembulatan

      // "Hari ini" WAJIB dihitung dari kalender timezone TENANT (bukan hardcode WIB, bukan
      // `new Date().toISOString()` mentah — itu UTC, bisa geser tanggal). Lihat
      // lib/tenant-timezone.ts untuk detail alasan + implementasi anchorTodayUtc().
      const today = anchorTodayUtc(tenantTimezone);

      const paymentSettings   = await getSettings(tenantDb, "payment");
      const uniqueCodeEnabled = paymentSettings["unique_code_enabled"] === true;

      const pickedCodes = new Set<number>();
      const scheduleRows: Array<{
        invoiceId: string; installmentPlanId: string; termNumber: number;
        dueDate: string; amount: string; uniqueCode: number | null;
      }> = [];

      for (let i = 0; i < plan.installmentCount; i++) {
        const termNumber = i + 1;
        const dueDate = new Date(today);
        dueDate.setUTCDate(dueDate.getUTCDate() + plan.intervalDays * i);

        let code: number | null = null;
        if (uniqueCodeEnabled) {
          const generated = await generateInstallmentScheduleCode(tenantDb, pickedCodes);
          if (generated > 0) { code = generated; pickedCodes.add(generated); }
        }

        scheduleRows.push({
          invoiceId,
          installmentPlanId: plan.id,
          termNumber,
          dueDate:    dueDate.toISOString().slice(0, 10),
          amount:     (termNumber === plan.installmentCount ? lastTerm : perTerm).toFixed(2),
          uniqueCode: code,
        });
      }

      await tx.insert(schema.installmentSchedules).values(scheduleRows);

      // uniqueCode invoice-level di-nolkan — begitu cicilan aktif, "bayar sekali lunas
      // total+kode" tidak lagi berlaku (digantikan kode PER TERMIN di atas). Tanpa ini,
      // amountDue (= total + uniqueCode lama) di confirmInvoicePaymentAction/
      // verifySubmittedPaymentAction TIDAK PERNAH tercapai oleh sum(term.amount) yang cuma
      // = total — invoice macet permanen di status "partial" walau semua termin lunas
      // (event tidak pernah confirmed, dan notifikasi pelunasan standar tidak pernah kirim).
      await tx
        .update(schema.invoices)
        .set({
          installmentPlanId: plan.id,
          dueDate:            scheduleRows[0].dueDate,
          uniqueCode:          0,
          updatedAt:          new Date(),
        })
        .where(eq(schema.invoices.id, invoiceId));

      // Kalau sudah ada partial payment sebelum konversi — auto-lunas-kan termin awal.
      if (paidSoFar > 0) {
        await settleInstallmentSchedules(tx, schema, invoiceId, paidSoFar, null);
      }

      return {
        firstDueDate:     scheduleRows[0].dueDate,
        customerName:     lockedInv.customerName,
        customerPhone:    lockedInv.customerPhone,
        invoiceNumber:    lockedInv.invoiceNumber,
        perTermAmount:    perTerm,
        remaining:        total - paidSoFar,
        installmentCount: plan.installmentCount,
        intervalDays:     plan.intervalDays,
      };
    });

    if ("error" in txResult) return { success: false, error: txResult.error };

    revalidatePath(`/${slug}/invoice/${invoiceId}`);
    revalidatePath(`/app/${slug}/finance/billing/invoice/${invoiceId}`);

    if (txResult.customerPhone) {
      const invoiceUrl = await waAppUrl(slug, `/invoice/${invoiceId}`);
      void notifyWa({
        slug,
        tenantDb,
        event: "installment_converted",
        phone: txResult.customerPhone,
        vars: {
          name:             txResult.customerName ?? "Pelanggan",
          invoiceNumber:    txResult.invoiceNumber,
          installmentCount: String(txResult.installmentCount),
          intervalDays:     String(txResult.intervalDays),
          perTermAmount:    waRupiah(txResult.perTermAmount),
          remaining:        waRupiah(txResult.remaining),
          dueDate:          txResult.firstDueDate,
          invoiceUrl,
        },
      });
    }

    return { success: true, data: undefined };
  } catch (err) {
    console.error("[convertInvoiceToInstallmentAction]", err);
    return { success: false, error: "Gagal mengubah invoice menjadi cicilan." };
  }
}

// ─── getCartCountAction ───────────────────────────────────────────────────────
// Hanya mengembalikan jumlah item di keranjang — ringan, untuk badge di header

export async function getCartCountAction(slug: string): Promise<number> {
  try {
    const token = await getSessionToken();
    if (!token) return 0;

    const { db: tenantDb, schema } = createTenantDb(slug);

    const [cart] = await tenantDb
      .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
      .from(schema.carts)
      .where(eq(schema.carts.sessionToken, token))
      .limit(1);

    if (!cart || cart.expiresAt <= new Date()) return 0;

    const [{ count }] = await tenantDb
      .select({ count: sql<number>`cast(sum(${schema.cartItems.quantity}) as int)` })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cart.id));

    return count ?? 0;
  } catch {
    return 0;
  }
}
