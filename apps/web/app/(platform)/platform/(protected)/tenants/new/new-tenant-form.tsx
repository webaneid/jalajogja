"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, GraduationCap, Users } from "lucide-react";
import { createTenantAction } from "../../actions";

type TenantType = "cabang" | "marhalah" | "forum";

interface CabangOption { id: string; nama: string; kota: string | null }

const TYPE_OPTIONS: { value: TenantType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: "cabang",
    label: "Cabang",
    desc:  "PC IKPM, cabang wilayah. Keanggotaan bersifat otomatis.",
    icon:  <Building2 size={20} />,
  },
  {
    value: "marhalah",
    label: "Marhalah / Angkatan",
    desc:  "Organisasi angkatan berdasarkan tahun lulus KMI. Dibuat per tahun atau per periode.",
    icon:  <GraduationCap size={20} />,
  },
  {
    value: "forum",
    label: "Forum",
    desc:  "Komunitas atau forum tematik (Forum Bisnis, Olahraga, dll). Keanggotaan bersifat aktif/opt-in.",
    icon:  <Users size={20} />,
  },
];

export function NewTenantForm({ cabangList }: { cabangList: CabangOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type,     setType]     = useState<TenantType>("cabang");
  const [name,     setName]     = useState("");
  const [slug,     setSlug]     = useState("");
  const [year,     setYear]     = useState("");
  const [period,   setPeriod]   = useState("");
  const [parentId, setParentId] = useState("");
  const [refCabangId, setRefCabangId] = useState("");
  const [error,    setError]    = useState("");

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  function autoSlug(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!slug || slug === autoSlug(name)) setSlug(autoSlug(val));
  }

  function handleTypeChange(val: TenantType) {
    setType(val);
    setRefCabangId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("name",             name);
    fd.set("slug",             slug);
    fd.set("tenant_type",      type);
    fd.set("marhalah_year",    year);
    fd.set("marhalah_period",  period);
    fd.set("parent_tenant_id", parentId);
    fd.set("ref_cabang_id",    refCabangId);

    startTransition(async () => {
      const res = await createTenantAction(fd);
      if ("error" in res) { setError(res.error); return; }
      router.push(`/platform/tenants/${res.slug}`);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/platform/tenants" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> Semua Tenant
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Tambah Tenant Baru</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buat Cabang, Marhalah, atau Forum dalam ekosistem jalakarta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pilih Tipe */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tipe Tenant</label>
          <div className="grid grid-cols-1 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  type === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="tenant_type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => handleTypeChange(opt.value)}
                  className="mt-0.5 accent-primary"
                />
                <div className={`mt-0.5 ${type === opt.value ? "text-primary" : "text-muted-foreground"}`}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Cabang: pilih dari daftar resmi PP IKPM */}
        {type === "cabang" && (
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              PC IKPM Resmi <span className="text-muted-foreground text-xs">(opsional)</span>
            </label>
            <select
              value={refCabangId}
              onChange={(e) => {
                setRefCabangId(e.target.value);
                // Auto-fill nama jika belum diisi
                if (!name && e.target.value) {
                  const selected = cabangList.find(c => c.id === e.target.value);
                  if (selected) handleNameChange(selected.nama);
                }
              }}
              className={inputCls}
            >
              <option value="">— Pilih PC IKPM (opsional)</option>
              {cabangList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nama}{c.kota ? ` — ${c.kota}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Hubungkan tenant ini ke data resmi PC IKPM. Anggota yang sudah mendaftar di cabang ini akan otomatis ditambahkan.
            </p>
          </div>
        )}

        {/* Nama */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Nama Tenant</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder={
              type === "cabang"   ? "PC IKPM Yogyakarta" :
              type === "marhalah" ? "Angkatan 2005" :
                                    "Forum Bisnis IKPM"
            }
            className={inputCls}
          />
        </div>

        {/* Slug */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Slug</label>
          <div className="flex items-center">
            <span className="rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              jalakarta.com/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required
              placeholder={
                type === "cabang"   ? "pc-ikpm-yogyakarta" :
                type === "marhalah" ? "angkatan-2005" :
                                      "forum-bisnis"
              }
              className="flex-1 rounded-l-none rounded-r-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">Huruf kecil, angka, dan dash saja. Minimal 3 karakter. Tidak bisa diubah.</p>
        </div>

        {/* Marhalah: Tahun + Periode */}
        {type === "marhalah" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Tahun Lulus KMI</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                min={1940}
                max={new Date().getFullYear()}
                placeholder="2005"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Periode <span className="text-muted-foreground text-xs">(opsional)</span>
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={inputCls}
              >
                <option value="">— (tidak ada / semua)</option>
                <option value="awal">1999 Awal</option>
                <option value="akhir">1999 Akhir</option>
              </select>
              <p className="text-xs text-muted-foreground">Hanya untuk angkatan 1999 yang punya dua periode.</p>
            </div>
          </div>
        )}

        {/* Forum/Marhalah: Parent Cabang (UUID tenant) */}
        {(type === "marhalah" || type === "forum") && (
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Cabang Induk <span className="text-muted-foreground text-xs">(opsional)</span>
            </label>
            <input
              type="text"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID tenant cabang (kosongkan jika lintas cabang)"
              className={inputCls + " font-mono text-xs"}
            />
            <p className="text-xs text-muted-foreground">
              {type === "marhalah"
                ? "Jika marhalah ini di bawah satu cabang tertentu, isi UUID tenant cabang tersebut."
                : "Jika forum ini dikelola oleh satu cabang, isi UUID tenant cabang pengelola."}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {pending ? "Membuat..." : "Buat Tenant"}
          </button>
          <Link
            href="/platform/tenants"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
