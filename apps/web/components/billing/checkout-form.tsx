"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  checkoutAction,
  previewVoucherAction,
  type CartData,
  type SellerGroup,
  type CheckoutShippingLine,
  type CheckoutShippingData,
  type VoucherPreview,
} from "@/app/(public)/[tenant]/cart/actions";
import { PhoneInput } from "@/components/ui/phone-input";

// ─── Tipe kurir ───────────────────────────────────────────────────────────────

type CourierOption = {
  courier:     string;
  service:     string;
  serviceDesc: string;
  etd:         string;
  cost:        number;
};

// RajaOngkir v2 response sudah flat — tidak ada nested costs[]
type FlatCourierResult = {
  name:        string;
  code:        string;
  service:     string;
  description: string;
  cost:        number;
  etd:         string;
};

type CityResult = {
  id:             number;
  label:          string; // "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243"
  cityName:       string;
  districtName:   string;
  subdistrictName: string;
  provinceName:   string;
  zipCode:        string;
};

function flattenCourierOptions(results: FlatCourierResult[]): CourierOption[] {
  return results
    .map(r => ({
      courier:     r.code,
      service:     r.service,
      serviceDesc: r.description,
      etd:         r.etd || "—",
      cost:        r.cost,
    }))
    .sort((a, b) => a.cost - b.cost);
}

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type CheckoutDefaults = { name: string; email: string; phone: string };

type Props = {
  slug:           string;
  cart:           CartData;
  defaults?:      CheckoutDefaults;
  sellerGroups?:  SellerGroup[];
  addonCouriers?: string[];
};

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function CheckoutForm({
  slug,
  cart,
  defaults,
  sellerGroups = [],
  addonCouriers = [],
}: Props) {
  const router                     = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState("");

  const needsShipping = sellerGroups.length > 0;
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — info pemesan
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [name,  setName]  = useState(defaults?.name  ?? "");
  const [notes, setNotes] = useState("");

  // Voucher — preview murni (baca saja, tidak mengunci/menaikkan usedCount). Checkout sungguhan
  // selalu re-validasi dari nol di dalam transaction-nya sendiri (lihat cart/actions.ts).
  const [voucherInput,   setVoucherInput]   = useState("");
  const [voucherPreview, setVoucherPreview] = useState<VoucherPreview | null>(null);
  const [voucherPending, startVoucherTransition] = useTransition();

  // Step 2 — kota tujuan
  const [destCity,     setDestCity]     = useState<{ id: number; name: string } | null>(null);
  const [address,      setAddress]      = useState("");
  const [citySearch,   setCitySearch]   = useState("");
  const [cityResults,  setCityResults]  = useState<CityResult[]>([]);
  const [cityLoading,  setCityLoading]  = useState(false);
  const [cityOpen,     setCityOpen]     = useState(false);

  // Step 3 — opsi kurir per seller group
  const [groupStates, setGroupStates] = useState<Record<string, {
    options:  CourierOption[];
    selected: CourierOption | null;
    loading:  boolean;
    error:    string;
  }>>({});

  // Pilihan pengiriman per grup penjual — deliveryMethod hanya relevan kalau group.pickupEnabled
  // (kalau tidak, selalu "courier"); paymentMethod hanya relevan kalau group.codEnabled DAN
  // deliveryMethod==="courier" (ambil sendiri SELALU prabayar, tidak pernah COD).
  type GroupChoice = { deliveryMethod: "courier" | "pickup"; paymentMethod: "prepaid" | "cod" };
  const [groupChoices, setGroupChoices] = useState<Record<string, GroupChoice>>({});
  const getChoice = useCallback((key: string): GroupChoice =>
    groupChoices[key] ?? { deliveryMethod: "courier", paymentMethod: "prepaid" },
  [groupChoices]);
  const setChoice = useCallback((key: string, patch: Partial<GroupChoice>) => {
    setGroupChoices(prev => ({ ...prev, [key]: { ...getChoice(key), ...patch } }));
  }, [getChoice]);

  // Debounced city search
  useEffect(() => {
    if (citySearch.length < 2) { setCityResults([]); return; }
    const t = setTimeout(async () => {
      setCityLoading(true);
      try {
        const res  = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(citySearch)}&limit=12`);
        const data = await res.json() as { cities: CityResult[] };
        setCityResults(data.cities ?? []);
      } catch { setCityResults([]); }
      finally  { setCityLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [citySearch]);

  // Fetch kurir saat masuk step 3
  const fetchCouriers = useCallback(async (group: SellerGroup, destCityId: number) => {
    setGroupStates(prev => ({
      ...prev,
      [group.key]: { options: [], selected: null, loading: true, error: "" },
    }));
    try {
      const res  = await fetch(`/api/ongkir/cost?slug=${slug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          origin:      group.originCityId,
          destination: destCityId,
          weight:      group.totalWeightGram,
          courier:     addonCouriers.join(":"),
        }),
      });
      const data = await res.json() as { costs?: FlatCourierResult[]; error?: string };
      if (!res.ok || !data.costs) {
        setGroupStates(prev => ({
          ...prev,
          [group.key]: { options: [], selected: null, loading: false, error: data.error ?? "Gagal memuat kurir" },
        }));
        return;
      }
      const options = flattenCourierOptions(data.costs);
      setGroupStates(prev => ({
        ...prev,
        [group.key]: { options, selected: options[0] ?? null, loading: false, error: "" },
      }));
    } catch {
      setGroupStates(prev => ({
        ...prev,
        [group.key]: { options: [], selected: null, loading: false, error: "Gagal memuat kurir" },
      }));
    }
  }, [slug, addonCouriers]);

  // Kalkulasi total
  const shippingTotal      = Object.values(groupStates).reduce((s, gs) => s + (gs.selected?.cost ?? 0), 0);
  const voucherDiscount    = voucherPreview?.valid ? (voucherPreview.totalDiscount ?? 0) : 0;
  const discountedSubtotal = Math.max(0, cart.subtotal - voucherDiscount);
  const grandTotal         = discountedSubtotal + shippingTotal;
  // Grup pickup dianggap "selesai" tanpa perlu pilihan kurir — tidak ada yang perlu dipilih.
  const allSelected        = sellerGroups.every(g =>
    getChoice(g.key).deliveryMethod === "pickup" || !!groupStates[g.key]?.selected,
  );
  // Destinasi kota hanya wajib kalau MINIMAL satu grup masih pakai kurir — kalau semua grup
  // pilih Ambil Sendiri, Step 2 tidak perlu tanya kota tujuan sama sekali.
  const anyCourierGroup     = sellerGroups.some(g => getChoice(g.key).deliveryMethod === "courier");

  // ── Handlers ──────────────────────────────────────────────────────────────

  function doCheckout(shippingData?: CheckoutShippingData) {
    startTransition(async () => {
      const res = await checkoutAction(
        slug,
        { phone, email, name, method: "transfer", notes },
        shippingData,
        voucherPreview?.valid ? voucherInput.trim() : undefined,
      );
      if (res.success) {
        router.push(`/${slug}/invoice/${res.data.invoiceId}`);
      } else {
        setError(res.error);
      }
    });
  }

  function handleApplyVoucher() {
    const code = voucherInput.trim();
    if (!code) { setVoucherPreview({ valid: false, error: "Masukkan kode voucher." }); return; }
    startVoucherTransition(async () => {
      const res = await previewVoucherAction(slug, code, {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setVoucherPreview(res.success ? res.data : { valid: false, error: res.error });
    });
  }

  function handleRemoveVoucher() {
    setVoucherPreview(null);
    setVoucherInput("");
  }

  function handleStep1Next() {
    if (!phone.trim() && !email.trim()) {
      setError("Nomor HP atau email wajib diisi.");
      return;
    }
    setError("");
    if (needsShipping) { setStep(2); return; }
    doCheckout();
  }

  function handleStep2Next() {
    if (anyCourierGroup && !destCity) { setError("Pilih kota tujuan pengiriman."); return; }
    setError("");
    setStep(3);
    for (const group of sellerGroups) {
      if (getChoice(group.key).deliveryMethod === "courier" && destCity) {
        void fetchCouriers(group, destCity.id);
      }
    }
  }

  function handleStep3Submit() {
    setError("");
    const lines: CheckoutShippingLine[] = sellerGroups
      .map((g): CheckoutShippingLine | null => {
        const choice = getChoice(g.key);
        if (choice.deliveryMethod === "pickup") {
          return {
            sellerType:         g.sellerType,
            sellerId:           g.sellerId,
            sellerName:         g.sellerName,
            deliveryMethod:     "pickup",
            paymentMethod:      "prepaid",
            pickupLocationName: g.pickupLocationName,
            pickupAddress:      g.pickupAddress,
            pickupMapsUrl:      g.pickupMapsUrl,
            cost:               0,
          };
        }
        const sel = groupStates[g.key]?.selected;
        if (!sel) return null;
        return {
          sellerType:    g.sellerType,
          sellerId:      g.sellerId,
          sellerName:    g.sellerName,
          originCityId:  g.originCityId,
          originCityName: g.originCityName,
          courier:       sel.courier,
          service:       sel.service,
          serviceDesc:   sel.serviceDesc,
          etd:           sel.etd,
          weightGram:    g.totalWeightGram,
          cost:          sel.cost,
          deliveryMethod: "courier",
          paymentMethod:  choice.paymentMethod,
        };
      })
      .filter((l): l is CheckoutShippingLine => l !== null);

    doCheckout(lines.length > 0 ? {
      cityId:   destCity?.id ?? 0,
      cityName: destCity?.name ?? "",
      address:  address.trim() || undefined,
      lines,
    } : undefined);
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-sm font-medium mb-1";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      {/* ── Form kiri ── */}
      <div className="space-y-5">

        {/* Progress indicator — hanya jika ada shipping */}
        {needsShipping && (
          <div className="flex items-center gap-1 text-sm">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step > s  ? "bg-green-500 text-white" :
                  step === s ? "bg-primary text-primary-foreground" :
                               "bg-muted text-muted-foreground"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                <span className={`text-xs ${step === s ? "font-medium" : "text-muted-foreground"}`}>
                  {s === 1 ? "Pemesan" : s === 2 ? "Pengiriman" : "Konfirmasi"}
                </span>
                {s < 3 && <span className="text-muted-foreground mx-1">›</span>}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* ── Step 1: info pemesan ── */}
        {step === 1 && (
          <div className="rounded-lg border border-border p-5 space-y-4">
            <p className="font-semibold text-sm">Informasi Pemesan</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhoneInput
                label="Nomor HP"
                value={phone}
                onChange={setPhone}
                optional
                hint="Atau isi email di sebelah kanan"
              />
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Nama <span className="text-muted-foreground text-xs">(opsional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                Catatan <span className="text-muted-foreground text-xs">(opsional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Pesan atau catatan untuk admin..."
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: metode pengiriman per grup + kota tujuan (kondisional) ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Pilihan Kirim via Kurir / Ambil Sendiri — hanya tampil kalau grup punya opsi
                Ambil Sendiri; kalau tidak, selalu kurir (perilaku lama, tidak berubah). */}
            {sellerGroups.some(g => g.pickupEnabled) && (
              <div className="rounded-lg border border-border p-5 space-y-3">
                <p className="font-semibold text-sm">Metode Pengiriman</p>
                {sellerGroups.map(group => {
                  if (!group.pickupEnabled) return null;
                  const choice = getChoice(group.key);
                  return (
                    <div key={group.key} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{group.sellerName}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer text-sm ${
                          choice.deliveryMethod === "courier" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}>
                          <input
                            type="radio"
                            name={`delivery-${group.key}`}
                            checked={choice.deliveryMethod === "courier"}
                            onChange={() => setChoice(group.key, { deliveryMethod: "courier" })}
                          />
                          Kirim via Kurir
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer text-sm ${
                          choice.deliveryMethod === "pickup" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}>
                          <input
                            type="radio"
                            name={`delivery-${group.key}`}
                            checked={choice.deliveryMethod === "pickup"}
                            onChange={() => setChoice(group.key, { deliveryMethod: "pickup", paymentMethod: "prepaid" })}
                          />
                          Ambil Sendiri
                        </label>
                      </div>
                      {choice.deliveryMethod === "pickup" && (
                        <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                          <p className="font-medium text-foreground">{group.pickupLocationName}</p>
                          <p className="text-muted-foreground">{group.pickupAddress}</p>
                          {group.pickupMapsUrl && (
                            <a href={group.pickupMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              Buka di Google Maps →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kota tujuan + alamat — hanya wajib kalau minimal satu grup masih pakai kurir */}
            {anyCourierGroup && (
          <div className="rounded-lg border border-border p-5 space-y-4">
            <p className="font-semibold text-sm">Alamat Pengiriman</p>

            <div>
              <label className={labelCls}>Kota / Kabupaten Tujuan</label>
              {destCity ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border rounded-md bg-muted/50 text-sm">
                  <span>{destCity.name}</span>
                  <button
                    type="button"
                    onClick={() => { setDestCity(null); setCitySearch(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => { setCitySearch(e.target.value); setCityOpen(true); }}
                    onFocus={() => setCityOpen(true)}
                    onBlur={() => setTimeout(() => setCityOpen(false), 150)}
                    placeholder="Ketik nama kota atau kabupaten..."
                    className={inputCls}
                    autoComplete="off"
                  />
                  {cityOpen && citySearch.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                      {cityLoading && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Mencari...</p>
                      )}
                      {!cityLoading && cityResults.length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Tidak ada hasil untuk "{citySearch}"</p>
                      )}
                      {cityResults.map(city => (
                        <button
                          key={city.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDestCity({ id: city.id, name: city.label });
                            setCitySearch("");
                            setCityOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          <span>{city.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Alamat Detail <span className="text-muted-foreground text-xs">(opsional)</span>
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Jl. ..., No. ..., RT/RW, Kelurahan, Kecamatan"
                className={inputCls}
              />
            </div>

            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">Paket dikirim dari:</p>
              {sellerGroups.filter(g => getChoice(g.key).deliveryMethod === "courier").map(g => (
                <p key={g.key}>
                  • {g.sellerName} — {g.originCityName} · {(g.totalWeightGram / 1000).toFixed(g.totalWeightGram >= 1000 ? 1 : 0)}
                  {g.totalWeightGram >= 1000 ? " kg" : ` g`} · {g.items.length} produk
                </p>
              ))}
            </div>
          </div>
            )}
          </div>
        )}

        {/* ── Step 3: konfirmasi pengiriman — kurir (+ metode bayar) atau ringkasan ambil sendiri ── */}
        {step === 3 && (
          <div className="space-y-4">
            {sellerGroups.map(group => {
              const choice = getChoice(group.key);

              if (choice.deliveryMethod === "pickup") {
                return (
                  <div key={group.key} className="rounded-lg border border-border p-5 space-y-2">
                    <p className="font-semibold text-sm">Ambil Sendiri — {group.sellerName}</p>
                    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                      <p className="font-medium">{group.pickupLocationName}</p>
                      <p className="text-xs text-muted-foreground">{group.pickupAddress}</p>
                      {group.pickupMapsUrl && (
                        <a href={group.pickupMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                          Buka di Google Maps →
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Gratis — tidak ada ongkos kirim.</p>
                  </div>
                );
              }

              const gs = groupStates[group.key];
              return (
                <div key={group.key} className="rounded-lg border border-border p-5 space-y-3">
                  <div>
                    <p className="font-semibold text-sm">Pengiriman dari {group.sellerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.originCityName} → {destCity?.name} · {group.totalWeightGram}g
                    </p>
                  </div>

                  {!gs || gs.loading ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Memuat opsi pengiriman…</p>
                  ) : gs.error ? (
                    <p className="text-sm text-destructive">{gs.error}</p>
                  ) : gs.options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada layanan tersedia untuk rute ini.</p>
                  ) : (
                    <div className="space-y-2">
                      {gs.options.map((opt, i) => {
                        const isSelected =
                          gs.selected?.courier === opt.courier &&
                          gs.selected?.service === opt.service;
                        return (
                          <label
                            key={i}
                            className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`courier-${group.key}`}
                              checked={isSelected}
                              onChange={() =>
                                setGroupStates(prev => ({
                                  ...prev,
                                  [group.key]: { ...prev[group.key]!, selected: opt },
                                }))
                              }
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium uppercase">
                                  {opt.courier} {opt.service}
                                </span>
                                <span className="text-sm font-semibold tabular-nums shrink-0">
                                  {formatRp(opt.cost)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {opt.serviceDesc} · Estimasi {opt.etd}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Metode bayar untuk paket ini — hanya kalau penjual aktifkan COD */}
                  {group.codEnabled && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-xs font-medium">Metode Bayar untuk Paket Ini</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer text-sm ${
                          choice.paymentMethod === "prepaid" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}>
                          <input
                            type="radio"
                            name={`payment-${group.key}`}
                            checked={choice.paymentMethod === "prepaid"}
                            onChange={() => setChoice(group.key, { paymentMethod: "prepaid" })}
                          />
                          Transfer/QRIS (nanti)
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer text-sm ${
                          choice.paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}>
                          <input
                            type="radio"
                            name={`payment-${group.key}`}
                            checked={choice.paymentMethod === "cod"}
                            onChange={() => setChoice(group.key, { paymentMethod: "cod" })}
                          />
                          Bayar di Tempat (COD)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <p className="text-xs text-muted-foreground">
            Metode pembayaran (transfer / QRIS) dipilih setelah invoice dibuat.
          </p>
        )}

        {/* ── Kode Voucher + Tombol navigasi — sticky di bawah layar saat mobile (konsisten
             dengan shell mobile event/donasi/produk), kembali ke alur normal di desktop.
             `mt-0` sama alasannya dengan spacer di atas (cuma relevan saat fixed di mobile —
             saat md:static di desktop, md:space-y-5 di bawah tetap mengatur gap seperti biasa). ── */}
        <div className="fixed inset-x-0 bottom-0 z-40 mt-0 space-y-3 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:static md:inset-auto md:z-auto md:mt-5 md:space-y-5 md:border-0 md:bg-transparent md:p-0 md:pb-0 md:shadow-none">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium mb-2">Punya Kode Voucher?</p>
            {voucherPreview?.valid ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs">
                <span className="text-green-700 truncate">
                  Voucher <strong>{voucherInput.trim().toUpperCase()}</strong> — {voucherPreview.voucherName}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveVoucher}
                  className="text-green-700 hover:underline shrink-0"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherPreview(null); }}
                    placeholder="Kode voucher"
                    className={`${inputCls} text-sm`}
                  />
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    disabled={voucherPending || !voucherInput.trim()}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {voucherPending ? "…" : "Terapkan"}
                  </button>
                </div>
                {voucherPreview && !voucherPreview.valid && (
                  <p className="text-xs text-destructive">{voucherPreview.error}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setError(""); setStep(prev => (prev - 1) as 1 | 2 | 3); }}
                className="shrink-0 rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                ← Kembali
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleStep1Next}
                disabled={pending}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {pending
                  ? "Memproses…"
                  : needsShipping
                    ? "Lanjut — Atur Pengiriman →"
                    : `Buat Invoice — ${formatRp(discountedSubtotal)}`}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleStep2Next}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Lanjut — Konfirmasi Pengiriman →
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleStep3Submit}
                disabled={pending || !allSelected}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {pending ? "Memproses…" : `Buat Invoice — ${formatRp(grandTotal)}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Ringkasan kanan ── */}
      <div className="rounded-lg border border-border p-5 space-y-3 sticky top-4">
        <p className="font-semibold text-sm">Ringkasan Pesanan</p>
        <div className="divide-y divide-border">
          {cart.items.map((item) => {
            const lineTotal    = item.unitPrice * item.quantity;
            const itemDiscount = voucherPreview?.valid ? (voucherPreview.perItemDiscount?.[item.id] ?? 0) : 0;
            return (
              <div key={item.id} className="flex justify-between py-2 text-sm gap-2">
                <span className="text-muted-foreground truncate">{item.name} × {item.quantity}</span>
                {itemDiscount > 0 ? (
                  <span className="text-right shrink-0">
                    <span className="block text-xs text-muted-foreground line-through">{formatRp(lineTotal)}</span>
                    <span className="tabular-nums text-green-600 font-medium">{formatRp(lineTotal - itemDiscount)}</span>
                  </span>
                ) : (
                  <span className="tabular-nums shrink-0">{formatRp(lineTotal)}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatRp(cart.subtotal)}</span>
        </div>

        {voucherPreview?.valid && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Diskon Voucher</span>
            <span className="tabular-nums">− {formatRp(voucherDiscount)}</span>
          </div>
        )}

        {step === 3 && sellerGroups.map(g => {
          const choice = getChoice(g.key);
          if (choice.deliveryMethod === "pickup") {
            return (
              <div key={g.key} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate">Ambil Sendiri — {g.sellerName}</span>
                <span className="tabular-nums shrink-0">Gratis</span>
              </div>
            );
          }
          const sel = groupStates[g.key]?.selected;
          return (
            <div key={g.key} className="flex justify-between text-sm">
              <span className="text-muted-foreground truncate">
                Ongkir {g.sellerName}{choice.paymentMethod === "cod" ? " (COD)" : ""}
              </span>
              <span className="tabular-nums shrink-0">{sel ? formatRp(sel.cost) : "—"}</span>
            </div>
          );
        })}

        <div className="flex justify-between font-semibold border-t border-border pt-3">
          <span>Total</span>
          <span className="tabular-nums">{formatRp(step === 3 ? grandTotal : discountedSubtotal)}</span>
        </div>
      </div>
    </div>

    {/* Spacer — WAJIB di sini, SETELAH grid ditutup (bukan di dalam kolom kiri) — di mobile,
        grid stack jadi 1 kolom dan kolom kanan "Ringkasan Pesanan" masih render SETELAH kolom
        kiri (termasuk bar sticky yang isinya). Kalau spacer ditaruh di dalam kolom kiri, ia
        nyangkut di ATAS Ringkasan Pesanan alih-alih di paling bawah tempat bar sticky
        sungguhan berada (bug yang sama dengan yang ditemukan di /keranjang — lihat lesson
        CLAUDE.md). Bar sticky sendiri (fixed di mobile) tidak perlu dipindah — position:fixed
        selalu render di viewport bottom terlepas dari posisi DOM-nya. */}
    <div className="h-48 md:hidden mt-0" />
    </>
  );
}
