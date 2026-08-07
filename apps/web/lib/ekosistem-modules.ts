// Toggle per-tenant untuk 3 modul ekosistem (Usaha/Pesantren/Profesional). Murni gerbang
// visibilitas front-end — data member (public.member_businesses/member_owned_pesantren/
// member_professionals) TIDAK PERNAH dihapus/dibatasi, cuma tidak ditawarkan/ditampilkan di
// konteks tenant yang mematikannya. Lihat docs/arsitektur-ekosistem.md untuk arsitektur penuh.
//
// File ini PURE (zero import dari @jalajogja/db) — aman dipakai client component
// (AkunNav, AkunBottomNav, DirectoryChoicePopover). Fungsi yang butuh DB (fetch settings)
// ada di ekosistem-modules.server.ts.

export type EkosistemModule = "usaha" | "pesantren" | "profesional";

export const ALL_EKOSISTEM_MODULES: EkosistemModule[] = ["usaha", "pesantren", "profesional"];

export type EkosistemModulesConfig = Record<EkosistemModule, boolean>;

/**
 * Resolve config dari settings object yang SUDAH di-fetch caller (getSettings(tenantDb,
 * "general")). Pure — tidak fetch apa pun sendiri. Default `true` (aktif) kalau key belum
 * pernah diisi tenant — backward-compatible untuk semua tenant existing.
 */
export function resolveEkosistemModulesConfig(raw: Record<string, unknown>): EkosistemModulesConfig {
  return {
    usaha:       raw.usaha_enabled       !== false,
    pesantren:   raw.pesantren_enabled   !== false,
    profesional: raw.profesional_enabled !== false,
  };
}

export function enabledModuleList(config: EkosistemModulesConfig): EkosistemModule[] {
  return ALL_EKOSISTEM_MODULES.filter((m) => config[m]);
}

// Label tampilan DEFAULT per modul — dipakai overlay eligibility + halaman /gabung untuk pesan
// spesifik ("Lengkapi Data Usaha Anda"), bukan cuma daftar generik "Usaha/Pesantren/Profesional".
// Bisa di-override per-tenant (2026-08-07) — lihat resolveEkosistemModuleLabel() di bawah.
export const EKOSISTEM_MODULE_LABELS: Record<EkosistemModule, string> = {
  usaha:       "Usaha",
  pesantren:   "Pesantren",
  profesional: "Profesional",
};

// Override label per-tenant untuk nama MODUL itu sendiri (2026-08-07) — BEDA dari
// TaxonomyOverrides.fieldLabels (docs/arsitektur-ekosistem.md § 10.9, yang cuma untuk field
// DI DALAM form Usaha: Kategori/Sektor/Bidang Usaha). Ini untuk 3 modul sendiri: "Usaha"/
// "Pesantren"/"Profesional" — nama yang tampil di nav, dashboard, arsip publik, dst. Disimpan
// di settings key `module_labels` group "ekosistem" (sama group dengan toggle enable/disable,
// key TERPISAH — bukan direplace ke config boolean). Partial: key absen = pakai default.
export type EkosistemModuleLabels = Partial<Record<EkosistemModule, string>>;

/**
 * Resolve label satu modul dari overrides — fallback ke default kalau kosong/tidak diisi.
 * Pure, dipakai client maupun server (sama seperti resolveEkosistemModulesConfig).
 */
export function resolveEkosistemModuleLabel(
  module: EkosistemModule,
  overrides: EkosistemModuleLabels,
): string {
  return overrides[module] || EKOSISTEM_MODULE_LABELS[module];
}

/**
 * Resolve dari settings object yang SUDAH di-fetch caller (getSettings(tenantDb, "ekosistem")).
 * Pure — tidak fetch apa pun sendiri. `raw.module_labels` diharapkan JSONB
 * Partial<Record<EkosistemModule,string>>, tapi tidak dipercaya buta (guard tipe per-key).
 */
export function resolveEkosistemModuleLabels(raw: Record<string, unknown>): EkosistemModuleLabels {
  const stored = (raw.module_labels ?? {}) as Record<string, unknown>;
  const result: EkosistemModuleLabels = {};
  for (const m of ALL_EKOSISTEM_MODULES) {
    const v = stored[m];
    if (typeof v === "string" && v.trim()) result[m] = v.trim();
  }
  return result;
}
