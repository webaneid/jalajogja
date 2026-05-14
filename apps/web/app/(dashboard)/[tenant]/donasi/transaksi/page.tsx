import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { desc, and, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransaksiTable } from "@/components/donasi/transaksi-list-client";
import { CartDonationsTable } from "@/components/donasi/cart-donations-table";

export default async function TransaksiListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // ── Donasi langsung (sistem lama) ─────────────────────────────────────────
  const donations = await db
    .select({
      id:             schema.donations.id,
      donationNumber: schema.donations.donationNumber,
      donorName:      schema.donations.donorName,
      isAnonymous:    schema.donations.isAnonymous,
      donationType:   schema.donations.donationType,
      campaignId:     schema.donations.campaignId,
      campaignTitle:  schema.campaigns.title,
      createdAt:      schema.donations.createdAt,
      paymentId:      schema.payments.id,
      paymentStatus:  schema.payments.status,
      paymentMethod:  schema.payments.method,
      paymentAmount:  schema.payments.amount,
    })
    .from(schema.donations)
    .leftJoin(
      schema.campaigns,
      eq(schema.campaigns.id, schema.donations.campaignId)
    )
    .leftJoin(
      schema.payments,
      and(
        eq(schema.payments.sourceType, "donation"),
        eq(schema.payments.sourceId,   schema.donations.id)
      )
    )
    .orderBy(desc(schema.donations.createdAt))
    .limit(200);

  // ── Donasi via keranjang (sistem baru / billing) ──────────────────────────
  const cartDonations = await db
    .select({
      invoiceId:     schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerName:  schema.invoices.customerName,
      invoiceStatus: schema.invoices.status,
      createdAt:     schema.invoices.createdAt,
      campaignId:    schema.invoiceItems.itemId,
      campaignTitle: schema.campaigns.title,
      itemName:      schema.invoiceItems.name,
      itemTotal:     schema.invoiceItems.total,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .leftJoin(schema.campaigns, eq(schema.campaigns.id, schema.invoiceItems.itemId))
    .where(eq(schema.invoiceItems.itemType, "donation"))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(200);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transaksi Donasi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Semua donasi masuk — langsung dan via keranjang
          </p>
        </div>
        <Link href={`/${slug}/donasi/transaksi/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Input Donasi
          </Button>
        </Link>
      </div>

      {/* Donasi langsung */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Donasi Langsung</h2>
          <p className="text-xs text-muted-foreground">Diinput manual oleh admin</p>
        </div>
        <TransaksiTable slug={slug} donations={donations} />
      </section>

      {/* Donasi via keranjang */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Donasi via Keranjang</h2>
          <p className="text-xs text-muted-foreground">Donasi dari checkout publik ({cartDonations.length} transaksi)</p>
        </div>
        <CartDonationsTable slug={slug} items={cartDonations} />
      </section>
    </div>
  );
}
