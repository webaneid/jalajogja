import { notFound }   from "next/navigation";
import { eq, and, or, inArray, ilike, count } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberProfessionals, addresses, refProvinces, refRegencies,
  createTenantDb,
} from "@jalajogja/db";
import Image     from "next/image";
import Link      from "next/link";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import type { Metadata } from "next";
import { Briefcase, MapPin } from "lucide-react";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { ProfessionalFiltersClient } from "@/components/profesional/professional-filters-client";
import type { ProfessionCategory } from "@/lib/professional-types";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params       = Promise<{ tenant: string }>;
type SearchParams = Promise<{
  q?: string; provinsi?: string; kategori?: string; jenis?: string; page?: string;
}>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "profesional-archive");
  return buildMetadata({
    title:         override?.metaTitle || "Direktori Profesional",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/profesional`,
    robots:        override?.robots || undefined,
  });
}

export default async function ProfesionalDirectoryPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug } = await params;
  const { q, provinsi, kategori, jenis, page: pageParam } = await searchParams;

  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset      = (currentPage - 1) * PAGE_SIZE;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const provinsiList = await db
    .select({ id: refProvinces.id, name: refProvinces.name })
    .from(refProvinces)
    .where(eq(refProvinces.isActive, true))
    .orderBy(refProvinces.name);

  const provinsiId = provinsi ? parseInt(provinsi, 10) : null;

  // Pasangan kategori+jenis yang benar-benar ada di tenant ini — untuk dependent dropdown filter
  const typeOptionRows = await db
    .selectDistinct({
      category: memberProfessionals.professionCategory,
      type:     memberProfessionals.professionType,
    })
    .from(memberProfessionals)
    .innerJoin(members, eq(members.id, memberProfessionals.memberId))
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .where(eq(memberProfessionals.isActive, true));

  const whereConditions = [
    eq(memberProfessionals.isActive, true),
    inArray(tenantMemberships.status, ["active", "alumni"]),
    eq(tenantMemberships.tenantId, tenant.id),
    ...(q ? [or(
      ilike(members.name, `%${q}%`),
      ilike(memberProfessionals.professionType, `%${q}%`),
      ilike(memberProfessionals.specialization, `%${q}%`),
    )!] : []),
    ...(kategori   ? [eq(memberProfessionals.professionCategory, kategori as ProfessionCategory)] : []),
    ...(jenis      ? [eq(memberProfessionals.professionType, jenis)]                              : []),
    ...(provinsiId ? [eq(addresses.provinceId, provinsiId)]                                        : []),
  ];

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id:                 memberProfessionals.id,
        title:              memberProfessionals.title,
        professionCategory: memberProfessionals.professionCategory,
        professionType:     memberProfessionals.professionType,
        specialization:     memberProfessionals.specialization,
        institution:        memberProfessionals.institution,
        coverUrl:           memberProfessionals.coverUrl,
        provinceName: refProvinces.name,
        regencyName:  refRegencies.name,
        ownerName:    members.name,
        ownerId:      members.id,
        ownerPhoto:   members.photoUrl,
      })
      .from(memberProfessionals)
      .innerJoin(members, eq(members.id, memberProfessionals.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberProfessionals.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions))
      .orderBy(memberProfessionals.professionType)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: count() })
      .from(memberProfessionals)
      .innerJoin(members, eq(members.id, memberProfessionals.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberProfessionals.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions)),
  ]);

  const total      = countRows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = { q, provinsi, kategori, jenis, page: String(currentPage), ...overrides };
    if (eff.q)        sp.set("q",        String(eff.q));
    if (eff.provinsi) sp.set("provinsi", String(eff.provinsi));
    if (eff.kategori) sp.set("kategori", String(eff.kategori));
    if (eff.jenis)    sp.set("jenis",    String(eff.jenis));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/profesional${qs ? `?${qs}` : ""}`;
  }

  const hasFilter = !!(q || provinsi || kategori || jenis);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Direktori Profesional</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total.toLocaleString("id-ID")} profesional terdaftar
          </p>
        </div>

        <ProfessionalFiltersClient
          slug={slug}
          currentQ={q}
          currentProvinsi={provinsi}
          currentKategori={kategori}
          currentJenis={jenis}
          currentPage={currentPage}
          hasFilter={hasFilter}
          provinsiList={provinsiList}
          typeOptions={typeOptionRows}
        />

        {/* Grid */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasFilter ? "Tidak ada profesional yang cocok dengan filter." : "Belum ada data profesional."}
            </p>
            {hasFilter && (
              <Link href={`/${slug}/profesional`} className="mt-3 text-sm text-primary hover:underline">
                Tampilkan semua
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {rows.map(p => (
              <Link
                key={p.id}
                href={`/${slug}/profesional/${p.id}`}
                className="group flex flex-col rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* Foto */}
                <div className="aspect-video bg-muted/30 relative overflow-hidden flex items-center justify-center p-4">
                  {p.coverUrl ? (
                    <Image
                      src={p.coverUrl} alt={p.professionType}
                      fill className="object-contain p-4"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Briefcase className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {p.professionCategory && (
                    <div className="absolute top-2 left-2">
                      <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">{p.professionCategory}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {[p.title, p.professionType].filter(Boolean).join(" ")}
                  </p>
                  {p.specialization && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.specialization}</p>
                  )}
                  {(p.provinceName || p.regencyName) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={11} />
                      {p.regencyName ? `${p.regencyName}, ` : ""}{p.provinceName}
                    </div>
                  )}
                  {p.institution && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.institution}</span>
                    </div>
                  )}

                  {/* Owner */}
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
                    {p.ownerPhoto ? (
                      <Image src={p.ownerPhoto} alt={p.ownerName} width={18} height={18} className="rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                        {p.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{p.ownerName}</p>
                  </div>
                </div>
              </Link>
            ))}
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
