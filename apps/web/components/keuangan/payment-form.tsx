"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  searchPendingOrdersAction,
  searchActiveCampaignsAction,
  searchUnpaidRegistrationsAction,
  createLinkedPaymentAction,
  type PendingOrderResult,
  type ActiveCampaignResult,
  type UnpaidRegistrationResult,
} from "@/app/(dashboard)/[tenant]/finance/actions";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

type SourceType = "manual" | "order" | "donation" | "event_registration";

type Props = { slug: string };

const SOURCE_TABS: { value: SourceType; label: string }[] = [
  { value: "manual",             label: "Manual" },
  { value: "order",              label: "Pembelian Toko" },
  { value: "donation",           label: "Donasi / Infaq" },
  { value: "event_registration", label: "Tiket Event" },
];

const METHOD_LABELS: Record<string, string> = {
  cash:     "Tunai",
  transfer: "Transfer",
  qris:     "QRIS",
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function PaymentForm({ slug }: Props) {
  const router  = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]  = useState("");

  // ── Source type ──────────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<SourceType>("manual");

  // ── Common fields ─────────────────────────────────────────────────────────────
  const [method,       setMethod]       = useState<"cash" | "transfer" | "qris">("cash");
  const [payerBank,    setPayerBank]    = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [notes,        setNotes]        = useState("");

  // ── Manual ───────────────────────────────────────────────────────────────────
  const [amount,    setAmount]    = useState("");
  const [payerName, setPayerName] = useState("");

  // ── Toko ─────────────────────────────────────────────────────────────────────
  const [orderSearch,  setOrderSearch]  = useState("");
  const [orderResults, setOrderResults] = useState<PendingOrderResult[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrderResult | null>(null);

  // ── Donasi ───────────────────────────────────────────────────────────────────
  const [campaignSearch,  setCampaignSearch]  = useState("");
  const [campaignResults, setCampaignResults] = useState<ActiveCampaignResult[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<ActiveCampaignResult | null>(null);
  const [donorName,   setDonorName]   = useState("");
  const [donorPhone,  setDonorPhone]  = useState("");
  const [donorEmail,  setDonorEmail]  = useState("");
  const [donationAmt, setDonationAmt] = useState("");

  // ── Event ─────────────────────────────────────────────────────────────────────
  const [regSearch,   setRegSearch]   = useState("");
  const [regResults,  setRegResults]  = useState<UnpaidRegistrationResult[]>([]);
  const [selectedReg, setSelectedReg] = useState<UnpaidRegistrationResult | null>(null);

  // Fetch orders
  useEffect(() => {
    if (sourceType !== "order") return;
    const run = async () => {
      const res = await searchPendingOrdersAction(slug, orderSearch);
      if (res.success) setOrderResults(res.data);
    };
    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [orderSearch, sourceType, slug]);

  // Fetch campaigns (load all on mount + filter by search)
  useEffect(() => {
    if (sourceType !== "donation") return;
    const run = async () => {
      const res = await searchActiveCampaignsAction(slug, campaignSearch);
      if (res.success) setCampaignResults(res.data);
    };
    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [campaignSearch, sourceType, slug]);

  // Fetch registrations
  useEffect(() => {
    if (sourceType !== "event_registration") return;
    const run = async () => {
      const res = await searchUnpaidRegistrationsAction(slug, regSearch);
      if (res.success) setRegResults(res.data);
    };
    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [regSearch, sourceType, slug]);

  // Reset source-specific state when switching tabs
  function switchSource(s: SourceType) {
    setSourceType(s);
    setError("");
    setSelectedOrder(null);
    setOrderSearch("");
    setSelectedCampaign(null);
    setCampaignSearch("");
    setSelectedReg(null);
    setRegSearch("");
  }

  // ── Combobox options ──────────────────────────────────────────────────────────
  const orderOptions: ComboboxOption[] = [
    { value: "", label: "— Ketik untuk mencari pesanan —" },
    ...orderResults.map((o) => ({
      value: o.id,
      label: `${o.orderNumber} · ${o.customerName} · Rp ${formatRp(o.total)}`,
    })),
  ];

  const campaignOptions: ComboboxOption[] = [
    { value: "", label: "— Pilih campaign —" },
    ...campaignResults.map((c) => ({ value: c.id, label: c.title })),
  ];

  const regOptions: ComboboxOption[] = [
    { value: "", label: "— Ketik untuk mencari registrasi —" },
    ...regResults.map((r) => ({
      value: r.id,
      label: `${r.registrationNumber} · ${r.attendeeName} · ${r.eventName}`,
    })),
  ];

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const res = await createLinkedPaymentAction(slug, {
        sourceType,
        method,
        payerBank:    payerBank.trim() || undefined,
        transferDate: transferDate || undefined,
        notes:        notes.trim() || undefined,

        // Manual
        amount:    sourceType === "manual" ? parseFloat(amount.replace(/\D/g, "")) || 0 : undefined,
        payerName: sourceType === "manual" ? payerName.trim() : undefined,

        // Toko
        sourceId: sourceType === "order" ? (selectedOrder?.id ?? undefined)
                : sourceType === "event_registration" ? (selectedReg?.id ?? undefined)
                : undefined,

        // Donasi
        campaignId:     sourceType === "donation" ? (selectedCampaign?.id ?? undefined) : undefined,
        donorName:      sourceType === "donation" ? donorName.trim() : undefined,
        donorPhone:     sourceType === "donation" ? donorPhone.trim() : undefined,
        donorEmail:     sourceType === "donation" ? donorEmail.trim() : undefined,
        donationAmount: sourceType === "donation" ? parseFloat(donationAmt.replace(/\D/g, "")) || 0 : undefined,
      });

      if (res.success) {
        router.push(`/${slug}/finance/pemasukan/${res.data.paymentId}`);
      } else {
        setError(res.error);
      }
    });
  }

  const labelCls = "block text-sm font-medium mb-1";
  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">

      {/* ── Source type tabs ─────────────────────────────────────────────── */}
      <div>
        <p className={labelCls}>Sumber Pembayaran</p>
        <div className="flex gap-2 flex-wrap">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => switchSource(t.value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                sourceType === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Manual ───────────────────────────────────────────────────────── */}
      {sourceType === "manual" && (
        <>
          <div>
            <label className={labelCls}>
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
          <div>
            <label className={labelCls}>
              Nama Pembayar <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="mis. Ahmad Budi"
              className={inputCls}
              required
            />
          </div>
        </>
      )}

      {/* ── Pembelian Toko ───────────────────────────────────────────────── */}
      {sourceType === "order" && (
        <>
          <div>
            <label className={labelCls}>
              Cari Pesanan <span className="text-destructive">*</span>
            </label>
            <Combobox
              options={orderOptions}
              value={selectedOrder?.id ?? ""}
              onValueChange={(val) => {
                const found = orderResults.find((o) => o.id === val) ?? null;
                setSelectedOrder(found);
              }}
              placeholder="— Ketik nomor pesanan / nama pelanggan —"
              searchPlaceholder="Cari pesanan..."
              onSearchChange={setOrderSearch}
            />
            {selectedOrder && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">No. Pesanan:</span> {selectedOrder.orderNumber}</p>
                <p><span className="text-muted-foreground">Pelanggan:</span> {selectedOrder.customerName}</p>
                <p><span className="text-muted-foreground">Total:</span> <strong>Rp {formatRp(selectedOrder.total)}</strong></p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Donasi / Infaq ───────────────────────────────────────────────── */}
      {sourceType === "donation" && (
        <>
          <div>
            <label className={labelCls}>
              Campaign <span className="text-destructive">*</span>
            </label>
            <Combobox
              options={campaignOptions}
              value={selectedCampaign?.id ?? ""}
              onValueChange={(val) => {
                const found = campaignResults.find((c) => c.id === val) ?? null;
                setSelectedCampaign(found);
              }}
              placeholder="— Pilih campaign —"
              searchPlaceholder="Cari campaign..."
              onSearchChange={setCampaignSearch}
            />
          </div>
          <div>
            <label className={labelCls}>
              Nama Donatur <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder="mis. Hamba Allah"
              className={inputCls}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Telepon</label>
              <input
                type="tel"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                placeholder="08xx-xxxx-xxxx"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                placeholder="email@domain.com"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Jumlah Donasi <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={donationAmt}
                onChange={(e) => setDonationAmt(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
          </div>
        </>
      )}

      {/* ── Tiket Event ──────────────────────────────────────────────────── */}
      {sourceType === "event_registration" && (
        <>
          <div>
            <label className={labelCls}>
              Cari Registrasi <span className="text-destructive">*</span>
            </label>
            <Combobox
              options={regOptions}
              value={selectedReg?.id ?? ""}
              onValueChange={(val) => {
                const found = regResults.find((r) => r.id === val) ?? null;
                setSelectedReg(found);
              }}
              placeholder="— Ketik nama / nomor registrasi / event —"
              searchPlaceholder="Cari registrasi..."
              onSearchChange={setRegSearch}
            />
            {selectedReg && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">No. Registrasi:</span> {selectedReg.registrationNumber}</p>
                <p><span className="text-muted-foreground">Peserta:</span> {selectedReg.attendeeName}</p>
                <p><span className="text-muted-foreground">Event:</span> {selectedReg.eventName}</p>
                <p><span className="text-muted-foreground">Tiket:</span> {selectedReg.ticketName}</p>
                <p><span className="text-muted-foreground">Harga:</span> <strong>Rp {formatRp(selectedReg.ticketPrice)}</strong></p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Metode pembayaran (semua source type) ────────────────────────── */}
      <div>
        <label className={labelCls}>Metode Pembayaran</label>
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
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Transfer fields ──────────────────────────────────────────────── */}
      {method === "transfer" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bank Pengirim</label>
            <input
              type="text"
              value={payerBank}
              onChange={(e) => setPayerBank(e.target.value)}
              placeholder="mis. BCA, BRI"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tanggal Transfer</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ── Catatan ──────────────────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Catatan</label>
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
