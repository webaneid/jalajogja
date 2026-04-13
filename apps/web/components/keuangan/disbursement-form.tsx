"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDisbursementAction,
  type DisbursementData,
} from "@/app/(dashboard)/[tenant]/finance/actions";

type Props = {
  slug: string;
};

const PURPOSE_OPTIONS: { value: DisbursementData["purposeType"]; label: string }[] = [
  { value: "expense",  label: "Beban Operasional" },
  { value: "grant",    label: "Bantuan / Hibah" },
  { value: "transfer", label: "Transfer Antar Rekening" },
  { value: "manual",   label: "Manual (Lainnya)" },
];

export function DisbursementForm({ slug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [amount,           setAmount]           = useState("");
  const [purposeType,      setPurposeType]      = useState<DisbursementData["purposeType"]>("expense");
  const [method,           setMethod]           = useState<"cash" | "transfer">("transfer");
  const [recipientName,    setRecipientName]    = useState("");
  const [recipientBank,    setRecipientBank]    = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [note,             setNote]             = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const amountNum = parseFloat(amount.replace(/\D/g, ""));
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }

    const data: DisbursementData = {
      purposeType,
      amount: amountNum,
      method,
      recipientName: recipientName.trim(),
      recipientBank: recipientBank.trim() || undefined,
      recipientAccount: recipientAccount.trim() || undefined,
      note: note.trim() || undefined,
    };

    startTransition(async () => {
      const res = await createDisbursementAction(slug, data);
      if (res.success) {
        router.push(`/${slug}/finance/pengeluaran/${res.data.disbursementId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Jenis pengeluaran */}
      <div>
        <label className="block text-sm font-medium mb-1">Jenis Pengeluaran</label>
        <div className="flex flex-wrap gap-2">
          {PURPOSE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPurposeType(opt.value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                purposeType === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* Nama penerima */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Nama Penerima <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="mis. Toko ATK Maju Bersama"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
      </div>

      {/* Metode */}
      <div>
        <label className="block text-sm font-medium mb-1">Metode Pembayaran</label>
        <div className="flex gap-2">
          {(["cash", "transfer"] as const).map((m) => (
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
              {m === "cash" ? "Tunai" : "Transfer"}
            </button>
          ))}
        </div>
      </div>

      {/* Rekening penerima — hanya jika transfer */}
      {method === "transfer" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Bank Penerima</label>
            <input
              type="text"
              value={recipientBank}
              onChange={(e) => setRecipientBank(e.target.value)}
              placeholder="mis. BCA"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nomor Rekening</label>
            <input
              type="text"
              value={recipientAccount}
              onChange={(e) => setRecipientAccount(e.target.value)}
              placeholder="mis. 1234567890"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Catatan */}
      <div>
        <label className="block text-sm font-medium mb-1">Keterangan</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Deskripsi pengeluaran ini (opsional)"
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
          {pending ? "Menyimpan..." : "Ajukan Pengeluaran"}
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
