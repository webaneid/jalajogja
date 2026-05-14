export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, desc, inArray }        from "drizzle-orm";
import { auth }                      from "@/lib/auth";
import { getAkunIdentity }           from "@/lib/akun-identity";
import { createTenantDb }            from "@jalajogja/db";

// ─── GET /api/akun/transaksi?slug={tenantSlug} ────────────────────────────────
// Riwayat pesanan (invoice + items + shipping) milik akun yang sedang login.
// Focus: produk yang dibeli + status pengiriman — bukan status pembayaran.

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id)
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  const identity = await getAkunIdentity(session.user.id);
  if (!identity)
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const slug  = searchParams.get("slug")?.trim();
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  if (!slug)
    return NextResponse.json({ error: "Parameter slug wajib diisi." }, { status: 400 });

  const { db: tenantDb, schema } = createTenantDb(slug);
  const offset = (page - 1) * limit;

  // ── Filter berdasarkan tipe akun ─────────────────────────────────────────
  let whereClause;
  if (identity.type === "member" && identity.memberId) {
    whereClause = eq(schema.invoices.memberId, identity.memberId);
  } else if (identity.profileId) {
    whereClause = eq(schema.invoices.profileId, identity.profileId);
  } else {
    return NextResponse.json({ data: [], total: 0, page, limit });
  }

  // ── Fetch invoices ────────────────────────────────────────────────────────
  const [invoiceRows, countRows] = await Promise.all([
    tenantDb
      .select({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        sourceType:    schema.invoices.sourceType,
        customerName:  schema.invoices.customerName,
        total:         schema.invoices.total,
        paidAmount:    schema.invoices.paidAmount,
        status:        schema.invoices.status,
        createdAt:     schema.invoices.createdAt,
      })
      .from(schema.invoices)
      .where(whereClause)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit)
      .offset(offset),

    tenantDb
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(whereClause),
  ]);

  if (!invoiceRows.length) {
    return NextResponse.json({ data: [], total: 0, page, limit });
  }

  const invoiceIds = invoiceRows.map(r => r.id);

  // ── Fetch items + shipping lines untuk semua invoice sekaligus ─────────────
  const [itemRows, shippingRows] = await Promise.all([
    tenantDb
      .select({
        invoiceId:   schema.invoiceItems.invoiceId,
        id:          schema.invoiceItems.id,
        itemType:    schema.invoiceItems.itemType,
        name:        schema.invoiceItems.name,
        description: schema.invoiceItems.description,
        unitPrice:   schema.invoiceItems.unitPrice,
        quantity:    schema.invoiceItems.quantity,
        total:       schema.invoiceItems.total,
      })
      .from(schema.invoiceItems)
      .where(inArray(schema.invoiceItems.invoiceId, invoiceIds))
      .orderBy(schema.invoiceItems.sortOrder),

    tenantDb
      .select({
        invoiceId:      schema.invoiceShippingLines.invoiceId,
        id:             schema.invoiceShippingLines.id,
        sellerName:     schema.invoiceShippingLines.sellerName,
        courier:        schema.invoiceShippingLines.courier,
        service:        schema.invoiceShippingLines.service,
        etd:            schema.invoiceShippingLines.etd,
        cost:           schema.invoiceShippingLines.cost,
        trackingNumber: schema.invoiceShippingLines.trackingNumber,
        shippedAt:      schema.invoiceShippingLines.shippedAt,
        status:         schema.invoiceShippingLines.status,
      })
      .from(schema.invoiceShippingLines)
      .where(inArray(schema.invoiceShippingLines.invoiceId, invoiceIds)),
  ]);

  // ── Group items + shipping per invoice ────────────────────────────────────
  const itemsByInvoice = itemRows.reduce<Record<string, typeof itemRows>>((acc, row) => {
    (acc[row.invoiceId] ??= []).push(row);
    return acc;
  }, {});

  const shippingByInvoice = shippingRows.reduce<Record<string, typeof shippingRows>>((acc, row) => {
    (acc[row.invoiceId] ??= []).push(row);
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    data: invoiceRows.map(inv => ({
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber,
      sourceType:    inv.sourceType,
      customerName:  inv.customerName,
      total:         parseFloat(String(inv.total     ?? 0)),
      paidAmount:    parseFloat(String(inv.paidAmount ?? 0)),
      status:        inv.status,
      createdAt:     inv.createdAt.toISOString(),
      items: (itemsByInvoice[inv.id] ?? []).map(it => ({
        id:          it.id,
        itemType:    it.itemType,
        name:        it.name,
        description: it.description,
        unitPrice:   parseFloat(String(it.unitPrice)),
        quantity:    it.quantity,
        total:       parseFloat(String(it.total)),
      })),
      shippingLines: (shippingByInvoice[inv.id] ?? []).map(sl => ({
        id:             sl.id,
        sellerName:     sl.sellerName,
        courier:        sl.courier,
        service:        sl.service,
        etd:            sl.etd,
        cost:           parseFloat(String(sl.cost)),
        trackingNumber: sl.trackingNumber,
        shippedAt:      sl.shippedAt?.toISOString() ?? null,
        status:         sl.status,
      })),
    })),
    total: countRows.length,
    page,
    limit,
  });
}
