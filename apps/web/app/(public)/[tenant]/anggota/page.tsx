import { notFound }          from "next/navigation";
import { eq, and, inArray, ilike, sql, count } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  addresses, refProvinces, refRegencies, refProfessions,
} from "@jalajogja/db";
import Image from "next/image";
import Link  from "next/link";
import type { Metadata } from "next";
import { Users }         from "lucide-react";
import { PublicButton }  from "@/components/website/public/ui/public-button";
import { AnggotaDirectoryClient } from "@/components/anggota/anggota-directory-client";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params      = Promise<{ tenant: string }>;
type SearchParams = Promise<{ q?: string; provinsi?: string; angkatan?: string; profesi?: string; page?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return {};
  return { title: `Direktori Anggota — ${tenant.name}` };
}

function Avatar({ name, photoUrl, size = 56 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (photoUrl) {
    return (
      <Image
        src={photoUrl} alt={name}
        width={size} height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
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

        {/* Filter bar */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <form method="GET" action={`/${slug}/anggota`}>
            {provinsi && <input type="hidden" name="provinsi" value={provinsi} />}
            {angkatan && <input type="hidden" name="angkatan" value={angkatan} />}
            {profesi  && <input type="hidden" name="profesi"  value={profesi} />}
            <div className="flex gap-2 max-w-md">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Cari nama anggota..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Cari
              </button>
            </div>
          </form>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Provinsi filter */}
            <select
              defaultValue={provinsi ?? ""}
              onChange={e => {
                const val = e.target.value;
                window.location.href = buildUrl({ provinsi: val || undefined, page: "1" });
              }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua Provinsi</option>
              {provinsiList.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>

            {/* Kategori profesi filter */}
            <select
              defaultValue={profesi ?? ""}
              onChange={e => {
                const val = e.target.value;
                window.location.href = buildUrl({ profesi: val || undefined, page: "1" });
              }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua Profesi</option>
              {profesiList.map(p => (
                <option key={p.category} value={p.category}>{p.category}</option>
              ))}
            </select>

            {/* Angkatan filter */}
            <select
              defaultValue={angkatan ?? ""}
              onChange={e => {
                const val = e.target.value;
                window.location.href = buildUrl({ angkatan: val || undefined, page: "1" });
              }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua Angkatan</option>
              {Array.from({ length: new Date().getFullYear() - 1959 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>

            {/* Reset filter */}
            {hasFilter && (
              <Link
                href={`/${slug}/anggota`}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                × Reset Filter
              </Link>
            )}
          </div>
        </div>

        {/* Grid dengan client component untuk popup */}
        <AnggotaDirectoryClient slug={slug}>
          {(onSelect) => (
            <>
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {hasFilter ? "Tidak ada anggota yang cocok dengan filter." : "Belum ada anggota terdaftar."}
                  </p>
                  {hasFilter && (
                    <Link href={`/${slug}/anggota`} className="mt-3 text-sm text-primary hover:underline">
                      Tampilkan semua
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {rows.map(m => (
                    <button
                      key={m.id}
                      onClick={() => onSelect(m.id)}
                      className="group flex flex-col items-center text-center gap-2.5 rounded-xl border border-border p-4 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <Avatar name={m.name} photoUrl={m.photoUrl} size={56} />
                      <div className="w-full">
                        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {m.name}
                        </p>
                        {m.professionName && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.professionName}</p>
                        )}
                        {m.domicileProvince && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.domicileProvince}</p>
                        )}
                        {m.graduationYear && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {m.graduationYear}{m.graduationPeriod ? ` (${m.graduationPeriod})` : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </AnggotaDirectoryClient>

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
