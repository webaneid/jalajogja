"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createInstallmentPlanAction, type EventTicketOption } from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type Props = {
  slug:          string;
  ticketOptions: EventTicketOption[];
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls = "block text-sm font-medium mb-1";

export function InstallmentPlanForm({ slug, ticketOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName]                     = useState("");
  const [description, setDescription]       = useState("");
  const [ticketId, setTicketId]             = useState("");
  const [totalAmount, setTotalAmount]       = useState("");
  const [installmentCount, setInstallmentCount] = useState("10");
  const [intervalDays, setIntervalDays]     = useState("30");

  const ticketComboOptions: ComboboxOption[] = ticketOptions.map((t) => ({
    value: t.ticketId,
    label: `${t.eventTitle} — ${t.ticketName} (${formatRp(t.price)})`,
  }));

  const totalNum  = parseInt(totalAmount.replace(/\D/g, ""), 10) || 0;
  const countNum  = parseInt(installmentCount, 10) || 0;
  const perTerm   = countNum > 0 ? Math.round(totalNum / countNum) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createInstallmentPlanAction(slug, {
        name,
        description: description.trim() || undefined,
        ticketId,
        totalAmount:      totalNum,
        installmentCount: countNum,
        intervalDays:     parseInt(intervalDays, 10) || 0,
      });
      if (res.success) {
        router.push(`/app/${slug}/finance/billing/cicilan/${res.data.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5 space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div>
        <label className={labelCls}>Nama Program</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nabung Qurban 2026" className={inputCls} required />
      </div>

      <div>
        <label className={labelCls}>Deskripsi <span className="text-muted-foreground text-xs">(opsional)</span></label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Tiket Event</label>
        <Combobox
          options={ticketComboOptions}
          value={ticketId}
          onValueChange={setTicketId}
          placeholder="Pilih event + tiket..."
          searchPlaceholder="Cari event/tiket..."
          emptyText="Tidak ada tiket aktif ditemukan."
        />
        {ticketOptions.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Belum ada tiket event aktif. Buat/aktifkan tiket dulu di modul Event.
          </p>
        )}
      </div>

      <div>
        <label className={labelCls}>Total Nominal</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <input type="text" inputMode="numeric" value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value.replace(/\D/g, ""))}
            className={`${inputCls} pl-9`} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Jumlah Termin</label>
          <input type="number" min={2} value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Interval (hari)</label>
          <input type="number" min={1} value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)} className={inputCls} required />
        </div>
      </div>

      {totalNum > 0 && countNum > 1 && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          Kira-kira {formatRp(perTerm)} / termin — termin terakhir menyerap sisa pembulatan.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !ticketId}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "Simpan Program"}
      </button>
    </form>
  );
}
