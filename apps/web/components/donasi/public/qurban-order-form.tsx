"use client";

import { useState, useTransition } from "react";
import { createQurbanOrderAction, type QurbanOrderData } from "@/app/(dashboard)/[tenant]/donasi/actions";

type Animal = {
  id:         string;
  animalType: "domba" | "kambing" | "sapi";
  price:      number;
  stock:      number;
  booked:     number;
  split:      number | null;
  isActive:   boolean;
};

type PaymentMethod = { type: "transfer"; bankName: string; accountNumber: string; accountName: string }
                   | { type: "qris"; name: string; imageUrl: string };

type Props = {
  slug:         string;
  campaignId:   string;
  animals:      Animal[];
  adminFee:     number;
  adminFeeLabel: string;
  methods:      PaymentMethod[];
  defaultName?: string;
  memberId?:    string | null;
};

const ANIMAL_LABEL: Record<string, string> = { domba: "Domba", kambing: "Kambing", sapi: "Sapi" };
const ANIMAL_EMOJI: Record<string, string> = { domba: "🐑", kambing: "🐐", sapi: "🐄" };

function formatRp(n: number) { return `Rp ${n.toLocaleString("id-ID")}`; }

export function QurbanOrderForm({ slug, campaignId, animals, adminFee, adminFeeLabel, methods, defaultName = "", memberId }: Props) {
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [atasNama,   setAtasNama]   = useState("");
  const [sameAsSelf, setSameAsSelf] = useState(false);
  const [donorName,  setDonorName]  = useState(defaultName);
  const [donorPhone, setDonorPhone] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [method,     setMethod]     = useState<"transfer" | "qris" | "cash">("transfer");
  const [bankRef,    setBankRef]    = useState("");
  const [qrisRef,    setQrisRef]    = useState("");
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState<{ donationNumber: string; uniqueCode: number; totalAmount: number; method: string } | null>(null);
  const [pending, startTransition]  = useTransition();

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
  const totalAmount    = selectedAnimal ? selectedAnimal.price + adminFee : 0;

  function availableSlots(a: Animal): number {
    if (a.animalType === "sapi" && a.split) return (a.stock * a.split) - a.booked;
    return a.stock - a.booked;
  }

  function handleSelf(checked: boolean) {
    setSameAsSelf(checked);
    if (checked) setAtasNama(donorName);
  }

  function handleDonorName(val: string) {
    setDonorName(val);
    if (sameAsSelf) setAtasNama(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedAnimalId) { setError("Pilih jenis hewan terlebih dahulu."); return; }
    if (!atasNama.trim())  { setError("Nama shohibul qurban wajib diisi."); return; }
    if (!donorName.trim()) { setError("Nama pemesan wajib diisi."); return; }

    startTransition(async () => {
      const payload: QurbanOrderData = {
        campaignId,
        animalId:    selectedAnimalId,
        atasNama,
        donorName,
        donorPhone:  donorPhone || null,
        donorEmail:  donorEmail || null,
        memberId:    memberId ?? null,
        method,
        bankAccountRef: method === "transfer" ? (bankRef || null) : null,
        qrisAccountRef: method === "qris"     ? (qrisRef || null) : null,
      };
      const res = await createQurbanOrderAction(slug, payload);
      if (res.success) {
        setResult({ ...res.data, method });
      } else {
        setError(res.error);
      }
    });
  }

  // Tampilkan instruksi bayar setelah sukses
  if (result) {
    const bank = methods.find(m => m.type === "transfer") as Extract<PaymentMethod, { type: "transfer" }> | undefined;
    return (
      <div className="space-y-4 p-5 rounded-xl border border-border bg-muted/30">
        <div className="text-center space-y-1">
          <p className="text-2xl">✅</p>
          <h3 className="font-semibold text-lg">Pesanan Diterima</h3>
          <p className="text-sm text-muted-foreground font-mono">{result.donationNumber}</p>
        </div>
        {result.method === "transfer" && bank && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-sm">
            <p className="font-medium">Transfer ke:</p>
            <p>{bank.bankName} — {bank.accountNumber}</p>
            <p>a.n. {bank.accountName}</p>
            <p className="mt-2">Total: <span className="font-bold text-primary">{formatRp(result.totalAmount + result.uniqueCode)}</span></p>
            {result.uniqueCode > 0 && (
              <p className="text-xs text-muted-foreground">
                Termasuk kode unik <span className="font-mono font-medium">{result.uniqueCode}</span> untuk identifikasi transfer.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Pilih hewan */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Pilih Jenis Hewan</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {animals.filter(a => a.isActive).map(a => {
            const slots   = availableSlots(a);
            const isAvail = slots > 0;
            const isSel   = selectedAnimalId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                disabled={!isAvail}
                onClick={() => setSelectedAnimalId(a.id)}
                className={[
                  "flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-sm",
                  isSel   ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                  !isAvail ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <span className="text-2xl">{ANIMAL_EMOJI[a.animalType]}</span>
                <span className="font-semibold">{ANIMAL_LABEL[a.animalType]}</span>
                <span className="font-bold text-primary">{formatRp(a.price)}</span>
                {a.animalType === "sapi" && a.split && (
                  <span className="text-xs text-muted-foreground">Patungan {a.split} orang</span>
                )}
                <span className={`text-xs ${isAvail ? "text-muted-foreground" : "text-destructive"}`}>
                  {isAvail ? `Sisa ${slots} slot` : "Habis"}
                </span>
              </button>
            );
          })}
        </div>

        {selectedAnimal && adminFee > 0 && (
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Harga {ANIMAL_LABEL[selectedAnimal.animalType]}</span><span>{formatRp(selectedAnimal.price)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{adminFeeLabel}</span><span>{formatRp(adminFee)}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span className="text-primary">{formatRp(totalAmount)}</span></div>
          </div>
        )}
      </div>

      {/* Atas nama */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold">Atas Nama (Shohibul Qurban)</label>
        <input
          type="text"
          value={atasNama}
          onChange={e => setAtasNama(e.target.value)}
          placeholder="Nama yang diniatkan qurban"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={sameAsSelf} onChange={e => handleSelf(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
          Sama dengan nama pemesan
        </label>
      </div>

      {/* Data pemesan */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Data Pemesan</p>
        <input type="text" value={donorName} onChange={e => handleDonorName(e.target.value)} placeholder="Nama lengkap *" required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="tel" value={donorPhone} onChange={e => setDonorPhone(e.target.value)} placeholder="Nomor HP (opsional)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="email" value={donorEmail} onChange={e => setDonorEmail(e.target.value)} placeholder="Email (opsional)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {/* Metode bayar */}
      {methods.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Metode Pembayaran</p>
          <div className="flex gap-2 flex-wrap">
            {methods.map((m, i) => (
              <button key={i} type="button"
                onClick={() => setMethod(m.type as "transfer" | "qris")}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${method === m.type ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
              >
                {m.type === "transfer" ? `Transfer — ${(m as Extract<PaymentMethod, {type:"transfer"}>).bankName}` : `QRIS — ${(m as Extract<PaymentMethod, {type:"qris"}>).name}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending || !selectedAnimalId}
        className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Memproses..." : "Pesan Qurban"}
      </button>
    </form>
  );
}
