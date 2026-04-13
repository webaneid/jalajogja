"use client";

import { useState, useTransition } from "react";
import { saveAccountMappingsAction } from "@/app/(dashboard)/[tenant]/finance/actions";

type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Props = {
  slug: string;
  accounts: AccountOption[];
  initialMappings: Record<string, string | null>;
};

const MAPPING_FIELDS = [
  { key: "cash_default",    label: "Kas Tunai (default)",      hint: "Dipakai untuk metode pembayaran Cash" },
  { key: "bank_default",    label: "Rekening Bank (default)",  hint: "Dipakai untuk Transfer / QRIS / Gateway" },
  { key: "income_manual",   label: "Pendapatan Iuran",         hint: "Kredit saat konfirmasi pemasukan manual" },
  { key: "income_toko",     label: "Pendapatan Usaha (Toko)",  hint: "Kredit saat konfirmasi pembayaran order" },
  { key: "dana_titipan",    label: "Dana Titipan (Donasi)",    hint: "Kredit saat konfirmasi pembayaran donasi (akun kewajiban 2200)" },
  { key: "expense_default", label: "Beban Operasional",        hint: "Debit saat pengeluaran dibayar" },
] as const;

export function AccountMappingsForm({ slug, accounts, initialMappings }: Props) {
  const [mappings, setMappings] = useState<Record<string, string>>(
    Object.fromEntries(
      MAPPING_FIELDS.map((f) => [f.key, initialMappings[f.key] ?? ""])
    )
  );
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();

  function handleChange(key: string, value: string) {
    setMappings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const payload = Object.fromEntries(
        Object.entries(mappings).map(([k, v]) => [k, v || null])
      );
      const res = await saveAccountMappingsAction(slug, payload);
      if (res.success) {
        setSaved(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 space-y-3">
      {MAPPING_FIELDS.map((field) => (
        <div key={field.key} className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
          <div>
            <p className="text-sm font-medium">{field.label}</p>
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          </div>
          <div className="sm:col-span-2">
            <select
              value={mappings[field.key] ?? ""}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Pilih akun —</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} · {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved  && <p className="text-sm text-green-600">Mapping berhasil disimpan.</p>}

      <div className="pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Mapping"}
        </button>
      </div>
    </form>
  );
}
