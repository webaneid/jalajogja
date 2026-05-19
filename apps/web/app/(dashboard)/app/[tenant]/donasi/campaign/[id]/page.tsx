import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus, ShoppingCart } from "lucide-react";
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
  pending:              { label: "Menunggu",          color: "bg-yellow-100 text-yellow-700" },
  submitted:            { label: "Perlu Konfirm.",    color: "bg-blue-100 text-blue-700"    },
  waiting_verification: { label: "Perlu Konfirm.",    color: "bg-blue-100 text-blue-700"    },
  paid:                 { label: "Dikonfirmasi",      color: "bg-green-100 text-green-700"  },
  partial:              { label: "Sebagian",          color: "bg-orange-100 text-orange-700"},
  cancelled:            { label: "Dibatalkan",        color: "bg-zinc-100 text-zinc-500"    },
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
  if (!access) redirect("/app/login");

  const { db, schema } = createTenantDb(slug);

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);

  if (!campaign) notFound();

  // ── Old-system donations (donations table + payments) ─────────────────────
  const donations = await db
    .select({
      id:             schema.donations.id,
      donationNumber: schema.donations.donationNumber,
      donorName:      schema.donations.donorName,
      isAnonymous:    schema.donations.isAnonymous,
      donationType:   schema.donations.donationType,
      createdAt:      schema.donations.createdAt,
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
    .limit(100);

  // ── Cart-based donations (invoice_items WHERE itemType='donation', itemId=campaignId) ─
  const cartDonations = await db
    .select({
      invoiceId:     schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerName:  schema.invoices.customerName,
      invoiceStatus: schema.invoices.status,
      createdAt:     schema.invoices.createdAt,
      itemName:      schema.invoiceItems.name,
      itemTotal:     schema.invoiceItems.total,
      itemNotes:     schema.invoiceItems.description,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(
      and(
        eq(schema.invoiceItems.itemType, "donation"),
        eq(schema.invoiceItems.itemId, campaignId),
      )
    )
    .orderBy(desc(schema.invoices.createdAt))
    .limit(100);

  // ── Disbursements (disalurkan) ────────────────────────────────────────────
  const disbursements = await db
    .select({
      id:            schema.disbursements.id,
      number:        schema.disbursements.number,
      amount:        schema.disbursements.amount,
      recipientName: schema.disbursements.recipientName,
      note:          schema.disbursements.note,
      status:        schema.disbursements.status,
      paidAt:        schema.disbursements.paidAt,
    })
    .from(schema.disbursements)
    .where(
      and(
        eq(schema.disbursements.purposeType, "donation_payout"),
        eq(schema.disbursements.purposeId,   campaignId),
      )
    )
    .orderBy(desc(schema.disbursements.createdAt));

  // ── Kalkulasi keuangan ────────────────────────────────────────────────────
  const oldCollected = donations.reduce((acc, d) => {
    if (d.paymentStatus === "paid" && d.paymentAmount)
      return acc + parseFloat(d.paymentAmount);
    return acc;
  }, 0);

  const cartCollected = cartDonations.reduce((acc, d) => {
    if (d.invoiceStatus === "paid" && d.itemTotal)
      return acc + parseFloat(String(d.itemTotal));
    return acc;
  }, 0);

  const totalCollected = oldCollected + cartCollected;

  const totalDisbursed = disbursements
    .filter(d => d.status === "paid")
    .reduce((acc, d) => acc + parseFloat(String(d.amount)), 0);

  const sisaTitipan = totalCollected - totalDisbursed;

  const target   = campaign.targetAmount ? parseFloat(campaign.targetAmount) : null;
  const progress = target ? Math.min(100, (totalCollected / target) * 100) : null;
  const st = STATUS_MAP[campaign.status] ?? { label: campaign.status, variant: "outline" as const };

  // ── Qurban ───────────────────────────────────────────────────────────────
  const isQurban = campaign.campaignType === "qurban";
  type QurbanRow = {
    animalType: string | null; animalId: string | null;
    groupNumber: number | null; slotNumber: number | null;
    atasNama: string; donorName: string | null;
    paymentStatus: string | null; paymentAmount: string | null;
  };
  let qurbanRows: QurbanRow[] = [];
  if (isQurban) {
    qurbanRows = await db
      .select({
        animalType:    schema.qurbanAnimals.animalType,
        animalId:      schema.qurbanAnimals.id,
        groupNumber:   schema.qurbanSapiGroups.groupNumber,
        slotNumber:    schema.qurbanParticipants.slotNumber,
        atasNama:      schema.qurbanParticipants.atasNama,
        donorName:     schema.donations.donorName,
        paymentStatus: schema.payments.status,
        paymentAmount: schema.payments.amount,
      })
      .from(schema.qurbanParticipants)
      .leftJoin(schema.qurbanAnimals,    eq(schema.qurbanAnimals.id,    schema.qurbanParticipants.animalId))
      .leftJoin(schema.qurbanSapiGroups, eq(schema.qurbanSapiGroups.id, schema.qurbanParticipants.sapiGroupId))
      .leftJoin(schema.donations,        eq(schema.donations.id,        schema.qurbanParticipants.donationId))
      .leftJoin(schema.payments,         and(
        eq(schema.payments.sourceType, "donation"),
        eq(schema.payments.sourceId,   schema.qurbanParticipants.donationId),
      ))
      .where(eq(schema.qurbanAnimals.campaignId, campaignId))
      .orderBy(schema.qurbanAnimals.animalType, schema.qurbanSapiGroups.groupNumber, schema.qurbanParticipants.slotNumber);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/app/${slug}/donasi/campaign`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaign
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/app/${slug}/donasi/campaign/${campaignId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Link href={`/app/${slug}/donasi/transaksi/new?campaign=${campaignId}`}>
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

      {/* ── Ringkasan Keuangan (4 kotak) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Terkumpul</p>
          <p className="text-lg font-bold text-green-700">{formatRupiah(totalCollected)}</p>
          {progress !== null && (
            <p className="text-xs text-muted-foreground">{progress.toFixed(1)}% dari target</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="text-lg font-bold">{target ? formatRupiah(target) : "—"}</p>
          {target && totalCollected < target && (
            <p className="text-xs text-muted-foreground">Kurang {formatRupiah(target - totalCollected)}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Disalurkan</p>
          <p className="text-lg font-bold text-blue-700">{formatRupiah(totalDisbursed)}</p>
          <p className="text-xs text-muted-foreground">{disbursements.filter(d => d.status === "paid").length} transaksi</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Sisa Titipan</p>
          <p className={`text-lg font-bold ${sisaTitipan < 0 ? "text-destructive" : "text-orange-600"}`}>
            {formatRupiah(sisaTitipan)}
          </p>
          <p className="text-xs text-muted-foreground">Belum disalurkan</p>
        </div>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Donasi Langsung (sistem lama) ── */}
      <div>
        <h2 className="font-medium text-sm mb-3">
          Donasi Langsung
          <span className="ml-2 text-muted-foreground font-normal">({donations.length})</span>
        </h2>
        {donations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada donasi langsung</p>
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

      {/* ── Donasi via Keranjang (sistem baru / billing) ── */}
      <div>
        <h2 className="font-medium text-sm mb-3 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          Donasi via Keranjang
          <span className="text-muted-foreground font-normal">({cartDonations.length})</span>
        </h2>
        {cartDonations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada donasi via keranjang</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">No. Invoice</th>
                  <th className="px-4 py-2.5 text-left font-medium">Donatur</th>
                  <th className="px-4 py-2.5 text-left font-medium">Keterangan</th>
                  <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cartDonations.map((d) => {
                  const ps = PAY_STATUS[d.invoiceStatus] ?? { label: d.invoiceStatus, color: "bg-zinc-100" };
                  return (
                    <tr key={`${d.invoiceId}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/${slug}/finance/billing/invoice/${d.invoiceId}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {d.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{d.customerName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.itemNotes ?? d.itemName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatRupiah(parseFloat(String(d.itemTotal ?? 0)))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ps.color}`}>
                          {ps.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Riwayat Penyaluran ── */}
      <div>
        <h2 className="font-medium text-sm mb-3">
          Riwayat Penyaluran
          <span className="ml-2 text-muted-foreground font-normal">({disbursements.length})</span>
        </h2>
        {disbursements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada penyaluran dicatat</p>
            <p className="text-xs text-muted-foreground mt-1">
              Catat penyaluran melalui menu Keuangan → Pengeluaran (tipe: Penyaluran Donasi)
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Nomor</th>
                  <th className="px-4 py-2.5 text-left font-medium">Penerima</th>
                  <th className="px-4 py-2.5 text-left font-medium">Keterangan</th>
                  <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {disbursements.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.number}</td>
                    <td className="px-4 py-3">{d.recipientName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{d.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatRupiah(parseFloat(String(d.amount)))}</td>
                    <td className="px-4 py-3">
                      {d.status === "paid" ? (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Disalurkan</span>
                      ) : d.status === "approved" ? (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Disetujui</span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {d.paidAt ? new Date(d.paidAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabel peserta qurban ── */}
      {isQurban && (
        <div className="space-y-3">
          <h2 className="font-semibold">Peserta Qurban</h2>
          {qurbanRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan qurban.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Hewan</th>
                    <th className="px-3 py-2 font-medium">Grup/Slot</th>
                    <th className="px-3 py-2 font-medium">Atas Nama</th>
                    <th className="px-3 py-2 font-medium">Pemesan</th>
                    <th className="px-3 py-2 font-medium">Nominal</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {qurbanRows.map((r, i) => {
                    const pay = PAY_STATUS[r.paymentStatus ?? ""] ?? { label: r.paymentStatus ?? "—", color: "bg-muted" };
                    const ANIMAL_LABEL: Record<string, string> = { domba: "Domba", kambing: "Kambing", sapi: "Sapi" };
                    return (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2">{r.animalType ? (ANIMAL_LABEL[r.animalType] ?? r.animalType) : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {r.groupNumber != null ? `Grup ${r.groupNumber}` : ""}
                          {r.slotNumber  != null ? ` / Slot ${r.slotNumber}` : ""}
                          {r.groupNumber == null && r.slotNumber == null ? "Individu" : ""}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.atasNama}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.donorName}</td>
                        <td className="px-3 py-2">{r.paymentAmount ? formatRupiah(r.paymentAmount) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pay.color}`}>{pay.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
