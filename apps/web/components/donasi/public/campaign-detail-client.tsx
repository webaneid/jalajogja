"use client";

import { useState, useTransition } from "react";
import { addToCartAction, checkoutAction } from "@/app/(public)/[tenant]/cart/actions";
import { formatRp } from "@/lib/campaign-card-templates";
import { Loader2, CheckCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QurbanAnimal = {
  id:         string;
  animalType: "domba" | "kambing" | "sapi";
  price:      number;
  stock:      number;
  booked:     number;
  split:      number | null;
  isActive:   boolean;
};

type SlaughterFees = { domba: number; kambing: number; sapi: number };

type Props = {
  campaignId:         string;
  campaignTitle:      string;
  campaignType:       "donasi" | "zakat" | "wakaf" | "qurban";
  tenantSlug:         string;
  // Donasi reguler
  recommendedAmounts: number[];
  // Qurban
  qurbanAnimals:      QurbanAnimal[];
  slaughterFees:      SlaughterFees;
  // Pre-filled dari session
  defaultName:        string;
  isLoggedIn:         boolean;
  memberPhone?:       string;
  memberEmail?:       string;
};

const ANIMAL_LABEL: Record<string, string> = { domba: "Domba", kambing: "Kambing", sapi: "Sapi" };
const ANIMAL_EMOJI: Record<string, string> = { domba: "🐑", kambing: "🐐", sapi: "🐄" };

// ─── Component ────────────────────────────────────────────────────────────────

type PopupState = "hidden" | "ask" | "login" | "processing";

export function CampaignDetailClient({
  campaignId, campaignTitle, campaignType, tenantSlug,
  recommendedAmounts, qurbanAnimals, slaughterFees, defaultName,
  isLoggedIn, memberPhone = "", memberEmail = "",
}: Props) {
  const isQurban = campaignType === "qurban";

  // State donasi reguler
  const [selectedAmount, setSelectedAmount] = useState<number | null>(
    recommendedAmounts[0] ?? null
  );
  const [customAmount, setCustomAmount] = useState("");

  // State qurban
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [atasNama, setAtasNama]                   = useState("");
  const [sameAsSelf, setSameAsSelf]               = useState(false);

  // Shared
  const [donorName,  setDonorName]  = useState(defaultName);
  const [isAnon,     setIsAnon]     = useState(false);
  const [error,      setError]      = useState("");
  const [pending,    startTransition] = useTransition();

  // Popup state machine
  const [popup,         setPopup]         = useState<PopupState>("hidden");
  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError,    setLoginError]    = useState("");
  const [loginPending,  setLoginPending]  = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedAnimal = qurbanAnimals.find(a => a.id === selectedAnimalId);
  const slaughterFee   = selectedAnimal ? (slaughterFees[selectedAnimal.animalType] ?? 0) : 0;
  const pricePerSlot   = selectedAnimal
    ? (selectedAnimal.split ? Math.ceil(selectedAnimal.price / selectedAnimal.split) : selectedAnimal.price)
    : 0;
  const totalQurban    = pricePerSlot + slaughterFee;

  const donationAmount = isQurban
    ? totalQurban
    : (customAmount ? (parseInt(customAmount.replace(/\D/g, ""), 10) || 0) : (selectedAmount ?? 0));

  function availableSlots(a: QurbanAnimal): number {
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

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleAddToCart() {
    setError("");
    if (!donorName.trim()) { setError("Nama donatur wajib diisi."); return; }
    if (isQurban) {
      if (!selectedAnimalId) { setError("Pilih jenis hewan terlebih dahulu."); return; }
      if (!atasNama.trim())  { setError("Nama shohibul qurban wajib diisi."); return; }
    } else {
      if (donationAmount <= 0) { setError("Masukkan nominal donasi."); return; }
    }

    const itemName = isQurban && selectedAnimal
      ? `Qurban ${ANIMAL_LABEL[selectedAnimal.animalType]} — ${campaignTitle}`
      : campaignTitle;
    const notes = isQurban
      ? `Atas nama: ${atasNama}; animalId: ${selectedAnimalId ?? ""}`
      : (isAnon ? "Anonim" : undefined);

    const res = await addToCartAction(tenantSlug, {
      itemType:  "donation",
      itemId:    campaignId,
      name:      itemName,
      unitPrice: donationAmount,
      notes,
    });

    if (res.success) {
      setPopup("ask");
    } else {
      setError(res.error);
    }
  }

  async function handleExpressCheckout(emailOverride?: string) {
    setPopup("processing");
    const res = await checkoutAction(tenantSlug, {
      name:   donorName.trim() || "Donatur",
      phone:  memberPhone || undefined,
      email:  (emailOverride ?? memberEmail) || undefined,
      method: "transfer",
    });
    if (res.success) {
      window.location.href = `/${tenantSlug}/invoice/${res.data.invoiceId}`;
    } else {
      setLoginError(res.error);
      setPopup("ask");
    }
  }

  async function handleInlineLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginPending(true);
    const res = await fetch("/api/auth/sign-in/email", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!res.ok) {
      setLoginError("Email atau password salah.");
      setLoginPending(false);
      return;
    }
    await handleExpressCheckout(loginEmail);
    setLoginPending(false);
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  // ── Popup overlay ─────────────────────────────────────────────────────────────
  const popupEl = popup !== "hidden" && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">

        {popup === "processing" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Membuat invoice...</p>
          </div>
        )}

        {popup === "ask" && (
          <>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <p className="font-semibold text-sm">Berhasil ditambahkan!</p>
            </div>
            <p className="text-sm text-muted-foreground">Ingin berdonasi untuk program lain juga?</p>
            {loginError && <p className="text-xs text-destructive">{loginError}</p>}
            <div className="space-y-2">
              <button type="button"
                onClick={() => { window.location.href = `/${tenantSlug}/campaign`; }}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Ya, lihat program lain
              </button>
              <button type="button"
                onClick={() => { if (isLoggedIn) { void handleExpressCheckout(); } else { setLoginError(""); setPopup("login"); } }}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Tidak, lanjut bayar →
              </button>
            </div>
          </>
        )}

        {popup === "login" && (
          <form onSubmit={handleInlineLogin} className="space-y-4">
            <div>
              <p className="font-semibold text-sm mb-0.5">Masuk untuk melanjutkan</p>
              <p className="text-xs text-muted-foreground">Invoice akan dibuat setelah login.</p>
            </div>
            <div className="space-y-3">
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email" required autoFocus className={inputCls} />
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                placeholder="Password" required className={inputCls} />
            </div>
            {loginError && <p className="text-xs text-destructive">{loginError}</p>}
            <button type="submit" disabled={loginPending}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {loginPending ? "Masuk..." : "Masuk & Buat Invoice"}
            </button>
            <button type="button" onClick={() => setPopup("ask")}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Kembali
            </button>
          </form>
        )}

      </div>
    </div>
  );

  // ── Render Qurban ────────────────────────────────────────────────────────────
  if (isQurban) {
    return (
      <>
      {popupEl}
      <div className="space-y-5">
        {/* Pilih hewan */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Pilih Jenis Hewan</p>
          <div className="grid grid-cols-1 gap-2">
            {qurbanAnimals.filter(a => a.isActive).map(a => {
              const slots    = availableSlots(a);
              const isAvail  = slots > 0;
              const isSel    = selectedAnimalId === a.id;
              const perSlot  = a.split ? Math.ceil(a.price / a.split) : a.price;
              const fee      = slaughterFees[a.animalType] ?? 0;
              return (
                <button
                  key={a.id} type="button" disabled={!isAvail}
                  onClick={() => setSelectedAnimalId(a.id)}
                  className={[
                    "flex items-center justify-between p-3 rounded-xl border-2 transition-all text-sm text-left",
                    isSel    ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    !isAvail ? "opacity-40 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{ANIMAL_EMOJI[a.animalType]}</span>
                    <span>
                      <span className="font-semibold">{ANIMAL_LABEL[a.animalType]}</span>
                      {a.split && <span className="text-muted-foreground ml-1 text-xs">Patungan {a.split} orang</span>}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-primary block">{formatRp(perSlot + fee)}</span>
                    <span className="text-xs text-muted-foreground">{isAvail ? `${slots} slot` : "Habis"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rincian harga */}
        {selectedAnimal && (
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Harga {ANIMAL_LABEL[selectedAnimal.animalType]}{selectedAnimal.split ? ` (÷${selectedAnimal.split})` : ""}</span>
              <span>{formatRp(pricePerSlot)}</span>
            </div>
            {slaughterFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Biaya Administrasi Penyembelihan</span>
                <span>{formatRp(slaughterFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>Total</span>
              <span className="text-primary">{formatRp(totalQurban)}</span>
            </div>
          </div>
        )}

        {/* Atas nama */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold">Atas Nama (Shohibul Qurban)</label>
          <input type="text" value={atasNama} onChange={e => setAtasNama(e.target.value)}
            placeholder="Nama yang diniatkan qurban" className={inputCls} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={sameAsSelf} onChange={e => handleSelf(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary" />
            Sama dengan nama saya
          </label>
        </div>

        {/* Pemesan */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Nama Pemesan</label>
          <input type="text" value={donorName} onChange={e => handleDonorName(e.target.value)}
            placeholder="Nama lengkap" className={inputCls} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="button" disabled={pending || !selectedAnimalId}
          onClick={() => startTransition(handleAddToCart)}
          className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Menambahkan..." : "Tambah ke Keranjang"}
        </button>
      </div>
      </>
    );
  }

  // ── Render Donasi Reguler ────────────────────────────────────────────────────
  return (
    <>
    {popupEl}
    <div className="space-y-5">
      {/* Nominal chips */}
      {recommendedAmounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Pilih Nominal</p>
          <div className="grid grid-cols-2 gap-2">
            {recommendedAmounts.map(n => (
              <button key={n} type="button"
                onClick={() => { setSelectedAmount(n); setCustomAmount(""); }}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  selectedAmount === n && !customAmount
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {formatRp(n)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom nominal */}
      <div className="space-y-1.5">
        <label className="block text-sm text-muted-foreground">Nominal lain</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <input type="text" inputMode="numeric"
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value.replace(/\D/g, "")); setSelectedAmount(null); }}
            placeholder="Masukkan nominal"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {/* Nama + anonim */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold">Nama Donatur</label>
        <input type="text" value={donorName} onChange={e => handleDonorName(e.target.value)}
          placeholder="Nama lengkap" className={inputCls} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-primary" />
          Sembunyikan nama (anonim)
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="button" disabled={pending || donationAmount <= 0}
        onClick={() => startTransition(handleAddToCart)}
        className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menambahkan..." : `Donasi ${donationAmount > 0 ? formatRp(donationAmount) : ""}`}
      </button>
    </div>
    </>
  );
}
