"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getVoucherTargetOptionsAction, type VoucherTargetOption,
} from "@/app/(dashboard)/app/[tenant]/finance/billing/actions";

type TargetType = "product" | "ticket" | "donation";

type Props = {
  slug:       string;
  targetType: TargetType;
  selected:   string[];
  onChange:   (ids: string[]) => void;
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

// Multi-select ringan — jumlah target per voucher realistis kecil (belasan produk paling
// banyak), tidak butuh virtualisasi/pagination. Opsi difetch ulang setiap targetType berganti.
export function VoucherTargetPicker({ slug, targetType, selected, onChange }: Props) {
  const [options, setOptions] = useState<VoucherTargetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getVoucherTargetOptionsAction(slug, targetType).then((res) => {
      if (cancelled) return;
      setOptions(res.success ? res.data : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, targetType]);

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Kosongkan (jangan pilih apa pun) supaya voucher berlaku untuk SEMUA item tipe ini.
      </p>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs"
            >
              {o.label}
              <button type="button" onClick={() => toggle(o.value)} className="hover:text-destructive">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari item untuk ditargetkan..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {loading ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Memuat...</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Tidak ada item ditemukan.</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="shrink-0"
              />
              <span className="flex-1 truncate">{o.label}</span>
              {o.price != null && (
                <span className="text-xs text-muted-foreground shrink-0">{formatRp(o.price)}</span>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
