import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TransaksiActions } from "@/components/donasi/transaksi-actions";

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
    hour: "2-digit", minute: "2-digit",
  });
}

const PAY_STATUS_LABEL: Record<string, string> = {
  pending:   "Menunggu Konfirmasi",
  submitted: "Perlu Dikonfirmasi Admin",
  paid:      "Terkonfirmasi",
  cancelled: "Dibatalkan",
  rejected:  "Ditolak",
};

const METHOD_LABEL: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer Bank",
  qris:     "QRIS",
};

const TYPE_LABEL: Record<string, string> = {
  donasi: "Donasi Umum",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};

export default async function TransaksiDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: donationId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [donation] = await db
    .select()
    .from(schema.donations)
    .where(eq(schema.donations.id, donationId))
    .limit(1);

  if (!donation) notFound();

  // Campaign info
  let campaignTitle: string | null = null;
  let campaignId:    string | null = donation.campaignId ?? null;
  if (campaignId) {
    const [c] = await db
      .select({ title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    campaignTitle = c?.title ?? null;
  }

  // Payment
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(and(
      eq(schema.payments.sourceType, "donation"),
      eq(schema.payments.sourceId,   donationId)
    ))
    .limit(1);

  const amount    = payment ? parseFloat(String(payment.amount)) : 0;
  const totalAmt  = payment ? amount + (payment.uniqueCode ?? 0) : 0;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/donasi/transaksi`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Transaksi
        </Link>
      </div>

      <div>
        <p className="font-mono text-xs text-muted-foreground">{donation.donationNumber}</p>
        <h1 className="text-xl font-semibold mt-0.5">
          {donation.isAnonymous ? "Donatur Anonim" : donation.donorName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{formatDate(donation.createdAt)}</p>
      </div>

      {/* Info donasi */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {[
          ["Jenis",     TYPE_LABEL[donation.donationType] ?? donation.donationType],
          ["Campaign",  campaignTitle ?? "Donasi Umum (tanpa campaign)"],
          ["Nama",      donation.isAnonymous ? "(Anonim)" : donation.donorName],
          ["Telepon",   donation.donorPhone   ?? "—"],
          ["Email",     donation.donorEmail   ?? "—"],
          ...(donation.donorMessage ? [["Pesan", donation.donorMessage]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground shrink-0 w-28">{label}</span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Pembayaran */}
      {payment && (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Nomor Pembayaran</p>
            <p className="font-mono text-sm mt-0.5">{payment.number}</p>
          </div>
          {[
            ["Metode",  METHOD_LABEL[payment.method] ?? payment.method],
            ["Nominal", formatRupiah(amount)],
            ...(payment.uniqueCode && payment.uniqueCode > 0
              ? [["Kode Unik", String(payment.uniqueCode)],
                 ["Transfer", formatRupiah(totalAmt) + " (nominal + kode unik)"]]
              : []),
            ["Status",  PAY_STATUS_LABEL[payment.status] ?? payment.status],
            ...(payment.confirmedAt ? [["Dikonfirmasi", formatDate(payment.confirmedAt)]] : []),
            ...(payment.rejectionNote ? [["Catatan Tolak", payment.rejectionNote]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bukti bayar */}
      {payment?.proofUrl && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bukti Pembayaran
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.proofUrl}
            alt="Bukti pembayaran"
            className="max-w-full rounded-md border border-border max-h-64 object-contain"
          />
        </div>
      )}

      {/* Aksi */}
      {payment && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-medium text-sm">Tindakan</h2>
          <TransaksiActions
            slug={slug}
            donationId={donationId}
            paymentId={payment.id}
            paymentStatus={payment.status}
            campaignId={campaignId}
          />
        </div>
      )}
    </div>
  );
}
