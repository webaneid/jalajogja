import { notFound }   from "next/navigation";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  addresses, refRegencies, refProfessions,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import type { Metadata } from "next";
import { Users, School, Briefcase, IdCard } from "lucide-react";

export const revalidate = 300;

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  return buildMetadata({ title: "Statistik Anggota", siteName: base.siteName, ogImageUrl: base.logoUrl, canonicalUrl: `${base.baseUrl}/statistik` });
}

// ─── Komponen visual ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-5 flex flex-col gap-1">
      <p className="text-3xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BarList({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">Belum ada data.</p>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(item => {
        const pct = Math.round((item.value / max) * 100);
        const totalPct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/80 truncate max-w-[70%]">{item.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.value.toLocaleString("id-ID")} ({totalPct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-base font-bold mt-2">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StatistikPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const tenantId = tenant.id;
  const scopeClause = and(
    eq(tenantMemberships.tenantId, tenantId),
    inArray(tenantMemberships.status, ["active", "alumni"]),
  );

  // ── Stats Anggota ──────────────────────────────────────────────────────────

  const activeRows  = await db
    .select({ total: sql<number>`count(*)` })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "active")));

  const alumniRows  = await db
    .select({ total: sql<number>`count(*)` })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "alumni")));

  const activeTotal  = Number(activeRows[0]?.total ?? 0);
  const alumniTotal  = Number(alumniRows[0]?.total ?? 0);
  const totalAnggota = activeTotal + alumniTotal;

  // Gender
  const genderRows = await db
    .select({ gender: members.gender, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      scopeClause,
    ))
    .groupBy(members.gender)
    .orderBy(sql`count(*) desc`);

  // Kabupaten domisili (top 10)
  const kabupatenAnggotaRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    members.homeAddressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(sql`${refRegencies.id} IS NOT NULL`)
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // Status domisili
  const domisiliRows = await db
    .select({ status: members.domicileStatus, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.domicileStatus} IS NOT NULL`)
    .groupBy(members.domicileStatus)
    .orderBy(sql`count(*) desc`);

  // Angkatan (top 10) — group by year + period agar 1999 Awal/Akhir terpisah
  const angkatanRows = await db
    .select({ year: members.graduationYear, period: members.graduationPeriod, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.graduationYear} IS NOT NULL`)
    .groupBy(members.graduationYear, members.graduationPeriod)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // Kategori profesi
  const profesiRows = await db
    .select({ category: refProfessions.category, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .innerJoin(refProfessions, eq(refProfessions.id, members.professionId))
    .groupBy(refProfessions.category)
    .orderBy(sql`count(*) desc`);

  // Wali santri
  const waliSantriRows = await db
    .select({ wali: members.waliSantri, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.waliSantri} IS NOT NULL`)
    .groupBy(members.waliSantri)
    .orderBy(sql`count(*) desc`);

  // Punya usaha
  const punyaUsahaRows = await db
    .select({ total: sql<number>`count(distinct ${memberBusinesses.memberId})` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true));

  // Punya pesantren
  const punyaPesantrenRows = await db
    .select({ total: sql<number>`count(distinct ${memberOwnedPesantren.memberId})` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  // Punya data profesional
  const punyaProfesionalRows = await db
    .select({ total: sql<number>`count(distinct ${memberProfessionals.memberId})` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true));

  const punyaUsahaTotal    = Number(punyaUsahaRows[0]?.total    ?? 0);
  const punyaPesantrenTotal = Number(punyaPesantrenRows[0]?.total ?? 0);
  const punyaProfesionalTotal = Number(punyaProfesionalRows[0]?.total ?? 0);

  // ── Stats Pesantren ────────────────────────────────────────────────────────

  const totalPesantrenRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  const totalPesantren = Number(totalPesantrenRows[0]?.total ?? 0);

  const sumSantriRows = await db
    .select({
      putra:     sql<string>`coalesce(sum(${memberOwnedPesantren.santriPutra}),0)`,
      putri:     sql<string>`coalesce(sum(${memberOwnedPesantren.santriPutri}),0)`,
      asatidz:   sql<string>`coalesce(sum(${memberOwnedPesantren.asatidz}),0)`,
      asatidzah: sql<string>`coalesce(sum(${memberOwnedPesantren.asatidzah}),0)`,
    })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  const sumSantri = sumSantriRows[0] ?? { putra: "0", putri: "0", asatidz: "0", asatidzah: "0" };

  const kurikulumRows = await db
    .select({ kurikulum: memberOwnedPesantren.kurikulum, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.kurikulum} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.kurikulum)
    .orderBy(sql`count(*) desc`);

  const kategoriSantriRows = await db
    .select({ kategori: memberOwnedPesantren.kategoriSantri, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.kategoriSantri} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.kategoriSantri)
    .orderBy(sql`count(*) desc`);

  const modelPendidikanRows = await db
    .select({ model: memberOwnedPesantren.modelPendidikan, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.modelPendidikan} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.modelPendidikan)
    .orderBy(sql`count(*) desc`);

  const jenisPondokRows = await db
    .select({ jenis: memberOwnedPesantren.jenisPondok, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.jenisPondok} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.jenisPondok)
    .orderBy(sql`count(*) desc`);

  // ── Stats Usaha ────────────────────────────────────────────────────────────

  const totalUsahaRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true));

  const totalUsaha = Number(totalUsahaRows[0]?.total ?? 0);

  const sektorRows = await db
    .select({ sector: memberBusinesses.sector, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true))
    .groupBy(memberBusinesses.sector)
    .orderBy(sql`count(*) desc`);

  const kategoriUsahaRows = await db
    .select({ category: memberBusinesses.category, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true))
    .groupBy(memberBusinesses.category)
    .orderBy(sql`count(*) desc`);

  const legalitasRows = await db
    .select({ legality: memberBusinesses.legality, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.legality} IS NOT NULL`))
    .groupBy(memberBusinesses.legality)
    .orderBy(sql`count(*) desc`);

  const karyawanRows = await db
    .select({ employees: memberBusinesses.employees, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.employees} IS NOT NULL`))
    .groupBy(memberBusinesses.employees)
    .orderBy(sql`count(*) desc`);

  const cabangUsahaRows = await db
    .select({ branches: memberBusinesses.branches, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.branches} IS NOT NULL`))
    .groupBy(memberBusinesses.branches)
    .orderBy(sql`count(*) desc`);

  const kabupatenUsahaRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    memberBusinesses.addressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(and(eq(memberBusinesses.isActive, true), sql`${refRegencies.id} IS NOT NULL`))
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // ── Stats Profesional ──────────────────────────────────────────────────────

  const totalProfesionalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true));

  const totalProfesional = Number(totalProfesionalRows[0]?.total ?? 0);

  const kategoriProfesionalRows = await db
    .select({ category: memberProfessionals.professionCategory, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true))
    .groupBy(memberProfessionals.professionCategory)
    .orderBy(sql`count(*) desc`);

  const jenisProfesionalRows = await db
    .select({ type: memberProfessionals.professionType, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true))
    .groupBy(memberProfessionals.professionType)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  const kabupatenProfesionalRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    memberProfessionals.addressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(and(eq(memberProfessionals.isActive, true), sql`${refRegencies.id} IS NOT NULL`))
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // ── Format helpers ─────────────────────────────────────────────────────────

  const genderLabel: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };
  const waliSantriLabel: Record<string, string> = {
    gontor:  "Wali Santri PM Gontor",
    alumni:  "Wali Santri PM Alumni Gontor",
    lain:    "Wali Santri Pesantren Lain",
    bukan:   "Bukan Wali Santri",
  };
  const domisiliLabel: Record<string, string> = {
    permanent: "Domisili Tetap",
    temporary: "Domisili Sementara / Perantau",
  };

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Statistik</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Data statistik anggota, pesantren, usaha, dan profesional {tenant.name}
          </p>
        </div>

        {/* ── Statistik Anggota ──────────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionTitle icon={Users} title="Statistik Anggota" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Anggota"   value={totalAnggota} />
            <StatCard label="Anggota Aktif"   value={activeTotal} />
            <StatCard label="Alumni"          value={alumniTotal} />
            <StatCard label="Memiliki Usaha"  value={punyaUsahaTotal}
              sub={totalAnggota > 0 ? `${Math.round(punyaUsahaTotal / totalAnggota * 100)}% dari total` : undefined} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Memiliki Pesantren" value={punyaPesantrenTotal}
              sub={totalAnggota > 0 ? `${Math.round(punyaPesantrenTotal / totalAnggota * 100)}% dari total` : undefined} />
            <StatCard label="Memiliki Data Profesional" value={punyaProfesionalTotal}
              sub={totalAnggota > 0 ? `${Math.round(punyaProfesionalTotal / totalAnggota * 100)}% dari total` : undefined} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Gender</p>
              <BarList
                items={genderRows.map(r => ({ label: genderLabel[r.gender ?? ""] ?? (r.gender ?? "Tidak diketahui"), value: Number(r.total) }))}
                total={totalAnggota}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Kategori Profesi</p>
              <BarList
                items={profesiRows.map(r => ({ label: r.category, value: Number(r.total) }))}
                total={totalAnggota}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Wali Santri</p>
              <BarList
                items={waliSantriRows.map(r => ({ label: waliSantriLabel[r.wali ?? ""] ?? (r.wali ?? "Tidak diketahui"), value: Number(r.total) }))}
                total={totalAnggota}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Status Domisili</p>
              <BarList
                items={domisiliRows.map(r => ({ label: domisiliLabel[r.status ?? ""] ?? (r.status ?? "Tidak diketahui"), value: Number(r.total) }))}
                total={totalAnggota}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Top 10 Kabupaten / Kota Domisili</p>
              <BarList
                items={kabupatenAnggotaRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalAnggota}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Top 10 Angkatan</p>
              <BarList
                items={angkatanRows.map(r => {
                  const base = r.year ? String(r.year) : "Tidak diketahui";
                  let label = base;
                  if (r.year === 1999) {
                    label = r.period === "awal" ? "1999 (Awal)" : r.period === "akhir" ? "1999 (Akhir)" : "1999 (Belum ditentukan)";
                  }
                  return { label, value: Number(r.total) };
                })}
                total={totalAnggota}
              />
            </div>
          </div>
        </section>

        {/* ── Statistik Pesantren ────────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionTitle icon={School} title="Statistik Pesantren" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Pesantren"    value={totalPesantren} />
            <StatCard label="Total Santri"        value={(Number(sumSantri.putra) + Number(sumSantri.putri)).toLocaleString("id-ID")} />
            <StatCard label="Santri Putra"        value={Number(sumSantri.putra).toLocaleString("id-ID")} />
            <StatCard label="Santri Putri"        value={Number(sumSantri.putri).toLocaleString("id-ID")} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Asatidz (Putra)"    value={Number(sumSantri.asatidz).toLocaleString("id-ID")} />
            <StatCard label="Asatidzah (Putri)"  value={Number(sumSantri.asatidzah).toLocaleString("id-ID")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Kurikulum</p>
              <BarList
                items={kurikulumRows.map(r => ({ label: r.kurikulum ?? "Lainnya", value: Number(r.total) }))}
                total={totalPesantren}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Kategori Santri</p>
              <BarList
                items={kategoriSantriRows.map(r => ({ label: r.kategori ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalPesantren}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Model Pendidikan</p>
              <BarList
                items={modelPendidikanRows.map(r => ({ label: r.model ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalPesantren}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Jenis Pondok</p>
              <BarList
                items={jenisPondokRows.map(r => ({ label: r.jenis ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalPesantren}
              />
            </div>
          </div>
        </section>

        {/* ── Statistik Usaha ────────────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionTitle icon={Briefcase} title="Statistik Usaha" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Usaha Aktif"  value={totalUsaha} />
            <StatCard label="Anggota Berusaha"    value={punyaUsahaTotal}
              sub={totalAnggota > 0 ? `${Math.round(punyaUsahaTotal / totalAnggota * 100)}% dari total anggota` : undefined} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Sektor</p>
              <BarList
                items={sektorRows.map(r => ({ label: r.sector, value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Kategori</p>
              <BarList
                items={kategoriUsahaRows.map(r => ({ label: r.category, value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Legalitas</p>
              <BarList
                items={legalitasRows.map(r => ({ label: r.legality ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Jumlah Karyawan</p>
              <BarList
                items={karyawanRows.map(r => ({ label: r.employees ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Jumlah Cabang Usaha</p>
              <BarList
                items={cabangUsahaRows.map(r => ({ label: r.branches ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Top 10 Kabupaten / Kota</p>
              <BarList
                items={kabupatenUsahaRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalUsaha}
              />
            </div>
          </div>
        </section>

        {/* ── Statistik Profesional ─────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionTitle icon={IdCard} title="Statistik Profesional" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Data Profesional" value={totalProfesional} />
            <StatCard label="Anggota Profesional"     value={punyaProfesionalTotal}
              sub={totalAnggota > 0 ? `${Math.round(punyaProfesionalTotal / totalAnggota * 100)}% dari total anggota` : undefined} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Distribusi Kategori Profesi</p>
              <BarList
                items={kategoriProfesionalRows.map(r => ({ label: r.category, value: Number(r.total) }))}
                total={totalProfesional}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Top 10 Jenis Profesi</p>
              <BarList
                items={jenisProfesionalRows.map(r => ({ label: r.type, value: Number(r.total) }))}
                total={totalProfesional}
              />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold">Top 10 Kabupaten / Kota</p>
              <BarList
                items={kabupatenProfesionalRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
                total={totalProfesional}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
