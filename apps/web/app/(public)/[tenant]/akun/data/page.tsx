"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { WilayahSelect } from "@/components/ui/wilayah-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader2, Save } from "lucide-react";

const WALI_SANTRI_OPTIONS = [
  { value: "gontor", label: "Wali Santri Pondok Modern Gontor" },
  { value: "alumni", label: "Wali Santri Pondok Modern Alumni Gontor" },
  { value: "lain",   label: "Wali Santri Pesantren Lain" },
  { value: "bukan",  label: "Bukan Wali Santri" },
] as const;

type WaliSantriValue = "gontor" | "alumni" | "lain" | "bukan" | "";

export default function AkunDataPage() {
  const params    = useParams<{ tenant: string }>();
  const slug      = params.tenant;
  const router    = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Form state
  const [name,          setName]          = useState("");
  const [email,         setEmail]         = useState("");
  const [phone,         setPhone]         = useState("");
  const [whatsapp,      setWhatsapp]      = useState("");
  const [sameAsPhone,   setSameAsPhone]   = useState(false);
  const [waliSantri,    setWaliSantri]    = useState<WaliSantriValue>("");
  const [addressDetail, setAddressDetail] = useState("");
  const [wilayah, setWilayah] = useState<{
    provinceId?: number; regencyId?: number; districtId?: number; villageId?: number;
  }>({});

  // Load data
  useEffect(() => {
    fetch("/api/akun/profile-data")
      .then(r => r.json())
      .then(data => {
        if (data.error) { router.replace(`/${slug}/akun`); return; }
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setSameAsPhone(!data.whatsapp || data.whatsapp === data.phone);
        setWaliSantri((data.waliSantri ?? "") as WaliSantriValue);
        setAddressDetail(data.addressDetail ?? "");
        setWilayah({
          provinceId: data.provinceId ? Number(data.provinceId) : undefined,
          regencyId:  data.regencyId  ? Number(data.regencyId)  : undefined,
          districtId: data.districtId ? Number(data.districtId) : undefined,
          villageId:  data.villageId  ? Number(data.villageId)  : undefined,
        });
      })
      .catch(() => setError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    if (!phone.trim()) { setError("Nomor HP wajib diisi."); return; }
    if (!wilayah.provinceId || !wilayah.regencyId || !wilayah.districtId) {
      setError("Alamat domisili wajib diisi minimal sampai tingkat Kecamatan.");
      return;
    }
    if (!addressDetail.trim()) {
      setError("Detail alamat domisili wajib diisi.");
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/akun/profile-data", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          whatsapp:      sameAsPhone ? phone : (whatsapp || null),
          waliSantri:    waliSantri || null,
          addressDetail: addressDetail || null,
          provinceId:    wilayah.provinceId  ? String(wilayah.provinceId)  : null,
          regencyId:     wilayah.regencyId   ? String(wilayah.regencyId)   : null,
          districtId:    wilayah.districtId  ? String(wilayah.districtId)  : null,
          villageId:     wilayah.villageId   ? String(wilayah.villageId)   : null,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Gagal menyimpan data. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }, [name, phone, whatsapp, sameAsPhone, waliSantri, addressDetail, wilayah]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Data Diri</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lengkapi profil Anda — kontak, alamat, dan informasi lainnya.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Identitas ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Identitas</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nama Lengkap</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nama lengkap"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <input
            value={email}
            disabled
            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">Email tidak dapat diubah sendiri.</p>
        </div>
      </section>

      {/* ── Kontak ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Kontak</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nomor HP <span className="text-destructive">*</span></label>
          <PhoneInput label="Nomor HP" value={phone} onChange={setPhone} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">WhatsApp</label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={e => { setSameAsPhone(e.target.checked); if (e.target.checked) setWhatsapp(""); }}
                className="rounded"
              />
              Sama dengan HP
            </label>
          </div>
          {!sameAsPhone && <PhoneInput label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />}
          {sameAsPhone && (
            <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">{phone || "—"}</p>
          )}
        </div>
      </section>

      {/* ── Wali Santri ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Keterangan Lainnya</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Apakah Anda Wali Santri?</label>
          <select
            value={waliSantri}
            onChange={e => setWaliSantri(e.target.value as WaliSantriValue)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Pilih —</option>
            {WALI_SANTRI_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ── Alamat Domisili ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Alamat Domisili</h2>

        <WilayahSelect
          defaultValue={wilayah}
          onChange={setWilayah}
          tenantSlug={slug}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Alamat Detail</label>
          <textarea
            value={addressDetail}
            onChange={e => setAddressDetail(e.target.value)}
            rows={3}
            placeholder="Nama jalan, nomor rumah, RT/RW, dll."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </section>

      {/* Tombol simpan */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Tersimpan!</span>}
      </div>
    </div>
  );
}
