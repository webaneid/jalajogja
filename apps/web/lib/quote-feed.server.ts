import "server-only";
import { eq, and, inArray, count } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { db as publicDb, tenants, tenantMemberships } from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import type { QuoteSectionData } from "./quote-section-designs";

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export type QuoteFeedResult = {
  memberCount:      number;
  orgName:          string;
  lastUpdateText:   string;
  defaultStatLabel: string;
  defaultCtaLabel:  string;
  defaultCtaUrl:    string;
};

/**
 * Resolver Server-Side untuk Section Quote & Impact Counter.
 * - Membaca jumlah anggota RIIL tenant ini dari `public.tenant_memberships`.
 * - Membaca nama organisasi secara dinamis via `getTenantSeoBase`.
 * - Meng-generate teks bulan & tahun update real-time saat halaman diakses.
 */
export async function resolveQuoteData(
  _tenantClient: TenantDb,
  tenantSlug: string,
  _data: QuoteSectionData,
): Promise<QuoteFeedResult> {
  const { siteName: orgName } = await getTenantSeoBase(tenantSlug);

  const now = new Date();
  const monthName = INDONESIAN_MONTHS[now.getMonth()];
  const yearNum = now.getFullYear();
  const lastUpdateText = `Berdasarkan data bulan ${monthName} ${yearNum}`;

  const [tenantRow] = await publicDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  let memberCount = 0;

  if (tenantRow) {
    const [countResult] = await publicDb
      .select({ total: count() })
      .from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.tenantId, tenantRow.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ));

    memberCount = Number(countResult?.total ?? 0);
  }

  const defaultStatLabel = `Anggota terdaftar di ekosistem ${orgName}`;
  const defaultCtaLabel = `Direktori ${orgName}`;
  const defaultCtaUrl = `/${tenantSlug}/anggota`;

  return {
    memberCount,
    orgName,
    lastUpdateText,
    defaultStatLabel,
    defaultCtaLabel,
    defaultCtaUrl,
  };
}
