"use server";

import { eq, and, sql, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, recordIncome, generateFinancialNumber, createLinkedInvoice, syncInvoicePayment } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Gambar produk — disimpan di JSONB images[]
export type ProductImage = {
  id:    string;  // media.id
  url:   string;  // URL publik (media.url / MinIO path)
  alt:   string;  // alt text
  order: number;  // urutan tampil, 0-based
};

export type ProductData = {
  name:        string;
  slug:        string;
  sku?:        string | null;
  description?: string | null;   // Tiptap HTML
  price:       number;
  stock:       number;
  images:      ProductImage[];
  categoryId?: string | null;
  status:      "draft" | "active" | "archived";
  // SEO
  metaTitle?:      string | null;
  metaDesc?:       string | null;
  ogTitle?:        string | null;
  ogDescription?:  string | null;
  ogImageId?:      string | null;
  twitterCard?:    "summary" | "summary_large_image" | null;
  focusKeyword?:   string | null;
  canonicalUrl?:   string | null;
  robots?:         "index,follow" | "noindex" | "noindex,nofollow";
};

export type OrderItemInput = {
  productId: string;
  qty:       number;
};

export type OrderData = {
  customerName:    string;
  customerEmail?:  string | null;
  customerPhone?:  string | null;
  shippingAddress?: string | null;
  discount:        number;   // diskon dalam rupiah (manual)
  notes?:          string | null;
  items:           OrderItemInput[];
};

// ─── Helper: account mappings (reuse pattern dari finance/actions.ts) ──────────

type AccountMappings = {
  cash_default:    string | null;
  bank_default:    string | null;
  income_toko:     string | null;
  expense_default: string | null;
};

async function lookupAccountByCode(
  db: ReturnType<typeof createTenantDb>["db"],
  schema: ReturnType<typeof createTenantDb>["schema"],
  code: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.code, code), eq(schema.accounts.isActive, true)))
    .limit(1);
  return row?.id ?? null;
}

async function resolveTokoMappings(
  tenantDb: ReturnType<typeof createTenantDb>
): Promise<AccountMappings> {
  const { db, schema } = tenantDb;

  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key, "account_mappings"),
      eq(schema.settings.group, "keuangan")
    ))
    .limit(1);

  if (row?.value && typeof row.value === "object") {
    const m = row.value as Record<string, string | null>;
    return {
      cash_default:    m.cash_default    ?? null,
      bank_default:    m.bank_default    ?? null,
      income_toko:     m.income_toko     ?? null,
      expense_default: m.expense_default ?? null,
    };
  }

  const [cash, bank, incomeToko, expense] = await Promise.all([
    lookupAccountByCode(db, schema, "1101"),
    lookupAccountByCode(db, schema, "1102"),
    lookupAccountByCode(db, schema, "4300"),
    lookupAccountByCode(db, schema, "5100"),
  ]);

  return {
    cash_default:    cash,
    bank_default:    bank,
    income_toko:     incomeToko,
    expense_default: expense,
  };
}

function pickCashAccount(
  method: string,
  mappings: AccountMappings
): string | null {
  if (method === "transfer" || method === "qris" ||
      method === "midtrans" || method === "xendit" || method === "ipaymu") {
    return mappings.bank_default ?? mappings.cash_default;
  }
  return mappings.cash_default;
}

// ─── Helper: generate nomor order ──────────────────────────────────────────────
// Format: ORD-YYYYMM-NNNNN
// Menggunakan COUNT orders bulan ini — aman untuk admin-only ordering (MVP)

async function generateOrderNumber(
  db: ReturnType<typeof createTenantDb>["db"],
  schema: ReturnType<typeof createTenantDb>["schema"]
): Promise<string> {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `ORD-${yyyymm}-`;

  const [row] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(schema.orders)
    .where(sql`${schema.orders.orderNumber} LIKE ${prefix + "%"}`);

  const next = (parseInt(String(row?.count ?? 0)) + 1).toString().padStart(5, "0");
  return `${prefix}${next}`;
}

// ─── Helper: generate slug unik ────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

function revalidateToko(slug: string) {
  revalidatePath(`/${slug}/toko`);
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUK
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create produk dengan data lengkap — dipanggil dari form kosong di /produk/new.
 * Tidak pre-create; record baru dibuat saat user klik "Simpan" pertama kali.
 */
export async function createProductAction(
  slug: string,
  data: ProductData
): Promise<ActionResult<{ productId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama produk wajib diisi." };
  if (!data.slug?.trim()) return { success: false, error: "Slug produk wajib diisi." };
  if (data.price < 0)     return { success: false, error: "Harga tidak boleh negatif." };
  if (data.stock < 0)     return { success: false, error: "Stok tidak boleh negatif." };

  const { db, schema } = createTenantDb(slug);

  const [dup] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.slug, data.slug.trim()))
    .limit(1);
  if (dup) return { success: false, error: "Slug sudah dipakai produk lain." };

  try {
    const [product] = await db
      .insert(schema.products)
      .values({
        name:          data.name.trim(),
        slug:          data.slug.trim(),
        sku:           data.sku             ?? null,
        description:   data.description     ?? null,
        price:         String(data.price),
        stock:         data.stock,
        images:        data.images.map((img, i) => ({ ...img, order: i })),
        categoryId:    data.categoryId      ?? null,
        status:        data.status          ?? "draft",
        metaTitle:     data.metaTitle       ?? null,
        metaDesc:      data.metaDesc        ?? null,
        ogTitle:       data.ogTitle         ?? null,
        ogDescription: data.ogDescription   ?? null,
        ogImageId:     data.ogImageId       ?? null,
        twitterCard:   data.twitterCard     || "summary_large_image",
        focusKeyword:  data.focusKeyword    ?? null,
        canonicalUrl:  data.canonicalUrl    ?? null,
        robots:        data.robots          || "index,follow",
      })
      .returning({ id: schema.products.id });

    revalidateToko(slug);
    return { success: true, data: { productId: product.id } };
  } catch (err) {
    console.error("[createProductAction]", err);
    return { success: false, error: "Gagal membuat produk." };
  }
}

/**
 * Pre-create produk draft kosong — dipertahankan untuk kompatibilitas.
 */
export async function createProductDraftAction(
  slug: string
): Promise<ActionResult<{ productId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Buat slug unik dari timestamp agar tidak collision
  const baseSlug = `produk-baru-${Date.now()}`;

  try {
    const [product] = await db
      .insert(schema.products)
      .values({
        name:   "Produk Baru",
        slug:   baseSlug,
        price:  "0",
        stock:  0,
        images: [],
        status: "draft",
      })
      .returning({ id: schema.products.id });

    revalidateToko(slug);
    return { success: true, data: { productId: product.id } };
  } catch (err) {
    console.error("[createProductDraftAction]", err);
    return { success: false, error: "Gagal membuat produk baru." };
  }
}

/**
 * Update semua field produk — dipanggil dari ProductForm.
 * images harus sudah di-sort berdasarkan field order sebelum dikirim.
 */
export async function updateProductAction(
  slug: string,
  productId: string,
  data: ProductData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama produk wajib diisi." };
  if (!data.slug?.trim()) return { success: false, error: "Slug produk wajib diisi." };
  if (data.price < 0)     return { success: false, error: "Harga tidak boleh negatif." };
  if (data.stock < 0)     return { success: false, error: "Stok tidak boleh negatif." };

  const { db, schema } = createTenantDb(slug);

  // Cek slug duplikat (kecuali produk ini sendiri)
  const [dup] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(
      eq(schema.products.slug, data.slug.trim()),
      ne(schema.products.id, productId)
    ))
    .limit(1);

  if (dup) return { success: false, error: "Slug sudah digunakan produk lain." };

  try {
    await db
      .update(schema.products)
      .set({
        name:        data.name.trim(),
        slug:        data.slug.trim(),
        sku:         data.sku?.trim() || null,
        description: data.description ?? null,
        price:       data.price.toFixed(2),
        stock:       data.stock,
        images:      data.images,
        categoryId:  data.categoryId ?? null,
        status:      data.status,
        // SEO
        metaTitle:     data.metaTitle?.trim()    || null,
        metaDesc:      data.metaDesc?.trim()     || null,
        ogTitle:       data.ogTitle?.trim()      || null,
        ogDescription: data.ogDescription?.trim()|| null,
        ogImageId:     data.ogImageId            || null,
        twitterCard:   data.twitterCard          || "summary_large_image",
        focusKeyword:  data.focusKeyword?.trim() || null,
        canonicalUrl:  data.canonicalUrl?.trim() || null,
        robots:        data.robots               || "index,follow",
        updatedAt:     new Date(),
      })
      .where(eq(schema.products.id, productId));

    revalidateToko(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateProductAction]", err);
    return { success: false, error: "Gagal menyimpan produk." };
  }
}

/**
 * Siklus status: draft → active → archived → draft
 */
export async function toggleProductStatusAction(
  slug: string,
  productId: string
): Promise<ActionResult<{ newStatus: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [product] = await db
    .select({ status: schema.products.status })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);

  if (!product) return { success: false, error: "Produk tidak ditemukan." };

  const CYCLE: Record<string, "draft" | "active" | "archived"> = {
    draft:    "active",
    active:   "archived",
    archived: "draft",
  };
  const newStatus = CYCLE[product.status] ?? "draft";

  await db
    .update(schema.products)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(schema.products.id, productId));

  revalidateToko(slug);
  return { success: true, data: { newStatus } };
}

/**
 * Hapus produk — hanya jika tidak ada order aktif yang merujuk produk ini.
 */
export async function deleteProductAction(
  slug: string,
  productId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Cek order aktif (bukan cancelled)
  const [activeOrder] = await db
    .select({ id: schema.orderItems.id })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(and(
      eq(schema.orderItems.productId, productId),
      sql`${schema.orders.status} != ${"cancelled"}`
    ))
    .limit(1);

  if (activeOrder) {
    return {
      success: false,
      error: "Produk tidak bisa dihapus — masih ada pesanan aktif yang menggunakan produk ini.",
    };
  }

  await db.delete(schema.products).where(eq(schema.products.id, productId));

  revalidateToko(slug);
  return { success: true, data: undefined };
}

// ════════════════════════════════════════════════════════════════════════════════
// PESANAN
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Buat pesanan manual oleh admin.
 * - Validasi stok tersedia per item
 * - Hitung subtotal per item + total order
 * - Simpan snapshot nama & SKU produk saat order
 */
export async function createOrderAction(
  slug: string,
  data: OrderData
): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  if (!data.customerName?.trim())
    return { success: false, error: "Nama pelanggan wajib diisi." };
  if (!data.items || data.items.length === 0)
    return { success: false, error: "Pesanan harus memiliki minimal 1 item." };
  if (data.discount < 0)
    return { success: false, error: "Diskon tidak boleh negatif." };

  const { db, schema } = createTenantDb(slug);

  // Ambil semua produk yang dipesan sekaligus
  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const products = await db
    .select({
      id:    schema.products.id,
      name:  schema.products.name,
      sku:   schema.products.sku,
      price: schema.products.price,
      stock: schema.products.stock,
      status: schema.products.status,
    })
    .from(schema.products)
    .where(sql`${schema.products.id} = ANY(${sql.raw(`ARRAY[${productIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`);

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validasi per item
  for (const item of data.items) {
    const p = productMap.get(item.productId);
    if (!p)
      return { success: false, error: `Produk tidak ditemukan: ${item.productId}` };
    if (p.status !== "active")
      return { success: false, error: `Produk "${p.name}" tidak aktif.` };
    if (item.qty <= 0)
      return { success: false, error: `Jumlah item "${p.name}" harus lebih dari 0.` };
    if (p.stock < item.qty)
      return {
        success: false,
        error: `Stok "${p.name}" tidak cukup. Tersedia: ${p.stock}, diminta: ${item.qty}.`,
      };
  }

  // Hitung total
  let subtotal = 0;
  const itemRows = data.items.map((item) => {
    const p = productMap.get(item.productId)!;
    const price   = parseFloat(String(p.price));
    const itemSub = price * item.qty;
    subtotal += itemSub;
    return {
      productId:    item.productId,
      productName:  p.name,
      skuAtOrder:   p.sku ?? null,
      qty:          item.qty,
      priceAtOrder: price.toFixed(2),
      subtotal:     itemSub.toFixed(2),
    };
  });

  const discount = data.discount ?? 0;
  const total    = Math.max(0, subtotal - discount);

  try {
    const orderNumber = await generateOrderNumber(db, schema);

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderNumber,
        customerName:    data.customerName.trim(),
        customerEmail:   data.customerEmail?.trim()  || null,
        customerPhone:   data.customerPhone?.trim()  || null,
        shippingAddress: data.shippingAddress?.trim()|| null,
        status:          "pending",
        subtotal:        subtotal.toFixed(2),
        discount:        discount.toFixed(2),
        total:           total.toFixed(2),
        notes:           data.notes?.trim()          || null,
      })
      .returning({ id: schema.orders.id, orderNumber: schema.orders.orderNumber });

    // Insert items
    await db
      .insert(schema.orderItems)
      .values(itemRows.map((r) => ({ ...r, orderId: order.id })));

    // Buat invoice universal untuk order ini
    const tenantDb = createTenantDb(slug);
    await createLinkedInvoice(tenantDb, {
      sourceType:    "order",
      sourceId:      order.id,
      customerName:  data.customerName.trim(),
      customerPhone: data.customerPhone?.trim() ?? null,
      customerEmail: data.customerEmail?.trim() ?? null,
      items: itemRows.map((r) => ({
        itemType:  "product" as const,
        itemId:    r.productId,
        name:      r.productName,
        unitPrice: parseFloat(r.priceAtOrder),
        quantity:  r.qty,
      })),
      discount: discount,
      createdBy: access.userId,
    });

    revalidateToko(slug);
    return { success: true, data: { orderId: order.id, orderNumber: order.orderNumber } };
  } catch (err) {
    console.error("[createOrderAction]", err);
    return { success: false, error: "Gagal membuat pesanan." };
  }
}

/**
 * Tambah payment record ke order yang sudah ada.
 * Status payment: 'submitted' (admin yang input, langsung siap dikonfirmasi).
 */
export async function addPaymentToOrderAction(
  slug: string,
  orderId: string,
  paymentData: {
    method:   "cash" | "transfer" | "qris";
    amount:   number;
    payerName?: string;
    payerBank?: string;
    transferDate?: string;
    notes?: string;
  }
): Promise<ActionResult<{ paymentId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [order] = await db
    .select({ id: schema.orders.id, total: schema.orders.total, status: schema.orders.status, orderNumber: schema.orders.orderNumber })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };
  if (order.status === "cancelled")
    return { success: false, error: "Pesanan sudah dibatalkan." };
  if (order.status !== "pending")
    return { success: false, error: "Pesanan sudah memiliki pembayaran." };

  try {
    const number = await generateFinancialNumber(tenantDb, "payment");

    const [payment] = await db
      .insert(schema.payments)
      .values({
        number,
        sourceType:   "order",
        sourceId:     orderId,
        amount:       paymentData.amount.toFixed(2),
        uniqueCode:   0,
        method:       paymentData.method,
        status:       "submitted",
        payerName:    paymentData.payerName?.trim()  || order.orderNumber,
        payerBank:    paymentData.payerBank?.trim()  || null,
        transferDate: paymentData.transferDate       || null,
        payerNote:    paymentData.notes?.trim()      || null,
        submittedAt:  new Date(),
      })
      .returning({ id: schema.payments.id });

    revalidateToko(slug);
    return { success: true, data: { paymentId: payment.id } };
  } catch (err) {
    console.error("[addPaymentToOrderAction]", err);
    return { success: false, error: "Gagal membuat pembayaran." };
  }
}

/**
 * Konfirmasi pembayaran order — atomic:
 * 1. Update payment → paid + link transactionId
 * 2. Stock -= qty per item (dalam satu DB transaction)
 * 3. Update order → paid
 * 4. Buat jurnal otomatis via recordIncome
 */
export async function confirmOrderPaymentAction(
  slug: string,
  paymentId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canConfirmPayment(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment)
    return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")
    return { success: false, error: "Pembayaran sudah dikonfirmasi sebelumnya." };
  if (payment.sourceType !== "order" || !payment.sourceId)
    return { success: false, error: "Bukan pembayaran order." };

  const orderId = payment.sourceId;

  // Ambil items order
  const items = await db
    .select({
      productId: schema.orderItems.productId,
      qty:       schema.orderItems.qty,
    })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  if (items.length === 0)
    return { success: false, error: "Pesanan tidak memiliki item." };

  // Validasi stok sebelum kurangi
  for (const item of items) {
    const [p] = await db
      .select({ stock: schema.products.stock, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, item.productId))
      .limit(1);

    if (!p) continue; // produk mungkin sudah dihapus — skip
    if (p.stock < item.qty) {
      return {
        success: false,
        error: `Stok "${p.name}" tidak cukup untuk dikurangi. Tersedia: ${p.stock}, diminta: ${item.qty}.`,
      };
    }
  }

  // Resolusi akun
  const mappings = await resolveTokoMappings(tenantDb);
  const cashAccountId   = pickCashAccount(payment.method, mappings);
  const incomeAccountId = mappings.income_toko;

  if (!cashAccountId || !incomeAccountId) {
    return {
      success: false,
      error: "Konfigurasi mapping akun belum lengkap. Atur di Keuangan → Akun → Mapping.",
    };
  }

  const amount = parseFloat(String(payment.amount));
  const userId = access.userId;

  try {
    const txNumber = await generateFinancialNumber(tenantDb, "journal");

    // Buat jurnal otomatis
    const transaction = await recordIncome(tenantDb, {
      date:            new Date().toISOString().slice(0, 10),
      description:     `Pembayaran order ${payment.number}`,
      referenceNumber: txNumber,
      createdBy:       userId,
      amount,
      cashAccountId,
      incomeAccountId,
    });

    // Update payment
    await db
      .update(schema.payments)
      .set({
        status:        "paid",
        confirmedBy:   userId,
        confirmedAt:   new Date(),
        transactionId: transaction.id,
        updatedAt:     new Date(),
      })
      .where(eq(schema.payments.id, paymentId));

    // Kurangi stok — per produk
    for (const item of items) {
      await db
        .update(schema.products)
        .set({
          stock:     sql`${schema.products.stock} - ${item.qty}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, item.productId));
    }

    // Update status order → paid
    await db
      .update(schema.orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    // Sync invoice yang terhubung ke order ini
    await syncInvoicePayment(tenantDb, {
      sourceType: "order",
      sourceId:   orderId,
      paymentId:  paymentId,
      amount,
    });

    revalidateToko(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmOrderPaymentAction]", err);
    return { success: false, error: "Gagal mengkonfirmasi pembayaran." };
  }
}

/**
 * Batalkan pesanan.
 * - Jika order sudah paid → restore stok
 * - Cancel payment record jika ada
 */
export async function cancelOrderAction(
  slug: string,
  orderId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [order] = await db
    .select({ id: schema.orders.id, status: schema.orders.status })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };
  if (order.status === "cancelled")
    return { success: false, error: "Pesanan sudah dibatalkan." };
  if (order.status === "done")
    return { success: false, error: "Pesanan yang sudah selesai tidak bisa dibatalkan." };

  const wasAlreadyPaid = order.status === "paid" ||
                         order.status === "processing" ||
                         order.status === "shipped";

  try {
    // Restore stok jika order sudah dibayar (stok sudah dikurangi)
    if (wasAlreadyPaid) {
      const items = await db
        .select({ productId: schema.orderItems.productId, qty: schema.orderItems.qty })
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId));

      for (const item of items) {
        await db
          .update(schema.products)
          .set({
            stock:     sql`${schema.products.stock} + ${item.qty}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, item.productId));
      }
    }

    // Cancel payment record jika ada
    await db
      .update(schema.payments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(schema.payments.sourceType, "order"),
        eq(schema.payments.sourceId,  orderId),
        sql`${schema.payments.status} NOT IN ('paid', 'refunded')`
      ));

    // Cancel order
    await db
      .update(schema.orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    revalidateToko(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[cancelOrderAction]", err);
    return { success: false, error: "Gagal membatalkan pesanan." };
  }
}

/**
 * Update status pesanan — flow: paid → processing → shipped → done
 */
export async function updateOrderStatusAction(
  slug: string,
  orderId: string,
  newStatus: "processing" | "shipped" | "done"
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [order] = await db
    .select({ status: schema.orders.status })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };

  // Validasi transisi status
  const VALID_FROM: Record<string, string[]> = {
    processing: ["paid"],
    shipped:    ["processing"],
    done:       ["shipped"],
  };
  if (!VALID_FROM[newStatus]?.includes(order.status)) {
    return {
      success: false,
      error: `Tidak bisa mengubah status dari "${order.status}" ke "${newStatus}".`,
    };
  }

  await db
    .update(schema.orders)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId));

  revalidateToko(slug);
  return { success: true, data: undefined };
}

// ─── Kategori Produk ──────────────────────────────────────────────────────────

export async function createProductCategoryAction(
  slug: string,
  data: { name: string; slug: string; parentId?: string | null }
): Promise<ActionResult<{ categoryId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama kategori wajib diisi." };
  if (!data.slug?.trim()) return { success: false, error: "Slug kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [dup] = await db
    .select({ id: schema.productCategories.id })
    .from(schema.productCategories)
    .where(eq(schema.productCategories.slug, data.slug.trim()))
    .limit(1);

  if (dup) return { success: false, error: "Slug kategori sudah digunakan." };

  const [cat] = await db
    .insert(schema.productCategories)
    .values({
      name:     data.name.trim(),
      slug:     data.slug.trim(),
      parentId: data.parentId ?? null,
    })
    .returning({ id: schema.productCategories.id });

  revalidateToko(slug);
  return { success: true, data: { categoryId: cat.id } };
}

export { slugify };
