import { notFound }   from "next/navigation";
import { eq, and, inArray, ilike, count } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberOwnedPesantren, addresses, refProvinces, refRegencies,
} from "@jalajogja/db";
import Image     from "next/image";
import Link      from "next/link";
import type { Metadata } from "next";
import { School, MapPin } from "lucide-react";
import { PublicButton }   from "@/components/website/public/ui/public-button";

export const revalidate = 60;

const PAGE_SIZE = 24;

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{
  q?: string; provinsi?: string; kurikulum?: string;
  model?: string; kategori?: string; page?: string;
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
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return {};
  return { title: `Direktori Pesantren — ${tenant.name}` };
}

export default async function PesantrenDirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug } = await params;
  const { q, provinsi, kurikulum, model, kategori, page: pageParam } = await searchParams;

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

  // Gabungkan semua kondisi WHERE
  const whereConditions = [
    inArray(tenantMemberships.status, ["active", "alumni"]),
    eq(tenantMemberships.tenantId, tenant.id),
    ...(q         ? [ilike(memberOwnedPesantren.name, `%${q}%`)] : []),
    ...(kurikulum ? [eq(memberOwnedPesantren.kurikulum, kurikulum as typeof KURIKULUM_OPTIONS[number])] : []),
    ...(model     ? [eq(memberOwnedPesantren.modelPendidikan, model as typeof MODEL_OPTIONS[number])] : []),
    ...(kategori  ? [eq(memberOwnedPesantren.kategoriSantri, kategori as typeof KATEGORI_OPTIONS[number])] : []),
    ...(provinsiId ? [eq(addresses.provinceId, provinsiId)] : []),
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
    const eff = { q, provinsi, kurikulum, model, kategori, page: String(currentPage), ...overrides };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.kurikulum) sp.set("kurikulum", String(eff.kurikulum));
    if (eff.model)     sp.set("model",     String(eff.model));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/pesantren${qs ? `?${qs}` : ""}`;
  }

  const hasFilter = !!(q || provinsi || kurikulum || model || kategori);

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Direktori Pesantren</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total.toLocaleString("id-ID")} pesantren terdaftar
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-6 space-y-3">
          <form method="GET" action={`/${slug}/pesantren`}>
            {provinsi  && <input type="hidden" name="provinsi"  value={provinsi} />}
            {kurikulum && <input type="hidden" name="kurikulum" value={kurikulum} />}
            {model     && <input type="hidden" name="model"     value={model} />}
            {kategori  && <input type="hidden" name="kategori"  value={kategori} />}
            <div className="flex gap-2 max-w-md">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Cari nama pesantren..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Cari
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              defaultValue={provinsi ?? ""}
              onChange={e => { window.location.href = buildUrl({ provinsi: e.target.value || undefined, page: "1" }); }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none"
            >
              <option value="">Semua Provinsi</option>
              {provinsiList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>

            <select
              defaultValue={kurikulum ?? ""}
              onChange={e => { window.location.href = buildUrl({ kurikulum: e.target.value || undefined, page: "1" }); }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none"
            >
              <option value="">Semua Kurikulum</option>
              {KURIKULUM_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>

            <select
              defaultValue={kategori ?? ""}
              onChange={e => { window.location.href = buildUrl({ kategori: e.target.value || undefined, page: "1" }); }}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none"
            >
              <option value="">Semua Kategori Santri</option>
              {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>

            {hasFilter && (
              <Link href={`/${slug}/pesantren`} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                × Reset Filter
              </Link>
            )}
          </div>
        </div>

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
                  {/* Cover */}
                  <div className="aspect-video bg-muted/50 relative overflow-hidden">
                    {p.coverUrl ? (
                      <Image
                        src={p.coverUrl} alt={p.name}
                        fill className="object-cover group-hover:scale-105 transition-transform duration-300"
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
