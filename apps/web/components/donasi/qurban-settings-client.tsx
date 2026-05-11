"use client";

import { useState, useTransition } from "react";
import { saveQurbanConfigAction, type QurbanConfig } from "@/app/(dashboard)/[tenant]/donasi/actions";

const ANIMALS = [
  { key: "domba",   label: "Domba"   },
  { key: "kambing", label: "Kambing" },
  { key: "sapi",    label: "Sapi"    },
] as const;

type AnimalKey = "domba" | "kambing" | "sapi";

type Props = {
  slug:   string;
  config: QurbanConfig;
};

export function QurbanSettingsClient({ slug, config }: Props) {
  const [prices, setPrices] = useState<Record<AnimalKey, string>>({
    domba:   String(config.defaultPrices.domba),
    kambing: String(config.defaultPrices.kambing),
    sapi:    String(config.defaultPrices.sapi),
  });
  const [adminFee,      setAdminFee]      = useState(String(config.adminFee));
  const [adminFeeLabel, setAdminFeeLabel] = useState(config.adminFeeLabel);
  const [error,         setError]         = useState("");
  const [saved,         setSaved]         = useState(false);
  const [pending,       startTransition]  = useTransition();

  function handleSave() {
    setError(""); setSaved(false);
    const parsed = {
      domba:   parseInt(prices.domba.replace(/\D/g, ""), 10) || 0,
      kambing: parseInt(prices.kambing.replace(/\D/g, ""), 10) || 0,
      sapi:    parseInt(prices.sapi.replace(/\D/g, ""), 10) || 0,
    };
    const fee = parseInt(adminFee.replace(/\D/g, ""), 10) || 0;

    startTransition(async () => {
      const res = await saveQurbanConfigAction(slug, {
        defaultPrices: parsed,
        adminFee:      fee,
        adminFeeLabel: adminFeeLabel,
      });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Gagal menyimpan.");
    });
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Harga Default Hewan Qurban</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Harga ini otomatis terisi saat admin membuat campaign qurban baru. Bisa di-override per campaign.
        </p>
      </div>

      <div className="space-y-3">
        {ANIMALS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="w-20 text-sm font-medium">{label}</label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={Number(prices[key]).toLocaleString("id-ID")}
                onChange={e => setPrices(prev => ({ ...prev, [key]: e.target.value.replace(/\D/g, "") }))}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-5 space-y-3">
        <h2 className="text-base font-semibold">Biaya Administrasi</h2>
        <p className="text-sm text-muted-foreground">
          Ditambahkan ke setiap pesanan. Ditampilkan terpisah di form donasi publik.
        </p>

        <div className="flex items-center gap-3">
          <label className="w-20 text-sm font-medium">Label</label>
          <input
            type="text"
            value={adminFeeLabel}
            onChange={e => setAdminFeeLabel(e.target.value)}
            placeholder="Biaya Administrasi"
            className={`${inputCls} flex-1`}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="w-20 text-sm font-medium">Nominal</label>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={Number(adminFee).toLocaleString("id-ID")}
              onChange={e => setAdminFee(e.target.value.replace(/\D/g, ""))}
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pengaturan qurban berhasil disimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan Pengaturan Qurban"}
      </button>
    </div>
  );
}
