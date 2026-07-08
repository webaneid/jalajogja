"use client";

import { useState, useTransition } from "react";
import { linkTenantToCabangAction } from "../../actions";

interface Props {
  tenantId:        string;
  currentRefId:    string | null;
  currentRefNama:  string | null;
  cabangList:      { id: string; nama: string }[];
}

export function LinkCabangClient({ tenantId, currentRefId, currentRefNama, cabangList }: Props) {
  const [selected, setSelected]   = useState(currentRefId ?? "");
  const [pending, start]          = useTransition();
  const [saved, setSaved]         = useState(false);
  const [populated, setPopulated] = useState<number | null>(null);
  const [error, setError]         = useState("");

  const changed = selected !== (currentRefId ?? "");

  function handleSave() {
    setError(""); setSaved(false); setPopulated(null);
    start(async () => {
      const res = await linkTenantToCabangAction(tenantId, selected || null);
      if ("error" in res) { setError(res.error); return; }
      setSaved(true);
      setPopulated(res.populated);
    });
  }

  return (
    <div className="px-5 py-4 space-y-3">
      {currentRefId && (
        <p className="text-sm text-muted-foreground">
          Terhubung ke: <span className="font-medium text-foreground">{currentRefNama}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={e => { setSelected(e.target.value); setSaved(false); setPopulated(null); }}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">— Tidak dihubungkan</option>
          {cabangList.map(c => (
            <option key={c.id} value={c.id}>{c.nama}</option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={pending || !changed}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>

      {saved && (
        <p className="text-sm text-green-600">
          Tersimpan.{" "}
          {populated !== null && populated > 0
            ? `${populated} anggota otomatis ditambahkan ke tenant ini.`
            : populated === 0
            ? "Belum ada anggota yang terdaftar di cabang ini."
            : ""}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
