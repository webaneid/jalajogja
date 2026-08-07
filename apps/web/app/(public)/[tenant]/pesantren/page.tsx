import { notFound }   from "next/navigation";
import { eq, and, inArray, ilike, count, sql } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberOwnedPesantren, addresses, refProvinces, refRegencies,
  createTenantDb,
} from "@jalajogja/db";
import Link      from "next/link";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import type { Metadata } from "next";
import { School, MapPin } from "lucide-react";
import { PublicButton }   from "@/components/website/public/ui/public-button";
import { PesantrenFiltersClient } from "@/components/pesantren/pesantren-filters-client";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getVariantUrl } from "@/lib/image-processor";
import { getEnabledEkosistemModules, getEkosistemModuleLabels } from "@/lib/ekosistem-modules.server";
import { resolveEkosistemModuleLabel } from "@/lib/ekosistem-modules";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{
  q?: string; provinsi?: string; kurikulum?: string;
  model?: string; kategori?: string; page?: string;
  tag?: string; arah?: string;
}>;

const KURIKULUM_OPTIONS = ["KMI Gontor", "DIKNAS", "KEMENAG", "Salafiah", "Lainnya"] as const;
const MODEL_OPTIONS = [
  "Murni KMI Gontor", "KMI dan Tahfidz", "KMI dan Kewirausahaan",
  "Pesantren Salafiah", "Pesantren Tahfidz", "Sekolah Umum",
  "DIKNAS dan Tahfidz", "KEMENAG dan Tahfidz", "Sekolah Kejuruan",
] as const;
const KATEGORI_OPTIONS = ["Putra", "Putra dan Putri", "Putri"] as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "pesantren-archive");
  return buildMetadata({
    title:         override?.metaTitle || "Direktori Pesantren",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/pesantren`,
    robots:        override?.robots || undefined,
  });
}

export default async function PesantrenDirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug } = await params;
  const { q, provinsi, kurikulum, model, kategori, page: pageParam, tag, arah } = await searchParams;

  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset      = (currentPage - 1) * PAGE_SIZE;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  // Modul Pesantren dimatikan admin tenant ini — data tetap ada (single-ID global), cuma
  // tidak ditawarkan di sini. Berlaku juga untuk entri lama yang dibuat sebelum dimatikan.
  const tenantClient = createTenantDb(slug);
  const [enabledModules, moduleLabels] = await Promise.all([
    getEnabledEkosistemModules(tenantClient),
    getEkosistemModuleLabels(tenantClient),
  ]);
  if (!enabledModules.pesantren) notFound();
  const moduleLabel = resolveEkosistemModuleLabel("pesantren", moduleLabels);

  const provinsiList = await db
    .select({ id: refProvinces.id, name: refProvinces.name })
    .from(refProvinces)
    .where(eq(refProvinces.isActive, true))
    .orderBy(refProvinces.name);

  const provinsiId = provinsi ? parseInt(provinsi, 10) : null;

  // Gabungkan semua kondisi WHERE
  const whereConditions = [
    inArray(tenantMemberships.status, ["active", "alumni"]),
    eq(tenantMemberships.tenantId, tenant.id),
    ...(q         ? [ilike(memberOwnedPesantren.name, `%${q}%`)] : []),
    ...(kurikulum ? [eq(memberOwnedPesantren.kurikulum, kurikulum as typeof KURIKULUM_OPTIONS[number])] : []),
    ...(model     ? [eq(memberOwnedPesantren.modelPendidikan, model as typeof MODEL_OPTIONS[number])] : []),
    ...(kategori  ? [eq(memberOwnedPesantren.kategoriSantri, kategori as typeof KATEGORI_OPTIONS[number])] : []),
    ...(provinsiId ? [eq(addresses.provinceId, provinsiId)] : []),
    ...(tag ? [sql`${arah === "membutuhkan" ? memberOwnedPesantren.neededTags : memberOwnedPesantren.offeredTags} @> ${JSON.stringify([tag])}::jsonb`] : []),
  ];

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id:              memberOwnedPesantren.id,
        name:            memberOwnedPesantren.name,
        coverUrl:        memberOwnedPesantren.coverUrl,
        kurikulum:       memberOwnedPesantren.kurikulum,
        modelPendidikan: memberOwnedPesantren.modelPendidikan,
        kategoriSantri:  memberOwnedPesantren.kategoriSantri,
        tahunBerdiri:    memberOwnedPesantren.tahunBerdiri,
        santriPutra:     memberOwnedPesantren.santriPutra,
        santriPutri:     memberOwnedPesantren.santriPutri,
        provinceName:    refProvinces.name,
        regencyName:     refRegencies.name,
        ownerName:       members.name,
        ownerId:         members.id,
      })
      .from(memberOwnedPesantren)
      .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberOwnedPesantren.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions))
      .orderBy(memberOwnedPesantren.name)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: count() })
      .from(memberOwnedPesantren)
      .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberOwnedPesantren.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions)),
  ]);

  const total      = countRows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = { q, provinsi, kurikulum, model, kategori, tag, arah, page: String(currentPage), ...overrides };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.kurikulum) sp.set("kurikulum", String(eff.kurikulum));
    if (eff.model)     sp.set("model",     String(eff.model));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.tag)       sp.set("tag",       String(eff.tag));
    if (eff.tag && eff.arah) sp.set("arah", String(eff.arah));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/pesantren${qs ? `?${qs}` : ""}`;
  }

  const hasFilter = !!(q || provinsi || kurikulum || model || kategori || tag);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Direktori {moduleLabel}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total.toLocaleString("id-ID")} pesantren terdaftar
          </p>
        </div>

        <PesantrenFiltersClient
          slug={slug}
          currentQ={q}
          currentProvinsi={provinsi}
          currentKurikulum={kurikulum}
          currentKategori={kategori}
          currentTag={tag}
          currentArah={arah}
          currentPage={currentPage}
          hasFilter={hasFilter}
          provinsiList={provinsiList}
        />

        {/* Grid */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <School className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasFilter ? "Tidak ada pesantren yang cocok dengan filter." : "Belum ada data pesantren."}
            </p>
            {hasFilter && (
              <Link href={`/${slug}/pesantren`} className="mt-3 text-sm text-primary hover:underline">
                Tampilkan semua
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {rows.map(p => {
              const totalSantri = (p.santriPutra ?? 0) + (p.santriPutri ?? 0);
              return (
                <Link
                  key={p.id}
                  href={`/${slug}/pesantren/${p.id}`}
                  className="group flex flex-col rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {/* Logo */}
                  <div className="aspect-video bg-muted/30 relative overflow-hidden flex items-center justify-center">
                    {p.coverUrl ? (
                      <ImageWithFallback
                        src={getVariantUrl(p.coverUrl, "thumbnail")} alt={p.name}
                        fill className="object-contain p-4"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <School className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    {p.kurikulum && (
                      <div className="absolute top-2 left-2">
                        <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
                          {p.kurikulum}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    {(p.provinceName || p.regencyName) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={11} />
                        {p.regencyName ? `${p.regencyName}, ` : ""}{p.provinceName}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                      {p.kategoriSantri && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {p.kategoriSantri}
                        </span>
                      )}
                      {totalSantri > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {totalSantri.toLocaleString("id-ID")} santri
                        </span>
                      )}
                      {p.tahunBerdiri && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Est. {p.tahunBerdiri}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70">
                      Pemilik: {p.ownerName}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {currentPage > 1 && (
              <PublicButton href={buildUrl({ page: currentPage - 1 })} variant="outline-dark" size="sm" iconLeft="chevron" icon="none">
                Sebelumnya
              </PublicButton>
            )}
            <span className="text-sm text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
            {currentPage < totalPages && (
              <PublicButton href={buildUrl({ page: currentPage + 1 })} variant="outline-dark" size="sm" icon="chevron">
                Berikutnya
              </PublicButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
