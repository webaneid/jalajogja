"use client";

// Form voucher produsen ("Promo Produsen", K23). Batas diskon = persentase bagian tenant; server memeriksa ulang.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VOUCHER_LIMITS } from "@/lib/producer-vouchers";

export type VoucherFormInitial = {
  code: string; name: string; description: string; discountType: "percentage" | "fixed"; discountValue: string; targetItemIds: string[];
  usageLimit: string; usageLimitPerCustomer: string; restrictPhone: string; restrictEmail: string; validFrom: string; validUntil: string; isActive: boolean;
};
const EMPTY: VoucherFormInitial = {
  code: "", name: "", description: "", discountType: "percentage", discountValue: "", targetItemIds: [],
  usageLimit: "", usageLimitPerCustomer: "", restrictPhone: "", restrictEmail: "", validFrom: "", validUntil: "", isActive: true,
};
type SubmitResult = { success: true } | { success: false; error: string };

export function ProducerVoucherForm({ products, sharePercent, initial = EMPTY, codeLocked = false, submitLabel, onSubmit, backHref }: {
  products: { id: string; name: string; price: number }[]; sharePercent: number; initial?: VoucherFormInitial; codeLocked?: boolean;
  submitLabel: string; onSubmit: (input: unknown) => Promise<SubmitResult>; backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof VoucherFormInitial>(k: K, v: VoucherFormInitial[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const toggleProduct = (id: string) => set("targetItemIds", f.targetItemIds.includes(id) ? f.targetItemIds.filter((x) => x !== id) : [...f.targetItemIds, id]);

  function submit() {
    setError(null);
    start(async () => {
      const res = await onSubmit({ ...f, usageLimit: f.usageLimit || null, usageLimitPerCustomer: f.usageLimitPerCustomer || null,
        restrictPhone: f.restrictPhone || null, restrictEmail: f.restrictEmail || null, validFrom: f.validFrom || null, validUntil: f.validUntil || null });
      if (!res.success) { setError(res.error); return; }
      toast.success("Voucher tersimpan.");
      router.push(backHref); router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Kode voucher <span className="text-destructive">*</span></label>
            <Input value={f.code} disabled={codeLocked} maxLength={VOUCHER_LIMITS.codeMax} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="HEMAT5" className="font-mono" />
            {codeLocked && <p className="mt-1 text-xs text-muted-foreground">Kode tidak bisa diubah setelah dibuat.</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nama (label internal) <span className="text-destructive">*</span></label>
            <Input value={f.name} maxLength={VOUCHER_LIMITS.nameMax} onChange={(e) => set("name", e.target.value)} placeholder="Promo akhir tahun" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Keterangan</label>
          <Input value={f.description} maxLength={VOUCHER_LIMITS.descMax} onChange={(e) => set("description", e.target.value)} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Diskon</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Jenis</label>
            <div className="flex gap-2">
              {([["percentage", "Persen (%)"], ["fixed", "Nominal (Rp)"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set("discountType", v)}
                  className={`h-9 flex-1 rounded-md border px-3 text-sm ${f.discountType === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nilai diskon <span className="text-destructive">*</span></label>
            <Input inputMode="decimal" value={f.discountValue} onChange={(e) => set("discountValue", e.target.value.replace(/[^0-9.]/g, ""))} placeholder={f.discountType === "percentage" ? "5" : "5000"} />
          </div>
        </div>
        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Potongan voucher ini <strong>Anda yang menanggung</strong> (bagian tenant tidak berkurang). Batas: persen maksimal <strong>{sharePercent}%</strong>
          (sama dengan bagian tenant atas penjualan Anda); nominal maksimal {sharePercent}% dari harga terendah produk yang dipilih.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Berlaku untuk produk <span className="text-destructive">*</span></h2>
        {products.length === 0 ? <p className="text-sm text-muted-foreground">Anda belum memiliki produk yang bisa dipilih.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
                  <input type="checkbox" checked={f.targetItemIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">Rp{new Intl.NumberFormat("id-ID").format(p.price)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Batas & masa berlaku (opsional)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm">Total pemakaian</label><Input inputMode="numeric" value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))} placeholder="Tanpa batas" /></div>
          <div><label className="mb-1 block text-sm">Maksimal per pembeli</label><Input inputMode="numeric" value={f.usageLimitPerCustomer} onChange={(e) => set("usageLimitPerCustomer", e.target.value.replace(/\D/g, ""))} placeholder="Tanpa batas" /></div>
          <div><label className="mb-1 block text-sm">Mulai</label><Input type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm">Berakhir</label><Input type="date" value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm">Hanya untuk nomor HP</label><Input value={f.restrictPhone} onChange={(e) => set("restrictPhone", e.target.value)} placeholder="Voucher personal (opsional)" /></div>
          <div><label className="mb-1 block text-sm">Hanya untuk email</label><Input value={f.restrictEmail} onChange={(e) => set("restrictEmail", e.target.value)} placeholder="Voucher personal (opsional)" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />Aktif</label>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(backHref)}>Batal</Button>
        <Button type="button" disabled={pending} onClick={submit}>{pending ? "Menyimpan..." : submitLabel}</Button>
      </div>
    </div>
  );
}
