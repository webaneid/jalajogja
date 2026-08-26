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
import "server-only";
import { eq, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { formatShippingMethod } from "@/lib/format-shipping-method";

export type ProductBuyerRow = {
  invoiceId:           string;
  invoiceNumber:       string;
  customerName:        string;
  customerPhone:       string | null;
  itemName:            string;
  variantLabel:        string; // "" untuk produk simple
  quantity:            number;
  unitPrice:            number;
  lineTotal:           number;
  shippingLabel:       string;
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
      invoiceId:  schema.invoiceItems.invoiceId,
      itemId:     schema.invoiceItems.itemId,
      name:       schema.invoiceItems.name,
      quantity:   schema.invoiceItems.quantity,
      unitPrice:  schema.invoiceItems.unitPrice,
      total:      schema.invoiceItems.total,
      sellerType: schema.invoiceItems.sellerType,
      sellerId:   schema.invoiceItems.sellerId,
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
    })
    .from(schema.invoiceShippingLines)
    .where(inArray(schema.invoiceShippingLines.invoiceId, invoiceIds));
  const shippingMap = new Map(
    shippingLines.map((s) => [`${s.invoiceId}|${s.sellerType}|${s.sellerId ?? ""}`, s]),
  );

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
      shippingLabel:      formatShippingMethod(shipping),
      paymentStatusLabel,
      totalDibayarkan,
      createdAt:          invoice.createdAt,
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { product, rows };
}
