import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql, gte } from "drizzle-orm";
import { db, tenants, tenantMemberships, members, TENANT_TYPES, createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { StatCard } from "@/components/dashboard/stat-card";
import { todayInTz } from "@/lib/tenant-timezone";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { computeMemberStatistics } from "@/lib/member-statistics.server";
import { StatistikSections } from "@/components/statistik/statistik-sections";
import { Building2, Users, IdCard, UserPlus } from "lucide-react";

// Menu KHUSUS tenant tipe "pusat" — satu-satunya tempat di seluruh dashboard yang membaca
// data agregat LINTAS SELURUH tenant. HANYA baca 3 tabel backbone: tenants, tenant_memberships,
// members — TIDAK PERNAH tenant_{slug}.* milik tenant lain. Lihat docs/arsitektur-backbone-
// ikpm.md § "Menu Admin Khusus IKPM Pusat: Ringkasan Tenant" untuk desain lengkap.

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  cabang:   { label: "Cabang",     cls: "bg-blue-100 text-blue-700" },
  marhalah: { label: "Marhalah",   cls: "bg-purple-100 text-purple-700" },
  forum:    { label: "Forum",      cls: "bg-orange-100 text-orange-700" },
  pusat:    { label: "IKPM Pusat", cls: "bg-emerald-100 text-emerald-700" },
};

export default async function RingkasanTenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  // Guard KEDUA — pertahanan SESUNGGUHNYA (bukan sidebar hiding yang murni UX). Tanpa baris
  // ini, admin tenant cabang/marhalah/forum manapun yang menebak URL bisa melihat rangkuman
  // keanggotaan SELURUH tenant lain.
  if (access.tenant.tenantType !== "pusat") redirect(`/app/${slug}/dashboard`);

  // ── A. KPI ringkas ─────────────────────────────────────────────────────────
  const [totalTenantRow]      = await db.select({ total: sql<number>`count(*)` }).from(tenants).where(eq(tenants.isActive, true));
  const [totalMembersRow]     = await db.select({ total: sql<number>`count(*)` }).from(members);
  const [totalMembershipsRow] = await db.select({ total: sql<number>`count(*)` }).from(tenantMemberships);

  // Anchor "awal bulan ini" di kalender WIB, dinyatakan sebagai UTC Date — bukan `new Date()`
  // mentah (bisa geser 1 hari di jam 00:00-06:59 WIB). Pola sama anchorTodayUtc().
  const todayWib = todayInTz("Asia/Jakarta");
  const [y, m] = todayWib.split("-").map(Number);
  const startOfMonthUtc = new Date(Date.UTC(y, m - 1, 1));
  const [newMembersRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(members)
    .where(gte(members.createdAt, startOfMonthUtc));

  const totalTenant      = Number(totalTenantRow?.total ?? 0);
  const totalMembers     = Number(totalMembersRow?.total ?? 0);
  const totalMemberships = Number(totalMembershipsRow?.total ?? 0);
  const newMembersMonth  = Number(newMembersRow?.total ?? 0);

  // ── B. Breakdown jumlah tenant per tipe (urutan tetap TENANT_TYPES) ───────
  const typeRows = await db
    .select({ tenantType: tenants.tenantType, total: sql<number>`count(*)` })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .groupBy(tenants.tenantType);
  const typeCountMap = new Map(typeRows.map(r => [r.tenantType, Number(r.total)]));

  // ── C. Tabel utama: daftar tenant + jumlah anggota per status ─────────────
  const tenantRows = await db
    .select({
      id:              tenants.id,
      slug:            tenants.slug,
      name:            tenants.name,
      tenantType:      tenants.tenantType,
      isActive:        tenants.isActive,
      totalMembers:    sql<number>`count(${tenantMemberships.id})`,
      activeMembers:   sql<number>`count(${tenantMemberships.id}) filter (where ${tenantMemberships.status} = 'active')`,
      alumniMembers:   sql<number>`count(${tenantMemberships.id}) filter (where ${tenantMemberships.status} = 'alumni')`,
      inactiveMembers: sql<number>`count(${tenantMemberships.id}) filter (where ${tenantMemberships.status} = 'inactive')`,
    })
    .from(tenants)
    .leftJoin(tenantMemberships, eq(tenantMemberships.tenantId, tenants.id))
    .groupBy(tenants.id)
    .orderBy(sql`count(${tenantMemberships.id}) desc`);

  // ── D. Data quality insight ────────────────────────────────────────────────
  const [noCabangRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(members)
    .where(sql`${members.primaryCabangRefId} IS NULL`);
  const noCabangTotal = Number(noCabangRow?.total ?? 0);

  // ── Total Statistik Pusat — reuse PERSIS computeMemberStatistics() yang dipakai
  // /{slug}/statistik untuk tenant mana pun. Karena tenant Pusat punya baris tenant_memberships
  // untuk SEMUA anggota (auto-populate unconditional), pemanggilan dengan ID tenant Pusat
  // sendiri OTOMATIS menghasilkan statistik SELURUH sistem — nol query khusus tambahan.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));
  const statsData      = await computeMemberStatistics(access.tenant.id);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Ringkasan Tenant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rangkuman keanggotaan lintas seluruh tenant — khusus dashboard {access.tenant.name}.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tenant Aktif" value={totalTenant.toLocaleString("id-ID")} icon={Building2} />
        <StatCard
          label="Total Anggota IKPM"
          value={totalMembers.toLocaleString("id-ID")}
          sublabel="Unik — satu orang dihitung sekali"
          icon={Users}
        />
        <StatCard
          label="Total Baris Keanggotaan"
          value={totalMemberships.toLocaleString("id-ID")}
          sublabel="Bisa lebih besar dari anggota unik — satu orang bisa anggota di banyak tenant"
          icon={IdCard}
        />
        <StatCard
          label="Anggota Baru Bulan Ini"
          value={newMembersMonth.toLocaleString("id-ID")}
          sublabel={`Sejak awal bulan (WIB)`}
          icon={UserPlus}
        />
      </div>

      {/* Breakdown per tipe tenant */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-3">Tenant per Tipe</p>
        <div className="flex flex-wrap gap-3">
          {TENANT_TYPES.map((type) => {
            const badge = TYPE_LABEL[type];
            const count = typeCountMap.get(type) ?? 0;
            return (
              <div key={type} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                <span className="text-sm font-semibold tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data quality insight */}
      {noCabangTotal > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{noCabangTotal.toLocaleString("id-ID")} anggota</span> belum
          tersambung ke PC IKPM resmi manapun (kolom PC IKPM Cabang masih kosong).
        </div>
      )}

      {/* Tabel utama */}
      <div>
        <p className="text-sm font-semibold mb-3">Daftar Tenant</p>
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Nama</th>
                <th className="text-left px-5 py-2.5 font-medium">Tipe</th>
                <th className="text-left px-5 py-2.5 font-medium">Total Anggota</th>
                <th className="text-left px-5 py-2.5 font-medium">Aktif</th>
                <th className="text-left px-5 py-2.5 font-medium">Alumni</th>
                <th className="text-left px-5 py-2.5 font-medium">Non-aktif</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenantRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    Belum ada tenant.
                  </td>
                </tr>
              ) : tenantRows.map((t) => {
                const badge = TYPE_LABEL[t.tenantType] ?? TYPE_LABEL.cabang;
                return (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <p className="font-medium">{t.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{t.slug}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-5 py-3 tabular-nums font-semibold">{Number(t.totalMembers).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{Number(t.activeMembers).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{Number(t.alumniMembers).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{Number(t.inactiveMembers).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {t.isActive ? "Aktif" : "Non-aktif"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/app/${slug}/ringkasan-tenant/${t.slug}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Lihat Statistik →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Statistik Pusat — sama dengan /{slug}/statistik publik, dipanggil dengan ID
          tenant Pusat sendiri sehingga otomatis mencakup seluruh sistem. */}
      <div className="pt-4 border-t border-border">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Total Statistik Pusat</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rangkuman demografi seluruh anggota IKPM di semua tenant.
          </p>
        </div>
        <div className="space-y-12">
          <StatistikSections data={statsData} enabledModules={enabledModules} />
        </div>
      </div>
    </div>
  );
}
