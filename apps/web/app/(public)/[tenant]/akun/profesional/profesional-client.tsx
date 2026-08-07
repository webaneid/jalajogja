"use client";

import * as React from "react";
import Image from "next/image";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import {
  Loader2, Plus, X, CheckCircle2,
  Eye, Pencil, Trash2, ArrowLeft, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ProfessionTypeCombobox } from "@/components/ui/profession-type-combobox";
import { TagMultiSelect } from "@/components/ui/tag-multi-select";
import { ECOSYSTEM_TAG_SUGGESTIONS } from "@/lib/ecosystem-tags";
import { PhoneInput } from "@/components/ui/phone-input";
import { displayPhone } from "@/lib/phone";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { SocialMediaInput, type SocialMediaValue } from "@/components/ui/social-media-input";
import { CoverImageField } from "@/components/media/member-media-picker";
import {
  PROFESSION_CATEGORIES, PROFESSION_TYPES_BY_CATEGORY, EMPLOYMENT_TYPES,
  type ProfessionCategory,
} from "@/lib/professional-types";

// Pure, client-safe — JANGAN import dari lib/image-processor.ts (bawa `sharp`, Node-only,
// merusak bundle client). Sama persis logika getVariantUrl() untuk swap suffix "_th".
function thumbUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.endsWith(".svg") || url.startsWith("data:")) return url;
  return url.replace(/_(ori|lg|md|th|sq|sql|pf)\.webp$/, "_th.webp");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  _key: string;
  title: string; professionCategory: string; professionType: string;
  specialization: string; description: string;
  offeredTags: string[]; neededTags: string[];
  licenseType: string; licenseNumber: string;
  employmentType: string; institution: string; startYear: string;
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
  isEmailPublic:    boolean;
  _sameAsPhone:     boolean;
  coverUrl:         string | null;
};

type ApiRow = {
  title?: string; professionCategory?: string; professionType?: string;
  specialization?: string; description?: string;
  offeredTags?: string[]; neededTags?: string[];
  licenseType?: string; licenseNumber?: string;
  employmentType?: string; institution?: string; startYear?: number;
  addressCountry?: string;
  addressProvinceId?: number; addressRegencyId?: number;
  addressDistrictId?: number; addressVillageId?: number;
  addressProvinceName?: string | null; addressRegencyName?: string | null;
  addressDistrictName?: string | null; addressVillageName?: string | null;
  addressDetail?: string; addressPostalCode?: string;
  phone?: string; whatsapp?: string; email?: string;
  isPhonePublic?: boolean; isWhatsappPublic?: boolean; isEmailPublic?: boolean;
  instagram?: string; facebook?: string; linkedin?: string;
  twitter?: string; youtube?: string; tiktok?: string; website?: string;
  coverUrl?: string | null;
};

// ─── Konstanta ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: ComboboxOption[] = PROFESSION_CATEGORIES.map(c => ({ value: c, label: c }));
const EMPLOYMENT_OPTIONS: ComboboxOption[] = EMPLOYMENT_TYPES.map(t => ({ value: t, label: t }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newEntry(): Entry {
  return {
    _key: crypto.randomUUID(),
    title: "", professionCategory: "", professionType: "",
    specialization: "", description: "",
    offeredTags: [], neededTags: [],
    licenseType: "", licenseNumber: "",
    employmentType: "", institution: "", startYear: "",
    _addressMode: "indonesia",
    addressCountry: "", addressProvinceId: null,
    addressRegencyId: null, addressDistrictId: null, addressVillageId: null,
    addressProvinceName: "", addressRegencyName: "",
    addressDistrictName: "", addressVillageName: "",
    addressDetail: "", addressPostalCode: "",
    phone: "", whatsapp: "", email: "",
    instagram: "", facebook: "", linkedin: "", twitter: "", youtube: "", tiktok: "", website: "",
    isPhonePublic: false, isWhatsappPublic: false, isEmailPublic: false, _sameAsPhone: false,
    coverUrl: null,
  };
}

function trim(s: string | undefined | null) { return (s ?? "").trim(); }

function apiRowToEntry(e: ApiRow): Entry {
  const phone    = e.phone    ?? "";
  const whatsapp = e.whatsapp ?? "";
  return {
    _key:               crypto.randomUUID(),
    title:              e.title              ?? "",
    professionCategory: e.professionCategory  ?? "",
    professionType:     e.professionType      ?? "",
    specialization:     e.specialization      ?? "",
    description:        e.description         ?? "",
    offeredTags:        e.offeredTags ?? [],
    neededTags:         e.neededTags  ?? [],
    licenseType:        e.licenseType         ?? "",
    licenseNumber:      e.licenseNumber       ?? "",
    employmentType:     e.employmentType      ?? "",
    institution:        e.institution         ?? "",
    startYear:          e.startYear != null ? String(e.startYear) : "",
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
    isEmailPublic:    e.isEmailPublic    ?? false,
    _sameAsPhone:     !!phone && phone === whatsapp,
    coverUrl:         e.coverUrl ?? null,
  };
}

function buildPayload(e: Entry) {
  return {
    title:              trim(e.title) || undefined,
    professionCategory: e.professionCategory,
    professionType:     trim(e.professionType),
    specialization:     trim(e.specialization) || undefined,
    description:        trim(e.description)    || undefined,
    offeredTags:        e.offeredTags.length > 0 ? e.offeredTags : undefined,
    neededTags:         e.neededTags.length  > 0 ? e.neededTags  : undefined,
    licenseType:        trim(e.licenseType)     || undefined,
    licenseNumber:      trim(e.licenseNumber)   || undefined,
    employmentType:     e.employmentType || undefined,
    institution:        trim(e.institution)     || undefined,
    startYear:          e.startYear ? parseInt(e.startYear, 10) : undefined,
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
    isEmailPublic:     e.isEmailPublic,
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
  const displayName = [entry.title, entry.professionType].filter(Boolean).join(" — ") || "Data Profesional";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl bg-background border border-border shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">{displayName}</h3>
            {entry.specialization && <p className="text-sm text-muted-foreground mt-0.5">{entry.specialization}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.professionCategory && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.professionCategory}</span>
              )}
              {entry.employmentType && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.employmentType}</span>
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
            <Image src={entry.coverUrl} alt={displayName} fill sizes="512px" className="object-cover" />
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[55vh] overflow-y-auto">
          {entry.description && (
            <InfoRow label="Deskripsi" value={entry.description} />
          )}

          {/* Ekosistem — apa yang ditawarkan/dibutuhkan */}
          {(entry.offeredTags.length > 0 || entry.neededTags.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Ekosistem Sinergi</p>
              <div className="space-y-2">
                {entry.offeredTags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Menawarkan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.offeredTags.map(t => (
                        <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {entry.neededTags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Membutuhkan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.neededTags.map(t => (
                        <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kredensial */}
          {(entry.licenseType || entry.licenseNumber) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Kredensial</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Jenis Izin"  value={entry.licenseType}   />
                <InfoRow label="Nomor Izin"  value={entry.licenseNumber} />
              </div>
            </div>
          )}

          {/* Konteks Kerja */}
          {(entry.institution || entry.startYear) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Konteks Kerja</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Institusi / Tempat Praktik" value={entry.institution} />
                <InfoRow label="Mulai Berkarir"              value={entry.startYear}  />
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
                {entry.phone    && <p className="text-sm">Telp: {displayPhone(entry.phone)}</p>}
                {entry.whatsapp && entry.whatsapp !== entry.phone && <p className="text-sm">WA: {displayPhone(entry.whatsapp)}</p>}
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
  const typeOptions = entry.professionCategory
    ? (PROFESSION_TYPES_BY_CATEGORY[entry.professionCategory as ProfessionCategory] ?? [])
    : [];

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6">

      {/* ── Foto ── */}
      <CoverImageField
        slug={slug}
        value={entry.coverUrl}
        onChange={(url) => onUpdate({ coverUrl: url })}
        label="Foto Profil"
      />

      {/* ── Identitas Profesional ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Identitas Profesional</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Gelar" optional>
            <input className={inputCls} value={entry.title} disabled={disabled}
              onChange={e => onUpdate({ title: e.target.value })}
              placeholder="dr., Ir., dll" />
          </Field>
          <Field label="Kategori Profesi">
            <Combobox options={CATEGORY_OPTIONS} value={entry.professionCategory}
              onValueChange={v => onUpdate({ professionCategory: v as string, professionType: "" })}
              placeholder="Pilih kategori" />
          </Field>
        </div>
        <Field label="Jenis Profesi">
          <ProfessionTypeCombobox
            options={typeOptions}
            value={entry.professionType}
            onChange={v => onUpdate({ professionType: v })}
            disabled={disabled || !entry.professionCategory}
            placeholder={entry.professionCategory ? "Pilih atau ketik jenis profesi..." : "Pilih kategori dulu"}
          />
        </Field>
        <Field label="Spesialisasi" optional>
          <input className={inputCls} value={entry.specialization} disabled={disabled}
            onChange={e => onUpdate({ specialization: e.target.value })}
            placeholder="Contoh: Spesialis Anak (Sp.A), Litigasi Perdata" />
        </Field>
        <Field label="Deskripsi / Bio">
          <textarea className={`${inputCls} h-16 resize-none py-2`} value={entry.description}
            onChange={e => onUpdate({ description: e.target.value })} disabled={disabled}
            placeholder="Layanan yang ditawarkan, pengalaman singkat..." rows={2} />
        </Field>
        <div className="space-y-4">
          <Field label="Menawarkan" optional>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.offeredTags}
              onChange={offeredTags => onUpdate({ offeredTags })}
              disabled={disabled}
              placeholder="Jasa konkret yang bisa dikerjakan..."
            />
          </Field>
          <Field label="Membutuhkan" optional>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.neededTags}
              onChange={neededTags => onUpdate({ neededTags })}
              disabled={disabled}
              placeholder="Proyek/klien yang sedang dicari..."
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Membantu sesama anggota menemukan sinergi — boleh lebih spesifik dari jenis profesi
          di atas.
        </p>
      </div>

      {/* ── Kredensial ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Kredensial</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Jenis Izin" optional>
            <input className={inputCls} value={entry.licenseType} disabled={disabled}
              onChange={e => onUpdate({ licenseType: e.target.value })}
              placeholder="STR, No. Advokat PERADI, dll" />
          </Field>
          <Field label="Nomor Izin" optional>
            <input className={inputCls} value={entry.licenseNumber} disabled={disabled}
              onChange={e => onUpdate({ licenseNumber: e.target.value })}
              placeholder="Nomor izin praktik" />
          </Field>
        </div>
      </div>

      {/* ── Konteks Kerja ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Konteks Kerja</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Status Kerja" optional>
            <Combobox options={EMPLOYMENT_OPTIONS} value={entry.employmentType}
              onValueChange={v => onUpdate({ employmentType: v as string })}
              placeholder="Pilih status kerja" />
          </Field>
          <Field label="Tahun Mulai Berkarir">
            <input className={inputCls} type="number" value={entry.startYear} disabled={disabled}
              onChange={e => onUpdate({ startYear: e.target.value })}
              placeholder="2015" min={1950} max={2100} />
          </Field>
        </div>
        <Field label="Institusi / Tempat Praktik" optional>
          <input className={inputCls} value={entry.institution} disabled={disabled}
            onChange={e => onUpdate({ institution: e.target.value })}
            placeholder="RSUD dr. Sardjito, Firma Hukum ABC, Freelance, dll" />
        </Field>
      </div>

      {/* ── Alamat ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Alamat Praktik</p>
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
        <p className="text-sm font-semibold text-muted-foreground">Kontak</p>
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
            <PhoneInput label="WhatsApp"
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
          <div className="sm:col-span-2 space-y-1.5">
            <Field label="Email" optional>
              <input className={inputCls} type="email" value={entry.email}
                onChange={ev => onUpdate({ email: ev.target.value })}
                placeholder="nama@email.com" />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" checked={entry.isEmailPublic}
                onChange={ev => onUpdate({ isEmailPublic: ev.target.checked })}
                className="rounded border-input accent-primary" />
              Publik
            </label>
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

// ─── Main: ProfesionalClient ────────────────────────────────────────────────────

export function ProfesionalClient({ slug, baseUrl, moduleLabel }: { slug: string; baseUrl: string; moduleLabel: string }) {
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
    fetch("/api/akun/member-professional")
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
    if (!e.professionCategory)   { setError("Kategori profesi wajib dipilih.");        return; }
    if (!trim(e.professionType)) { setError("Jenis profesi wajib diisi.");             return; }
    if (!trim(e.description))    { setError("Deskripsi / bio profesional wajib diisi."); return; }
    if (!trim(e.startYear))      { setError("Tahun mulai berkarir wajib diisi.");      return; }
    if (e._addressMode === "indonesia") {
      if (!e.addressProvinceId || !e.addressRegencyId || !e.addressDistrictId) {
        setError("Alamat praktik wajib diisi minimal sampai tingkat Kecamatan."); return;
      }
    } else {
      if (!trim(e.addressCountry)) {
        setError("Negara alamat praktik wajib diisi."); return;
      }
    }
    const wa = e._sameAsPhone ? e.phone : e.whatsapp;
    if (!trim(wa))               { setError("Nomor WhatsApp wajib diisi.");           return; }

    setError(null);
    setSaving(true);
    const updatedEntries = entries.map(en => en._key === e._key ? e : en);
    try {
      const res = await fetch("/api/akun/member-professional", {
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
    if (!confirm("Hapus data profesional ini?")) return;
    const updated = entries.filter(e => e._key !== key);
    setSaving(true);
    try {
      const res = await fetch("/api/akun/member-professional", {
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
    const displayLabel = [editingEntry.title, editingEntry.professionType].filter(Boolean).join(" ") || `Data ${moduleLabel}`;
    return (
      <div className="space-y-6">
        {/* Breadcrumb-style back */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={cancelEdit}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-3.5" />
            Data {moduleLabel}
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">
            {isNew ? `Tambah Data ${moduleLabel}` : displayLabel}
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
          Data {moduleLabel.toLowerCase()} berhasil disimpan.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Table / empty state */}
      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Profesi</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">Kategori</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">Institusi</th>
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
                          <ImageWithFallback src={thumbUrl(e.coverUrl)} alt={e.professionType} fill sizes="40px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Briefcase className="size-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {[e.title, e.professionType].filter(Boolean).join(" ") || "—"}
                        </p>
                        {e.specialization && <p className="text-xs text-muted-foreground">{e.specialization}</p>}
                        <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                          {[e.professionCategory, e.institution].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.professionCategory}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.institution || "—"}</td>
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
          <Briefcase className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Belum ada data {moduleLabel.toLowerCase()}</p>
          <p className="text-xs text-muted-foreground mt-1">Tambahkan profesi Anda (dokter, pengacara, konsultan, dll).</p>
        </div>
      )}

      {/* Tambah button */}
      <button onClick={handleAdd} disabled={saving}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center disabled:opacity-50">
        <Plus className="h-4 w-4" />
        Tambah Data {moduleLabel}
      </button>

      {/* Back to dashboard */}
      <a href={`${baseUrl}/akun`}
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
