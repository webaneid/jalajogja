import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DisbursementActions } from "@/components/keuangan/disbursement-detail-client";

function formatRupiah(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft:     "Draft",
  approved:  "Disetujui",
  paid:      "Dibayar",
  cancelled: "Dibatalkan",
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-zinc-100 text-zinc-600",
  approved:  "bg-indigo-100 text-indigo-700",
  paid:      "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const PURPOSE_LABEL: Record<string, string> = {
  refund:   "Pengembalian Dana",
  expense:  "Beban Operasional",
  grant:    "Bantuan / Hibah",
  transfer: "Transfer Antar Rekening",
  manual:   "Manual (Lainnya)",
};

export default async function PengeluaranDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [dis] = await db
    .select()
    .from(schema.disbursements)
    .where(eq(schema.disbursements.id, id))
    .limit(1);

  if (!dis) notFound();

  let transaction = null;
  if (dis.transactionId) {
    const [tx] = await db
      .select({
        id:              schema.transactions.id,
        referenceNumber: schema.transactions.referenceNumber,
        date:            schema.transactions.date,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, dis.transactionId))
      .limit(1);
    transaction = tx;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/finance/pengeluaran`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pengeluaran
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[dis.status] ?? "bg-zinc-100"}`}>
          {STATUS_LABEL[dis.status] ?? dis.status}
        </span>
      </div>

      {/* Header */}
      <div>
        <p className="font-mono text-xs text-muted-foreground">{dis.number}</p>
        <h1 className="text-xl font-semibold mt-1">{formatRupiah(dis.amount)}</h1>
        <p className="text-sm text-muted-foreground">kepada {dis.recipientName}</p>
      </div>

      {/* Detail */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {[
          ["Jenis",           PURPOSE_LABEL[dis.purposeType] ?? dis.purposeType],
          ["Metode",          dis.method === "cash" ? "Tunai" : "Transfer Bank"],
          ["Bank Penerima",   dis.recipientBank ?? "—"],
          ["No. Rekening",    dis.recipientAccount ?? "—"],
          ["Keterangan",      dis.note ?? "—"],
          ["Diajukan",        formatDate(dis.createdAt)],
          ...(dis.approvedAt ? [["Disetujui", formatDate(dis.approvedAt)]] : []),
          ...(dis.paidAt     ? [["Dibayar",   formatDate(dis.paidAt)]]     : []),
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right max-w-[60%]">{value}</span>
          </div>
        ))}
      </div>

      {/* Jurnal */}
      {transaction && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground mb-1">Jurnal Akuntansi</p>
          <Link
            href={`/${slug}/finance/jurnal`}
            className="font-mono text-sm text-primary hover:underline"
          >
            {transaction.referenceNumber}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">{transaction.date}</p>
        </div>
      )}

      {/* Aksi */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-sm">Tindakan</h2>
        <DisbursementActions slug={slug} disbursementId={dis.id} status={dis.status} />
      </div>
    </div>
  );
}
