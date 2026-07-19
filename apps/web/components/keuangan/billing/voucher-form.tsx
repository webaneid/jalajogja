"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/ui/phone-input";
import { VoucherTargetPicker } from "@/components/keuangan/billing/voucher-target-picker";
import {
  createVoucherAction, updateVoucherAction, type VoucherFormData,
} from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type InitialValues = {
  code:                   string;
  name:                   string;
  description:            string;
  discountType:           "percentage" | "fixed";
  discountValue:          number;
  targetType:             "product" | "ticket" | "donation";
  targetItemIds:          string[];
  usageLimit:             number | null;
  usageLimitPerCustomer:  number | null;
  restrictPhone:          string | null;
  restrictEmail:          string | null;
  validFrom:              string | null;
  validUntil:             string | null;
};

type Props = {
  slug: string;
  // Kalau diisi → mode edit (update, redirect ke detail). Kalau tidak → mode create.
  voucherId?:     string;
  initialValues?: InitialValues;
};

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls = "block text-sm font-medium mb-1";

const TARGET_LABELS: Record<"product" | "ticket" | "donation", string> = {
  product:  "Produk",
  ticket:   "Tiket Event",
  donation: "Donasi / Qurban",
};

export function VoucherForm({ slug, voucherId, initialValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const isEdit = !!voucherId;

  const [code, setCode]               = useState(initialValues?.code ?? "");
  const [name, setName]               = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(initialValues?.discountType ?? "percentage");
  const [discountValue, setDiscountValue] = useState(initialValues ? String(initialValues.discountValue) : "");
  const [targetType, setTargetType]   = useState<"product" | "ticket" | "donation">(initialValues?.targetType ?? "product");
  const [targetItemIds, setTargetItemIds] = useState<string[]>(initialValues?.targetItemIds ?? []);
  const [usageLimit, setUsageLimit]   = useState(initialValues?.usageLimit != null ? String(initialValues.usageLimit) : "");
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    initialValues?.usageLimitPerCustomer != null ? String(initialValues.usageLimitPerCustomer) : "",
  );
  const [restrictPhone, setRestrictPhone] = useState(initialValues?.restrictPhone ?? "");
  const [restrictEmail, setRestrictEmail] = useState(initialValues?.restrictEmail ?? "");
  const [validFrom, setValidFrom]   = useState(initialValues?.validFrom  ? initialValues.validFrom.slice(0, 10)  : "");
  const [validUntil, setValidUntil] = useState(initialValues?.validUntil ? initialValues.validUntil.slice(0, 10) : "");

  function handleTargetTypeChange(newType: "product" | "ticket" | "donation") {
    setTargetType(newType);
    setTargetItemIds([]); // ganti tipe → daftar item lama (dari tipe berbeda) tidak relevan lagi
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const data: VoucherFormData = {
        code, name,
        description:  description.trim() || undefined,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        targetType,
        targetItemIds,
        usageLimit:             usageLimit.trim()             ? parseInt(usageLimit, 10)             : null,
        usageLimitPerCustomer:  usageLimitPerCustomer.trim()  ? parseInt(usageLimitPerCustomer, 10)  : null,
        restrictPhone: restrictPhone.trim() || null,
        restrictEmail: restrictEmail.trim() || null,
        validFrom:  validFrom  || null,
        validUntil: validUntil || null,
      };
      if (isEdit) {
        const res = await updateVoucherAction(slug, voucherId!, data);
        if (res.success) router.push(`/app/${slug}/finance/billing/voucher/${voucherId}`);
        else setError(res.error);
      } else {
        const res = await createVoucherAction(slug, data);
        if (res.success) router.push(`/app/${slug}/finance/billing/voucher/${res.data.id}`);
        else setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5 space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div>
        <label className={labelCls}>Kode Voucher</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LOMBA100"
          className={`${inputCls} font-mono uppercase`}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Kode yang diketik customer di halaman checkout — huruf/angka, tidak case-sensitive.
        </p>
      </div>

      <div>
        <label className={labelCls}>Nama Internal</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Hadiah Lomba 17an" className={inputCls} required
        />
        <p className="mt-1 text-xs text-muted-foreground">Label untuk admin — tidak ditampilkan ke customer.</p>
      </div>

      <div>
        <label className={labelCls}>Deskripsi <span className="text-muted-foreground text-xs">(opsional)</span></label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipe Diskon</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
            className={inputCls}
          >
            <option value="percentage">Persentase (%)</option>
            <option value="fixed">Nominal Tetap (Rp)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Nilai Diskon</label>
          <div className="relative">
            {discountType === "fixed" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            )}
            <input
              type="number" min={1} max={discountType === "percentage" ? 100 : undefined}
              value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
              className={discountType === "fixed" ? `${inputCls} pl-9` : inputCls}
              required
            />
            {discountType === "percentage" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Berlaku Untuk</label>
        <select
          value={targetType}
          onChange={(e) => handleTargetTypeChange(e.target.value as "product" | "ticket" | "donation")}
          className={inputCls}
        >
          {Object.entries(TARGET_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Item Ditargetkan</label>
        <VoucherTargetPicker
          slug={slug} targetType={targetType}
          selected={targetItemIds} onChange={setTargetItemIds}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Batas Pemakaian <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <input
            type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Tak terbatas" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Batas / Orang <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <input
            type="number" min={1} value={usageLimitPerCustomer} onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
            placeholder="Tak terbatas" className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhoneInput
          label="HP Khusus (voucher personal)"
          value={restrictPhone}
          onChange={setRestrictPhone}
          optional
          hint="Kosongkan jika berlaku untuk siapa saja"
        />
        <div>
          <label className={labelCls}>
            Email Khusus <span className="text-muted-foreground text-xs">(opsional)</span>
          </label>
          <input
            type="email" value={restrictEmail} onChange={(e) => setRestrictEmail(e.target.value)}
            placeholder="Kosongkan jika berlaku untuk siapa saja" className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Berlaku Mulai <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Berlaku Sampai <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Voucher"}
      </button>
    </form>
  );
}
