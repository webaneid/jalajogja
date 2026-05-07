"use client";

import * as React      from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Plus, X, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PesantrenOption = { id: string; name: string; popularName: string | null };

type Entry = {
  _key:         string;
  pesantrenId:  string;
  pesantrenName: string;
  peran:        string;
  posisi:       string;
  tahunMulai:   string;
  tahunSelesai: string;
  catatan:      string;
};

const PERAN_ITEMS = [
  { value: "alumni",   label: "Alumni / Santri" },
  { value: "pengajar", label: "Pengajar / Ustadz" },
  { value: "pengurus", label: "Pengurus" },
  { value: "pengasuh", label: "Pengasuh" },
  { value: "pendiri",  label: "Pendiri" },
  { value: "lainnya",  label: "Lainnya" },
];

function newEntry(): Entry {
  return { _key: crypto.randomUUID(), pesantrenId:"", pesantrenName:"", peran:"alumni", posisi:"", tahunMulai:"", tahunSelesai:"", catatan:"" };
}

// ─── Pesantren search ─────────────────────────────────────────────────────────

function PesantrenSearch({ value, valueName, onSelect }: {
  value: string; valueName: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [query,   setQuery]   = React.useState(valueName);
  const [options, setOptions] = React.useState<PesantrenOption[]>([]);
  const [open,    setOpen]    = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setQuery(valueName); }, [valueName]);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setOptions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/ref/pesantren?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) { const d = await res.json(); setOptions(d.data ?? d); setOpen(true); }
    }, 300);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      <label className="text-sm font-medium">Nama Pesantren <span className="text-destructive">*</span></label>
      <input
        type="text"
        value={query}
        onChange={e => { handleSearch(e.target.value); if (!e.target.value) onSelect("",""); }}
        placeholder="Ketik nama pesantren..."
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-10 w-72 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {options.map(o => (
              <li key={o.id}>
                <button type="button"
                  onMouseDown={e => { e.preventDefault(); onSelect(o.id, o.name); setQuery(o.name); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                >
                  {o.name}
                  {o.popularName && <span className="text-xs text-muted-foreground ml-1">({o.popularName})</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PesantrenPage() {
  const params = useParams<{ tenant: string }>();
  const slug   = params.tenant;
  const router = useRouter();

  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);
  const [saved,   setSaved]   = React.useState(false);

  React.useEffect(() => {
    fetch("/api/akun/member-pesantren")
      .then(r => r.json())
      .then((d: { data?: { pesantrenId:string; pesantrenName:string; peran:string; posisi:string|null; tahunMulai:number|null; tahunSelesai:number|null; catatan:string|null }[] }) => {
        if (d.data && d.data.length > 0) {
          setEntries(d.data.map(e => ({
            _key:         crypto.randomUUID(),
            pesantrenId:  e.pesantrenId,
            pesantrenName: e.pesantrenName,
            peran:        e.peran,
            posisi:       e.posisi       ?? "",
            tahunMulai:   e.tahunMulai   != null ? String(e.tahunMulai)   : "",
            tahunSelesai: e.tahunSelesai != null ? String(e.tahunSelesai) : "",
            catatan:      e.catatan      ?? "",
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e));
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch("/api/akun/member-pesantren", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          entries: entries
            .filter(e => e.pesantrenId && e.peran)
            .map(e => ({
              pesantrenId:  e.pesantrenId,
              peran:        e.peran,
              posisi:       e.posisi.trim()  || null,
              tahunMulai:   e.tahunMulai  ? Number(e.tahunMulai)  : null,
              tahunSelesai: e.tahunSelesai ? Number(e.tahunSelesai) : null,
              catatan:      e.catatan.trim() || null,
            })),
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      setSaved(true);
      setTimeout(() => router.push(`/${slug}/akun`), 1000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <a href={`/${slug}/akun`} className="hover:text-foreground transition-colors">← Dashboard</a>
        <span>/</span>
        <span>Data Pesantren</span>
      </div>

      <div>
        <h1 className="text-xl font-bold">Data Pesantren</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tambahkan keterlibatan Anda di pesantren — sebagai alumni, pengajar, pengurus, dll.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada data pesantren. Klik tombol di bawah untuk menambahkan.</p>
      )}

      {entries.map(e => (
        <div key={e._key} className="rounded-xl border border-border p-4 space-y-4 relative">
          <button type="button" onClick={() => setEntries(p => p.filter(x => x._key !== e._key))}
            className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>

          <PesantrenSearch
            value={e.pesantrenId}
            valueName={e.pesantrenName}
            onSelect={(id, name) => update(e._key, { pesantrenId: id, pesantrenName: name })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Peran</label>
              <select value={e.peran} onChange={ev => update(e._key, { peran: ev.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {PERAN_ITEMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Posisi / Jabatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
              <input type="text" value={e.posisi} onChange={ev => update(e._key, { posisi: ev.target.value })}
                placeholder="mis. Ketua, Wali Kelas"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tahun Mulai <span className="text-muted-foreground font-normal">(opsional)</span></label>
              <input type="number" min={1950} max={new Date().getFullYear()} value={e.tahunMulai}
                onChange={ev => update(e._key, { tahunMulai: ev.target.value })}
                placeholder="mis. 2000"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tahun Selesai <span className="text-muted-foreground font-normal">(kosongkan jika masih aktif)</span></label>
              <input type="number" min={1950} max={new Date().getFullYear()} value={e.tahunSelesai}
                onChange={ev => update(e._key, { tahunSelesai: ev.target.value })}
                placeholder="mis. 2006"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
              <input type="text" value={e.catatan} onChange={ev => update(e._key, { catatan: ev.target.value })}
                placeholder="Informasi tambahan"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setEntries(p => [...p, newEntry()])}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center">
        <Plus className="h-4 w-4" />
        Tambah Pesantren
      </button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" /> Tersimpan. Kembali ke dashboard...
        </div>
      )}

      <div className="flex justify-between pt-2">
        <a href={`/${slug}/akun`} className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
          Batal
        </a>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Simpan Data Pesantren
        </button>
      </div>
    </div>
  );
}
