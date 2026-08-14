"use server";

import { eq, and, sql, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createTenantDb, recordIncome, generateFinancialNumber, syncInvoicePayment,
  resolveProductCartItem, findVoucherByCode, countCustomerRedemptions, computeVoucherDiscount,
  type VoucherApplicationResult,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";
import { getTenantTimezone, anchorTodayUtc } from "@/lib/tenant-timezone.server";
import { getTokoSettings } from "@/lib/toko-settings";
import type { CheckoutShippingData } from "@/app/(public)/[tenant]/cart/actions";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Gambar produk — disimpan di JSONB images[]
export type ProductImage = {
  id:       string;                              // media.id
  url:      string;                              // URL primary (square-large untuk shop)
  variants?: Record<string, string> | null;     // resolved URLs per variant — { square, "square-large" }
  alt:      string;                              // alt text
  order:    number;                              // urutan tampil, 0-based
};

export type ProductData = {
  name:            string;
  slug:            string;
  sku?:            string | null;
  description?:    string | null;
  price:           number;
  publicPrice?:    number | null;
  memberPrice?:    number | null;
  stock:           number;
  weightGram?:     number | null;
  images:          ProductImage[];
  productType?:    "simple" | "variable";
  attributeGroups?: import("@jalajogja/db").AttributeGroup[];
  categoryId?:  string | null;
  status:       "draft" | "active" | "archived";
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
  memberId?:       string | null; // hasil pilih dari CustomerSearchAutocomplete (anggota)
  profileId?:      string | null; // hasil pilih dari CustomerSearchAutocomplete (akun publik)
  shippingAddress?: string | null;
  discount:        number;   // diskon dalam rupiah (manual, TERPISAH dari diskon voucher)
  notes?:          string | null;
  items:           OrderItemInput[];
  // Opsional — hanya diisi kalau ada grup produk yang butuh ongkir (RajaOngkir dikonfigurasi).
  // Struktur SAMA PERSIS dengan checkout publik (cart/actions.ts) — lihat CheckoutShippingData.
  shipping?:       CheckoutShippingData | null;
  voucherCode?:    string | null;
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
  revalidatePath(`/app/${slug}/toko`);
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
        weightGram:    data.weightGram      ?? null,
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
        price:           data.price.toFixed(2),
        publicPrice:     data.publicPrice  != null ? data.publicPrice.toFixed(2)  : null,
        memberPrice:     data.memberPrice  != null ? data.memberPrice.toFixed(2)  : null,
        stock:           data.stock,
        weightGram:      data.weightGram   ?? null,
        images:          data.images,
        categoryId:      data.categoryId   ?? null,
        status:          data.status,
        productType:     data.productType  ?? "simple",
        attributeGroups: data.attributeGroups ?? [],
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
 * Preview potongan voucher untuk pesanan manual — dipanggil sebelum submit, sama pola
 * previewVoucherAction (cart/actions.ts) tapi item datang dari cart client-side admin
 * (bukan cart_items DB, karena tidak ada session keranjang di sini). perItemDiscount
 * dikembalikan keyed by productId (bukan cartItemId — tidak ada baris cart di sini).
 */
export type OrderVoucherPreview = {
  valid:            boolean;
  error?:           string;
  voucherName?:     string;
  perItemDiscount?: Record<string, number>; // productId -> nominal potongan
  totalDiscount?:   number;
};

export async function previewOrderVoucherAction(
  slug: string,
  code: string,
  items: OrderItemInput[],
  customer?: { phone?: string | null; email?: string | null },
): Promise<ActionResult<OrderVoucherPreview>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    const voucherRow = await findVoucherByCode(db, schema, code, false);
    if (!voucherRow) return { success: true, data: { valid: false, error: "Kode voucher tidak ditemukan." } };

    const normalizedPhone = customer?.phone ? normalizePhone(customer.phone) : null;
    const emailTrim        = customer?.email?.trim() || null;

    const existingRedemptions = await countCustomerRedemptions(db, schema, voucherRow.id, {
      phone: normalizedPhone, email: emailTrim,
    });

    // originalIds tetap lockstep dengan voucherItems (dua-duanya di-push bersamaan, item yang
    // gagal resolve di-skip dari KEDUANYA) — supaya perItemDiscount di bawah bisa dikembalikan
    // dengan key ID ASLI yang dikirim client (bisa jadi ID variasi), bukan ID produk induk hasil
    // resolve (itemId di voucherItems WAJIB parent id — itu yang dicocokkan ke
    // voucher.targetItemIds, VoucherTargetPicker cuma pernah simpan products.id).
    const voucherItems: Array<{ itemType: "product"; itemId: string; unitPrice: number; quantity: number; mitraId: string | null }> = [];
    const originalIds: string[] = [];
    for (const item of items) {
      const resolved = await resolveProductCartItem(db, schema, item.productId);
      if (!resolved) continue;
      voucherItems.push({ itemType: "product", itemId: resolved.productId, unitPrice: resolved.price, quantity: item.qty, mitraId: resolved.mitraId });
      originalIds.push(item.productId);
    }

    const result = computeVoucherDiscount(voucherRow, { phone: normalizedPhone, email: emailTrim }, existingRedemptions, voucherItems);
    if ("error" in result) return { success: true, data: { valid: false, error: result.error } };

    const perItemDiscount: Record<string, number> = {};
    result.perItemDiscount.forEach((discount, index) => {
      perItemDiscount[originalIds[index]] = discount;
    });

    return {
      success: true,
      data: { valid: true, voucherName: result.voucher.name, perItemDiscount, totalDiscount: result.totalDiscount },
    };
  } catch (err) {
    console.error("[previewOrderVoucherAction]", err);
    return { success: false, error: "Gagal memeriksa voucher." };
  }
}

// ─── Variasi produk — lazy fetch untuk picker di form buat pesanan manual ──────
// Tipe khusus admin (BUKAN reuse ProductVariationData dari product-detail-client.tsx) karena
// admin butuh weightGram (untuk hitung ongkir client-side di order-create-client.tsx) yang
// tidak ada di tipe publik itu — publik tidak butuh weight, checkout server-side query fresh
// sendiri. Fallback harga/berat ke induk sudah di-resolve di sini (server), bukan di client.
export type AdminProductVariation = {
  id:             string;
  sku:            string | null;
  price:          string;   // efektif — variation.price kalau ada, else harga produk induk
  stock:          number;
  weightGram:     number;   // efektif — variation.weightGram kalau ada, else berat produk induk
  attributeCombo: Record<string, string>;
  isActive:       boolean;
};

export type AdminAttributeGroup = { name: string; values: string[] };

export async function getProductVariationsAction(
  slug: string,
  productId: string,
): Promise<ActionResult<{ variations: AdminProductVariation[]; attrGroups: AdminAttributeGroup[] }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [p] = await db
    .select({
      id: schema.products.id, price: schema.products.price, weightGram: schema.products.weightGram,
      attributeGroups: schema.products.attributeGroups, productType: schema.products.productType,
    })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);
  if (!p) return { success: false, error: "Produk tidak ditemukan." };
  if (p.productType !== "variable") return { success: false, error: "Produk ini bukan produk variasi." };

  const vrows = await db
    .select({
      id: schema.productVariations.id, sku: schema.productVariations.sku,
      price: schema.productVariations.price, stock: schema.productVariations.stock,
      weightGram: schema.productVariations.weightGram, attributeCombo: schema.productVariations.attributeCombo,
      isActive: schema.productVariations.isActive,
    })
    .from(schema.productVariations)
    .where(and(eq(schema.productVariations.productId, p.id), eq(schema.productVariations.isActive, true)))
    .orderBy(schema.productVariations.createdAt);

  const variations: AdminProductVariation[] = vrows.map((v) => ({
    id:             v.id,
    sku:            v.sku ?? null,
    price:          String(v.price ?? p.price),
    stock:          v.stock,
    weightGram:     v.weightGram ?? p.weightGram ?? 0,
    attributeCombo: (v.attributeCombo ?? {}) as Record<string, string>,
    isActive:       v.isActive,
  }));

  return {
    success: true,
    data: { variations, attrGroups: (p.attributeGroups ?? []) as AdminAttributeGroup[] },
  };
}

/**
 * Buat pesanan manual oleh admin.
 * - Resolusi harga/mitraId/stok dilakukan ULANG di server (jangan percaya client) — pola
 *   sama checkoutAction (cart/actions.ts), termasuk untuk voucher & shipping.
 * - Invoice dibangun LANGSUNG (bukan via createLinkedInvoice) karena butuh field yang tidak
 *   didukung helper itu: memberId/profileId, shippingTotal, voucherDiscountTotal.
 * - Kirim notifikasi WA "invoice_created" kalau ada nomor HP pelanggan.
 */
export async function createOrderAction(
  slug: string,
  data: OrderData
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false as const, error: "Akses ditolak." };

  if (!data.customerName?.trim())
    return { success: false, error: "Nama pelanggan wajib diisi." };
  if (!data.items || data.items.length === 0)
    return { success: false, error: "Pesanan harus memiliki minimal 1 item." };
  if (data.discount < 0)
    return { success: false, error: "Diskon tidak boleh negatif." };

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const normalizedPhone = data.customerPhone?.trim() ? normalizePhone(data.customerPhone.trim()) : null;
  const emailTrim        = data.customerEmail?.trim() || null;

  try {
    const tenantTimezone = await getTenantTimezone(tenantClient);
    const invoiceNumber  = await generateFinancialNumber(tenantClient, "invoice");
    const tokoSettings   = await getTokoSettings(slug);
    const paymentSettings   = await (async () => {
      const { getSettings } = await import("@jalajogja/db");
      return getSettings(tenantClient, "payment");
    })();
    const uniqueCodeEnabled = paymentSettings["unique_code_enabled"] === true;

    type TxResult =
      | { error: string }
      | { invoiceId: string; invoiceNumber: string; total: number; uniqueCode: number; dueDate: string; customerName: string };

    const txResult: TxResult = await db.transaction(async (tx) => {
      // ── Resolusi item — JANGAN percaya harga/mitraId dari client (pola checkoutAction) ──
      // itemId = ID ASLI yang dikirim client (bisa product_variations.id untuk produk
      // bervariasi) — disimpan APA ADANYA ke invoice_items.itemId untuk fulfillment/SKU.
      // productId = ID PRODUK INDUK hasil resolve — HANYA dipakai untuk voucher matching
      // (voucher.targetItemIds cuma pernah simpan products.id, tidak pernah variasi). Dua
      // field ini WAJIB dipisah — lihat komentar di resolveProductCartItem() untuk root cause
      // bug kelas ini yang pernah terjadi di checkout publik.
      const resolvedItems: Array<{ itemId: string; productId: string; name: string; unitPrice: number; quantity: number; mitraId: string | null }> = [];
      for (const item of data.items) {
        const resolved = await resolveProductCartItem(tx, schema, item.productId);
        if (!resolved) return { error: "Produk tidak ditemukan." };
        const [p] = await tx
          .select({ name: schema.products.name, status: schema.products.status })
          .from(schema.products)
          .where(eq(schema.products.id, resolved.productId))
          .limit(1);
        if (!p) return { error: "Produk tidak ditemukan." };
        if (p.status !== "active") return { error: `Produk "${p.name}" tidak aktif.` };
        if (item.qty <= 0) return { error: `Jumlah item "${p.name}" harus lebih dari 0.` };

        // itemId !== productId hasil resolve berarti item ini adalah variasi (product_variations.id)
        // — stok+nama WAJIB dicek dari baris variasi itu sendiri, bukan produk induk (stock/atribut
        // combo tidak sama antara induk dan tiap variasinya).
        const isVariation = item.productId !== resolved.productId;
        let itemName = p.name;
        let availableStock: number;

        if (isVariation) {
          const [v] = await tx
            .select({ stock: schema.productVariations.stock, attributeCombo: schema.productVariations.attributeCombo, isActive: schema.productVariations.isActive })
            .from(schema.productVariations)
            .where(eq(schema.productVariations.id, item.productId))
            .limit(1);
          if (!v || !v.isActive) return { error: `Variasi produk "${p.name}" tidak tersedia.` };
          const combo = (v.attributeCombo ?? {}) as Record<string, string>;
          const comboLabel = Object.values(combo).join(" / ");
          itemName = comboLabel ? `${p.name} — ${comboLabel}` : p.name;
          availableStock = v.stock;
        } else {
          const [pr] = await tx.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.id, resolved.productId)).limit(1);
          availableStock = pr?.stock ?? 0;
        }

        if (availableStock < item.qty) return { error: `Stok "${itemName}" tidak cukup. Tersedia: ${availableStock}, diminta: ${item.qty}.` };
        resolvedItems.push({ itemId: item.productId, productId: resolved.productId, name: itemName, unitPrice: resolved.price, quantity: item.qty, mitraId: resolved.mitraId });
      }

      // ── Voucher (opsional) ──
      let voucherApplication: VoucherApplicationResult | null = null;
      if (data.voucherCode?.trim()) {
        const voucherRow = await findVoucherByCode(tx, schema, data.voucherCode, true);
        if (!voucherRow) return { error: "Kode voucher tidak ditemukan." };
        const existingRedemptions = await countCustomerRedemptions(tx, schema, voucherRow.id, {
          phone: normalizedPhone, email: emailTrim,
        });
        const voucherItems = resolvedItems.map((it) => ({
          itemType: "product" as const, itemId: it.productId, unitPrice: it.unitPrice, quantity: it.quantity, mitraId: it.mitraId,
        }));
        const result = computeVoucherDiscount(voucherRow, { phone: normalizedPhone, email: emailTrim }, existingRedemptions, voucherItems);
        if ("error" in result) return { error: result.error };
        voucherApplication = result;
      }

      const subtotal = resolvedItems.reduce((s, it, i) => {
        const disc = voucherApplication?.perItemDiscount.get(i) ?? 0;
        return s + Math.max(0, it.unitPrice * it.quantity - disc);
      }, 0);

      // ── Shipping (opsional) — re-validasi server-side, jangan percaya deliveryMethod/
      // paymentMethod dari client. Pola SAMA PERSIS checkoutAction (cart/actions.ts).
      let shippingTotal = 0;
      type ShippingLineInsert = {
        sellerType:          "tenant" | "mitra";
        sellerId:            string | null;
        sellerName:          string;
        cost:                string;
        status:              "pending";
        deliveryMethod:      "courier" | "pickup";
        paymentMethod:       "prepaid" | "cod";
        pickupLocationName?: string | null;
        pickupAddress?:      string | null;
        pickupMapsUrl?:      string | null;
        originCityId?:       number | null;
        originCityName?:     string | null;
        courier?:            string | null;
        service?:            string | null;
        serviceDesc?:        string | null;
        etd?:                string | null;
        weightGram?:         number | null;
      };
      const shippingLineValues: ShippingLineInsert[] = [];
      if (data.shipping && data.shipping.lines.length > 0) {
        const mitraSellerIds = [...new Set(
          data.shipping.lines.filter(l => l.sellerType === "mitra" && l.sellerId).map(l => l.sellerId!)
        )];
        const mitraRows = mitraSellerIds.length > 0
          ? await tx
              .select({ id: schema.mitras.id, codEnabled: schema.mitras.codEnabled, pickupEnabled: schema.mitras.pickupEnabled })
              .from(schema.mitras)
              .where(inArray(schema.mitras.id, mitraSellerIds))
          : [];
        const mitraConfigMap = new Map(mitraRows.map(m => [m.id, m]));

        for (const line of data.shipping.lines) {
          const sellerConfig = line.sellerType === "mitra" && line.sellerId
            ? mitraConfigMap.get(line.sellerId)
            : { codEnabled: tokoSettings.codEnabled, pickupEnabled: tokoSettings.pickupEnabled };

          const deliveryMethod: "courier" | "pickup" =
            line.deliveryMethod === "pickup" && sellerConfig?.pickupEnabled ? "pickup" : "courier";
          const paymentMethod: "prepaid" | "cod" =
            deliveryMethod === "pickup" ? "prepaid" : (line.paymentMethod === "cod" && sellerConfig?.codEnabled ? "cod" : "prepaid");

          if (deliveryMethod === "pickup") {
            shippingLineValues.push({
              sellerType: line.sellerType, sellerId: line.sellerId ?? null, sellerName: line.sellerName,
              cost: "0.00", status: "pending" as const, deliveryMethod: "pickup" as const, paymentMethod: "prepaid" as const,
              pickupLocationName: line.pickupLocationName ?? null, pickupAddress: line.pickupAddress ?? null, pickupMapsUrl: line.pickupMapsUrl ?? null,
            });
          } else {
            shippingTotal += line.cost;
            shippingLineValues.push({
              sellerType: line.sellerType, sellerId: line.sellerId ?? null, sellerName: line.sellerName,
              originCityId: line.originCityId ?? null, originCityName: line.originCityName ?? null,
              courier: line.courier ?? null, service: line.service ?? null, serviceDesc: line.serviceDesc ?? null,
              etd: line.etd ?? null, weightGram: line.weightGram ?? null, cost: line.cost.toFixed(2),
              status: "pending" as const, deliveryMethod: "courier" as const, paymentMethod,
            });
          }
        }
      }

      const manualDiscount = data.discount ?? 0;
      const total = Math.max(0, subtotal + shippingTotal - manualDiscount);
      const uniqueCode = uniqueCodeEnabled ? await import("@jalajogja/db").then(m => m.generateUniqueCode(tenantClient)) : 0;

      const dueDate = (() => {
        const d = anchorTodayUtc(tenantTimezone);
        d.setUTCDate(d.getUTCDate() + 3);
        return d.toISOString().slice(0, 10);
      })();

      const notesWithAddress = [
        data.shippingAddress?.trim() ? `Alamat: ${data.shippingAddress.trim()}` : null,
        data.notes?.trim() ?? null,
      ].filter(Boolean).join("\n") || null;

      const [invoice] = await tx
        .insert(schema.invoices)
        .values({
          invoiceNumber,
          sourceType:    "order",
          sourceId:      crypto.randomUUID(),
          customerName:  data.customerName.trim(),
          customerPhone: normalizedPhone,
          customerEmail: emailTrim,
          memberId:      data.memberId ?? null,
          profileId:     data.profileId ?? null,
          subtotal:      subtotal.toFixed(2),
          shippingTotal: shippingTotal.toFixed(2),
          discount:      manualDiscount.toFixed(2),
          total:         total.toFixed(2),
          paidAmount:    "0",
          uniqueCode,
          status:        "pending",
          dueDate,
          notes:         notesWithAddress,
          createdBy:     access.tenantUser.id,
          voucherId:            voucherApplication?.voucher.id ?? null,
          voucherCode:          voucherApplication ? voucherApplication.voucher.code : null,
          voucherDiscountTotal: (voucherApplication?.totalDiscount ?? 0).toFixed(2),
        })
        .returning({ id: schema.invoices.id });

      await tx.insert(schema.invoiceItems).values(
        resolvedItems.map((item, i) => {
          const disc = voucherApplication?.perItemDiscount.get(i) ?? 0;
          return {
            invoiceId:   invoice.id,
            itemType:    "product" as const,
            itemId:      item.itemId,
            name:        item.name,
            unitPrice:   item.unitPrice.toFixed(2),
            quantity:    item.quantity,
            total:       Math.max(0, item.unitPrice * item.quantity - disc).toFixed(2),
            sortOrder:   i,
            sellerType:  item.mitraId ? ("mitra" as const) : ("tenant" as const),
            sellerId:    item.mitraId,
            discountAmount: disc.toFixed(2),
            voucherId:      disc > 0 ? (voucherApplication?.voucher.id ?? null) : null,
          };
        })
      );

      if (shippingLineValues.length > 0) {
        await tx.insert(schema.invoiceShippingLines).values(
          shippingLineValues.map(v => ({ ...v, invoiceId: invoice.id }))
        );
      }

      if (voucherApplication) {
        await tx.update(schema.vouchers)
          .set({ usedCount: sql`${schema.vouchers.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(schema.vouchers.id, voucherApplication.voucher.id));
        await tx.insert(schema.voucherRedemptions).values({
          voucherId:     voucherApplication.voucher.id,
          invoiceId:     invoice.id,
          customerPhone: normalizedPhone,
          customerEmail: emailTrim,
          discountTotal: voucherApplication.totalDiscount.toFixed(2),
        });
      }

      return {
        invoiceId: invoice.id, invoiceNumber, total, uniqueCode, dueDate,
        customerName: data.customerName.trim(),
      };
    });

    if ("error" in txResult) return { success: false, error: txResult.error };

    if (normalizedPhone) {
      void (async () => {
        const invoiceUrl = await waAppUrl(slug, `/invoice/${txResult.invoiceId}`);
        void notifyWa({
          slug, tenantDb: tenantClient, event: "invoice_created",
          phone: normalizedPhone,
          vars: {
            name:          txResult.customerName,
            invoiceNumber: txResult.invoiceNumber,
            // Wajib total + uniqueCode — jangan pernah kirim total polos. Lihat lesson
            // CLAUDE.md § Kode Unik Transaksi.
            amount:        waRupiah(txResult.total + txResult.uniqueCode),
            dueDate:       txResult.dueDate,
            invoiceUrl,
          },
        });
      })();
    }

    revalidateToko(slug);
    return { success: true, data: { invoiceId: txResult.invoiceId, invoiceNumber: txResult.invoiceNumber } };
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
  data: { name: string; slug: string; parentId?: string | null; metaTitle?: string | null; metaDesc?: string | null }
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
      name:      data.name.trim(),
      slug:      data.slug.trim(),
      parentId:  data.parentId ?? null,
      metaTitle: data.metaTitle || null,
      metaDesc:  data.metaDesc  || null,
    })
    .returning({ id: schema.productCategories.id });

  revalidateToko(slug);
  return { success: true, data: { categoryId: cat.id } };
}

// slugify tidak di-export — jangan import dari "use server" file ke client component
// (akan jadi server action proxy dan return Promise bukan string)
// Implementasikan lokal di tiap client component yang butuh

// ─── Variasi Produk ────────────────────────────────────────────────────────────

import type { VariationLocal } from "@/components/toko/variation-table";

export async function saveVariationsAction(
  slug:       string,
  productId:  string,
  variations: VariationLocal[],
): Promise<{ error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Diff-based upsert — BUKAN delete-all+insert-all seperti sebelumnya. cart_items.item_id
  // (untuk produk variable) adalah product_variations.id — kalau setiap save meregenerasi
  // SEMUA UUID variasi (delete-all lalu insert ulang), item yang sudah ada di keranjang
  // pelanggan jadi orphan (menunjuk id yang tidak pernah ada lagi) setiap kali admin resave
  // produk, walau kombinasi atributnya persis sama. Variasi existing yang masih dikirim
  // (punya v.id) di-UPDATE di tempat — UUID-nya dipertahankan.
  const existingRows = await tenantDb
    .select({ id: schema.productVariations.id })
    .from(schema.productVariations)
    .where(eq(schema.productVariations.productId, productId));
  const existingIds  = new Set(existingRows.map(r => r.id));
  const submittedIds = new Set(variations.filter(v => v.id).map(v => v.id!));

  const toDelete = [...existingIds].filter(id => !submittedIds.has(id));
  if (toDelete.length > 0) {
    await tenantDb.delete(schema.productVariations)
      .where(inArray(schema.productVariations.id, toDelete));
  }

  for (const v of variations) {
    const values = {
      productId,
      sku:            v.sku.trim() || null,
      // Kosong = null → fallback ke harga produk induk saat dibaca (lib/product-variation-
      // price.server.ts), bukan dipaksa jadi 0 seperti sebelumnya.
      price:          v.price.trim() ? (parseFloat(v.price) || 0).toFixed(2) : null,
      publicPrice:    v.publicPrice ? (parseFloat(v.publicPrice)).toFixed(2) : null,
      memberPrice:    v.memberPrice ? (parseFloat(v.memberPrice)).toFixed(2) : null,
      stock:          parseInt(v.stock) || 0,
      weightGram:     v.weightGram ? (parseInt(v.weightGram) || null) : null,
      images:         v.images,
      attributeCombo: v.attributeCombo,
      isActive:       v.isActive,
    };

    if (v.id && existingIds.has(v.id)) {
      await tenantDb.update(schema.productVariations)
        .set(values)
        .where(eq(schema.productVariations.id, v.id));
    } else {
      await tenantDb.insert(schema.productVariations).values(values);
    }
  }

  revalidateToko(slug);
  return {};
}

// Hasilkan semua kombinasi (cartesian product) dari attribute_groups
// Kombinasi yang sudah ada (by attributeCombo) dipertahankan, tidak di-overwrite
export async function generateVariationsAction(
  slug:            string,
  productId:       string,
  attributeGroups: import("@jalajogja/db").AttributeGroup[],
  existing:        VariationLocal[],
): Promise<{ variations?: VariationLocal[]; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  if (attributeGroups.length === 0 || attributeGroups.some(g => g.values.length === 0)) {
    return { error: "Semua atribut harus memiliki minimal satu nilai." };
  }

  // Cartesian product dari semua attribute values
  function cartesian(groups: import("@jalajogja/db").AttributeGroup[]): Record<string, string>[] {
    return groups.reduce<Record<string, string>[]>((acc, group) => {
      if (acc.length === 0) return group.values.map(v => ({ [group.name]: v }));
      return acc.flatMap(combo => group.values.map(v => ({ ...combo, [group.name]: v })));
    }, []);
  }

  const combos = cartesian(attributeGroups);

  // Map existing variations by combo key
  const existingMap = new Map(
    existing.map(v => [JSON.stringify(v.attributeCombo), v])
  );

  const result: VariationLocal[] = combos.map(combo => {
    const key      = JSON.stringify(combo);
    const found    = existingMap.get(key);
    return found ?? {
      _key:        crypto.randomUUID(),
      sku:         "",
      price:       "",
      publicPrice: "",
      memberPrice: "",
      stock:       "0",
      weightGram:  "",
      images:      [],
      attributeCombo: combo,
      isActive:    true,
    };
  });

  return { variations: result };
}
