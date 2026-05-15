import { notFound }          from "next/navigation";
import { eq, and, inArray, ilike, sql, count } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  addresses, refProvinces, refRegencies, refProfessions,
} from "@jalajogja/db";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import type { Metadata } from "next";
import { PublicButton }  from "@/components/website/public/ui/public-button";
import { AnggotaDirectoryClient } from "@/components/anggota/anggota-directory-client";
import { AnggotaFiltersClient }   from "@/components/anggota/anggota-filters-client";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params      = Promise<{ tenant: string }>;
type SearchParams = Promise<{ q?: string; provinsi?: string; angkatan?: string; profesi?: string; page?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  return buildMetadata({ title: "Direktori Anggota", siteName: base.siteName, ogImageUrl: base.logoUrl, canonicalUrl: `${base.baseUrl}/anggota` });
}

export default async function AnggotaDirectoryPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug } = await params;
  const { q, provinsi, angkatan, profesi, page: pageParam } = await searchParams;

  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset      = (currentPage - 1) * PAGE_SIZE;

  // Resolve tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  // Fetch provinsi list untuk filter dropdown
  const provinsiList = await db
    .select({ id: refProvinces.id, name: refProvinces.name })
    .from(refProvinces)
    .where(eq(refProvinces.isActive, true))
    .orderBy(refProvinces.name);

  // Fetch kategori profesi untuk filter
  const profesiList = await db
    .selectDistinct({ category: refProfessions.category })
    .from(refProfessions)
    .orderBy(refProfessions.category);

  // Bangun kondisi WHERE
  const provinsiId  = provinsi ? parseInt(provinsi, 10) : null;
  const angkatanNum = angkatan ? parseInt(angkatan, 10) : null;

  // Sub-query: member IDs yang terdaftar di tenant ini
  const conditions = [
    eq(tenantMemberships.tenantId, tenant.id),
    inArray(tenantMemberships.status, ["active", "alumni"]),
    ...(q            ? [ilike(members.name, `%${q}%`)]                     : []),
    ...(angkatanNum  ? [eq(members.graduationYear, angkatanNum)]            : []),
    ...(profesi      ? [eq(refProfessions.category, profesi)]               : []),
    ...(provinsiId   ? [eq(addresses.provinceId, provinsiId)]              : []),
  ];

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id:               members.id,
        name:             members.name,
        photoUrl:         members.photoUrl,
        gender:           members.gender,
        graduationYear:   members.graduationYear,
        graduationPeriod: members.graduationPeriod,
        memberStatus:     tenantMemberships.status,
        professionName:   refProfessions.name,
        professionCategory: refProfessions.category,
        domicileProvince: refProvinces.name,
        domicileRegency:  refRegencies.name,
      })
      .from(members)
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(refProfessions, eq(refProfessions.id, members.professionId))
      .leftJoin(addresses,     eq(addresses.id,      members.homeAddressId))
      .leftJoin(refProvinces,  eq(refProvinces.id,   addresses.provinceId))
      .leftJoin(refRegencies,  eq(refRegencies.id,   addresses.regencyId))
      .where(
        q          ? and(ilike(members.name, `%${q}%`))                    :
        angkatanNum ? and(eq(members.graduationYear, angkatanNum))          :
        profesi    ? and(eq(refProfessions.category, profesi))              :
        provinsiId ? and(eq(addresses.provinceId, provinsiId))             :
        undefined
      )
      .orderBy(members.name)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: count() })
      .from(members)
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(refProfessions, eq(refProfessions.id, members.professionId))
      .leftJoin(addresses,     eq(addresses.id,      members.homeAddressId))
      .leftJoin(refProvinces,  eq(refProvinces.id,   addresses.provinceId))
      .leftJoin(refRegencies,  eq(refRegencies.id,   addresses.regencyId))
      .where(
        q          ? and(ilike(members.name, `%${q}%`))                    :
        angkatanNum ? and(eq(members.graduationYear, angkatanNum))          :
        profesi    ? and(eq(refProfessions.category, profesi))              :
        provinsiId ? and(eq(addresses.provinceId, provinsiId))             :
        undefined
      ),
  ]);

  const total      = countRows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = { q, provinsi, angkatan, profesi, page: String(currentPage), ...overrides };
    if (eff.q)        sp.set("q",        String(eff.q));
    if (eff.provinsi) sp.set("provinsi", String(eff.provinsi));
    if (eff.angkatan) sp.set("angkatan", String(eff.angkatan));
    if (eff.profesi)  sp.set("profesi",  String(eff.profesi));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/anggota${qs ? `?${qs}` : ""}`;
  }

  const hasFilter = !!(q || provinsi || angkatan || profesi);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Direktori Anggota</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total.toLocaleString("id-ID")} anggota terdaftar
          </p>
        </div>

        {/* Filter bar — client component karena ada onChange handler */}
        <AnggotaFiltersClient
          slug={slug}
          currentQ={q}
          currentProvinsi={provinsi}
          currentAngkatan={angkatan}
          currentProfesi={profesi}
          currentPage={currentPage}
          hasFilter={hasFilter}
          provinsiList={provinsiList}
          profesiList={profesiList}
        />

        {/* Grid + popup — grid di-render di dalam client component */}
        <AnggotaDirectoryClient slug={slug} rows={rows} hasFilter={hasFilter} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {currentPage > 1 && (
              <PublicButton
                href={buildUrl({ page: currentPage - 1 })}
                variant="outline-dark" size="sm" iconLeft="chevron" icon="none"
              >
                Sebelumnya
              </PublicButton>
            )}
            <span className="text-sm text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </span>
            {currentPage < totalPages && (
              <PublicButton
                href={buildUrl({ page: currentPage + 1 })}
                variant="outline-dark" size="sm" icon="chevron"
              >
                Berikutnya
              </PublicButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
