"use server";

import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { createTenantDb, upsertSettings } from "@jalajogja/db";
import { revalidatePath } from "next/cache";
import type { TaxonomyOverrides } from "@/lib/taxonomy-overrides";
import type { EkosistemModuleLabels } from "@/lib/ekosistem-modules";

type ActionResult = { error?: string };

// Toggle Usaha/Pesantren/Profesional — dipindah dari saveGeneralSettingsAction (settings/
// actions.ts) ke sini saat modul Ekosistem dibangun (2026-08-07, docs/arsitektur-ekosistem.md
// § 9). Guard write sama persis SEBELUM dipindah (canManageUsers) — level akses TIDAK berubah,
// cuma lokasinya. Group storage juga pindah "general" → "ekosistem" (migration 0061) — HANYA
// 3 key ini yang ditulis, `upsertSettings()` upsert per-key (bukan replace seluruh group),
// jadi aman tidak menyentuh key lain sama sekali.
export async function saveEkosistemModulesAction(
  slug: string,
  values: {
    usahaEnabled:       boolean;
    pesantrenEnabled:   boolean;
    profesionalEnabled: boolean;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "ekosistem", {
    usaha_enabled:       values.usahaEnabled,
    pesantren_enabled:   values.pesantrenEnabled,
    profesional_enabled: values.profesionalEnabled,
  });

  // Toggle ini menentukan apa yang tampil di /gabung, /akun (overlay eligibility), direktori
  // publik (/usaha, /pesantren, /profesional), dan section builder landing page — revalidate
  // path admin (halaman ini sendiri) cukup untuk UI form, path publik ikut cache Next.js normal
  // (revalidate:60 di masing-masing halaman publik yang sudah ada).
  revalidatePath(`/app/${slug}/ekosistem/pengaturan`);

  return {};
}

// Label custom nama modul (Usaha/Pesantren/Profesional) — TERPISAH dari toggle enable/disable
// di atas (key settings beda: "module_labels" vs "usaha_enabled" dkk), sengaja SATU form+action
// di halaman yang SAMA (/ekosistem/pengaturan) karena secara UX kedua hal ini ("aktif atau
// tidak" + "namanya apa") memang dikonfigurasi bersamaan oleh admin yang sama.
export async function saveEkosistemModuleLabelsAction(
  slug: string,
  labels: EkosistemModuleLabels,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "ekosistem", { module_labels: labels });

  revalidatePath(`/app/${slug}/ekosistem/pengaturan`);

  return {};
}

// Override label Kategori/Sektor/Bidang Usaha + toggle enable Sektor + Bidang Usaha custom
// tenant. Sub-halaman kedua modul Ekosistem — docs/arsitektur-ekosistem.md § 10. Objek
// `overrides` ditulis APA ADANYA (tidak divalidasi field-per-field di sini) — form client
// yang bertanggung jawab hanya mengirim shape yang valid; server ini murni penyimpanan.
export async function saveTaxonomyOverridesAction(
  slug: string,
  overrides: TaxonomyOverrides,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "ekosistem", {
    taxonomy_overrides: overrides,
  });

  // Revalidate halaman admin ini sendiri saja — halaman publik/self-service yang membaca
  // override ini sudah ISR-cached (revalidate:60) seperti pola lain di project ini, tidak
  // perlu revalidate manual per halaman.
  revalidatePath(`/app/${slug}/ekosistem/taksonomi`);

  return {};
}
