"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Ticket } from "lucide-react";
import {
  createOrderAction, previewOrderVoucherAction,
  type OrderData, type OrderItemInput, type OrderVoucherPreview,
} from "@/app/(dashboard)/app/[tenant]/toko/actions";
import type { CheckoutShippingLine } from "@/app/(public)/[tenant]/cart/actions";
import { PhoneInput } from "@/components/ui/phone-input";
import { CustomerSearchAutocomplete, type SelectedCustomer } from "@/components/toko/customer-search-autocomplete";

// ─── Types ──────────────────────────────────────────────────────────────────

type ProductOption = {
  id:          string;
  name:        string;
  sku:         string | null;
  price:       number;
  stock:       number;
  weightGram:  number;
  mitraId:     string | null;
  sellerType:  "tenant" | "mitra";
  productType: "simple" | "variable";
};

type CartItem = { product: ProductOption; qty: number };

type MitraShippingConfig = {
  sellerName:          string;
  originCityId:        number | null;
  originCityName:      string | null;
  codEnabled:          boolean;
  pickupEnabled:       boolean;
  pickupLocationName:  string | null;
  pickupAddress:       string | null;
  pickupMapsUrl:       string | null;
};

type TenantShippingConfig = {
  originCityId:        number;
  originCityName:      string;
  codEnabled:          boolean;
  pickupEnabled:       boolean;
  pickupLocationName:  string | null;
  pickupAddress:       string | null;
  pickupMapsUrl:       string | null;
};

type LocalSellerGroup = {
  key:                 string;
  sellerType:          "tenant" | "mitra";
  sellerId:            string | null;
  sellerName:          string;
  originCityId:        number;
  originCityName:      string;
  totalWeightGram:     number;
  codEnabled:          boolean;
  pickupEnabled:       boolean;
  pickupLocationName:  string | null;
  pickupAddress:       string | null;
  pickupMapsUrl:       string | null;
};

type CourierOption = { courier: string; service: string; serviceDesc: string; etd: string; cost: number };
type FlatCourierResult = { name: string; code: string; service: string; description: string; cost: number; etd: string };
type CityResult = { id: number; label: string; cityName: string; districtName: string; subdistrictName: string; provinceName: string; zipCode: string };

type GroupChoice = { deliveryMethod: "courier" | "pickup"; paymentMethod: "prepaid" | "cod" };
type GroupState  = { options: CourierOption[]; selected: CourierOption | null; loading: boolean; error: string };

function flattenCourierOptions(results: FlatCourierResult[]): CourierOption[] {
  return results
    .map((r) => ({ courier: r.code, service: r.service, serviceDesc: r.description, etd: r.etd || "—", cost: r.cost }))
    .sort((a, b) => a.cost - b.cost);
}

function formatRupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);
}

type Props = {
  slug:           string;
  tenantName:     string;
  products:       ProductOption[];
  tenantShipping: TenantShippingConfig | null;
  mitraConfigMap: Record<string, MitraShippingConfig>;
  addonCouriers:  string[];
};

export function OrderCreateClient({ slug, tenantName, products, tenantShipping, mitraConfigMap, addonCouriers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // ── Customer ────────────────────────────────────────────────────────────────
  const [customerName,     setCustomerName]     = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerEmail,    setCustomerEmail]    = useState("");
  const [customerPhone,    setCustomerPhone]    = useState("");
  const [shippingAddress,  setShippingAddress]  = useState("");
  const [discount,         setDiscount]         = useState("0");
  const [notes,            setNotes]            = useState("");

  function handleSelectCustomer(c: SelectedCustomer | null) {
    setSelectedCustomer(c);
    if (c) {
      if (c.phone) setCustomerPhone(c.phone);
      if (c.email) setCustomerEmail(c.email);
    }
  }

  // ── Cart produk ─────────────────────────────────────────────────────────────
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [searchQ,    setSearchQ]    = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(searchQ.toLowerCase())
  );

  function addToCart(product: ProductOption) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: Math.min(c.qty + 1, product.stock) } : c));
      }
      return [...prev, { product, qty: 1 }];
    });
    setShowSearch(false);
    setSearchQ("");
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
    } else {
      setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, qty: Math.min(qty, c.product.stock) } : c)));
    }
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  // ── Voucher ──────────────────────────────────────────────────────────────────
  const [voucherInput,   setVoucherInput]   = useState("");
  const [voucherPreview, setVoucherPreview] = useState<OrderVoucherPreview | null>(null);
  const [voucherPending, startVoucherTransition] = useTransition();

  function handleApplyVoucher() {
    const code = voucherInput.trim();
    if (!code) { setVoucherPreview({ valid: false, error: "Masukkan kode voucher." }); return; }
    const items: OrderItemInput[] = cart.map((c) => ({ productId: c.product.id, qty: c.qty }));
    startVoucherTransition(async () => {
      const res = await previewOrderVoucherAction(slug, code, items, {
        phone: customerPhone.trim() || undefined,
        email: customerEmail.trim() || undefined,
      });
      setVoucherPreview(res.success ? res.data : { valid: false, error: res.error });
    });
  }

  function handleClearVoucher() {
    setVoucherInput("");
    setVoucherPreview(null);
  }

  // ── Seller groups (pengiriman) — dihitung client-side dari cart + config props ──
  const sellerGroups: LocalSellerGroup[] = useMemo(() => {
    const groupMap: Record<string, LocalSellerGroup> = {};
    for (const item of cart) {
      const p = item.product;
      if (!p.weightGram) continue; // tanpa berat, tidak dihitung ke opsi ongkir

      let sellerType: "tenant" | "mitra";
      let sellerId: string | null;
      let sellerName: string;
      let originCityId: number;
      let originCityName: string;
      let codEnabled: boolean;
      let pickupEnabled: boolean;
      let pickupLocationName: string | null;
      let pickupAddress: string | null;
      let pickupMapsUrl: string | null;

      if (p.mitraId && mitraConfigMap[p.mitraId]?.originCityId) {
        const mc = mitraConfigMap[p.mitraId];
        sellerType = "mitra"; sellerId = p.mitraId; sellerName = mc.sellerName;
        originCityId = mc.originCityId as number; originCityName = mc.originCityName ?? "";
        codEnabled = mc.codEnabled; pickupEnabled = mc.pickupEnabled;
        pickupLocationName = mc.pickupLocationName; pickupAddress = mc.pickupAddress; pickupMapsUrl = mc.pickupMapsUrl;
      } else if (!p.mitraId && tenantShipping) {
        sellerType = "tenant"; sellerId = null; sellerName = tenantName;
        originCityId = tenantShipping.originCityId; originCityName = tenantShipping.originCityName;
        codEnabled = tenantShipping.codEnabled; pickupEnabled = tenantShipping.pickupEnabled;
        pickupLocationName = tenantShipping.pickupLocationName; pickupAddress = tenantShipping.pickupAddress; pickupMapsUrl = tenantShipping.pickupMapsUrl;
      } else {
        continue; // kota asal tidak diketahui — grup dilewati (produk tetap masuk item pesanan)
      }

      const key = `${sellerType}:${sellerId ?? "tenant"}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          key, sellerType, sellerId, sellerName, originCityId, originCityName, totalWeightGram: 0,
          codEnabled, pickupEnabled, pickupLocationName, pickupAddress, pickupMapsUrl,
        };
      }
      groupMap[key].totalWeightGram += p.weightGram * item.qty;
    }
    return Object.values(groupMap);
  }, [cart, mitraConfigMap, tenantShipping, tenantName]);

  const needsShipping = sellerGroups.length > 0;

  // ── Pengiriman: kota tujuan + pilihan per grup ──────────────────────────────
  const [destCity,     setDestCity]     = useState<CityResult | null>(null);
  const [citySearch,   setCitySearch]   = useState("");
  const [cityResults,  setCityResults]  = useState<CityResult[]>([]);
  const [cityOpen,     setCityOpen]     = useState(false);
  const [cityLoading,  setCityLoading]  = useState(false);

  const [groupChoices, setGroupChoices] = useState<Record<string, GroupChoice>>({});
  const [groupStates,  setGroupStates]  = useState<Record<string, GroupState>>({});

  function getChoice(groupKey: string): GroupChoice {
    return groupChoices[groupKey] ?? { deliveryMethod: "courier", paymentMethod: "prepaid" };
  }
  function setChoice(groupKey: string, patch: Partial<GroupChoice>) {
    setGroupChoices((prev) => ({ ...prev, [groupKey]: { ...getChoice(groupKey), ...patch } }));
  }

  useEffect(() => {
    if (citySearch.length < 2) { setCityResults([]); return; }
    setCityLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(citySearch)}&limit=15`);
        const data = (await res.json()) as { cities: CityResult[] };
        setCityResults(data.cities ?? []);
        setCityOpen(true);
      } finally {
        setCityLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch]);

  // Reset hasil kurir tiap kali kota tujuan berubah — supaya efek fetch di bawah
  // menganggap semua grup "belum di-fetch" untuk kota yang baru.
  useEffect(() => { setGroupStates({}); }, [destCity?.id]);

  async function fetchCouriers(group: LocalSellerGroup, destCityId: number) {
    setGroupStates((prev) => ({ ...prev, [group.key]: { options: [], selected: null, loading: true, error: "" } }));
    try {
      const res = await fetch(`/api/ongkir/cost?slug=${slug}`, {
        method: "POST",
        body: new URLSearchParams({
          origin: String(group.originCityId),
          destination: String(destCityId),
          weight: String(Math.max(group.totalWeightGram, 1)),
          courier: addonCouriers.join(":"),
        }),
      });
      const data = (await res.json()) as { costs?: FlatCourierResult[]; error?: string };
      if (!res.ok || data.error) {
        setGroupStates((prev) => ({ ...prev, [group.key]: { options: [], selected: null, loading: false, error: data.error ?? "Gagal mengambil ongkir." } }));
        return;
      }
      const options = flattenCourierOptions(data.costs ?? []);
      setGroupStates((prev) => ({ ...prev, [group.key]: { options, selected: options[0] ?? null, loading: false, error: options.length === 0 ? "Tidak ada opsi kurir." : "" } }));
    } catch {
      setGroupStates((prev) => ({ ...prev, [group.key]: { options: [], selected: null, loading: false, error: "Gagal mengambil ongkir." } }));
    }
  }

  useEffect(() => {
    if (!destCity) return;
    for (const g of sellerGroups) {
      if (getChoice(g.key).deliveryMethod !== "courier") continue;
      if (groupStates[g.key]) continue;
      void fetchCouriers(g, destCity.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCity, sellerGroups, groupChoices]);

  // ── Kalkulasi ────────────────────────────────────────────────────────────────
  const rawSubtotal  = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const voucherDiscount = voucherPreview?.valid ? (voucherPreview.totalDiscount ?? 0) : 0;
  const discountNum  = parseFloat(discount) || 0;

  const shippingTotal = sellerGroups.reduce((s, g) => {
    const choice = getChoice(g.key);
    if (choice.deliveryMethod === "pickup") return s;
    const sel = groupStates[g.key]?.selected;
    return s + (sel?.cost ?? 0);
  }, 0);

  const total = Math.max(0, rawSubtotal - voucherDiscount - discountNum + shippingTotal);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) { setError("Nama pelanggan wajib diisi."); return; }
    if (cart.length === 0)    { setError("Tambahkan minimal 1 produk."); return; }

    let shipping: OrderData["shipping"] = null;
    if (needsShipping) {
      if (!destCity) { setError("Pilih kota tujuan pengiriman."); return; }
      const lines: CheckoutShippingLine[] = [];
      for (const g of sellerGroups) {
        const choice = getChoice(g.key);
        if (choice.deliveryMethod === "pickup") {
          lines.push({
            sellerType: g.sellerType, sellerId: g.sellerId, sellerName: g.sellerName,
            deliveryMethod: "pickup", paymentMethod: "prepaid", cost: 0,
            pickupLocationName: g.pickupLocationName, pickupAddress: g.pickupAddress, pickupMapsUrl: g.pickupMapsUrl,
          });
          continue;
        }
        const sel = groupStates[g.key]?.selected;
        if (!sel) { setError(`Pilih opsi kurir untuk pengiriman dari ${g.sellerName}.`); return; }
        lines.push({
          sellerType: g.sellerType, sellerId: g.sellerId, sellerName: g.sellerName,
          originCityId: g.originCityId, originCityName: g.originCityName,
          courier: sel.courier, service: sel.service, serviceDesc: sel.serviceDesc, etd: sel.etd,
          weightGram: g.totalWeightGram, cost: sel.cost,
          deliveryMethod: "courier", paymentMethod: choice.paymentMethod,
        });
      }
      shipping = { cityId: destCity.id, cityName: destCity.label, address: shippingAddress.trim() || undefined, lines };
    }

    const data: OrderData = {
      customerName:    customerName.trim(),
      customerEmail:   customerEmail.trim()   || null,
      customerPhone:   customerPhone.trim()   || null,
      memberId:        selectedCustomer?.type === "member"  ? selectedCustomer.id : null,
      profileId:       selectedCustomer?.type === "profile" ? selectedCustomer.id : null,
      shippingAddress: shippingAddress.trim() || null,
      discount:        discountNum,
      notes:           notes.trim()           || null,
      items:           cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
      shipping,
      voucherCode:     voucherPreview?.valid ? voucherInput.trim() : null,
    };

    startTransition(async () => {
      const res = await createOrderAction(slug, data);
      if (res.success) {
        router.push(`/app/${slug}/toko/pesanan/invoice/${res.data.invoiceId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Kolom kiri — Info pelanggan */}
      <div className="space-y-4">
        <h2 className="font-medium text-sm">Informasi Pelanggan</h2>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Nama Pelanggan <span className="text-destructive">*</span>
          </label>
          <CustomerSearchAutocomplete
            slug={slug}
            value={customerName}
            onChange={setCustomerName}
            onSelect={handleSelectCustomer}
            placeholder="Cari anggota / akun publik, atau ketik manual..."
          />
          {selectedCustomer && (
            <p className="mt-1 text-xs text-green-600">
              ✓ Terhubung ke {selectedCustomer.type === "member" ? "anggota" : "akun publik"}: {selectedCustomer.name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="ahmad@email.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <PhoneInput
            label="Telepon"
            optional
            value={customerPhone}
            onChange={setCustomerPhone}
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Alamat Pengiriman</label>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            rows={3}
            placeholder="Jl. Contoh No. 1, RT/RW, Kelurahan, Kecamatan, Kota"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Catatan tambahan (opsional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {/* Pengiriman — muncul kalau ada grup produk yang butuh ongkir */}
        {needsShipping && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <h3 className="text-sm font-medium">Pengiriman</h3>

            <div className="relative">
              <label className="block text-xs text-muted-foreground mb-1">Kota Tujuan</label>
              <input
                type="text"
                value={destCity ? destCity.label : citySearch}
                onChange={(e) => { setDestCity(null); setCitySearch(e.target.value); }}
                onFocus={() => cityResults.length > 0 && setCityOpen(true)}
                onBlur={() => setTimeout(() => setCityOpen(false), 200)}
                placeholder="Ketik nama kelurahan/kecamatan/kota tujuan..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {cityLoading && <p className="mt-1 text-xs text-muted-foreground">Mencari kota...</p>}
              {cityOpen && cityResults.length > 0 && (
                <ul className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
                  {cityResults.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => { setDestCity(c); setCitySearch(""); setCityOpen(false); }}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                    >
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sellerGroups.map((g) => {
              const choice = getChoice(g.key);
              const state  = groupStates[g.key];
              return (
                <div key={g.key} className="space-y-2 rounded-md border border-border/70 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Dari: {g.sellerName}</p>

                  {g.pickupEnabled && (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setChoice(g.key, { deliveryMethod: "courier" })}
                        className={`flex-1 rounded border px-2 py-1.5 ${choice.deliveryMethod === "courier" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                      >
                        Kirim via Kurir
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoice(g.key, { deliveryMethod: "pickup" })}
                        className={`flex-1 rounded border px-2 py-1.5 ${choice.deliveryMethod === "pickup" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                      >
                        Ambil Sendiri
                      </button>
                    </div>
                  )}

                  {choice.deliveryMethod === "pickup" ? (
                    <div className="rounded bg-muted/30 px-2.5 py-2 text-xs">
                      <p className="font-medium">{g.pickupLocationName ?? "Lokasi pengambilan"}</p>
                      {g.pickupAddress && <p className="text-muted-foreground">{g.pickupAddress}</p>}
                    </div>
                  ) : (
                    <>
                      {!destCity ? (
                        <p className="text-xs text-muted-foreground">Pilih kota tujuan untuk melihat opsi kurir.</p>
                      ) : state?.loading ? (
                        <p className="text-xs text-muted-foreground">Menghitung ongkos kirim...</p>
                      ) : state?.error ? (
                        <p className="text-xs text-destructive">{state.error}</p>
                      ) : state && state.options.length > 0 ? (
                        <select
                          value={state.selected ? `${state.selected.courier}|${state.selected.service}` : ""}
                          onChange={(e) => {
                            const [courier, service] = e.target.value.split("|");
                            const sel = state.options.find((o) => o.courier === courier && o.service === service) ?? null;
                            setGroupStates((prev) => ({ ...prev, [g.key]: { ...state, selected: sel } }));
                          }}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                        >
                          {state.options.map((o) => (
                            <option key={`${o.courier}|${o.service}`} value={`${o.courier}|${o.service}`}>
                              {o.courier.toUpperCase()} {o.service} — {formatRupiah(o.cost)} ({o.etd})
                            </option>
                          ))}
                        </select>
                      ) : null}

                      {g.codEnabled && (
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setChoice(g.key, { paymentMethod: "prepaid" })}
                            className={`flex-1 rounded border px-2 py-1.5 ${choice.paymentMethod === "prepaid" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                          >
                            Transfer / QRIS
                          </button>
                          <button
                            type="button"
                            onClick={() => setChoice(g.key, { paymentMethod: "cod" })}
                            className={`flex-1 rounded border px-2 py-1.5 ${choice.paymentMethod === "cod" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                          >
                            Bayar di Tempat (COD)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Kolom kanan — Produk & Ringkasan */}
      <div className="space-y-4">
        <h2 className="font-medium text-sm">Produk</h2>

        {/* Search produk */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="w-full flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Produk
          </button>

          {showSearch && (
            <div className="absolute top-full mt-1 left-0 right-0 z-10 rounded-lg border border-border bg-background shadow-lg">
              <div className="p-2 border-b border-border flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Cari produk..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto divide-y divide-border">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Tidak ditemukan</li>
                ) : (
                  filteredProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        disabled={p.stock === 0}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors disabled:opacity-50 text-left"
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku && <span className="font-mono">{p.sku}</span>}
                            {p.mitraId && <span className="ml-1 rounded bg-blue-50 px-1 text-blue-600">Mitra</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-green-600 font-medium">
                            {new Intl.NumberFormat("id-ID").format(p.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="p-2 border-t border-border">
                <button type="button" onClick={() => setShowSearch(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        {cart.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {cart.map((item) => {
              const disc = voucherPreview?.valid ? (voucherPreview.perItemDiscount?.[item.product.id] ?? 0) : 0;
              return (
                <div key={item.product.id} className="flex items-center gap-3 px-3 py-2.5">
                  {/* Info produk */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-green-600">
                      {formatRupiah(item.product.price)} × {item.qty} = {formatRupiah(item.product.price * item.qty)}
                    </p>
                    {disc > 0 && (
                      <p className="text-xs text-primary">Diskon voucher: -{formatRupiah(disc)}</p>
                    )}
                  </div>

                  {/* Qty control */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, item.qty - 1)}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted/40"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.product.stock}
                      value={item.qty}
                      onChange={(e) => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                      className="w-12 h-7 rounded border border-border text-center text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, item.qty + 1)}
                      disabled={item.qty >= item.product.stock}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted/40 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  {/* Hapus */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Belum ada produk — klik &quot;Tambah Produk&quot; di atas
          </div>
        )}

        {/* Voucher */}
        {cart.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">Kode Voucher</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                placeholder="Masukkan kode voucher"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {voucherPreview?.valid ? (
                <button type="button" onClick={handleClearVoucher} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
                  Batal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  disabled={voucherPending || !voucherInput.trim()}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Terapkan
                </button>
              )}
            </div>
            {voucherPreview?.valid && (
              <p className="text-xs text-green-600">✓ Voucher &quot;{voucherPreview.voucherName}&quot; diterapkan — hemat {formatRupiah(voucherPreview.totalDiscount ?? 0)}</p>
            )}
            {voucherPreview && !voucherPreview.valid && (
              <p className="text-xs text-destructive">{voucherPreview.error}</p>
            )}
          </div>
        )}

        {/* Ringkasan harga */}
        {cart.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal Produk</span>
              <span>{formatRupiah(rawSubtotal)}</span>
            </div>

            {voucherDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Diskon Voucher</span>
                <span>-{formatRupiah(voucherDiscount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diskon Tambahan (Rp)</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-32 rounded border border-input bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {needsShipping && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ongkos Kirim</span>
                <span>{formatRupiah(shippingTotal)}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold border-t border-border pt-2">
              <span>Total</span>
              <span className="text-lg">{formatRupiah(total)}</span>
            </div>
          </div>
        )}

        {/* Error + Submit */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending || cart.length === 0}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Membuat Pesanan..." : "Buat Pesanan"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
          >
            Batal
          </button>
        </div>
      </div>
    </form>
  );
}
