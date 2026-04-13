"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createJournalAction,
  type JournalEntryInput,
} from "@/app/(dashboard)/[tenant]/finance/actions";

type AccountOption = {
  id: string;
  code: string;
  name: string;
};

type Props = {
  slug: string;
  accounts: AccountOption[];
};

type EntryRow = {
  key: number;
  accountId: string;
  type: "debit" | "credit";
  amount: string;
  note: string;
};

let rowKey = 0;

function newRow(): EntryRow {
  return { key: rowKey++, accountId: "", type: "debit", amount: "", note: "" };
}

export function JournalForm({ slug, accounts }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([
    { ...newRow(), type: "debit" },
    { ...newRow(), type: "credit" },
  ]);

  function updateEntry(key: number, field: keyof EntryRow, value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e))
    );
  }

  function addRow(type: "debit" | "credit") {
    setEntries((prev) => [...prev, { ...newRow(), type }]);
  }

  function removeRow(key: number) {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  }

  const totalDebit  = entries.filter((e) => e.type === "debit")
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCredit = entries.filter((e) => e.type === "credit")
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Keterangan jurnal wajib diisi.");
      return;
    }
    if (entries.length < 2) {
      setError("Jurnal minimal 2 baris.");
      return;
    }
    if (!isBalanced) {
      setError(`Jurnal tidak balance: Debit ${totalDebit.toLocaleString("id-ID")} ≠ Kredit ${totalCredit.toLocaleString("id-ID")}`);
      return;
    }
    for (const e of entries) {
      if (!e.accountId || !e.amount || parseFloat(e.amount) <= 0) {
        setError("Semua baris harus memiliki akun dan jumlah yang valid.");
        return;
      }
    }

    const payload: JournalEntryInput[] = entries.map((e) => ({
      accountId: e.accountId,
      type:      e.type,
      amount:    parseFloat(e.amount),
      note:      e.note.trim() || undefined,
    }));

    startTransition(async () => {
      const res = await createJournalAction(slug, { date, description, entries: payload });
      if (res.success) {
        router.push(`/${slug}/finance/jurnal`);
      } else {
        setError(res.error);
      }
    });
  }

  function formatRupiah(n: number) {
    return new Intl.NumberFormat("id-ID").format(n);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tanggal & Keterangan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">
            Tanggal <span className="text-destructive">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Keterangan <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi jurnal"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
        </div>
      </div>

      {/* Tabel entry */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Entri Jurnal <span className="text-destructive">*</span>
        </label>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-8">#</th>
                <th className="px-3 py-2 text-left font-medium">Akun</th>
                <th className="px-3 py-2 text-left font-medium w-28">D/K</th>
                <th className="px-3 py-2 text-right font-medium w-36">Jumlah</th>
                <th className="px-3 py-2 text-left font-medium">Keterangan Baris</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((row, idx) => (
                <tr key={row.key} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.accountId}
                      onChange={(e) => updateEntry(row.key, "accountId", e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      required
                    >
                      <option value="">— Pilih akun —</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} · {acc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.type}
                      onChange={(e) => updateEntry(row.key, "type", e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Kredit</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.amount}
                      onChange={(e) => updateEntry(row.key, "amount", e.target.value)}
                      placeholder="0"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
                      required
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) => updateEntry(row.key, "note", e.target.value)}
                      placeholder="Opsional"
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      disabled={entries.length <= 2}
                      title="Hapus baris"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Footer balance */}
            <tfoot className="border-t border-border bg-muted/20 text-sm font-medium">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Total Debit</td>
                <td className={`px-3 py-2 text-right ${isBalanced ? "text-green-600" : "text-destructive"}`}>
                  Rp {formatRupiah(totalDebit)}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Total Kredit</td>
                <td className={`px-3 py-2 text-right ${isBalanced ? "text-green-600" : "text-destructive"}`}>
                  Rp {formatRupiah(totalCredit)}
                </td>
                <td colSpan={2}></td>
              </tr>
              {!isBalanced && (
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-xs text-destructive text-center">
                    Selisih: Rp {formatRupiah(Math.abs(totalDebit - totalCredit))} — Jurnal harus balance sebelum bisa disimpan.
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Tombol tambah baris */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => addRow("debit")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Debit
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button
            type="button"
            onClick={() => addRow("credit")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Kredit
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !isBalanced}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Jurnal"}
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
