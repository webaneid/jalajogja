// Label organisasi dinamis untuk halaman register — menyesuaikan copy
// "Anggota IKPM Gontor" statis agar sesuai tipe tenant (cabang/marhalah/forum).

export type TenantOrgInfo = {
  name:           string;
  tenantType:     "cabang" | "marhalah" | "forum";
  marhalahYear:   number | null;
  marhalahPeriod: "awal" | "akhir" | null;
};

export type OrgLabels = {
  memberLabel:          string;  // judul pilihan jalur "anggota"
  memberDescription:    string;  // subtitle jalur "anggota"
  nonMemberLabel:       string;  // judul pilihan jalur "bukan anggota"
  nonMemberDescription: string;  // subtitle jalur "bukan anggota"
};

export function resolveOrgLabels(tenant: TenantOrgInfo): OrgLabels {
  const nonMemberDescription = "Saya masyarakat umum yang ingin menggunakan layanan ini";

  if (tenant.tenantType === "marhalah" && tenant.marhalahYear) {
    const periodSuffix = tenant.marhalahYear === 1999 && tenant.marhalahPeriod
      ? ` (${tenant.marhalahPeriod === "awal" ? "Awal" : "Akhir"})`
      : "";
    const angkatanLabel = `Angkatan ${tenant.marhalahYear}${periodSuffix}`;
    return {
      memberLabel:          `Anggota ${angkatanLabel}`,
      memberDescription:    `Saya alumni Pondok Modern Gontor ${angkatanLabel} / anggota IKPM`,
      nonMemberLabel:       "Bukan Anggota IKPM",
      nonMemberDescription,
    };
  }

  if (tenant.tenantType === "forum") {
    return {
      memberLabel:          `Anggota ${tenant.name}`,
      memberDescription:    "Saya alumni Pondok Modern Gontor / anggota IKPM",
      nonMemberLabel:       "Bukan Anggota",
      nonMemberDescription,
    };
  }

  // Default: cabang
  return {
    memberLabel:          `Anggota ${tenant.name}`,
    memberDescription:    "Saya alumni Pondok Modern Gontor / anggota IKPM",
    nonMemberLabel:       "Bukan Anggota IKPM",
    nonMemberDescription,
  };
}
