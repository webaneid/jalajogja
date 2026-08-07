// Override label per-tenant untuk Kategori/Sektor/Bidang Usaha Usaha + toggle enable/disable
// per Sektor + Bidang Usaha custom tambahan tenant. Dibangun 2026-08-07, detail arsitektur
// lengkap: docs/arsitektur-ekosistem.md § 10.
//
// PRINSIP KUNCI (dikonfirmasi eksplisit user, "perubahan hanya di label"): fungsi di sini
// TIDAK PERNAH mengubah nilai (value) yang tersimpan di member_businesses.category/.sector/
// .businessFields[] — HANYA teks LABEL yang ditampilkan. member_businesses adalah data GLOBAL
// (public schema), kalau nilai literal ikut berubah per tenant, filter/pencarian lintas-tenant
// (Fase 2 Ekosistem, JSONB containment match) akan pecah. Lihat docs/arsitektur-ekosistem.md
// § 10.1-10.2 untuk rasionalisasi lengkap.
//
// ZERO import dari @jalajogja/db — aman dipakai client maupun server, sama seperti
// lib/business-sectors.ts / lib/business-form-options.ts.

import {
  BUSINESS_CATEGORY_ENUM, type BusinessCategory, CATEGORY_COMBOBOX_OPTIONS,
} from "@/lib/business-form-options";
import {
  BUSINESS_SECTOR_ENUM, type BusinessSector, SECTOR_COMBOBOX_OPTIONS,
  getPrioritizedBusinessFields, getStrictBusinessFields,
} from "@/lib/business-sectors";

export type TaxonomyOverrides = {
  // Nama FIELD itu sendiri (judul "Kategori"/"Sektor"/"Bidang Usaha" di form) — BEDA dari
  // categoryLabels/sectorLabels/businessFieldLabels di bawah (yang override label per-ITEM di
  // dalam field). Default kosong = pakai nama bawaan. § 10.9.
  fieldLabels?: {
    category?:       string; // default "Kategori"
    sector?:         string; // default "Sektor"
    businessFields?: string; // default "Bidang Usaha"
  };
  categoryLabels?:       Partial<Record<BusinessCategory, string>>;
  // default true — key absen di object berarti kategori itu AKTIF (backward-compat penuh)
  categoryEnabled?:      Partial<Record<BusinessCategory, boolean>>;
  sectorLabels?:         Partial<Record<BusinessSector, string>>;
  // default true — key absen di object berarti sektor itu AKTIF (backward-compat penuh)
  sectorEnabled?:        Partial<Record<BusinessSector, boolean>>;
  // Sektor tambahan milik tenant, DI LUAR 10 kanonik (2026-08-07, § 10.10) — string bebas,
  // langsung jadi value+label sekaligus (sama pola customBusinessFields). Bukan hard-locked
  // sub-set: begitu ditambahkan, sektor ini bisa dipilih di picker Sektor DAN sebagai induk
  // untuk "Tambah Bidang Usaha Baru" (kunci customBusinessFields di bawah karena itu jadi
  // `string`, bukan cuma BusinessSector).
  customSectors?:        string[];
  // keyed by nilai kanonik Bidang Usaha — HANYA dipakai untuk tampilan display, TIDAK PERNAH
  // di picker TagMultiSelect (lihat docs/arsitektur-ekosistem.md § 10.2 untuk alasan teknisnya)
  businessFieldLabels?:  Record<string, string>;
  // Bidang Usaha tambahan milik tenant, dikelompokkan PER SEKTOR (2026-08-07, § 10.9) — MIRROR
  // struktur SECTOR_SUB_FIELDS (lib/business-sectors.ts): sektor di sini murni untuk
  // PRIORITASI saran (sama seperti Tier-3 kanonik), BUKAN kepemilikan eksklusif — item custom
  // untuk sektor X tetap muncul (di posisi lebih bawah) saat sektor lain dipilih. Nilai
  // (`string`) tetap facet independen di level DATA member (member_businesses.businessFields),
  // hanya PENGELOMPOKAN SARAN yang jadi hirarkis-lunak, konsisten prinsip § 2-3
  // docs/arsitektur-usaha.md. Key TIDAK dibatasi `BusinessSector` lagi (§ 10.10) — sektor
  // custom tenant boleh jadi induk juga.
  customBusinessFields?: Partial<Record<string, string[]>>;
};

export const EMPTY_TAXONOMY_OVERRIDES: TaxonomyOverrides = {};

const DEFAULT_FIELD_LABELS = {
  category:       "Kategori",
  sector:         "Sektor",
  businessFields: "Bidang Usaha",
} as const;

// Nama FIELD itu sendiri — bukan label item di dalamnya. Dipakai di JUDUL field manapun form
// Usaha menampilkan "Kategori"/"Sektor"/"Bidang Usaha" (label input, heading section, filter
// placeholder "Semua X"). § 10.9.
export function resolveFieldLabel(
  field: "category" | "sector" | "businessFields",
  overrides: TaxonomyOverrides,
): string {
  return overrides.fieldLabels?.[field] || DEFAULT_FIELD_LABELS[field];
}

// ── Kategori ─────────────────────────────────────────────────────────────────

export function resolveCategoryLabel(
  value: string | null | undefined,
  overrides: TaxonomyOverrides,
): string {
  if (!value) return "";
  return overrides.categoryLabels?.[value as BusinessCategory] || value;
}

// Untuk PICKER — sama persis resolveSectorOptions (§ di bawah): kategori yang di-disable admin
// tidak ditawarkan lagi sebagai opsi baru, tapi entri LAMA yang sudah pakai kategori itu tetap
// disisipkan balik via `currentValue` supaya Combobox tidak blank.
export function resolveCategoryOptions(overrides: TaxonomyOverrides, currentValue?: string | null) {
  const opts = CATEGORY_COMBOBOX_OPTIONS
    .filter((o) => overrides.categoryEnabled?.[o.value] !== false)
    .map((o) => ({
      value: o.value,
      label: overrides.categoryLabels?.[o.value] || o.label,
    }));

  if (currentValue && !opts.some((o) => o.value === currentValue)) {
    const canonical = CATEGORY_COMBOBOX_OPTIONS.find((o) => o.value === currentValue);
    if (canonical) {
      opts.push({
        value: canonical.value,
        label: overrides.categoryLabels?.[canonical.value] || canonical.label,
      });
    }
  }

  return opts;
}

// ── Sektor ────────────────────────────────────────────────────────────────────

export function resolveSectorLabel(
  value: string | null | undefined,
  overrides: TaxonomyOverrides,
): string {
  if (!value) return "";
  return overrides.sectorLabels?.[value as BusinessSector] || value;
}

// Untuk PICKER — sektor yang di-disable admin tidak ditawarkan lagi sebagai opsi baru.
// Entri LAMA yang sudah pakai sektor itu TIDAK terpengaruh (resolveSectorLabel tetap jalan
// untuk value apa pun, terlepas enabled/disabled).
//
// Sekarang ikut menggabungkan Sektor CUSTOM tenant (§ 10.10, `overrides.customSectors`) —
// string bebas, value=label (tidak ada override label terpisah untuk sektor custom — nama yang
// diketik admin sudah jadi tampilan finalnya, ganti dengan hapus+tambah ulang).
//
// `currentValue` opsional: kalau diisi dan sektor itu ternyata sudah di-disable admin ATAU
// custom sector yang sudah dihapus tenant, tetap disertakan di hasil — supaya Combobox tidak
// "blank" (kehilangan seleksi) untuk data lama. Tanpa ini, entri usaha yang sektornya kebetulan
// baru dinonaktifkan/dihapus admin akan tampil seolah belum pilih sektor sama sekali saat form
// edit dibuka — melanggar janji "usaha yang sudah pakai sektor itu tetap tampil normal".
export function resolveSectorOptions(overrides: TaxonomyOverrides, currentValue?: string | null) {
  const canonicalOpts = SECTOR_COMBOBOX_OPTIONS
    .filter((o) => overrides.sectorEnabled?.[o.value] !== false)
    .map((o) => ({
      value: o.value,
      label: overrides.sectorLabels?.[o.value] || o.label,
    }));

  const customOpts = (overrides.customSectors ?? [])
    .filter((v) => !SECTOR_COMBOBOX_OPTIONS.some((o) => o.value === v))
    .map((v) => ({ value: v, label: v }));

  const opts = [...canonicalOpts, ...customOpts];

  if (currentValue && !opts.some((o) => o.value === currentValue)) {
    const canonical = SECTOR_COMBOBOX_OPTIONS.find((o) => o.value === currentValue);
    opts.push(canonical
      ? { value: canonical.value, label: overrides.sectorLabels?.[canonical.value] || canonical.label }
      : { value: currentValue, label: currentValue });
  }

  return opts;
}

// ── Bidang Usaha ──────────────────────────────────────────────────────────────

export function resolveBusinessFieldLabel(
  value: string | null | undefined,
  overrides: TaxonomyOverrides,
): string {
  if (!value) return "";
  return overrides.businessFieldLabels?.[value] || value;
}

// Untuk PICKER (TagMultiSelect) mode PENCARIAN (searchOptions) — gabung daftar kanonik
// (soft-prioritized per sektor) dengan Bidang Usaha custom tenant, JUGA soft-prioritized per
// sektor (§ 10.9 — customBusinessFields sekarang Partial<Record<BusinessSector,string[]>>,
// mirror SECTOR_SUB_FIELDS). Item custom milik sektor terpilih didahulukan, item custom milik
// sektor LAIN tetap ada di posisi belakang (non-exclusive, sama seperti kanonik) — TIDAK PERNAH
// hilang total. TIDAK menerapkan businessFieldLabels di sini — TagMultiSelect cuma terima
// string[] polos (value=label sekaligus), lihat § 10.2 kenapa override picker untuk Bidang
// Usaha sengaja tidak didukung.
export function resolveBusinessFieldSuggestions(
  sector: string | null | undefined,
  overrides: TaxonomyOverrides,
): string[] {
  const canonicalPrioritized = getPrioritizedBusinessFields(sector);
  const customMap = overrides.customBusinessFields ?? {};
  const currentSectorCustom = (sector && customMap[sector]) || [];
  const otherSectorCustom = Object.entries(customMap)
    .filter(([s]) => s !== sector)
    .flatMap(([, items]) => items ?? []);
  return Array.from(new Set([...currentSectorCustom, ...canonicalPrioritized, ...otherSectorCustom]));
}

// Untuk PICKER (TagMultiSelect/Combobox) mode IDLE (options) — HANYA item milik sektor
// terpilih (kanonik Tier-3 sektor itu + custom Bidang Usaha khusus sektor itu), TIDAK
// menyertakan sektor lain sama sekali (§ 2026-08-07 susulan — beda dari soft-prioritize di
// atas yang tetap menyertakan SEMUA sektor). Dipasangkan sebagai `options` bersama
// resolveBusinessFieldSuggestions() (union penuh) sebagai `searchOptions` — begitu user
// mengetik untuk mencari, seluruh sektor lain tetap bisa ditemukan; SEBELUM mengetik, dropdown
// tidak "bocor" item sektor lain. Kalau sektor belum dipilih, fallback ke union penuh (tidak
// ada yang bisa dibatasi tanpa sektor).
export function resolveBusinessFieldSuggestionsStrict(
  sector: string | null | undefined,
  overrides: TaxonomyOverrides,
): string[] {
  if (!sector) return resolveBusinessFieldSuggestions(sector, overrides);
  const canonicalForSector = getStrictBusinessFields(sector);
  const customForSector = overrides.customBusinessFields?.[sector] ?? [];
  return Array.from(new Set([...canonicalForSector, ...customForSector]));
}

// Re-export enum untuk konsumen yang cuma butuh daftar mentah (mis. form pengaturan taksonomi
// yang perlu iterasi SEMUA 5 Kategori / 10 Sektor apa pun status enabled-nya).
export { BUSINESS_CATEGORY_ENUM, BUSINESS_SECTOR_ENUM };
export type { BusinessCategory, BusinessSector };
