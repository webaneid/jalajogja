import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DonationActions } from "@/components/donasi/donation-actions";

function formatRupiah(amount: string | null | number) {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft:    { label: "Draft",    variant: "secondary" },
  active:   { label: "Aktif",   variant: "default"   },
  closed:   { label: "Ditutup", variant: "outline"   },
  archived: { label: "Arsip",   variant: "outline"   },
};

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Menunggu",       color: "bg-yellow-100 text-yellow-700" },
  submitted: { label: "Perlu Konfirm.", color: "bg-blue-100 text-blue-700"    },
  paid:      { label: "Dikonfirmasi",   color: "bg-green-100 text-green-700"  },
  cancelled: { label: "Dibatalkan",     color: "bg-zinc-100 text-zinc-500"    },
};

const METHOD_LABEL: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

const TYPE_LABEL: Record<string, string> = {
  donasi: "Donasi",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: campaignId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);

  if (!campaign) notFound();

  // Donasi terkait campaign ini (dengan data payment)
  const donations = await db
    .select({
      id:             schema.donations.id,
      donationNumber: schema.donations.donationNumber,
      donorName:      schema.donations.donorName,
      isAnonymous:    schema.donations.isAnonymous,
      donationType:   schema.donations.donationType,
      createdAt:      schema.donations.createdAt,
      // Payment
      paymentId:      schema.payments.id,
      paymentStatus:  schema.payments.status,
      paymentMethod:  schema.payments.method,
      paymentAmount:  schema.payments.amount,
    })
    .from(schema.donations)
    .leftJoin(
      schema.payments,
      and(
        eq(schema.payments.sourceType, "donation"),
        eq(schema.payments.sourceId,   schema.donations.id)
      )
    )
    .where(eq(schema.donations.campaignId, campaignId))
    .orderBy(desc(schema.donations.createdAt))
    .limit(50);

  const target    = campaign.targetAmount ? parseFloat(campaign.targetAmount) : null;
  const collected = parseFloat(campaign.collectedAmount);
  const progress  = target ? Math.min(100, (collected / target) * 100) : null;
  const st = STATUS_MAP[campaign.status] ?? { label: campaign.status, variant: "outline" as const };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/donasi/campaign`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaign
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/${slug}/donasi/campaign/${campaignId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Link href={`/${slug}/donasi/transaksi/new?campaign=${campaignId}`}>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Input Donasi
            </Button>
          </Link>
        </div>
      </div>

      {/* Judul + meta */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{campaign.title}</h1>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground font-mono">{campaign.slug}</p>
        <p className="text-sm text-muted-foreground">
          {TYPE_LABEL[campaign.campaignType] ?? campaign.campaignType}
          {campaign.startsAt && ` · ${formatDate(new Date(campaign.startsAt))}`}
          {campaign.endsAt   && ` — ${formatDate(new Date(campaign.endsAt))}`}
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Terkumpul</p>
            <p className="text-2xl font-bold text-green-700">{formatRupiah(collected)}</p>
          </div>
          {target && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-sm font-medium">{formatRupiah(target)}</p>
            </div>
          )}
        </div>
        {progress !== null && (
          <div className="space-y-1">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{progress.toFixed(1)}%</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{donations.length} transaksi</p>
      </div>

      {/* Daftar donasi */}
      <div>
        <h2 className="font-medium text-sm mb-3">Riwayat Donasi</h2>
        {donations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Belum ada donasi masuk</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Nomor</th>
                  <th className="px-4 py-2.5 text-left font-medium">Donatur</th>
                  <th className="px-4 py-2.5 text-left font-medium">Metode</th>
                  <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {donations.map((d) => {
                  const ps = d.paymentStatus ? (PAY_STATUS[d.paymentStatus] ?? { label: d.paymentStatus, color: "bg-zinc-100" }) : null;
                  return (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {d.donationNumber}
                      </td>
                      <td className="px-4 py-3">
                        {d.isAnonymous ? (
                          <span className="text-muted-foreground italic">Anonim</span>
                        ) : (
                          d.donorName
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.paymentMethod ? (METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {d.paymentAmount ? formatRupiah(d.paymentAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {ps ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ps.color}`}>
                            {ps.label}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DonationActions
                          slug={slug}
                          donationId={d.id}
                          paymentId={d.paymentId ?? null}
                          paymentStatus={d.paymentStatus ?? null}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
