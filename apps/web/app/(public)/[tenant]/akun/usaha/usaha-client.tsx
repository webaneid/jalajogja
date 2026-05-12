"use client";

import * as React      from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";

type Entry = {
  _key: string;
  name: string; brand: string; description: string;
  category: string; sector: string; legality: string;
  position: string; employees: string; branches: string; revenue: string;
  // Alamat
  _addressMode:      "indonesia" | "overseas"; // UI only
  addressCountry:    string;
  addressProvinceId: number | null;
  addressRegencyId:  number | null;
  addressDistrictId: number | null;
  addressVillageId:  number | null;
  addressDetail:     string;
  addressPostalCode: string;
  // Kontak
  phone: string; whatsapp: string; email: string;
  instagram: string; facebook: string; website: string;
  isPhonePublic:    boolean;
  isWhatsappPublic: boolean;
  _sameAsPhone:     boolean; // UI only
};

const CATEGORIES: ComboboxOption[] = [
  { value: "Jasa",          label: "Jasa" },
  { value: "Produsen",      label: "Produsen" },
  { value: "Distributor",   label: "Distributor" },
  { value: "Trading",       label: "Trading" },
  { value: "Profesional",   label: "Profesional" },
];
const SECTORS: ComboboxOption[] = [
  { value: "Teknologi",                  label: "Teknologi" },
  { value: "Jasa Profesional",           label: "Jasa Profesional" },
  { value: "Kreatif",                    label: "Kreatif" },
  { value: "Manufaktur",                 label: "Manufaktur" },
  { value: "Kesehatan & Pendidikan",     label: "Kesehatan & Pendidikan" },
  { value: "Konsumsi & Ritel",           label: "Konsumsi & Ritel" },
  { value: "Sumber Daya Alam",           label: "Sumber Daya Alam" },
];
const LEGALITIES: ComboboxOption[] = [
  { value: "PT Perseorangan",            label: "PT Perseorangan" },
  { value: "PT",                         label: "PT" },
  { value: "CV",                         label: "CV" },
  { value: "Yayasan",                    label: "Yayasan" },
  { value: "Perkumpulan",                label: "Perkumpulan" },
  { value: "Koperasi",                   label: "Koperasi" },
  { value: "Belum Memiliki Legalitas",   label: "Belum Memiliki Legalitas" },
];
const POSITIONS: ComboboxOption[] = [
  { value: "Komisaris", label: "Komisaris" },
  { value: "Direktur",  label: "Direktur" },
  { value: "Pengelola", label: "Pengelola" },
  { value: "Manajer",   label: "Manajer" },
];
const EMPLOYEES: ComboboxOption[] = [
  { value: "1-4",          label: "1–4 orang" },
  { value: "5-10",         label: "5–10 orang" },
  { value: "11-20",        label: "11–20 orang" },
  { value: "Lebih dari 20",label: "Lebih dari 20" },
];
const BRANCHES: ComboboxOption[] = [
  { value: "Tidak Ada", label: "Tidak Ada" },
  { value: "1-3",       label: "1–3 cabang" },
  { value: "Diatas 3",  label: "Di atas 3 cabang" },
];
const REVENUES: ComboboxOption[] = [
  { value: "Dibawah 500jt", label: "Di bawah Rp 500 juta" },
  { value: "500jt-1M",      label: "Rp 500 juta – 1 Miliar" },
  { value: "1M-2M",         label: "Rp 1 – 2 Miliar" },
  { value: "Diatas 2M",     label: "Di atas Rp 2 Miliar" },
];

function newEntry(defaultProvinceId?: number): Entry {
  return {
    _key: crypto.randomUUID(), name:"", brand:"", description:"",
    category:"", sector:"", legality:"", position:"",
    employees:"", branches:"", revenue:"",
    _addressMode: "indonesia",
    addressCountry: "", addressProvinceId: defaultProvinceId ?? null,
    addressRegencyId: null, addressDistrictId: null, addressVillageId: null,
    addressDetail: "", addressPostalCode: "",
    phone:"", whatsapp:"", email:"", instagram:"", facebook:"", website:"",
    isPhonePublic: false, isWhatsappPublic: false, _sameAsPhone: false,
  };
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

type ApiRow = {
  name?: string; brand?: string; description?: string;
  category?: string; sector?: string; legality?: string; position?: string;
  employees?: string; branches?: string; revenue?: string;
  addressCountry?: string;
  addressProvinceId?: number; addressRegencyId?: number;
  addressDistrictId?: number; addressVillageId?: number;
  addressDetail?: string; addressPostalCode?: string;
  phone?: string; whatsapp?: string; email?: string;
  isPhonePublic?: boolean; isWhatsappPublic?: boolean;
  instagram?: string; facebook?: string; website?: string;
};

export function UsahaClient({ slug, defaultProvinceId }: { slug: string; defaultProvinceId?: number }) {
  const router = useRouter();

  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);
  const [saved,   setSaved]   = React.useState(false);

  React.useEffect(() => {
    fetch("/api/akun/member-business")
      .then(r => r.json())
      .then((d: { data?: ApiRow[] }) => {
        if (d.data && d.data.length > 0) {
          setEntries(d.data.map(e => {
            const phone    = e.phone    ?? "";
            const whatsapp = e.whatsapp ?? "";
            return {
              _key:             crypto.randomUUID(),
              name:             e.name        ?? "",
              brand:            e.brand       ?? "",
              description:      e.description ?? "",
              category:         e.category    ?? "",
              sector:           e.sector      ?? "",
              legality:         e.legality    ?? "",
              position:         e.position    ?? "",
              employees:        e.employees   ?? "",
              branches:         e.branches    ?? "",
              revenue:          e.revenue     ?? "",
              _addressMode:     (e.addressCountry ? "overseas" : "indonesia") as "indonesia" | "overseas",
              addressCountry:   e.addressCountry   ?? "",
              addressProvinceId: e.addressProvinceId ?? null,
              addressRegencyId:  e.addressRegencyId  ?? null,
              addressDistrictId: e.addressDistrictId ?? null,
              addressVillageId:  e.addressVillageId  ?? null,
              addressDetail:     e.addressDetail     ?? "",
              addressPostalCode: e.addressPostalCode ?? "",
              phone,
              whatsapp,
              email:            e.email       ?? "",
              instagram:        e.instagram   ?? "",
              facebook:         e.facebook    ?? "",
              website:          e.website     ?? "",
              isPhonePublic:    e.isPhonePublic    ?? false,
              isWhatsappPublic: e.isWhatsappPublic ?? false,
              _sameAsPhone:     !!phone && phone === whatsapp,
            };
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e));
  }

  function handleWilayah(key: string, val: WilayahValue) {
    update(key, {
      addressProvinceId: val.provinceId ?? null,
      addressRegencyId:  val.regencyId  ?? null,
      addressDistrictId: val.districtId ?? null,
      addressVillageId:  val.villageId  ?? null,
    });
  }

  function switchAddressMode(key: string, mode: "indonesia" | "overseas") {
    if (mode === "indonesia") {
      update(key, { _addressMode: "indonesia", addressCountry: "" });
    } else {
      update(key, {
        _addressMode: "overseas", addressCountry: "",
        addressProvinceId: null, addressRegencyId: null,
        addressDistrictId: null, addressVillageId: null,
      });
    }
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    for (const e of entries) {
      if (!e.name.trim())        { setError(`Nama usaha wajib diisi.`);        setSaving(false); return; }
      if (!e.description.trim()) { setError(`Deskripsi usaha wajib diisi.`);   setSaving(false); return; }
      if (!e.category)           { setError(`Kategori wajib dipilih.`);         setSaving(false); return; }
      if (!e.sector)             { setError(`Sektor wajib dipilih.`);           setSaving(false); return; }
      if (!e.legality)           { setError(`Legalitas wajib dipilih.`);        setSaving(false); return; }
      if (!e.position)           { setError(`Posisi / jabatan wajib dipilih.`); setSaving(false); return; }
      if (!e.employees)          { setError(`Jumlah karyawan wajib dipilih.`);  setSaving(false); return; }
      if (!e.branches)           { setError(`Jumlah cabang wajib dipilih.`);    setSaving(false); return; }
      if (!e.revenue)            { setError(`Omzet tahunan wajib dipilih.`);    setSaving(false); return; }
    }
    try {
      const res = await fetch("/api/akun/member-business", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries: entries.map(e => ({
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
          addressCountry:    e._addressMode === "overseas" ? (e.addressCountry.trim() || undefined) : undefined,
          addressProvinceId: e._addressMode === "indonesia" ? (e.addressProvinceId ?? undefined) : undefined,
          addressRegencyId:  e._addressMode === "indonesia" ? (e.addressRegencyId  ?? undefined) : undefined,
          addressDistrictId: e._addressMode === "indonesia" ? (e.addressDistrictId ?? undefined) : undefined,
          addressVillageId:  e._addressMode === "indonesia" ? (e.addressVillageId  ?? undefined) : undefined,
          addressDetail:    e.addressDetail.trim()    || undefined,
          addressPostalCode: e.addressPostalCode.trim() || undefined,
          phone:            e.phone.trim()    || undefined,
          whatsapp:         e._sameAsPhone ? (e.phone.trim() || undefined) : (e.whatsapp.trim() || undefined),
          email:            e.email.trim()   || undefined,
          isPhonePublic:    e.isPhonePublic,
          isWhatsappPublic: e.isWhatsappPublic,
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
    <div className="space-y-6">
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

          {/* ── Identitas ── */}
          <p className="text-sm font-semibold text-muted-foreground">Identitas Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nama Usaha">
                <input className={inputCls} value={e.name}
                  onChange={ev => update(e._key, { name: ev.target.value })}
                  placeholder="Nama usaha / perusahaan" required />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Nama Brand" optional>
                <input className={inputCls} value={e.brand}
                  onChange={ev => update(e._key, { brand: ev.target.value })}
                  placeholder="Brand / merek dagang" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Deskripsi">
                <textarea className={`${inputCls} h-20 resize-none py-2`} value={e.description}
                  onChange={ev => update(e._key, { description: ev.target.value })}
                  placeholder="Ringkasan singkat usaha" />
              </Field>
            </div>
            <Field label="Kategori">
              <Combobox options={CATEGORIES} value={e.category}
                onValueChange={v => update(e._key, { category: v })}
                placeholder="Pilih kategori" />
            </Field>
            <Field label="Sektor">
              <Combobox options={SECTORS} value={e.sector}
                onValueChange={v => update(e._key, { sector: v })}
                placeholder="Pilih sektor" />
            </Field>
            <Field label="Legalitas">
              <Combobox options={LEGALITIES} value={e.legality}
                onValueChange={v => update(e._key, { legality: v })}
                placeholder="Pilih legalitas" />
            </Field>
            <Field label="Posisi / Jabatan">
              <Combobox options={POSITIONS} value={e.position}
                onValueChange={v => update(e._key, { position: v })}
                placeholder="Pilih posisi" />
            </Field>
          </div>

          {/* ── Skala ── */}
          <p className="text-sm font-semibold text-muted-foreground pt-2">Skala Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Karyawan">
              <Combobox options={EMPLOYEES} value={e.employees}
                onValueChange={v => update(e._key, { employees: v })}
                placeholder="Jumlah karyawan" />
            </Field>
            <Field label="Cabang">
              <Combobox options={BRANCHES} value={e.branches}
                onValueChange={v => update(e._key, { branches: v })}
                placeholder="Jumlah cabang" />
            </Field>
            <Field label="Omzet / tahun">
              <Combobox options={REVENUES} value={e.revenue}
                onValueChange={v => update(e._key, { revenue: v })}
                placeholder="Kisaran omzet" />
            </Field>
          </div>

          {/* ── Alamat ── */}
          <p className="text-sm font-semibold text-muted-foreground pt-2">Alamat Usaha</p>
          <div className="space-y-4">
            {/* Toggle Indonesia / Luar Negeri */}
            <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
              {(["indonesia", "overseas"] as const).map(mode => (
                <button key={mode} type="button"
                  onClick={() => switchAddressMode(e._key, mode)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    e._addressMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {mode === "indonesia" ? "Indonesia" : "Luar Negeri"}
                </button>
              ))}
            </div>

            {e._addressMode === "indonesia" ? (
              <WilayahSelect
                defaultValue={{
                  provinceId: e.addressProvinceId ?? undefined,
                  regencyId:  e.addressRegencyId  ?? undefined,
                  districtId: e.addressDistrictId ?? undefined,
                  villageId:  e.addressVillageId  ?? undefined,
                }}
                onChange={val => handleWilayah(e._key, val)}
              />
            ) : (
              <Field label="Negara" optional>
                <input className={inputCls} value={e.addressCountry}
                  onChange={ev => update(e._key, { addressCountry: ev.target.value })}
                  placeholder="Contoh: Malaysia, Arab Saudi, Jepang" />
              </Field>
            )}

            <Field label="Detail Alamat" optional>
              <textarea className={`${inputCls} h-16 resize-none py-2`} value={e.addressDetail}
                onChange={ev => update(e._key, { addressDetail: ev.target.value })}
                placeholder="Nama jalan, nomor, RT/RW, gedung, lantai..." />
            </Field>

            <div className="max-w-[160px]">
              <Field label="Kode Pos" optional>
                <input className={inputCls} value={e.addressPostalCode}
                  onChange={ev => update(e._key, { addressPostalCode: ev.target.value })}
                  placeholder="55283" maxLength={10} inputMode="numeric" />
              </Field>
            </div>
          </div>

          {/* ── Kontak ── */}
          <p className="text-sm font-semibold text-muted-foreground pt-2">Kontak Usaha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Telepon */}
            <div className="space-y-1.5">
              <PhoneInput label="Telepon" value={e.phone}
                onChange={v => update(e._key, { phone: v, ...(e._sameAsPhone && { whatsapp: v }) })}
                optional />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                <input type="checkbox" checked={e.isPhonePublic}
                  onChange={ev => update(e._key, { isPhonePublic: ev.target.checked })}
                  className="rounded border-input accent-primary" />
                Publik
              </label>
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <PhoneInput label="WhatsApp"
                value={e._sameAsPhone ? e.phone : e.whatsapp}
                onChange={v => { if (!e._sameAsPhone) update(e._key, { whatsapp: v }); }}
                disabled={e._sameAsPhone} optional />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                <input type="checkbox" checked={e._sameAsPhone}
                  onChange={ev => update(e._key, { _sameAsPhone: ev.target.checked, ...(ev.target.checked && { whatsapp: e.phone }) })}
                  className="rounded border-input accent-primary" />
                Sama dengan nomor telepon
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                <input type="checkbox" checked={e.isWhatsappPublic}
                  onChange={ev => update(e._key, { isWhatsappPublic: ev.target.checked })}
                  className="rounded border-input accent-primary" />
                Publik
              </label>
            </div>
            <div className="sm:col-span-2">
              <Field label="Email" optional>
                <input className={inputCls} type="email" value={e.email}
                  onChange={ev => update(e._key, { email: ev.target.value })}
                  placeholder="usaha@email.com" />
              </Field>
            </div>
            <Field label="Instagram" optional>
              <input className={inputCls} value={e.instagram}
                onChange={ev => update(e._key, { instagram: ev.target.value })}
                placeholder="username (tanpa @)" />
            </Field>
            <Field label="Facebook" optional>
              <input className={inputCls} value={e.facebook}
                onChange={ev => update(e._key, { facebook: ev.target.value })}
                placeholder="URL atau nama halaman" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Website" optional>
                <input className={inputCls} type="url" value={e.website}
                  onChange={ev => update(e._key, { website: ev.target.value })}
                  placeholder="https://usaha.com" />
              </Field>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setEntries(p => [...p, newEntry(defaultProvinceId)])}
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
