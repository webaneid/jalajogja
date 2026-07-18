"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/ui/phone-input";
import { enrollInstallmentPlanAction } from "@/app/(dashboard)/app/[tenant]/event/actions";

type Props = {
  slug:    string;
  planId:  string;
  planName: string;
  totalAmount: number;
  installmentCount: number;
  intervalDays: number;
  defaultName?:  string;
  defaultPhone?: string;
  defaultEmail?: string;
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function EventInstallmentEnroll({
  slug, planId, planName, totalAmount, installmentCount, intervalDays,
  defaultName = "", defaultPhone = "", defaultEmail = "",
}: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError]     = useState("");
  const [name, setName]       = useState(defaultName);
  const [phone, setPhone]     = useState(defaultPhone);
  const [email, setEmail]     = useState(defaultEmail);

  const perTerm = Math.round(totalAmount / installmentCount);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await enrollInstallmentPlanAction(slug, {
        planId, attendeeName: name, attendeePhone: phone || null, attendeeEmail: email || null,
      });
      if (res.success) {
        router.push(`/${slug}/invoice/${res.data.invoiceId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Tersedia Cicilan: {planName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {installmentCount}× {formatRp(perTerm)} — setiap {intervalDays} hari — total {formatRp(totalAmount)}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-outline-primary btn-sm shrink-0"
          >
            Daftar
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <div>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap" className={inputCls} required />
          </div>
          <PhoneInput label="Nomor HP/WhatsApp" value={phone} onChange={setPhone} />
          <div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (opsional)" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !name.trim()}
              className="btn btn-primary btn-sm disabled:opacity-60">
              {pending ? "Mendaftar..." : "Daftar Cicilan"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="btn btn-ghost btn-sm">
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
