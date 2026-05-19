import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PaymentActions } from "@/components/keuangan/payment-detail-client";

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
  pending:   "Menunggu",
  submitted: "Perlu Konfirmasi",
  paid:      "Lunas",
  rejected:  "Ditolak",
  cancelled: "Dibatalkan",
  refunded:  "Dikembalikan",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  submitted: "bg-blue-100 text-blue-700",
  paid:      "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
  refunded:  "bg-purple-100 text-purple-700",
};

const METHOD_LABEL: Record<string, string> = {
  cash:    "Tunai",
  transfer: "Transfer Bank",
  qris:    "QRIS",
  midtrans: "Midtrans",
  xendit:  "Xendit",
  ipaymu:  "iPaymu",
};

const SOURCE_LABEL: Record<string, string> = {
  order:    "Order Toko",
  donation: "Donasi",
  invoice:  "Invoice",
  manual:   "Manual",
};

export default async function PemasukanDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, id))
    .limit(1);

  if (!payment) notFound();

  // Ambil data transaksi jurnal jika sudah dikonfirmasi
  let transaction = null;
  if (payment.transactionId) {
    const [tx] = await db
      .select({
        id:              schema.transactions.id,
        referenceNumber: schema.transactions.referenceNumber,
        date:            schema.transactions.date,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, payment.transactionId))
      .limit(1);
    transaction = tx;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/finance/pemasukan`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Pemasukan
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[payment.status] ?? "bg-zinc-100 text-zinc-600"}`}>
          {STATUS_LABEL[payment.status] ?? payment.status}
        </span>
      </div>

      {/* Header */}
      <div>
        <p className="font-mono text-xs text-muted-foreground">{payment.number}</p>
        <h1 className="text-xl font-semibold mt-1">{formatRupiah(payment.amount)}</h1>
        <p className="text-sm text-muted-foreground">dari {payment.payerName ?? "—"}</p>
      </div>

      {/* Detail */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {[
          ["Sumber",         SOURCE_LABEL[payment.sourceType] ?? payment.sourceType],
          ["Metode",         METHOD_LABEL[payment.method]     ?? payment.method],
          ["Bank Pengirim",  payment.payerBank ?? "—"],
          ["Tgl Transfer",   payment.transferDate ?? "—"],
          ["Catatan",        payment.payerNote ?? "—"],
          ["Dibuat",         formatDate(payment.createdAt)],
          ...(payment.status === "paid"
            ? [["Dikonfirmasi", formatDate(payment.confirmedAt)]]
            : []),
          ...(payment.status === "rejected"
            ? [
                ["Ditolak",          formatDate(payment.rejectedAt)],
                ["Alasan Penolakan", payment.rejectionNote ?? "—"],
              ]
            : []),
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

      {/* Aksi admin */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-sm">Tindakan Admin</h2>
        <PaymentActions slug={slug} paymentId={payment.id} status={payment.status} />
      </div>
    </div>
  );
}
