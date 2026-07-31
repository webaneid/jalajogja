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
