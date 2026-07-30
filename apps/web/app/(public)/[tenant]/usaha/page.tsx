import { notFound }   from "next/navigation";
import { eq, and, inArray, ilike, count, sql } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberBusinesses, addresses, refProvinces, refRegencies,
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
import { UsahaFiltersClient } from "@/components/usaha/usaha-filters-client";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getVariantUrl } from "@/lib/image-processor";
import { getPrioritizedBusinessFields } from "@/lib/business-sectors";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params      = Promise<{ tenant: string }>;
type SearchParams  = Promise<{
  q?: string; provinsi?: string; sektor?: string; kategori?: string; bidang?: string; page?: string;
  tag?: string; arah?: string;
}>;

const SEKTOR_OPTIONS = [
  "Pertanian, Peternakan & Perikanan",
  "Manufaktur & Pengolahan",
  "Perdagangan, Ritel & F&B",
  "Teknologi & Informasi",
  "Kreatif",
  "Logistik, Transportasi & Konstruksi",
  "Jasa Usaha & Keuangan",
  "Pendidikan & Pelatihan",
  "Kesehatan, Farmasi & Herbal",
  "Sumber Daya Alam & Energi",
] as const;

const KATEGORI_OPTIONS = ["Jasa", "Produsen", "Distributor", "Trading", "Profesional"] as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "usaha-archive");
  return buildMetadata({
    title:         override?.metaTitle || "Direktori Usaha",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/usaha`,
    robots:        override?.robots || undefined,
  });
}

export default async function UsahaDirectoryPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug } = await params;
  const { q, provinsi, sektor, kategori, bidang, page: pageParam, tag, arah } = await searchParams;

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

  const whereConditions = [
    eq(memberBusinesses.isActive, true),
    inArray(tenantMemberships.status, ["active", "alumni"]),
    eq(tenantMemberships.tenantId, tenant.id),
    ...(q          ? [ilike(memberBusinesses.name, `%${q}%`)]                                                    : []),
    ...(sektor     ? [eq(memberBusinesses.sector, sektor as typeof SEKTOR_OPTIONS[number])]                      : []),
    ...(kategori   ? [eq(memberBusinesses.category, kategori as typeof KATEGORI_OPTIONS[number])]                : []),
    ...(bidang     ? [sql`${memberBusinesses.businessFields} @> ${JSON.stringify([bidang])}::jsonb`]             : []),
    ...(provinsiId ? [eq(addresses.provinceId, provinsiId)]                                                      : []),
    ...(tag ? [sql`${arah === "membutuhkan" ? memberBusinesses.neededTags : memberBusinesses.offeredTags} @> ${JSON.stringify([tag])}::jsonb`] : []),
  ];

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id:           memberBusinesses.id,
        name:         memberBusinesses.name,
        brand:        memberBusinesses.brand,
        description:  memberBusinesses.description,
        coverUrl:     memberBusinesses.coverUrl,
        logoUrl:      memberBusinesses.logoUrl,
        category:     memberBusinesses.category,
        sector:       memberBusinesses.sector,
        employees:    memberBusinesses.employees,
        provinceName: refProvinces.name,
        regencyName:  refRegencies.name,
        ownerName:    members.name,
        ownerId:      members.id,
        ownerPhoto:   members.photoUrl,
      })
      .from(memberBusinesses)
      .innerJoin(members, eq(members.id, memberBusinesses.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberBusinesses.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions))
      .orderBy(memberBusinesses.name)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: count() })
      .from(memberBusinesses)
      .innerJoin(members, eq(members.id, memberBusinesses.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses,    eq(addresses.id,    memberBusinesses.addressId))
      .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
      .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
      .where(and(...whereConditions)),
  ]);

  const total      = countRows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = { q, provinsi, sektor, kategori, bidang, tag, arah, page: String(currentPage), ...overrides };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.sektor)    sp.set("sektor",    String(eff.sektor));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.bidang)    sp.set("bidang",    String(eff.bidang));
    if (eff.tag)       sp.set("tag",       String(eff.tag));
    if (eff.tag && eff.arah) sp.set("arah", String(eff.arah));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/usaha${qs ? `?${qs}` : ""}`;
  }

  const hasFilter = !!(q || provinsi || sektor || kategori || bidang || tag);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Direktori Usaha</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total.toLocaleString("id-ID")} usaha terdaftar
          </p>
        </div>

        <UsahaFiltersClient
          slug={slug}
          currentQ={q}
          currentProvinsi={provinsi}
          currentSektor={sektor}
          currentKategori={kategori}
          currentBidang={bidang}
          currentTag={tag}
          currentArah={arah}
          currentPage={currentPage}
          hasFilter={hasFilter}
          provinsiList={provinsiList}
          bidangOptions={getPrioritizedBusinessFields(sektor ?? null)}
        />

        {/* Grid */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasFilter ? "Tidak ada usaha yang cocok dengan filter." : "Belum ada data usaha."}
            </p>
            {hasFilter && (
              <Link href={`/${slug}/usaha`} className="mt-3 text-sm text-primary hover:underline">
                Tampilkan semua
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {rows.map(b => (
              <Link
                key={b.id}
                href={`/${slug}/usaha/${b.id}`}
                className="group flex flex-col rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* Sampul & Logo */}
                {(() => {
                  const coverImg = getVariantUrl(b.coverUrl, "thumbnail");
                  const logoImg  = b.logoUrl;
                  return (
                    <div className="aspect-video bg-muted/30 relative overflow-hidden flex items-center justify-center">
                      {coverImg ? (
                        <>
                          <ImageWithFallback
                            src={coverImg} alt={b.name}
                            fill className="object-cover"
                            unoptimized
                          />
                          {logoImg && (
                            <div className="absolute bottom-2 left-2 w-9 h-9 rounded-lg bg-background/95 border border-border p-1 shadow-sm flex items-center justify-center overflow-hidden z-10">
                              <Image src={logoImg} alt={b.name} fill className="object-contain p-0.5" unoptimized />
                            </div>
                          )}
                        </>
                      ) : logoImg ? (
                        <Image
                          src={logoImg} alt={b.name}
                          fill className="object-contain p-4"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Briefcase className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {b.category && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">{b.category}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Info */}
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {b.name}
                    {b.brand && b.brand !== b.name && (
                      <span className="font-normal text-muted-foreground ml-1">({b.brand})</span>
                    )}
                  </p>
                  {b.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                  )}
                  {(b.provinceName || b.regencyName) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={11} />
                      {b.regencyName ? `${b.regencyName}, ` : ""}{b.provinceName}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    {b.sector && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{b.sector}</span>
                    )}
                    {b.employees && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{b.employees} karyawan</span>
                    )}
                  </div>

                  {/* Owner */}
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
                    {b.ownerPhoto ? (
                      <Image src={b.ownerPhoto} alt={b.ownerName} width={18} height={18} className="rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                        {b.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{b.ownerName}</p>
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
