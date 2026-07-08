"use client";

import * as React from "react";
import Image from "next/image";
import {
  Loader2, Plus, X, CheckCircle2,
  Eye, Pencil, Trash2, ArrowLeft, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { SocialMediaInput, type SocialMediaValue } from "@/components/ui/social-media-input";
import { CoverImageField } from "@/components/media/member-media-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  _key: string;
  name: string; brand: string; description: string;
  category: string; sector: string; legality: string;
  position: string; employees: string; branches: string; revenue: string;
  _addressMode:       "indonesia" | "overseas";
  addressCountry:     string;
  addressProvinceId:  number | null;
  addressRegencyId:   number | null;
  addressDistrictId:  number | null;
  addressVillageId:   number | null;
  addressProvinceName: string;
  addressRegencyName:  string;
  addressDistrictName: string;
  addressVillageName:  string;
  addressDetail:      string;
  addressPostalCode:  string;
  phone: string; whatsapp: string; email: string;
  instagram: string; facebook: string; linkedin: string;
  twitter: string; youtube: string; tiktok: string; website: string;
  isPhonePublic:    boolean;
  isWhatsappPublic: boolean;
  _sameAsPhone:     boolean;
  coverUrl:         string | null;
};

type ApiRow = {
  name?: string; brand?: string; description?: string;
  category?: string; sector?: string; legality?: string; position?: string;
  employees?: string; branches?: string; revenue?: string;
  addressCountry?: string;
  addressProvinceId?: number; addressRegencyId?: number;
  addressDistrictId?: number; addressVillageId?: number;
  addressProvinceName?: string | null; addressRegencyName?: string | null;
  addressDistrictName?: string | null; addressVillageName?: string | null;
  addressDetail?: string; addressPostalCode?: string;
  phone?: string; whatsapp?: string; email?: string;
  isPhonePublic?: boolean; isWhatsappPublic?: boolean;
  instagram?: string; facebook?: string; linkedin?: string;
  twitter?: string; youtube?: string; tiktok?: string; website?: string;
  coverUrl?: string | null;
};

// ─── Konstanta ────────────────────────────────────────────────────────────────

const CATEGORIES: ComboboxOption[] = [
  { value: "Jasa",        label: "Jasa" },
  { value: "Produsen",    label: "Produsen" },
  { value: "Distributor", label: "Distributor" },
  { value: "Trading",     label: "Trading" },
  { value: "Profesional", label: "Profesional" },
];
const SECTORS: ComboboxOption[] = [
  { value: "Teknologi",              label: "Teknologi" },
  { value: "Jasa Profesional",       label: "Jasa Profesional" },
  { value: "Kreatif",                label: "Kreatif" },
  { value: "Manufaktur",             label: "Manufaktur" },
  { value: "Kesehatan & Pendidikan", label: "Kesehatan & Pendidikan" },
  { value: "Konsumsi & Ritel",       label: "Konsumsi & Ritel" },
  { value: "Sumber Daya Alam",       label: "Sumber Daya Alam" },
];
const LEGALITIES: ComboboxOption[] = [
  { value: "PT Perseorangan",          label: "PT Perseorangan" },
  { value: "PT",                       label: "PT" },
  { value: "CV",                       label: "CV" },
  { value: "Yayasan",                  label: "Yayasan" },
  { value: "Perkumpulan",              label: "Perkumpulan" },
  { value: "Koperasi",                 label: "Koperasi" },
  { value: "Belum Memiliki Legalitas", label: "Belum Memiliki Legalitas" },
];
const POSITIONS: ComboboxOption[] = [
  { value: "Komisaris", label: "Komisaris" },
  { value: "Direktur",  label: "Direktur" },
  { value: "Pengelola", label: "Pengelola" },
  { value: "Manajer",   label: "Manajer" },
];
const EMPLOYEES: ComboboxOption[] = [
  { value: "1-4",           label: "1–4 orang" },
  { value: "5-10",          label: "5–10 orang" },
  { value: "11-20",         label: "11–20 orang" },
  { value: "Lebih dari 20", label: "Lebih dari 20" },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newEntry(): Entry {
  return {
    _key: crypto.randomUUID(), name: "", brand: "", description: "",
    category: "", sector: "", legality: "", position: "",
    employees: "", branches: "", revenue: "",
    _addressMode: "indonesia",
    addressCountry: "", addressProvinceId: null,
    addressRegencyId: null, addressDistrictId: null, addressVillageId: null,
    addressProvinceName: "", addressRegencyName: "",
    addressDistrictName: "", addressVillageName: "",
    addressDetail: "", addressPostalCode: "",
    phone: "", whatsapp: "", email: "",
    instagram: "", facebook: "", linkedin: "", twitter: "", youtube: "", tiktok: "", website: "",
    isPhonePublic: false, isWhatsappPublic: false, _sameAsPhone: false,
    coverUrl: null,
  };
}

function trim(s: string | undefined | null) { return (s ?? "").trim(); }

function apiRowToEntry(e: ApiRow): Entry {
  const phone    = e.phone    ?? "";
  const whatsapp = e.whatsapp ?? "";
  return {
    _key:              crypto.randomUUID(),
    name:              e.name        ?? "",
    brand:             e.brand       ?? "",
    description:       e.description ?? "",
    category:          e.category    ?? "",
    sector:            e.sector      ?? "",
    legality:          e.legality    ?? "",
    position:          e.position    ?? "",
    employees:         e.employees   ?? "",
    branches:          e.branches    ?? "",
    revenue:           e.revenue     ?? "",
    _addressMode:      (e.addressCountry ? "overseas" : "indonesia") as "indonesia" | "overseas",
    addressCountry:    e.addressCountry    ?? "",
    addressProvinceId: e.addressProvinceId ?? null,
    addressRegencyId:  e.addressRegencyId  ?? null,
    addressDistrictId: e.addressDistrictId ?? null,
    addressVillageId:  e.addressVillageId  ?? null,
    addressProvinceName: e.addressProvinceName ?? "",
    addressRegencyName:  e.addressRegencyName  ?? "",
    addressDistrictName: e.addressDistrictName ?? "",
    addressVillageName:  e.addressVillageName  ?? "",
    addressDetail:     e.addressDetail     ?? "",
    addressPostalCode: e.addressPostalCode ?? "",
    phone, whatsapp,
    email:            e.email       ?? "",
    instagram:        e.instagram   ?? "",
    facebook:         e.facebook    ?? "",
    linkedin:         e.linkedin    ?? "",
    twitter:          e.twitter     ?? "",
    youtube:          e.youtube     ?? "",
    tiktok:           e.tiktok      ?? "",
    website:          e.website     ?? "",
    isPhonePublic:    e.isPhonePublic    ?? false,
    isWhatsappPublic: e.isWhatsappPublic ?? false,
    _sameAsPhone:     !!phone && phone === whatsapp,
    coverUrl:         e.coverUrl ?? null,
  };
}

function buildPayload(e: Entry) {
  return {
    name:              trim(e.name),
    brand:             trim(e.brand)        || undefined,
    description:       trim(e.description)  || undefined,
    category:          e.category,
    sector:            e.sector,
    legality:          e.legality  || undefined,
    position:          e.position  || undefined,
    employees:         e.employees || undefined,
    branches:          e.branches  || undefined,
    revenue:           e.revenue   || undefined,
    addressCountry:    e._addressMode === "overseas" ? (trim(e.addressCountry) || undefined) : undefined,
    addressProvinceId: e._addressMode === "indonesia" ? (e.addressProvinceId ?? undefined) : undefined,
    addressRegencyId:  e._addressMode === "indonesia" ? (e.addressRegencyId  ?? undefined) : undefined,
    addressDistrictId: e._addressMode === "indonesia" ? (e.addressDistrictId ?? undefined) : undefined,
    addressVillageId:  e._addressMode === "indonesia" ? (e.addressVillageId  ?? undefined) : undefined,
    addressDetail:     trim(e.addressDetail)    || undefined,
    addressPostalCode: trim(e.addressPostalCode) || undefined,
    phone:             trim(e.phone)    || undefined,
    whatsapp:          e._sameAsPhone ? (trim(e.phone) || undefined) : (trim(e.whatsapp) || undefined),
    email:             trim(e.email)   || undefined,
    isPhonePublic:     e.isPhonePublic,
    isWhatsappPublic:  e.isWhatsappPublic,
    instagram: trim(e.instagram) || undefined,
    facebook:  trim(e.facebook)  || undefined,
    linkedin:  trim(e.linkedin)  || undefined,
    twitter:   trim(e.twitter)   || undefined,
    youtube:   trim(e.youtube)   || undefined,
    tiktok:    trim(e.tiktok)    || undefined,
    website:   trim(e.website)   || undefined,
    coverUrl:  e.coverUrl ?? undefined,
  };
}

// ─── Sub-komponen: Field ──────────────────────────────────────────────────────

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

// ─── Sub-komponen: Detail Dialog ──────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function DetailDialog({ entry, onClose, onEdit }: {
  entry: Entry; onClose: () => void; onEdit: () => void;
}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const socials = [
    { label: "Instagram", value: entry.instagram },
    { label: "Facebook",  value: entry.facebook  },
    { label: "Twitter/X", value: entry.twitter   },
    { label: "TikTok",    value: entry.tiktok    },
    { label: "LinkedIn",  value: entry.linkedin  },
    { label: "YouTube",   value: entry.youtube   },
    { label: "Website",   value: entry.website   },
  ].filter(s => s.value);

  const hasAddress = entry.addressCountry || entry.addressProvinceId ||
    entry.addressDetail || entry.addressPostalCode;
  const hasContact = entry.phone || entry.whatsapp || entry.email;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl bg-background border border-border shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">{entry.name}</h3>
            {entry.brand && <p className="text-sm text-muted-foreground mt-0.5">{entry.brand}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.category && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.category}</span>
              )}
              {entry.sector && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.sector}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="size-4" />
          </button>
        </div>

        {/* Foto */}
        {entry.coverUrl && (
          <div className="relative h-48 w-full overflow-hidden rounded-none">
            <Image src={entry.coverUrl} alt={entry.name} fill sizes="512px" className="object-cover" />
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[55vh] overflow-y-auto">
          {entry.description && (
            <InfoRow label="Deskripsi" value={entry.description} />
          )}

          {/* Klasifikasi */}
          {(entry.legality || entry.position || entry.employees || entry.branches || entry.revenue) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Klasifikasi & Skala</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Legalitas"     value={entry.legality}  />
                <InfoRow label="Posisi"         value={entry.position}  />
                <InfoRow label="Karyawan"       value={entry.employees} />
                <InfoRow label="Cabang"         value={entry.branches}  />
                <InfoRow label="Omzet / Tahun"  value={entry.revenue}   />
              </div>
            </div>
          )}

          {/* Alamat */}
          {hasAddress && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Alamat</p>
              {entry._addressMode === "overseas" ? (
                <div className="space-y-0.5">
                  {entry.addressCountry && <p className="text-sm text-foreground">{entry.addressCountry}</p>}
                  {entry.addressDetail  && <p className="text-sm text-muted-foreground">{entry.addressDetail}</p>}
                  {entry.addressPostalCode && <p className="text-sm text-muted-foreground">Kode Pos: {entry.addressPostalCode}</p>}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {entry.addressDetail && <p className="text-sm text-foreground">{entry.addressDetail}</p>}
                  {entry.addressVillageName  && <p className="text-sm text-muted-foreground">{entry.addressVillageName}</p>}
                  {entry.addressDistrictName && <p className="text-sm text-muted-foreground">{entry.addressDistrictName}</p>}
                  {entry.addressRegencyName  && <p className="text-sm text-muted-foreground">{entry.addressRegencyName}</p>}
                  {entry.addressProvinceName && <p className="text-sm text-muted-foreground">{entry.addressProvinceName}</p>}
                  {entry.addressPostalCode   && <p className="text-sm text-muted-foreground">Kode Pos: {entry.addressPostalCode}</p>}
                </div>
              )}
            </div>
          )}

          {/* Kontak */}
          {hasContact && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Kontak</p>
              <div className="space-y-1">
                {entry.phone    && <p className="text-sm">Telp: {entry.phone}</p>}
                {entry.whatsapp && entry.whatsapp !== entry.phone && <p className="text-sm">WA: {entry.whatsapp}</p>}
                {entry.email    && <p className="text-sm">Email: {entry.email}</p>}
              </div>
            </div>
          )}

          {/* Sosmed */}
          {socials.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Sosial Media</p>
              <div className="space-y-1">
                {socials.map(s => (
                  <p key={s.label} className="text-sm">
                    <span className="text-muted-foreground">{s.label}:</span>{" "}
                    {s.value}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            Tutup
          </button>
          <button onClick={onEdit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-komponen: Form Edit ──────────────────────────────────────────────────

function EntryEditForm({ entry, onUpdate, onWilayah, disabled, slug }: {
  entry: Entry;
  onUpdate: (patch: Partial<Entry>) => void;
  onWilayah: (val: WilayahValue) => void;
  disabled: boolean;
  slug: string;
}) {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6">

      {/* ── Foto ── */}
      <CoverImageField
        slug={slug}
        value={entry.coverUrl}
        onChange={(url) => onUpdate({ coverUrl: url })}
        label="Foto Usaha"
      />

      {/* ── Identitas ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Identitas Usaha</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Usaha">
            <input className={inputCls} value={entry.name} disabled={disabled}
              onChange={e => onUpdate({ name: e.target.value })}
              placeholder="Nama legal usaha" />
          </Field>
          <Field label="Merek / Brand" optional>
            <input className={inputCls} value={entry.brand} disabled={disabled}
              onChange={e => onUpdate({ brand: e.target.value })}
              placeholder="Nama merek jika berbeda" />
          </Field>
        </div>
        <Field label="Deskripsi" optional>
          <textarea className={`${inputCls} h-16 resize-none py-2`} value={entry.description}
            onChange={e => onUpdate({ description: e.target.value })} disabled={disabled}
            placeholder="Produk atau layanan yang ditawarkan..." rows={2} />
        </Field>
      </div>

      {/* ── Klasifikasi ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Klasifikasi</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kategori">
            <Combobox options={CATEGORIES} value={entry.category}
              onValueChange={v => onUpdate({ category: v as string })}
              placeholder="Pilih kategori" />
          </Field>
          <Field label="Sektor">
            <Combobox options={SECTORS} value={entry.sector}
              onValueChange={v => onUpdate({ sector: v as string })}
              placeholder="Pilih sektor" />
          </Field>
          <Field label="Legalitas" optional>
            <Combobox options={LEGALITIES} value={entry.legality}
              onValueChange={v => onUpdate({ legality: v as string })}
              placeholder="Pilih legalitas" />
          </Field>
          <Field label="Posisi / Jabatan" optional>
            <Combobox options={POSITIONS} value={entry.position}
              onValueChange={v => onUpdate({ position: v as string })}
              placeholder="Pilih posisi" />
          </Field>
        </div>
      </div>

      {/* ── Skala ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Skala Usaha</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Karyawan" optional>
            <Combobox options={EMPLOYEES} value={entry.employees}
              onValueChange={v => onUpdate({ employees: v as string })}
              placeholder="Jumlah karyawan" />
          </Field>
          <Field label="Cabang" optional>
            <Combobox options={BRANCHES} value={entry.branches}
              onValueChange={v => onUpdate({ branches: v as string })}
              placeholder="Jumlah cabang" />
          </Field>
          <Field label="Omzet / Tahun" optional>
            <Combobox options={REVENUES} value={entry.revenue}
              onValueChange={v => onUpdate({ revenue: v as string })}
              placeholder="Kisaran omzet" />
          </Field>
        </div>
      </div>

      {/* ── Alamat ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Alamat Usaha</p>
        <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
          <button type="button" disabled={disabled}
            onClick={() => onUpdate({ _addressMode: "indonesia", addressCountry: "" })}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              entry._addressMode === "indonesia"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")}>
            Indonesia
          </button>
          <button type="button" disabled={disabled}
            onClick={() => onUpdate({ _addressMode: "overseas", addressProvinceId: null, addressRegencyId: null, addressDistrictId: null, addressVillageId: null })}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              entry._addressMode === "overseas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")}>
            Luar Negeri
          </button>
        </div>

        {entry._addressMode === "indonesia" ? (
          <WilayahSelect
            key={entry._key}
            defaultValue={{
              provinceId: entry.addressProvinceId ?? undefined,
              regencyId:  entry.addressRegencyId  ?? undefined,
              districtId: entry.addressDistrictId ?? undefined,
              villageId:  entry.addressVillageId  ?? undefined,
            }}
            onChange={onWilayah}
            disabled={disabled}
            tenantSlug={slug}
          />
        ) : (
          <Field label="Negara" optional>
            <input className={inputCls} value={entry.addressCountry} disabled={disabled}
              onChange={e => onUpdate({ addressCountry: e.target.value })}
              placeholder="Contoh: Malaysia, Arab Saudi, Jepang" />
          </Field>
        )}

        <Field label="Detail Alamat" optional>
          <textarea className={`${inputCls} h-16 resize-none py-2`} value={entry.addressDetail}
            onChange={e => onUpdate({ addressDetail: e.target.value })} disabled={disabled}
            placeholder="Nama jalan, nomor, RT/RW, gedung, lantai..." rows={2} />
        </Field>
        <div className="max-w-[160px]">
          <Field label="Kode Pos" optional>
            <input className={inputCls} value={entry.addressPostalCode} disabled={disabled}
              onChange={e => onUpdate({ addressPostalCode: e.target.value })}
              placeholder="55283" maxLength={10} inputMode="numeric" />
          </Field>
        </div>
      </div>

      {/* ── Kontak ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Kontak Usaha</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <PhoneInput label="Telepon" value={entry.phone} optional
              onChange={v => onUpdate({ phone: v, ...(entry._sameAsPhone && { whatsapp: v }) })} />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" checked={entry.isPhonePublic}
                onChange={ev => onUpdate({ isPhonePublic: ev.target.checked })}
                className="rounded border-input accent-primary" />
              Publik
            </label>
          </div>
          <div className="space-y-1.5">
            <PhoneInput label="WhatsApp" optional
              value={entry._sameAsPhone ? entry.phone : entry.whatsapp}
              onChange={v => { if (!entry._sameAsPhone) onUpdate({ whatsapp: v }); }}
              disabled={entry._sameAsPhone} />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" checked={entry._sameAsPhone}
                onChange={ev => onUpdate({ _sameAsPhone: ev.target.checked, ...(ev.target.checked && { whatsapp: entry.phone }) })}
                className="rounded border-input accent-primary" />
              Sama dengan nomor telepon
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" checked={entry.isWhatsappPublic}
                onChange={ev => onUpdate({ isWhatsappPublic: ev.target.checked })}
                className="rounded border-input accent-primary" />
              Publik
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Email" optional>
              <input className={inputCls} type="email" value={entry.email}
                onChange={ev => onUpdate({ email: ev.target.value })}
                placeholder="usaha@email.com" />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Sosial Media ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Sosial Media</p>
        <SocialMediaInput
          value={{
            instagram: entry.instagram, facebook: entry.facebook,
            linkedin: entry.linkedin, twitter: entry.twitter,
            youtube: entry.youtube, tiktok: entry.tiktok, website: entry.website,
          }}
          onChange={(v: SocialMediaValue) => onUpdate({
            instagram: v.instagram, facebook: v.facebook,
            linkedin: v.linkedin,  twitter: v.twitter,
            youtube: v.youtube,    tiktok: v.tiktok, website: v.website,
          })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ─── Main: UsahaClient ────────────────────────────────────────────────────────

export function UsahaClient({ slug }: { slug: string }) {
  const [entries,     setEntries]     = React.useState<Entry[]>([]);
  const [loading,     setLoading]     = React.useState(true);
  const [saving,      setSaving]      = React.useState(false);
  const [error,       setError]       = React.useState<string | null>(null);
  const [savedMsg,    setSavedMsg]    = React.useState(false);

  // View state
  const [editingEntry, setEditingEntry] = React.useState<Entry | null>(null);
  const [isNew,        setIsNew]        = React.useState(false);
  const [detailKey,    setDetailKey]    = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/akun/member-business")
      .then(r => r.json())
      .then((d: { data?: ApiRow[] }) => {
        if (d.data && d.data.length > 0) {
          setEntries(d.data.map(apiRowToEntry));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const detailEntry = detailKey ? (entries.find(e => e._key === detailKey) ?? null) : null;

  function startEdit(e: Entry, isNewEntry = false) {
    setEditingEntry({ ...e });
    setIsNew(isNewEntry);
    setDetailKey(null);
    setError(null);
  }

  function handleAdd() {
    const e = newEntry();
    setEntries(prev => [...prev, e]);
    startEdit(e, true);
  }

  function cancelEdit() {
    if (isNew && editingEntry) {
      setEntries(prev => prev.filter(e => e._key !== editingEntry._key));
    }
    setEditingEntry(null);
    setIsNew(false);
    setError(null);
  }

  function updateEditing(patch: Partial<Entry>) {
    setEditingEntry(prev => prev ? { ...prev, ...patch } : null);
  }

  async function saveEditing() {
    if (!editingEntry) return;
    const e = editingEntry;
    if (!trim(e.name))     { setError("Nama usaha wajib diisi.");        return; }
    if (!e.category)       { setError("Kategori wajib dipilih.");         return; }
    if (!e.sector)         { setError("Sektor wajib dipilih.");           return; }

    setError(null);
    setSaving(true);
    const updatedEntries = entries.map(en => en._key === e._key ? e : en);
    try {
      const res = await fetch("/api/akun/member-business", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries: updatedEntries.map(buildPayload) }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      setEntries(updatedEntries);
      setEditingEntry(null);
      setIsNew(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(key: string) {
    if (!confirm("Hapus data usaha ini?")) return;
    const updated = entries.filter(e => e._key !== key);
    setSaving(true);
    try {
      const res = await fetch("/api/akun/member-business", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries: updated.map(buildPayload) }),
      });
      if (!res.ok) { setError("Gagal menghapus."); return; }
      setEntries(updated);
      if (detailKey === key) setDetailKey(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Edit view ─────────────────────────────────────────────────────────────────

  if (editingEntry) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb-style back */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={cancelEdit}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-3.5" />
            Data Usaha
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">
            {isNew ? "Tambah Usaha" : (trim(editingEntry.name) || "Edit Usaha")}
          </span>
        </div>

        <EntryEditForm
          key={editingEntry._key}
          entry={editingEntry}
          onUpdate={updateEditing}
          onWilayah={val => updateEditing({
            addressProvinceId: val.provinceId ?? null,
            addressRegencyId:  val.regencyId  ?? null,
            addressDistrictId: val.districtId ?? null,
            addressVillageId:  val.villageId  ?? null,
          })}
          disabled={saving}
          slug={slug}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button onClick={cancelEdit}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            Batal
          </button>
          <button onClick={saveEditing} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4" />}
            Simpan
          </button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Data usaha berhasil disimpan.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Table / empty state */}
      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Nama Usaha</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">Kategori</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">Sektor</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(e => (
                <tr key={e._key} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {e.coverUrl ? (
                        <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 border border-border">
                          <Image src={e.coverUrl} alt={e.name} fill sizes="40px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="size-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{e.name}</p>
                        {e.brand && <p className="text-xs text-muted-foreground">{e.brand}</p>}
                        <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                          {[e.category, e.sector].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.category}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.sector}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetailKey(e._key)} title="Detail"
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Eye className="size-4" />
                      </button>
                      <button onClick={() => startEdit(e)} title="Edit"
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => { void deleteEntry(e._key); }} title="Hapus" disabled={saving}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Building2 className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Belum ada data usaha</p>
          <p className="text-xs text-muted-foreground mt-1">Tambahkan usaha atau bisnis yang Anda kelola.</p>
        </div>
      )}

      {/* Tambah button */}
      <button onClick={handleAdd} disabled={saving}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center disabled:opacity-50">
        <Plus className="h-4 w-4" />
        Tambah Usaha
      </button>

      {/* Back to dashboard */}
      <a href="../"
        className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
        <ArrowLeft className="size-4" />
        Kembali ke Dashboard
      </a>

      {/* Detail dialog */}
      {detailEntry && (
        <DetailDialog
          entry={detailEntry}
          onClose={() => setDetailKey(null)}
          onEdit={() => startEdit(detailEntry)}
        />
      )}
    </div>
  );
}
