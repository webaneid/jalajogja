import { db, tenants, platformUsers } from "@jalajogja/db";
import { count, eq } from "drizzle-orm";
import { Building2, Users, UserCheck } from "lucide-react";

async function getStats() {
  const [{ total: totalTenants }]     = await db.select({ total: count() }).from(tenants);
  const [{ total: activeTenants }]    = await db.select({ total: count() }).from(tenants).where(eq(tenants.isActive, true));
  const [{ total: platformTeamCount }] = await db.select({ total: count() }).from(platformUsers).where(eq(platformUsers.isActive, true));

  return { totalTenants, activeTenants, platformTeamCount };
}

export default async function PlatformDashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Total Tenant",   value: stats.totalTenants,     icon: Building2,  color: "bg-blue-50 text-blue-600" },
    { label: "Tenant Aktif",   value: stats.activeTenants,    icon: UserCheck,  color: "bg-green-50 text-green-600" },
    { label: "Tim Platform",   value: stats.platformTeamCount, icon: Users,     color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview platform jalakarta</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-background p-5 flex items-center gap-4">
            <div className={`rounded-lg p-2.5 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent tenants */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Tenant Terbaru</h2>
        </div>
        <RecentTenants />
      </div>
    </div>
  );
}

async function RecentTenants() {
  const recent = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, isActive: tenants.isActive, createdAt: tenants.createdAt })
    .from(tenants)
    .orderBy(tenants.createdAt)
    .limit(10);

  if (recent.length === 0) {
    return <p className="px-5 py-8 text-sm text-muted-foreground text-center">Belum ada tenant.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/30 text-xs text-muted-foreground">
        <tr>
          <th className="text-left px-5 py-2.5 font-medium">Nama</th>
          <th className="text-left px-5 py-2.5 font-medium">Slug</th>
          <th className="text-left px-5 py-2.5 font-medium">Status</th>
          <th className="text-left px-5 py-2.5 font-medium">Dibuat</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {recent.map((t) => (
          <tr key={t.id} className="hover:bg-muted/20">
            <td className="px-5 py-3 font-medium">{t.name}</td>
            <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{t.slug}</td>
            <td className="px-5 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {t.isActive ? "Aktif" : "Non-aktif"}
              </span>
            </td>
            <td className="px-5 py-3 text-muted-foreground text-xs">
              {t.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
