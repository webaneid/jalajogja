"use client";

import { useState, useEffect } from "react";
import { use }                 from "react";
import { Loader2, Receipt }    from "lucide-react";

type Params = Promise<{ tenant: string }>;

type Invoice = {
  id:         string;
  number:     string | null;
  sourceType: string;
  total:      number;
  status:     string;
  createdAt:  string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Lunas",     cls: "bg-green-100 text-green-700" },
  pending:   { label: "Menunggu",  cls: "bg-yellow-100 text-yellow-700" },
  partial:   { label: "Sebagian",  cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Batal",     cls: "bg-red-100 text-red-700" },
};

const SOURCE_LABEL: Record<string, string> = {
  order:                "Toko",
  donation:             "Donasi",
  event_registration:   "Event",
  manual:               "Manual",
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export default function TransaksiPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/akun/transaksi?slug=${slug}`)
      .then(r => r.json())
      .then((res: { data?: Invoice[]; error?: string }) => {
        if (res.data) setInvoices(res.data);
        else setError(res.error ?? "Gagal memuat data.");
      })
      .catch(() => setError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Riwayat Transaksi</h1>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {invoices.map(inv => {
            const status = STATUS_LABEL[inv.status] ?? { label: inv.status, cls: "bg-muted text-muted-foreground" };
            return (
              <a
                key={inv.id}
                href={`/${slug}/invoice/${inv.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {inv.number ?? `INV-${inv.id.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[inv.sourceType] ?? inv.sourceType} ·{" "}
                    {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(inv.createdAt))}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{fmt(inv.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
