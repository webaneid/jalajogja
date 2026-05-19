import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { desc, and, eq, ilike, sql } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, ListOrdered } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Belum Dibayar",       cls: "bg-yellow-100 text-yellow-700" },
  waiting_verification: { label: "Menunggu Verifikasi", cls: "bg-blue-100 text-blue-700"    },
  partial:              { label: "Terbayar Sebagian",   cls: "bg-orange-100 text-orange-700" },
  paid:                 { label: "Lunas",               cls: "bg-green-100 text-green-700"  },
  cancelled:            { label: "Dibatalkan",          cls: "bg-zinc-100 text-zinc-500"    },
};

function fmt(n: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TransaksiListPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status }    = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Satu query — semua invoice yang punya item donasi, admin & front-end bersatu
  const conditions = [eq(schema.invoiceItems.itemType, "donation")];
  if (status && status !== "all") {
    conditions.push(sql`${schema.invoices.status} = ${status}`);
  }
  if (q) {
    conditions.push(
      sql`(${ilike(schema.invoices.customerName, `%${q}%`)} OR ${ilike(schema.invoices.invoiceNumber, `%${q}%`)} OR ${ilike(schema.campaigns.title, `%${q}%`)})`
    );
  }

  const rows = await db
    .select({
      invoiceId:      schema.invoices.id,
      invoiceNumber:  schema.invoices.invoiceNumber,
      sourceType:     schema.invoices.sourceType,
      customerName:   schema.invoices.customerName,
      invoiceStatus:  schema.invoices.status,
      createdAt:      schema.invoices.createdAt,
      donationId:     schema.donations.id,
      donationNumber: schema.donations.donationNumber,
      isAnonymous:    schema.donations.isAnonymous,
      itemName:       schema.invoiceItems.name,
      itemTotal:      schema.invoiceItems.total,
      campaignTitle:  schema.campaigns.title,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .leftJoin(
      schema.donations,
      and(
        eq(schema.invoices.sourceType, "donation"),
        eq(schema.donations.id, schema.invoices.sourceId),
      ),
    )
    .leftJoin(schema.campaigns, eq(schema.campaigns.id, schema.invoiceItems.itemId))
    .where(and(...conditions))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(500);

  const statuses = ["all", "pending", "waiting_verification", "paid", "cancelled"];

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (overrides.q      ?? q)      sp.set("q",      overrides.q      ?? q ?? "");
    if (overrides.status ?? status) sp.set("status", overrides.status ?? status ?? "");
    return `/${slug}/donasi/transaksi?${sp.toString()}`;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transaksi Donasi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} transaksi</p>
        </div>
        <Link href={`/${slug}/donasi/transaksi/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Input Donasi
          </Button>
        </Link>
      </div>

      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const label = s === "all" ? "Semua" : (INV_STATUS[s]?.label ?? s);
          return (
            <Link
              key={s}
              href={buildUrl({ status: s === "all" ? "" : s })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                (s === "all" && !status) || status === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form method="GET" action={`/${slug}/donasi/transaksi`}>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari donatur, nomor, atau campaign..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </form>

      {/* Tabel */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-16 text-center">
          <ListOrdered className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {q || status ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi donasi."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nomor</th>
                <th className="px-4 py-2.5 text-left font-medium">Donatur</th>
                <th className="px-4 py-2.5 text-left font-medium">Campaign / Keterangan</th>
                <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Tanggal</th>
                <th className="px-4 py-2.5 text-right font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const st = INV_STATUS[r.invoiceStatus] ?? { label: r.invoiceStatus, cls: "bg-zinc-100 text-zinc-500" };
                const isAdmin  = r.sourceType === "donation";
                const nomor    = r.donationNumber ?? r.invoiceNumber;
                const detailHref = isAdmin
                  ? `/${slug}/donasi/transaksi/${r.donationId}`
                  : `/${slug}/finance/billing/invoice/${r.invoiceId}`;
                return (
                  <tr key={`${r.invoiceId}-${r.itemName}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {nomor}
                    </td>
                    <td className="px-4 py-3">
                      {r.isAnonymous
                        ? <span className="italic text-muted-foreground text-xs">Anonim</span>
                        : r.customerName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.campaignTitle ?? r.itemName}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                      {fmt(r.itemTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={detailHref}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
