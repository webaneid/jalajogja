"use client";

import * as React      from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Plus, X, CheckCircle2 } from "lucide-react";

type Entry = {
  _key: string;
  name: string; brand: string; description: string;
  category: string; sector: string; legality: string;
  position: string; employees: string; branches: string; revenue: string;
  phone: string; whatsapp: string; email: string;
  instagram: string; facebook: string; website: string;
};

const CATEGORIES = ["Jasa","Produsen","Distributor","Trading","Profesional"];
const SECTORS    = ["Teknologi","Jasa Profesional","Kreatif","Manufaktur","Kesehatan & Pendidikan","Konsumsi & Ritel","Sumber Daya Alam"];
const LEGALITIES = ["PT Perseorangan","PT","CV","Yayasan","Perkumpulan","Koperasi","Belum Memiliki Legalitas"];
const POSITIONS  = ["Komisaris","Direktur","Pengelola","Manajer"];
const EMPLOYEES  = ["1-4","5-10","11-20","Lebih dari 20"];
const BRANCHES   = ["Tidak Ada","1-3","Diatas 3"];
const REVENUES   = ["Dibawah 500jt","500jt-1M","1M-2M","Diatas 2M"];

function newEntry(): Entry {
  return { _key: crypto.randomUUID(), name:"", brand:"", description:"", category:"Jasa", sector:"Teknologi",
    legality:"", position:"", employees:"", branches:"", revenue:"",
    phone:"", whatsapp:"", email:"", instagram:"", facebook:"", website:"" };
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}{optional && <span className="text-muted-foreground font-normal ml-1">(opsional)</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const selectCls = inputCls;

export default function UsahaPage() {
  const params = useParams<{ tenant: string }>();
  const slug   = params.tenant;
  const router = useRouter();

  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);
  const [saved,   setSaved]   = React.useState(false);

  React.useEffect(() => {
    fetch("/api/akun/member-business")
      .then(r => r.json())
      .then((d: { data?: Partial<Entry & { addressProvinceId?: number }>[] }) => {
        if (d.data && d.data.length > 0) {
          setEntries(d.data.map(e => ({
            _key: crypto.randomUUID(),
            name:        e.name        ?? "",
            brand:       e.brand       ?? "",
            description: e.description ?? "",
            category:    e.category    ?? "Jasa",
            sector:      e.sector      ?? "Teknologi",
            legality:    e.legality    ?? "",
            position:    e.position    ?? "",
            employees:   e.employees   ?? "",
            branches:    e.branches    ?? "",
            revenue:     e.revenue     ?? "",
            phone:       e.phone       ?? "",
            whatsapp:    e.whatsapp    ?? "",
            email:       e.email       ?? "",
            instagram:   e.instagram   ?? "",
            facebook:    e.facebook    ?? "",
            website:     e.website     ?? "",
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
    const valid = entries.filter(e => e.name.trim() && e.category && e.sector);
    if (valid.length < entries.length) {
      setError("Nama usaha, kategori, dan sektor wajib diisi untuk setiap usaha.");
      setSaving(false); return;
    }
    try {
      const res = await fetch("/api/akun/member-business", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries: valid.map(e => ({
          name:        e.name.trim(),
          brand:       e.brand.trim()       || undefined,
          description: e.description.trim() || undefined,
          category:    e.category,
          sector:      e.sector,
          legality:    e.legality  || undefined,
          position:    e.position  || undefined,
          employees:   e.employees || undefined,
          branches:    e.branches  || undefined,
          revenue:     e.revenue   || undefined,
          phone:       e.phone.trim()     || undefined,
          whatsapp:    e.whatsapp.trim()  || undefined,
          email:       e.email.trim()     || undefined,
          instagram:   e.instagram.trim() || undefined,
          facebook:    e.facebook.trim()  || undefined,
          website:     e.website.trim()   || undefined,
        }))
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
        <span>Data Usaha</span>
      </div>

      <div>
        <h1 className="text-xl font-bold">Data Usaha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tambahkan usaha atau bisnis yang Anda miliki / kelola.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada data usaha. Klik tombol di bawah untuk menambahkan.</p>
      )}

      {entries.map(e => (
        <div key={e._key} className="rounded-xl border border-border p-4 space-y-4 relative">
          <button type="button" onClick={() => setEntries(p => p.filter(x => x._key !== e._key))}
            className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>

          <p className="text-sm font-semibold text-muted-foreground">Identitas Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nama Usaha">
                <input className={inputCls} value={e.name} onChange={ev => update(e._key, { name: ev.target.value })} placeholder="Nama usaha / perusahaan" required />
              </Field>
            </div>
            <Field label="Nama Brand" optional>
              <input className={inputCls} value={e.brand} onChange={ev => update(e._key, { brand: ev.target.value })} placeholder="Brand / merek dagang" />
            </Field>
            <Field label="Kategori">
              <select className={selectCls} value={e.category} onChange={ev => update(e._key, { category: ev.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Sektor">
              <select className={selectCls} value={e.sector} onChange={ev => update(e._key, { sector: ev.target.value })}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Legalitas" optional>
              <select className={selectCls} value={e.legality} onChange={ev => update(e._key, { legality: ev.target.value })}>
                <option value="">Pilih legalitas</option>
                {LEGALITIES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Posisi / Jabatan" optional>
              <select className={selectCls} value={e.position} onChange={ev => update(e._key, { position: ev.target.value })}>
                <option value="">Pilih posisi</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <p className="text-sm font-semibold text-muted-foreground pt-2">Skala Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Karyawan" optional>
              <select className={selectCls} value={e.employees} onChange={ev => update(e._key, { employees: ev.target.value })}>
                <option value="">Pilih</option>
                {EMPLOYEES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Cabang" optional>
              <select className={selectCls} value={e.branches} onChange={ev => update(e._key, { branches: ev.target.value })}>
                <option value="">Pilih</option>
                {BRANCHES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Omzet / tahun" optional>
              <select className={selectCls} value={e.revenue} onChange={ev => update(e._key, { revenue: ev.target.value })}>
                <option value="">Pilih</option>
                {REVENUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>

          <p className="text-sm font-semibold text-muted-foreground pt-2">Kontak Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telepon" optional>
              <input className={inputCls} type="tel" value={e.phone} onChange={ev => update(e._key, { phone: ev.target.value })} placeholder="08xxxxxxxxxx" />
            </Field>
            <Field label="WhatsApp" optional>
              <input className={inputCls} type="tel" value={e.whatsapp} onChange={ev => update(e._key, { whatsapp: ev.target.value })} placeholder="08xxxxxxxxxx" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email" optional>
                <input className={inputCls} type="email" value={e.email} onChange={ev => update(e._key, { email: ev.target.value })} placeholder="usaha@email.com" />
              </Field>
            </div>
            <Field label="Instagram" optional>
              <input className={inputCls} value={e.instagram} onChange={ev => update(e._key, { instagram: ev.target.value })} placeholder="username (tanpa @)" />
            </Field>
            <Field label="Facebook" optional>
              <input className={inputCls} value={e.facebook} onChange={ev => update(e._key, { facebook: ev.target.value })} placeholder="URL atau nama halaman" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Website" optional>
                <input className={inputCls} type="url" value={e.website} onChange={ev => update(e._key, { website: ev.target.value })} placeholder="https://usaha.com" />
              </Field>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setEntries(p => [...p, newEntry()])}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center">
        <Plus className="h-4 w-4" />
        Tambah Usaha
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
          Simpan Data Usaha
        </button>
      </div>
    </div>
  );
}
