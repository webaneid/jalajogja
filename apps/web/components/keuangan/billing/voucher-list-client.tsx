"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toggleVoucherActiveAction, type VoucherListItem } from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type Props = {
  slug: string;
  rows: VoucherListItem[];
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function formatDiscount(r: VoucherListItem) {
  return r.discountType === "percentage" ? `${r.discountValue}%` : formatRp(r.discountValue);
}

const TARGET_LABELS: Record<string, string> = {
  product: "Produk", ticket: "Tiket Event", donation: "Donasi / Qurban",
};

export function VoucherListClient({ slug, rows }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(voucherId: string) {
    setPendingId(voucherId);
    startTransition(async () => {
      await toggleVoucherActiveAction(slug, voucherId);
      router.refresh();
      setPendingId(null);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Belum ada voucher. Klik &quot;Buat Voucher&quot; untuk mulai.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Kode</th>
            <th className="text-left px-4 py-2.5 font-medium">Berlaku Untuk</th>
            <th className="text-right px-4 py-2.5 font-medium">Diskon</th>
            <th className="text-center px-4 py-2.5 font-medium">Dipakai</th>
            <th className="text-center px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <Link
                  href={`/app/${slug}/finance/billing/voucher/${r.id}`}
                  className="font-mono font-medium hover:text-primary transition-colors"
                >
                  {r.code}
                </Link>
                <span className="block text-xs text-muted-foreground truncate max-w-[180px]">{r.name}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {TARGET_LABELS[r.targetType] ?? r.targetType}
                {r.targetCount > 0 && (
                  <span className="block text-xs">{r.targetCount} item spesifik</span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{formatDiscount(r)}</td>
              <td className="px-4 py-3 text-center text-muted-foreground">
                {r.usedCount}{r.usageLimit != null ? ` / ${r.usageLimit}` : ""}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  disabled={pendingId === r.id}
                  onClick={() => handleToggle(r.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    r.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.isActive ? "Aktif" : "Nonaktif"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
