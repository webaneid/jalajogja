"use client";

import * as React from "react";
import {
  Loader2, Plus, X, CheckCircle2,
  Eye, Pencil, Trash2, ArrowLeft, School,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { TagMultiSelect } from "@/components/ui/tag-multi-select";
import { ECOSYSTEM_TAG_SUGGESTIONS } from "@/lib/ecosystem-tags";
import { PhoneInput } from "@/components/ui/phone-input";
import { displayPhone } from "@/lib/phone";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { SocialMediaInput, type SocialMediaValue, SOCIAL_MEDIA_EMPTY } from "@/components/ui/social-media-input";
import Image from "next/image";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { CoverImageField } from "@/components/media/member-media-picker";

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
  name: string;
  tahunBerdiri: string;   // string untuk input, konversi ke number saat save
  luasArea: string;
  namaPimpinan: string;
  hpPimpinan: string;
  kurikulum: string;
  jenisPondok: string;
  modelPendidikan: string;
  kategoriSantri: string;
  santriPutra: string;
  santriPutri: string;
  asatidz: string;
  asatidzah: string;
  offeredTags: string[];
  neededTags: string[];
  // Kontak
  phone: string; whatsapp: string; email: string;
  isPhonePublic: boolean; isWhatsappPublic: boolean;
  _sameAsPhone: boolean;
  // Alamat
  _addressMode: "indonesia" | "overseas";
  addressCountry: string;
  addressProvinceId: number | null; addressRegencyId: number | null;
  addressDistrictId: number | null; addressVillageId: number | null;
  addressProvinceName: string; addressRegencyName: string;
  addressDistrictName: string; addressVillageName: string;
  addressDetail: string; addressPostalCode: string;
  // Sosmed
  instagram: string; facebook: string; linkedin: string;
  twitter: string; youtube: string; tiktok: string; website: string;
  // Foto
  coverUrl: string | null;
};

type ApiRow = {
  id?: string;
  name?: string;
  tahunBerdiri?: number | null;
  luasArea?: string | null;
  namaPimpinan?: string | null;
  hpPimpinan?: string | null;
  kurikulum?: string | null;
  jenisPondok?: string | null;
  modelPendidikan?: string | null;
  kategoriSantri?: string | null;
  santriPutra?: number | null;
  santriPutri?: number | null;
  asatidz?: number | null;
  asatidzah?: number | null;
  offeredTags?: string[] | null;
  neededTags?: string[] | null;
  phone?: string | null; whatsapp?: string | null; email?: string | null;
  isPhonePublic?: boolean | null; isWhatsappPublic?: boolean | null;
  addressCountry?: string | null;
  addressProvinceId?: number | null; addressRegencyId?: number | null;
  addressDistrictId?: number | null; addressVillageId?: number | null;
  addressProvinceName?: string | null; addressRegencyName?: string | null;
  addressDistrictName?: string | null; addressVillageName?: string | null;
  addressDetail?: string | null; addressPostalCode?: string | null;
  instagram?: string | null; facebook?: string | null; linkedin?: string | null;
  twitter?: string | null; youtube?: string | null; tiktok?: string | null;
  website?: string | null;
  coverUrl?: string | null;
};

// ─── Konstanta ────────────────────────────────────────────────────────────────

const KURIKULUM_OPTS: ComboboxOption[] = [
  { value: "KMI Gontor", label: "KMI Gontor" },
  { value: "DIKNAS",     label: "DIKNAS" },
  { value: "KEMENAG",    label: "KEMENAG" },
  { value: "Salafiah",   label: "Salafiah" },
  { value: "Lainnya",    label: "Lainnya" },
];
const JENIS_PONDOK_OPTS: ComboboxOption[] = [
  { value: "Wakaf",         label: "Wakaf" },
  { value: "Milik Keluarga", label: "Milik Keluarga" },
];
const MODEL_OPTS: ComboboxOption[] = [
  { value: "Murni KMI Gontor",    label: "Murni KMI Gontor" },
  { value: "KMI dan Tahfidz",     label: "KMI dan Tahfidz" },
  { value: "KMI dan Kewirausahaan", label: "KMI dan Kewirausahaan" },
  { value: "Pesantren Salafiah",  label: "Pesantren Salafiah" },
  { value: "Pesantren Tahfidz",   label: "Pesantren Tahfidz" },
  { value: "Sekolah Umum",        label: "Sekolah Umum" },
  { value: "DIKNAS dan Tahfidz",  label: "DIKNAS dan Tahfidz" },
  { value: "KEMENAG dan Tahfidz", label: "KEMENAG dan Tahfidz" },
  { value: "Sekolah Kejuruan",    label: "Sekolah Kejuruan" },
];
const KATEGORI_SANTRI_OPTS: ComboboxOption[] = [
  { value: "Putra",          label: "Putra" },
  { value: "Putra dan Putri", label: "Putra dan Putri" },
  { value: "Putri",          label: "Putri" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(s: string | null | undefined) { return (s ?? "").trim(); }

function newEntry(): Entry {
  return {
    _key: crypto.randomUUID(),
    name: "", tahunBerdiri: "", luasArea: "",
    namaPimpinan: "", hpPimpinan: "",
    kurikulum: "", jenisPondok: "", modelPendidikan: "", kategoriSantri: "",
    santriPutra: "", santriPutri: "", asatidz: "", asatidzah: "",
    offeredTags: [], neededTags: [],
    phone: "", whatsapp: "", email: "",
    isPhonePublic: false, isWhatsappPublic: false, _sameAsPhone: false,
    _addressMode: "indonesia",
    addressCountry: "",
    addressProvinceId: null, addressRegencyId: null,
    addressDistrictId: null, addressVillageId: null,
    addressProvinceName: "", addressRegencyName: "",
    addressDistrictName: "", addressVillageName: "",
    addressDetail: "", addressPostalCode: "",
    instagram: "", facebook: "", linkedin: "",
    twitter: "", youtube: "", tiktok: "", website: "",
    coverUrl: null,
  };
}

function apiRowToEntry(e: ApiRow): Entry {
  const phone    = e.phone    ?? "";
  const whatsapp = e.whatsapp ?? "";
  return {
    _key: crypto.randomUUID(),
    name:         e.name         ?? "",
    tahunBerdiri: e.tahunBerdiri != null ? String(e.tahunBerdiri) : "",
    luasArea:     e.luasArea     ?? "",
    namaPimpinan: e.namaPimpinan ?? "",
    hpPimpinan:   e.hpPimpinan   ?? "",
    kurikulum:       e.kurikulum       ?? "",
    jenisPondok:     e.jenisPondok     ?? "",
    modelPendidikan: e.modelPendidikan ?? "",
    kategoriSantri:  e.kategoriSantri  ?? "",
    santriPutra: e.santriPutra != null ? String(e.santriPutra) : "",
    santriPutri: e.santriPutri != null ? String(e.santriPutri) : "",
    asatidz:     e.asatidz     != null ? String(e.asatidz)     : "",
    asatidzah:   e.asatidzah   != null ? String(e.asatidzah)   : "",
    offeredTags: e.offeredTags ?? [],
    neededTags:  e.neededTags  ?? [],
    phone, whatsapp,
    email:            e.email            ?? "",
    isPhonePublic:    e.isPhonePublic     ?? false,
    isWhatsappPublic: e.isWhatsappPublic  ?? false,
    _sameAsPhone:     !!phone && phone === whatsapp,
    _addressMode:     e.addressCountry ? "overseas" : "indonesia",
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
    instagram: e.instagram ?? "",
    facebook:  e.facebook  ?? "",
    linkedin:  e.linkedin  ?? "",
    twitter:   e.twitter   ?? "",
    youtube:   e.youtube   ?? "",
    tiktok:    e.tiktok    ?? "",
    website:   e.website   ?? "",
    coverUrl:  e.coverUrl  ?? null,
  };
}

function buildPayload(e: Entry) {
  const num = (s: string) => s.trim() !== "" ? Number(s) : undefined;
  return {
    name:         t(e.name),
    tahunBerdiri: num(e.tahunBerdiri),
    luasArea:     t(e.luasArea)     || undefined,
    namaPimpinan: t(e.namaPimpinan) || undefined,
    hpPimpinan:   t(e.hpPimpinan)   || undefined,
    kurikulum:       e.kurikulum       || undefined,
    jenisPondok:     e.jenisPondok     || undefined,
    modelPendidikan: e.modelPendidikan || undefined,
    kategoriSantri:  e.kategoriSantri  || undefined,
    santriPutra: num(e.santriPutra),
    santriPutri: num(e.santriPutri),
    asatidz:     num(e.asatidz),
    asatidzah:   num(e.asatidzah),
    offeredTags: e.offeredTags.length > 0 ? e.offeredTags : undefined,
    neededTags:  e.neededTags.length  > 0 ? e.neededTags  : undefined,
    phone:    t(e.phone)    || undefined,
    whatsapp: e._sameAsPhone ? (t(e.phone) || undefined) : (t(e.whatsapp) || undefined),
    email:    t(e.email)    || undefined,
    isPhonePublic:    e.isPhonePublic,
    isWhatsappPublic: e.isWhatsappPublic,
    addressCountry:    e._addressMode === "overseas" ? (t(e.addressCountry) || undefined) : undefined,
    addressProvinceId: e._addressMode === "indonesia" ? (e.addressProvinceId ?? undefined) : undefined,
    addressRegencyId:  e._addressMode === "indonesia" ? (e.addressRegencyId  ?? undefined) : undefined,
    addressDistrictId: e._addressMode === "indonesia" ? (e.addressDistrictId ?? undefined) : undefined,
    addressVillageId:  e._addressMode === "indonesia" ? (e.addressVillageId  ?? undefined) : undefined,
    addressDetail:     t(e.addressDetail)    || undefined,
    addressPostalCode: t(e.addressPostalCode) || undefined,
    instagram: t(e.instagram) || undefined,
    facebook:  t(e.facebook)  || undefined,
    linkedin:  t(e.linkedin)  || undefined,
    twitter:   t(e.twitter)   || undefined,
    youtube:   t(e.youtube)   || undefined,
    tiktok:    t(e.tiktok)    || undefined,
    website:   t(e.website)   || undefined,
    coverUrl:  e.coverUrl ?? undefined,
  };
}

function autoTotal(a: string, b: string) {
  const na = Number(a) || 0;
  const nb = Number(b) || 0;
  return na + nb > 0 ? na + nb : null;
}

// ─── Sub-komponen: Field ──────────────────────────────────────────────────────

function Field({ label, optional, children }: {
  label: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {optional && <span className="text-muted-foreground font-normal ml-1">(opsional)</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const autoFieldCls = "flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground select-none";

// ─── DetailDialog ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
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

  const totalSantri  = autoTotal(entry.santriPutra, entry.santriPutri);
  const totalAsatidz = autoTotal(entry.asatidz, entry.asatidzah);

  const hasStats   = entry.santriPutra || entry.santriPutri || entry.asatidz || entry.asatidzah;
  const hasKontak  = entry.phone || entry.whatsapp || entry.email;
  const hasAddress = entry.addressCountry || entry.addressProvinceId || entry.addressDetail;
  const socials    = [
    { label: "Instagram", value: entry.instagram },
    { label: "Facebook",  value: entry.facebook  },
    { label: "Twitter/X", value: entry.twitter   },
    { label: "TikTok",    value: entry.tiktok    },
    { label: "LinkedIn",  value: entry.linkedin  },
    { label: "YouTube",   value: entry.youtube   },
    { label: "Website",   value: entry.website   },
  ].filter(s => s.value);

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
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.kurikulum && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.kurikulum}</span>
              )}
              {entry.modelPendidikan && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.modelPendidikan}</span>
              )}
              {entry.kategoriSantri && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.kategoriSantri}</span>
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
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* Identitas */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Berdiri Sejak"  value={entry.tahunBerdiri} />
            <InfoRow label="Luas Area"      value={entry.luasArea} />
            <InfoRow label="Jenis Pondok"   value={entry.jenisPondok} />
          </div>

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

          {/* Pimpinan */}
          {(entry.namaPimpinan || entry.hpPimpinan) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Pimpinan</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Nama Pimpinan"  value={entry.namaPimpinan} />
                <InfoRow label="HP Pimpinan"    value={entry.hpPimpinan ? displayPhone(entry.hpPimpinan) : null} />
              </div>
            </div>
          )}

          {/* Statistik */}
          {hasStats && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Data Pesantren</p>
              <div className="grid grid-cols-3 gap-3">
                <InfoRow label="Santri Putra"  value={entry.santriPutra || undefined} />
                <InfoRow label="Santri Putri"  value={entry.santriPutri || undefined} />
                {totalSantri != null && <InfoRow label="Total Santri"  value={totalSantri} />}
                <InfoRow label="Asatidz"       value={entry.asatidz    || undefined} />
                <InfoRow label="Asatidzah"     value={entry.asatidzah  || undefined} />
                {totalAsatidz != null && <InfoRow label="Total Asatidz" value={totalAsatidz} />}
              </div>
            </div>
          )}

          {/* Kontak */}
          {hasKontak && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Kontak</p>
              <div className="space-y-1">
                {entry.phone    && <p className="text-sm">Telp: {displayPhone(entry.phone)}</p>}
                {entry.whatsapp && entry.whatsapp !== entry.phone && <p className="text-sm">WA: {displayPhone(entry.whatsapp)}</p>}
                {entry.email    && <p className="text-sm">Email: {entry.email}</p>}
              </div>
            </div>
          )}

          {/* Alamat */}
          {hasAddress && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Alamat</p>
              {entry._addressMode === "overseas" ? (
                <div className="space-y-0.5">
                  {entry.addressCountry  && <p className="text-sm">{entry.addressCountry}</p>}
                  {entry.addressDetail   && <p className="text-sm text-muted-foreground">{entry.addressDetail}</p>}
                  {entry.addressPostalCode && <p className="text-sm text-muted-foreground">Kode Pos: {entry.addressPostalCode}</p>}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {entry.addressDetail      && <p className="text-sm text-foreground">{entry.addressDetail}</p>}
                  {entry.addressVillageName  && <p className="text-sm text-muted-foreground">{entry.addressVillageName}</p>}
                  {entry.addressDistrictName && <p className="text-sm text-muted-foreground">{entry.addressDistrictName}</p>}
                  {entry.addressRegencyName  && <p className="text-sm text-muted-foreground">{entry.addressRegencyName}</p>}
                  {entry.addressProvinceName && <p className="text-sm text-muted-foreground">{entry.addressProvinceName}</p>}
                  {entry.addressPostalCode   && <p className="text-sm text-muted-foreground">Kode Pos: {entry.addressPostalCode}</p>}
                </div>
              )}
            </div>
          )}

          {/* Sosmed */}
          {socials.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Sosial Media</p>
              <div className="space-y-1">
                {socials.map(s => (
                  <p key={s.label} className="text-sm">
                    <span className="text-muted-foreground">{s.label}:</span>{" "}{s.value}
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

// ─── EntryEditForm ────────────────────────────────────────────────────────────

function EntryEditForm({ entry, onUpdate, onWilayah, disabled, slug }: {
  entry: Entry;
  onUpdate: (patch: Partial<Entry>) => void;
  onWilayah: (val: WilayahValue) => void;
  disabled: boolean;
  slug: string;
}) {
  const totalSantri  = autoTotal(entry.santriPutra, entry.santriPutri);
  const totalAsatidz = autoTotal(entry.asatidz, entry.asatidzah);

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6">

      {/* ── Foto ── */}
      <CoverImageField
        slug={slug}
        value={entry.coverUrl}
        onChange={(url) => onUpdate({ coverUrl: url })}
        label="Foto Pesantren"
      />

      {/* ── 1. Identitas ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Identitas Pesantren</p>
        <Field label="Nama Pesantren">
          <input className={inputCls} value={entry.name} disabled={disabled}
            onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Nama pesantren" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Berdiri Sejak">
            <input className={inputCls} type="number" min={1800} max={new Date().getFullYear()}
              value={entry.tahunBerdiri} disabled={disabled}
              onChange={e => onUpdate({ tahunBerdiri: e.target.value })}
              placeholder="1985" />
          </Field>
          <Field label="Luas Area">
            <input className={inputCls} value={entry.luasArea} disabled={disabled}
              onChange={e => onUpdate({ luasArea: e.target.value })}
              placeholder="2 hektar" />
          </Field>
        </div>
      </div>

      {/* ── 2. Pimpinan ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Pimpinan</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Pimpinan">
            <input className={inputCls} value={entry.namaPimpinan} disabled={disabled}
              onChange={e => onUpdate({ namaPimpinan: e.target.value })}
              placeholder="KH. Ahmad Fauzi" />
          </Field>
          <div>
            <PhoneInput label="Nomor HP Pimpinan" value={entry.hpPimpinan} optional disabled={disabled}
              onChange={v => onUpdate({ hpPimpinan: v })} />
          </div>
        </div>
      </div>

      {/* ── 3. Klasifikasi ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Klasifikasi</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kurikulum Pendidikan">
            <Combobox options={KURIKULUM_OPTS} value={entry.kurikulum}
              onValueChange={v => onUpdate({ kurikulum: v as string })}
              placeholder="Pilih kurikulum" />
          </Field>
          <Field label="Jenis Pondok">
            <Combobox options={JENIS_PONDOK_OPTS} value={entry.jenisPondok}
              onValueChange={v => onUpdate({ jenisPondok: v as string })}
              placeholder="Pilih jenis pondok" />
          </Field>
          <Field label="Model Pendidikan">
            <Combobox options={MODEL_OPTS} value={entry.modelPendidikan}
              onValueChange={v => onUpdate({ modelPendidikan: v as string })}
              placeholder="Pilih model pendidikan" />
          </Field>
          <Field label="Kategori Santri">
            <Combobox options={KATEGORI_SANTRI_OPTS} value={entry.kategoriSantri}
              onValueChange={v => onUpdate({ kategoriSantri: v as string })}
              placeholder="Pilih kategori santri" />
          </Field>
        </div>
      </div>

      {/* ── 3b. Ekosistem — apa yang ditawarkan/dibutuhkan ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Ekosistem Sinergi</p>
        <div className="space-y-4">
          <Field label="Menawarkan" optional>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.offeredTags}
              onChange={offeredTags => onUpdate({ offeredTags })}
              placeholder="Mis. Kelebihan Lahan, Aula untuk Disewa..."
            />
          </Field>
          <Field label="Membutuhkan" optional>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.neededTags}
              onChange={neededTags => onUpdate({ neededTags })}
              placeholder="Mis. Guru Bahasa Inggris, Pasokan Beras..."
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Membantu sesama anggota menemukan sinergi — mis. tenaga pengajar, pengadaan, atau
          pemanfaatan aset.
        </p>
      </div>

      {/* ── 4. Data Pesantren (Statistik) ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Data Pesantren</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Santri Putra" optional>
            <input className={inputCls} type="number" min={0} value={entry.santriPutra}
              onChange={e => onUpdate({ santriPutra: e.target.value })} disabled={disabled}
              placeholder="0" />
          </Field>
          <Field label="Santri Putri" optional>
            <input className={inputCls} type="number" min={0} value={entry.santriPutri}
              onChange={e => onUpdate({ santriPutri: e.target.value })} disabled={disabled}
              placeholder="0" />
          </Field>
          <Field label="Total Santri">
            <div className={autoFieldCls}>
              {totalSantri != null ? totalSantri : "—"}
            </div>
          </Field>
          <Field label="Asatidz" optional>
            <input className={inputCls} type="number" min={0} value={entry.asatidz}
              onChange={e => onUpdate({ asatidz: e.target.value })} disabled={disabled}
              placeholder="0" />
          </Field>
          <Field label="Asatidzah" optional>
            <input className={inputCls} type="number" min={0} value={entry.asatidzah}
              onChange={e => onUpdate({ asatidzah: e.target.value })} disabled={disabled}
              placeholder="0" />
          </Field>
          <Field label="Total Asatidz">
            <div className={autoFieldCls}>
              {totalAsatidz != null ? totalAsatidz : "—"}
            </div>
          </Field>
        </div>
      </div>

      {/* ── 5. Kontak ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Kontak Pesantren</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <PhoneInput label="Telepon" value={entry.phone} disabled={disabled}
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
          <div className="sm:col-span-2">
            <Field label="Email" optional>
              <input className={inputCls} type="email" value={entry.email}
                onChange={ev => onUpdate({ email: ev.target.value })}
                placeholder="pesantren@email.com" />
            </Field>
          </div>
        </div>
      </div>

      {/* ── 6. Alamat ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Alamat Pesantren</p>
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
            defaultValue={{
              provinceId: entry.addressProvinceId ?? undefined,
              regencyId:  entry.addressRegencyId  ?? undefined,
              districtId: entry.addressDistrictId ?? undefined,
              villageId:  entry.addressVillageId  ?? undefined,
            }}
            onChange={onWilayah} disabled={disabled} tenantSlug={slug} />
        ) : (
          <Field label="Negara" optional>
            <input className={inputCls} value={entry.addressCountry} disabled={disabled}
              onChange={e => onUpdate({ addressCountry: e.target.value })}
              placeholder="Malaysia, Arab Saudi, Mesir..." />
          </Field>
        )}
        <Field label="Detail Alamat" optional>
          <textarea className={`${inputCls} h-16 resize-none py-2`} value={entry.addressDetail}
            onChange={e => onUpdate({ addressDetail: e.target.value })} disabled={disabled}
            placeholder="Nama jalan, nomor, RT/RW, dusun..." rows={2} />
        </Field>
        <div className="max-w-[160px]">
          <Field label="Kode Pos" optional>
            <input className={inputCls} value={entry.addressPostalCode} disabled={disabled}
              onChange={e => onUpdate({ addressPostalCode: e.target.value })}
              placeholder="55283" maxLength={10} inputMode="numeric" />
          </Field>
        </div>
      </div>

      {/* ── 7. Sosial Media ── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Sosial Media</p>
        <SocialMediaInput
          value={{
            instagram: entry.instagram, facebook: entry.facebook,
            linkedin: entry.linkedin,   twitter: entry.twitter,
            youtube: entry.youtube,     tiktok: entry.tiktok,
            website: entry.website,
          }}
          onChange={(v: SocialMediaValue) => onUpdate({
            instagram: v.instagram, facebook: v.facebook,
            linkedin: v.linkedin,   twitter: v.twitter,
            youtube: v.youtube,     tiktok: v.tiktok,
            website: v.website,
          })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ─── Main: PesantrenClient ────────────────────────────────────────────────────

export function PesantrenClient({ slug, baseUrl }: { slug: string; baseUrl: string }) {
  const [entries,      setEntries]      = React.useState<Entry[]>([]);
  const [loading,      setLoading]      = React.useState(true);
  const [saving,       setSaving]       = React.useState(false);
  const [error,        setError]        = React.useState<string | null>(null);
  const [savedMsg,     setSavedMsg]     = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<Entry | null>(null);
  const [isNew,        setIsNew]        = React.useState(false);
  const [detailKey,    setDetailKey]    = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/akun/member-pesantren")
      .then(r => r.json())
      .then((d: { data?: ApiRow[] }) => {
        if (d.data && d.data.length > 0) setEntries(d.data.map(apiRowToEntry));
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

  async function saveEditing() {
    if (!editingEntry) return;
    if (!t(editingEntry.name))             { setError("Nama pesantren wajib diisi."); return; }
    if (!t(editingEntry.tahunBerdiri))     { setError("Berdiri sejak (tahun) wajib diisi."); return; }
    if (!t(editingEntry.luasArea))         { setError("Luas area wajib diisi."); return; }
    if (!t(editingEntry.namaPimpinan))     { setError("Nama pimpinan wajib diisi."); return; }
    if (!editingEntry.kurikulum)           { setError("Kurikulum pendidikan wajib dipilih."); return; }
    if (!editingEntry.jenisPondok)         { setError("Jenis pondok wajib dipilih."); return; }
    if (!editingEntry.modelPendidikan)     { setError("Model pendidikan wajib dipilih."); return; }
    if (!editingEntry.kategoriSantri)      { setError("Kategori santri wajib dipilih."); return; }
    if (!t(editingEntry.phone))            { setError("Nomor telepon wajib diisi."); return; }
    const waOk = editingEntry._sameAsPhone ? !!t(editingEntry.phone) : !!t(editingEntry.whatsapp);
    if (!waOk)                             { setError("Nomor WhatsApp wajib diisi."); return; }
    setError(null);
    setSaving(true);
    const updated = entries.map(en => en._key === editingEntry._key ? editingEntry : en);
    try {
      const res = await fetch("/api/akun/member-pesantren", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries: updated.map(buildPayload) }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      setEntries(updated);
      setEditingEntry(null);
      setIsNew(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(key: string) {
    if (!confirm("Hapus data pesantren ini?")) return;
    const updated = entries.filter(e => e._key !== key);
    setSaving(true);
    try {
      const res = await fetch("/api/akun/member-pesantren", {
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Edit view ──────────────────────────────────────────────────────────────

  if (editingEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={cancelEdit}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-3.5" />
            Data Pesantren
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">
            {isNew ? "Tambah Pesantren" : (t(editingEntry.name) || "Edit Pesantren")}
          </span>
        </div>

        <EntryEditForm
          key={editingEntry._key}
          entry={editingEntry}
          onUpdate={patch => setEditingEntry(prev => prev ? { ...prev, ...patch } : null)}
          onWilayah={val => setEditingEntry(prev => prev ? {
            ...prev,
            addressProvinceId: val.provinceId ?? null,
            addressRegencyId:  val.regencyId  ?? null,
            addressDistrictId: val.districtId ?? null,
            addressVillageId:  val.villageId  ?? null,
          } : null)}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Simpan
          </button>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Data pesantren berhasil disimpan.
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Nama Pesantren</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">Kurikulum</th>
                <th className="px-4 py-3 text-left font-medium text-foreground hidden md:table-cell">Model</th>
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
                          <ImageWithFallback src={thumbUrl(e.coverUrl)} alt={e.name} fill sizes="40px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <School className="size-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{e.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                          {[e.kurikulum, e.modelPendidikan].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.kurikulum || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{e.modelPendidikan || "—"}</td>
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
          <School className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Belum ada data pesantren</p>
          <p className="text-xs text-muted-foreground mt-1">Tambahkan pesantren yang Anda kelola atau pimpin.</p>
        </div>
      )}

      <button onClick={handleAdd} disabled={saving}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center disabled:opacity-50">
        <Plus className="h-4 w-4" />
        Tambah Pesantren
      </button>

      <a href={`${baseUrl}/akun`}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
        <ArrowLeft className="size-4" />
        Kembali ke Dashboard
      </a>

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
