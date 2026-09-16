// Resolusi "siapa saja yang membeli produk X" — dipakai bersama halaman admin
// `/toko/produk/[id]` (tampilan tabel) dan route export Excel `/api/products/[id]/export-buyers`.
// Satu fungsi shared supaya UI dan export tidak pernah drift (pola sama resolveVariantPriceRanges).
//
// Titik krusial (lihat packages/db/src/helpers/resolve-product-item.ts): untuk produk SIMPLE,
// invoice_items.itemId = products.id. Untuk produk VARIABLE, invoice_items.itemId =
// product_variations.id (varian spesifik yang dibeli) — BUKAN id produk induk. Query "siapa
// pembeli produk X" WAJIB `itemId IN [product.id, ...semua variation.id miliknya]`.
//
// Status pembayaran (Lunas/Sebagian/Belum Bayar) diturunkan dari invoices.status/paidAmount
// LANGSUNG (bukan dijumlah manual dari payments) — persis pola yang sudah dikunci di
// export-participants event (lihat komentar di sana). "Total Dibayarkan" di sini scoped ke
// INVOICE (bukan per-baris) — kalau satu invoice punya >1 baris produk yang sama, tiap baris
// akan menampilkan angka total-invoice yang SAMA; itu disengaja (representasi "berapa yang
// sudah masuk untuk invoice ini"), JANGAN dijumlah lintas baris kalau invoice-nya sama.
//
// Voucher (docs/arsitektur-voucher.md): lineTotal SUDAH net-of-voucher (invoice_items.total =
// unitPrice*quantity - discountAmount). discountAmount + voucherCode diekspos terpisah supaya
// UI/export bisa menjelaskan KENAPA lineTotal lebih kecil dari unitPrice*quantity — jangan
// pernah tampilkan lineTotal tanpa keduanya kalau discountAmount > 0.
import "server-only";
import { eq, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { db as publicDb, members as publicMembers, contacts as publicContacts, composeAddress } from "@jalajogja/db";
import { formatShippingMethod } from "@/lib/format-shipping-method";
import { normalizePhone } from "@/lib/phone";

export type ProductBuyerRow = {
  invoiceId:           string;
  invoiceNumber:       string;
  customerName:        string;
  customerPhone:       string | null;
  itemName:            string;
  variantLabel:        string; // "" untuk produk simple
  quantity:            number;
  unitPrice:            number;
  lineTotal:           number; // NET of diskon voucher — lihat discountAmount untuk selisihnya
  discountAmount:      number; // potongan voucher pada baris INI (invoice_items.discountAmount)
  voucherCode:         string | null; // kode voucher invoice ini (invoices.voucherCode), null = tanpa voucher
  shippingLabel:       string;
  // Alamat lengkap+kodepos — snapshot checkout (shippingAddress+shippingCityName, sudah satu
  // string lengkap) DIUTAMAKAN, fallback ke alamat member tersimpan HANYA kalau snapshot kosong
  // total (docs/arsitektur-product.md § "Susulan — Alamat Lengkap..."). "" kalau keduanya kosong.
  fullAddress:         string;
  shippingCost:        number; // 0 untuk pickup — SELALU punya nilai pasti, beda dari totalDibayarkan
  paymentStatusLabel:  "Lunas" | "Sebagian" | "Belum Bayar";
  totalDibayarkan:     number | "";
  createdAt:           Date;
};

export type ProductBuyersResult = {
  product: {
    id:          string;
    name:        string;
    sku:         string | null;
    price:       string;
    stock:       number;
    status:      string;
    images:      unknown;
    productType: string;
  } | null;
  rows: ProductBuyerRow[];
};

export async function resolveProductBuyers(
  tenantClient: TenantDb,
  productId:    string,
  opts:         { includeAll: boolean },
): Promise<ProductBuyersResult> {
  const { db, schema } = tenantClient;

  const [product] = await db
    .select({
      id: schema.products.id, name: schema.products.name, sku: schema.products.sku,
      price: schema.products.price, stock: schema.products.stock, status: schema.products.status,
      images: schema.products.images, productType: schema.products.productType,
    })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);
  if (!product) return { product: null, rows: [] };

  // Semua id yang mungkin muncul sebagai invoice_items.itemId untuk produk ini.
  const variations = await db
    .select({ id: schema.productVariations.id, attributeCombo: schema.productVariations.attributeCombo })
    .from(schema.productVariations)
    .where(eq(schema.productVariations.productId, productId));
  const variationMap = new Map(variations.map((v) => [v.id, v.attributeCombo as Record<string, string>]));
  const matchIds = [product.id, ...variations.map((v) => v.id)];

  const items = await db
    .select({
      invoiceId:      schema.invoiceItems.invoiceId,
      itemId:         schema.invoiceItems.itemId,
      name:           schema.invoiceItems.name,
      quantity:       schema.invoiceItems.quantity,
      unitPrice:      schema.invoiceItems.unitPrice,
      total:          schema.invoiceItems.total,
      discountAmount: schema.invoiceItems.discountAmount,
      sellerType:     schema.invoiceItems.sellerType,
      sellerId:       schema.invoiceItems.sellerId,
    })
    .from(schema.invoiceItems)
    .where(and(
      eq(schema.invoiceItems.itemType, "product"),
      inArray(schema.invoiceItems.itemId, matchIds),
    ));
  if (items.length === 0) return { product, rows: [] };

  const invoiceIds = [...new Set(items.map((i) => i.invoiceId))];
  const invoiceRows = await db
    .select({
      id: schema.invoices.id, invoiceNumber: schema.invoices.invoiceNumber,
      customerName: schema.invoices.customerName, customerPhone: schema.invoices.customerPhone,
      status: schema.invoices.status, paidAmount: schema.invoices.paidAmount,
      voucherCode: schema.invoices.voucherCode,
      shippingAddress: schema.invoices.shippingAddress,
      shippingCityName: schema.invoices.shippingCityName,
      memberId: schema.invoices.memberId,
      createdAt: schema.invoices.createdAt,
    })
    .from(schema.invoices)
    .where(inArray(schema.invoices.id, invoiceIds));
  const invoiceMap = new Map(invoiceRows.map((i) => [i.id, i]));

  const shippingLines = await db
    .select({
      invoiceId: schema.invoiceShippingLines.invoiceId,
      sellerType: schema.invoiceShippingLines.sellerType,
      sellerId: schema.invoiceShippingLines.sellerId,
      deliveryMethod: schema.invoiceShippingLines.deliveryMethod,
      courier: schema.invoiceShippingLines.courier,
      service: schema.invoiceShippingLines.service,
      paymentMethod: schema.invoiceShippingLines.paymentMethod,
      cost: schema.invoiceShippingLines.cost,
    })
    .from(schema.invoiceShippingLines)
    .where(inArray(schema.invoiceShippingLines.invoiceId, invoiceIds));
  const shippingMap = new Map(
    shippingLines.map((s) => [`${s.invoiceId}|${s.sellerType}|${s.sellerId ?? ""}`, s]),
  );

  // Alamat lengkap — checkout snapshot DIUTAMAKAN. Fallback ke alamat member tersimpan HANYA
  // untuk invoice yang shippingAddress-nya kosong total DAN punya memberId (docs/arsitektur-
  // product.md § "Susulan — Alamat Lengkap..."). Batch via Promise.all (bukan N+1 serial) —
  // hanya invoice yang genuinely butuh fallback yang di-query, sisanya nol query tambahan.
  //
  // ANTI-ABUSE (security review 2026-09-17): invoices.memberId bisa ke-link lewat match EMAIL
  // di resolveIdentity() (packages/db/src/helpers/resolve-identity.ts) TANPA verifikasi apa
  // pun — beda dari match HP yang di checkoutAction WAJIB lolos gate OTP dulu
  // (cart/actions.ts:536-551) sebelum resolveIdentity() dipanggil. Kalau fallback dipakai
  // buta-buta dari memberId, tamu yang kebetulan/sengaja isi EMAIL milik anggota lain bisa
  // membuat alamat rumah ASLI anggota itu ketampil ke admin toko. Fix: fallback HANYA jalan
  // kalau nomor HP di invoice ini (customerPhone, yang benar-benar diketik saat transaksi)
  // SAMA dengan nomor HP tersimpan milik member yang match — kalau sama, invoice ini MESTI
  // sudah lolos gate OTP (satu-satunya jalur match-HP-lalu-checkout-sukses). Kalau beda
  // (match aslinya lewat email), fallback di-skip, alamat tetap kosong. Limitasi yang
  // diterima: invoice historis dari SEBELUM gate OTP dibangun (commit ed5ce17) tidak bisa
  // dibedakan dari sini — residual risk kecil, dicatat sebagai limitasi eksplisit di dokumen.
  const needsFallback = invoiceRows.filter((i) => !i.shippingAddress?.trim() && i.memberId);
  const fallbackAddressMap = new Map<string, string>();
  if (needsFallback.length > 0) {
    const memberIds = [...new Set(needsFallback.map((i) => i.memberId as string))];
    const memberRows = await publicDb
      .select({ id: publicMembers.id, homeAddressId: publicMembers.homeAddressId, contactId: publicMembers.contactId })
      .from(publicMembers)
      .where(inArray(publicMembers.id, memberIds));
    const memberMap = new Map(memberRows.map((m) => [m.id, m]));

    const contactIds = memberRows.map((m) => m.contactId).filter((id): id is string => !!id);
    const contactRows = contactIds.length > 0
      ? await publicDb
          .select({ id: publicContacts.id, phone: publicContacts.phone })
          .from(publicContacts)
          .where(inArray(publicContacts.id, contactIds))
      : [];
    const contactPhoneMap = new Map(contactRows.map((c) => [c.id, c.phone]));

    const resolved = await Promise.all(
      needsFallback.map(async (inv) => {
        const member = memberMap.get(inv.memberId as string);
        if (!member?.homeAddressId) return [inv.id, ""] as const;

        const memberPhone  = member.contactId ? contactPhoneMap.get(member.contactId) : null;
        const invoicePhone = inv.customerPhone ? (normalizePhone(inv.customerPhone) ?? inv.customerPhone) : null;
        if (!memberPhone || !invoicePhone || memberPhone !== invoicePhone) return [inv.id, ""] as const;

        const composed = await composeAddress(publicDb, member.homeAddressId);
        return [inv.id, composed ?? ""] as const;
      }),
    );
    for (const [invoiceId, address] of resolved) {
      if (address) fallbackAddressMap.set(invoiceId, address);
    }
  }

  const rows: ProductBuyerRow[] = [];
  for (const item of items) {
    const invoice = invoiceMap.get(item.invoiceId);
    if (!invoice) continue; // data yatim, tidak seharusnya terjadi tapi jangan crash

    if (!opts.includeAll && invoice.status !== "paid") continue;

    let paymentStatusLabel: ProductBuyerRow["paymentStatusLabel"];
    let totalDibayarkan: number | "";
    if (invoice.status === "paid") {
      paymentStatusLabel = "Lunas";
      totalDibayarkan    = parseFloat(String(invoice.paidAmount));
    } else if (invoice.status === "partial") {
      paymentStatusLabel = "Sebagian";
      totalDibayarkan    = parseFloat(String(invoice.paidAmount));
    } else {
      paymentStatusLabel = "Belum Bayar";
      totalDibayarkan    = "";
    }

    const combo = item.itemId !== product.id ? variationMap.get(item.itemId ?? "") : undefined;
    const variantLabel = combo
      ? Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";

    const shipping = shippingMap.get(`${item.invoiceId}|${item.sellerType}|${item.sellerId ?? ""}`);

    const checkoutAddress = [invoice.shippingAddress, invoice.shippingCityName]
      .filter((p): p is string => !!p?.trim())
      .join(", ");
    const fullAddress = checkoutAddress || fallbackAddressMap.get(invoice.id) || "";

    rows.push({
      invoiceId:          invoice.id,
      invoiceNumber:      invoice.invoiceNumber,
      customerName:       invoice.customerName,
      customerPhone:      invoice.customerPhone,
      itemName:           item.name,
      variantLabel,
      quantity:           item.quantity,
      unitPrice:          parseFloat(String(item.unitPrice)),
      lineTotal:          parseFloat(String(item.total)),
      discountAmount:     parseFloat(String(item.discountAmount ?? "0")),
      voucherCode:        invoice.voucherCode ?? null,
      shippingLabel:      formatShippingMethod(shipping),
      fullAddress,
      shippingCost:       shipping ? parseFloat(String(shipping.cost)) : 0,
      paymentStatusLabel,
      totalDibayarkan,
      createdAt:          invoice.createdAt,
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { product, rows };
}
