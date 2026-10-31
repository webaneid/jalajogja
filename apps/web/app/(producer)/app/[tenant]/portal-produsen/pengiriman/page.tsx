// Menu Pengiriman — daftar batch pengiriman produsen. Server component; data lewat lib/producer-orders.server.ts.
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listProducerBatches } from "@/lib/producer-orders.server";

const LABEL: Record<string, string> = { pending: "Menunggu", processing: "Diproses", packed: "Dikemas", shipped: "Dikirim", delivered: "Diterima" };
const fmtDate = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default async function ProducerShipmentsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const batches = await listProducerBatches(createTenantDb(access.tenant.slug), access.producer.id);
  const base = `/app/${slug}/portal-produsen/pengiriman`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pengiriman</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Batch pengiriman: kelompok pesanan yang dikirim bersamaan.</p>
        </div>
        <Link href={`${base}/baru`} className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Buat Batch</Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Batch</th>
              <th className="px-3 py-2 font-medium">Tgl Pengiriman</th>
              <th className="px-3 py-2 text-right font-medium">Pesanan</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {batches.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">Belum ada batch pengiriman.</td></tr>}
            {batches.map((b) => (
              <tr key={b.id} className="hover:bg-muted/40">
                <td className="px-3 py-2"><Link href={`${base}/${b.id}`} className="font-mono font-medium hover:underline">{b.name}</Link></td>
                <td className="px-3 py-2">{fmtDate(b.shippingDate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b.total}</td>
                <td className="px-3 py-2 text-xs">
                  {b.finished ? <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">Selesai</span>
                    : Object.entries(b.byStatus).map(([st, n]) => `${LABEL[st] ?? st} ${n}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
