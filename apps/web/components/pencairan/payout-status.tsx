// Badge status + stepper alur pencairan (Diajukan → Disetujui → Ditransfer). Presentasional murni.
import { Check, X } from "lucide-react";
import { fmtDateTime } from "@/lib/rupiah";

export const PAYOUT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  requested: { label: "Menunggu persetujuan", cls: "bg-amber-100 text-amber-800" },
  approved:  { label: "Disetujui — menunggu transfer", cls: "bg-sky-100 text-sky-800" },
  paid:      { label: "Sudah ditransfer", cls: "bg-emerald-100 text-emerald-800" },
  rejected:  { label: "Ditolak", cls: "bg-rose-100 text-rose-800" },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground" },
};

export function PayoutStatusBadge({ status }: { status: string }) {
  const s = PAYOUT_STATUS_LABEL[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function PayoutStepper({ status, requestedAt, approvedAt, paidAt }: { status: string; requestedAt: Date | string; approvedAt: Date | string | null; paidAt: Date | string | null }) {
  const failed = status === "rejected" || status === "cancelled";
  const steps = [
    { label: "Diajukan", at: requestedAt, done: true },
    { label: "Disetujui", at: approvedAt, done: status === "approved" || status === "paid" },
    { label: "Ditransfer", at: paidAt, done: status === "paid" },
  ];
  const failIndex = failed ? steps.findIndex((x) => !x.done) : -1;   // langkah tempat proses berhenti (ditolak/dibatalkan)
  return (
    <ol className="flex items-start">
      {steps.map((st, i) => (
        <li key={st.label} className="flex flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <div className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : st.done ? "bg-emerald-500" : "bg-border"}`} />
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${st.done ? "border-emerald-500 bg-emerald-500 text-white" : i === failIndex ? "border-rose-500 bg-rose-50 text-rose-600" : "border-border bg-background text-muted-foreground"}`}>
              {st.done ? <Check className="h-4 w-4" /> : i === failIndex ? <X className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
            </div>
            <div className={`h-0.5 flex-1 ${i === steps.length - 1 ? "bg-transparent" : steps[i + 1].done ? "bg-emerald-500" : "bg-border"}`} />
          </div>
          <p className="mt-1.5 text-xs font-medium">{st.label}</p>
          <p className="text-[11px] text-muted-foreground">{st.done && st.at ? fmtDateTime(st.at) : i === failIndex ? (status === "rejected" ? "Ditolak" : "Dibatalkan") : "—"}</p>
        </li>
      ))}
    </ol>
  );
}
