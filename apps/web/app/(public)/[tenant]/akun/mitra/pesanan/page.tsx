import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, members, createTenantDb } from "@jalajogja/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { ShoppingBag } from "lucide-react";
import { MitraPesananClient, type MitraOrder } from "./pesanan-client";

type Params = Promise<{ tenant: string }>;

export default async function MitraPesananPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect(`/${slug}/login?redirect=/${slug}/akun/mitra/pesanan`);

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) redirect(`/${slug}/akun`);

  const { db: tdb, schema } = createTenantDb(slug);

  // Pastikan mitra aktif
  const [mitra] = await tdb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);

  if (!mitra) redirect(`/${slug}/akun/mitra`);

  // Ambil semua invoice yang mengandung item dari mitra ini
  const mitraItemRows = await tdb
    .select({
      invoiceId: schema.invoiceItems.invoiceId,
      name:      schema.invoiceItems.name,
      quantity:  schema.invoiceItems.quantity,
      unitPrice: schema.invoiceItems.unitPrice,
    })
    .from(schema.invoiceItems)
    .where(and(
      eq(schema.invoiceItems.sellerType, "mitra"),
      eq(schema.invoiceItems.sellerId, mitra.id),
    ));

  const invoiceIds = [...new Set(mitraItemRows.map(r => r.invoiceId))];

  if (invoiceIds.length === 0) {
    return (
      <div className="space-y-6">
        <Header slug={slug} />
        <MitraPesananClient slug={slug} orders={[]} />
      </div>
    );
  }

  const invoiceRows = await tdb
    .select({
      id:               schema.invoices.id,
      invoiceNumber:    schema.invoices.invoiceNumber,
      customerName:     schema.invoices.customerName,
      shippingCityName: schema.invoices.shippingCityName,
      shippingAddress:  schema.invoices.shippingAddress,
      status:           schema.invoices.status,
      total:            schema.invoices.total,
      createdAt:        schema.invoices.createdAt,
    })
    .from(schema.invoices)
    .where(inArray(schema.invoices.id, invoiceIds))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(100);

  // Ambil shipping lines untuk mitra ini
  const shippingRows = await tdb
    .select()
    .from(schema.invoiceShippingLines)
    .where(and(
      inArray(schema.invoiceShippingLines.invoiceId, invoiceIds),
      eq(schema.invoiceShippingLines.sellerId, mitra.id),
    ));

  // Group items per invoice
  const itemsByInvoice: Record<string, typeof mitraItemRows> = {};
  for (const row of mitraItemRows) {
    if (!itemsByInvoice[row.invoiceId]) itemsByInvoice[row.invoiceId] = [];
    itemsByInvoice[row.invoiceId].push(row);
  }

  // Map shipping per invoice
  const shippingByInvoice: Record<string, typeof shippingRows[0]> = {};
  for (const row of shippingRows) {
    shippingByInvoice[row.invoiceId] = row;
  }

  // Build MitraOrder[]
  const orders: MitraOrder[] = invoiceRows.map(inv => {
    const items = (itemsByInvoice[inv.id] ?? []).map(it => ({
      name:      it.name,
      quantity:  it.quantity,
      unitPrice: parseFloat(String(it.unitPrice)),
    }));

    const sl = shippingByInvoice[inv.id];
    const shipping = sl ? {
      id:             sl.id,
      courier:        sl.courier,
      service:        sl.service,
      etd:            sl.etd,
      weightGram:     sl.weightGram,
      cost:           parseFloat(String(sl.cost)),
      trackingNumber: sl.trackingNumber,
      shippedAt:      sl.shippedAt?.toISOString() ?? null,
      status:         sl.status as "pending" | "shipped" | "delivered",
    } : null;

    return {
      invoiceId:        inv.id,
      invoiceNumber:    inv.invoiceNumber,
      customerName:     inv.customerName,
      shippingCityName: inv.shippingCityName,
      shippingAddress:  inv.shippingAddress,
      invoiceStatus:    inv.status,
      invoiceTotal:     parseFloat(String(inv.total)),
      createdAt:        inv.createdAt.toISOString(),
      items,
      shipping,
    };
  });

  return (
    <div className="space-y-6">
      <Header slug={slug} />
      <MitraPesananClient slug={slug} orders={orders} />
    </div>
  );
}

function Header({ slug }: { slug: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Pesanan Masuk</h1>
          <p className="text-xs text-muted-foreground">
            Invoice yang mengandung produk Anda — input resi setelah pembayaran dikonfirmasi
          </p>
        </div>
      </div>
      <a href={`/${slug}/akun/mitra`} className="text-xs text-muted-foreground hover:text-foreground">
        ← Kembali
      </a>
    </div>
  );
}
