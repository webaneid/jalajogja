"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toggleInstallmentPlanAction, type InstallmentPlanListItem } from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type Props = {
  slug: string;
  rows: InstallmentPlanListItem[];
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function InstallmentPlanListClient({ slug, rows }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(planId: string, field: "isActive" | "isPublished") {
    setPendingId(planId + field);
    startTransition(async () => {
      await toggleInstallmentPlanAction(slug, planId, field);
      router.refresh();
      setPendingId(null);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Belum ada program cicilan. Klik &quot;Buat Program&quot; untuk mulai.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Program</th>
            <th className="text-left px-4 py-2.5 font-medium">Event / Tiket</th>
            <th className="text-right px-4 py-2.5 font-medium">Total</th>
            <th className="text-center px-4 py-2.5 font-medium">Termin</th>
            <th className="text-center px-4 py-2.5 font-medium">Terdaftar</th>
            <th className="text-center px-4 py-2.5 font-medium">Aktif</th>
            <th className="text-center px-4 py-2.5 font-medium">Publish</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <Link
                  href={`/app/${slug}/finance/billing/cicilan/${r.id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.eventTitle ? (
                  <>
                    <span className="block">{r.eventTitle}</span>
                    <span className="block text-xs">{r.ticketName}</span>
                  </>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.totalAmount != null ? formatRp(r.totalAmount) : "—"}
              </td>
              <td className="px-4 py-3 text-center text-muted-foreground">
                {r.installmentCount}× / {r.intervalDays}hr
              </td>
              <td className="px-4 py-3 text-center">{r.enrolledCount}</td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  disabled={pendingId === r.id + "isActive"}
                  onClick={() => handleToggle(r.id, "isActive")}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    r.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.isActive ? "Aktif" : "Nonaktif"}
                </button>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  disabled={pendingId === r.id + "isPublished"}
                  onClick={() => handleToggle(r.id, "isPublished")}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    r.isPublished ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.isPublished ? "Tampil" : "Tersembunyi"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
