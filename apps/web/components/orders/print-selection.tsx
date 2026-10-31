"use client";

// Seleksi cetak masal untuk tabel pesanan (tabel tetap server component; pulau klien ini hanya checkbox + tombol).
// Provider memegang daftar terpilih + popup format. Doc: arsitektur-portal-produsen.md § 21.
import { createContext, useContext, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { PrintLabelDialog } from "./print-label-dialog";

type Ctx = { slug: string; selected: Set<string>; toggle: (id: string) => void; setMany: (ids: string[], on: boolean) => void; clear: () => void; openFor: (ids: string[]) => void };
const C = createContext<Ctx | null>(null);
const useSel = () => { const c = useContext(C); if (!c) throw new Error("PrintProvider hilang"); return c; };

export function PrintProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogIds, setDialogIds] = useState<string[] | null>(null);
  const ctx: Ctx = {
    slug, selected,
    toggle: (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    setMany: (ids, on) => setSelected((s) => { const n = new Set(s); for (const i of ids) { if (on) n.add(i); else n.delete(i); } return n; }),
    clear: () => setSelected(new Set()),
    openFor: (ids) => setDialogIds(ids),
  };
  return (
    <C.Provider value={ctx}>
      {children}
      <PrintLabelDialog open={dialogIds !== null} onClose={() => setDialogIds(null)} slug={slug} invoiceIds={dialogIds ?? []} onDone={ctx.clear} />
    </C.Provider>
  );
}

export function RowCheckbox({ invoiceId, disabled }: { invoiceId: string; disabled?: boolean }) {
  const { selected, toggle } = useSel();
  return <input type="checkbox" aria-label="Pilih untuk cetak" disabled={disabled} checked={selected.has(invoiceId)} onChange={() => toggle(invoiceId)}
    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" />;
}

export function HeaderCheckbox({ ids }: { ids: string[] }) {
  const { selected, setMany } = useSel();
  const all = ids.length > 0 && ids.every((i) => selected.has(i));
  return <input type="checkbox" aria-label="Pilih semua" disabled={ids.length === 0} checked={all} onChange={() => setMany(ids, !all)} className="h-4 w-4 cursor-pointer disabled:opacity-40" />;
}

export function RowPrintButton({ invoiceId, disabledReason }: { invoiceId: string; disabledReason?: string }) {
  const { openFor } = useSel();
  const off = !!disabledReason;
  return (
    <button type="button" disabled={off} onClick={() => openFor([invoiceId])} title={off ? disabledReason : "Cetak label"} aria-label={off ? disabledReason : "Cetak label"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
      <Printer className="h-4 w-4" />
    </button>
  );
}

/** Bar cetak masal — muncul hanya bila ada pesanan terpilih. */
export function BulkPrintBar() {
  const { selected, clear, openFor } = useSel();
  if (selected.size === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span><b>{selected.size}</b> pesanan dipilih{selected.size > 100 ? " — maksimal 100 per cetak" : ""}</span>
      <span className="flex items-center gap-2">
        <button type="button" onClick={clear} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">Batal pilih</button>
        <button type="button" disabled={selected.size > 100} onClick={() => openFor([...selected])}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          <Printer className="h-3.5 w-3.5" /> Cetak Label ({selected.size})
        </button>
      </span>
    </div>
  );
}
