"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createManualPaymentAction,
  type ManualPaymentData,
} from "@/app/(dashboard)/[tenant]/finance/actions";

type Props = {
  slug: string;
};

export function PaymentForm({ slug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [amount, setAmount]         = useState("");
  const [method, setMethod]         = useState<"cash" | "transfer" | "qris">("cash");
  const [payerName, setPayerName]   = useState("");
  const [payerBank, setPayerBank]   = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [notes, setNotes]           = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const amountNum = parseFloat(amount.replace(/\D/g, ""));
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }

    const data: ManualPaymentData = {
      amount: amountNum,
      method,
      payerName: payerName.trim(),
      payerBank: payerBank.trim() || undefined,
      transferDate: transferDate || undefined,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      const res = await createManualPaymentAction(slug, data);
      if (res.success) {
        router.push(`/${slug}/finance/pemasukan/${res.data.paymentId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Jumlah */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Jumlah <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
        </div>
      </div>

      {/* Nama pembayar */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Nama Pembayar <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          placeholder="mis. Ahmad Budi"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
      </div>

      {/* Metode */}
      <div>
        <label className="block text-sm font-medium mb-1">Metode Pembayaran</label>
        <div className="flex gap-2 flex-wrap">
          {(["cash", "transfer", "qris"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                method === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
            </button>
          ))}
        </div>
      </div>

      {/* Bank pembayar — hanya jika transfer */}
      {method === "transfer" && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Bank Pengirim</label>
            <input
              type="text"
              value={payerBank}
              onChange={(e) => setPayerBank(e.target.value)}
              placeholder="mis. BCA, BRI, Mandiri"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Transfer</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </>
      )}

      {/* Catatan */}
      <div>
        <label className="block text-sm font-medium mb-1">Catatan</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Keterangan tambahan (opsional)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Catat Pemasukan"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
