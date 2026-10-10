"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { unlockPjLinkAction, pjVerifyPaymentAction, type PjAction } from "./actions";

export type PjPaymentRow = {
  id: string; sender: string; invoiceNumber: string; via: string; note: string | null; sentAt: string;
  claimed: number; billBase: number; uniqueCode: number;
  state: "pending" | "verified" | "rejected" | "other";
  verifiedBy: string | null; verifiedAt: string | null; verifiedAmount: number | null;
  flaggedBy: string | null; flaggedAt: string | null;
};

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function PjUnlockForm({ slug, token, recipientName }: { slug: string; token: string; recipientName: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await unlockPjLinkAction(slug, token, pin);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        Halo {recipientName}. Masukkan <strong>4 digit terakhir nomor HP Anda</strong> untuk membuka halaman ini.
      </p>
      <Input
        inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••"
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="text-center text-lg tracking-widest" disabled={pending}
      />
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <button type="submit" disabled={pending || pin.length !== 4} className="btn btn-primary btn-md btn-full">
        {pending ? "Memeriksa..." : "Buka"}
      </button>
    </form>
  );
}

export function PjPaymentList({ slug, token, items }: { slug: string; token: string; items: PjPaymentRow[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground rounded-xl border border-border p-6 text-center">Tidak ada pembayaran yang menunggu verifikasi.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((it) => <PaymentCard key={it.id} slug={slug} token={token} item={it} />)}
    </div>
  );
}

function PaymentCard({ slug, token, item }: { slug: string; token: string; item: PjPaymentRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [differentMode, setDifferentMode] = useState(false);
  const [amountStr, setAmountStr] = useState("");

  function run(action: PjAction) {
    setMsg(null);
    start(async () => {
      const res = await pjVerifyPaymentAction(slug, token, item.id, action);
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Berhasil.") : res.error });
      router.refresh();
    });
  }

  const expected = item.billBase + item.uniqueCode;

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{item.sender}</p>
          <p className="text-xs text-muted-foreground">{item.invoiceNumber} • {item.via} • {item.sentAt}</p>
        </div>
        <p className="font-bold whitespace-nowrap">{rp(item.claimed)}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Tagihan {rp(item.billBase)}{item.uniqueCode ? ` + kode unik ${item.uniqueCode} = ${rp(expected)}` : ""}
        {item.claimed !== expected && <span className="text-amber-600"> • nominal yang dikirim berbeda dari tagihan</span>}
      </p>
      {item.note && <p className="text-xs text-muted-foreground">Catatan pembayar: {item.note}</p>}

      {item.state === "verified" && (
        <p className="flex items-start gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Sudah diverifikasi oleh <strong>{item.verifiedBy}</strong>{item.verifiedAt ? ` pada ${item.verifiedAt}` : ""}
            {item.verifiedAmount != null ? ` (${rp(item.verifiedAmount)})` : ""}.</span>
        </p>
      )}
      {item.state === "rejected" && <p className="text-sm text-destructive">Pembayaran ini sudah ditolak oleh pengurus.</p>}

      {item.state === "pending" && (
        <div className="space-y-2">
          {item.flaggedBy && (
            <p className="text-xs text-amber-700">Ditandai &quot;dana belum ditemukan&quot; oleh {item.flaggedBy}{item.flaggedAt ? ` (${item.flaggedAt})` : ""}.</p>
          )}
          {!differentMode ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run({ kind: "correct" })} className="btn btn-primary btn-sm">
                Benar, sudah diterima
              </button>
              <button type="button" disabled={pending} onClick={() => { setDifferentMode(true); setAmountStr(String(item.claimed)); }} className="btn btn-outline-dark btn-sm">
                Diterima, nominal berbeda
              </button>
              <button type="button" disabled={pending} onClick={() => run({ kind: "not_found" })} className="btn btn-ghost btn-sm">
                Tidak ada
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Nominal yang benar-benar masuk (Rp)</label>
              <Input inputMode="numeric" value={amountStr} onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ""))} disabled={pending} />
              <div className="flex gap-2">
                <button type="button" disabled={pending || !amountStr || Number(amountStr) <= 0}
                  onClick={() => run({ kind: "different", amount: Number(amountStr) })} className="btn btn-primary btn-sm">
                  {pending ? "Memproses..." : "Simpan"}
                </button>
                <button type="button" disabled={pending} onClick={() => setDifferentMode(false)} className="btn btn-ghost btn-sm">Batal</button>
              </div>
              <p className="text-xs text-muted-foreground">Kurang dari tagihan → invoice tercatat dibayar sebagian. Sama/lebih → lunas.</p>
            </div>
          )}
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
