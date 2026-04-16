import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { desc, and, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransaksiTable } from "@/components/donasi/transaksi-list-client";

export default async function TransaksiListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transaksi Donasi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Semua donasi masuk ({donations.length} transaksi)
          </p>
        </div>
        <Link href={`/${slug}/donasi/transaksi/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Input Donasi
          </Button>
        </Link>
      </div>

      <TransaksiTable slug={slug} donations={donations} />
    </div>
  );
}
