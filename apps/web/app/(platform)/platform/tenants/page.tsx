import { db, tenants } from "@jalajogja/db";
import { desc, like, or, eq } from "drizzle-orm";
import Link from "next/link";
import { PlatformTenantActions } from "@/components/platform/tenant-actions";

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function PlatformTenantsPage({ searchParams }: Props) {
  const { q = "", status } = await searchParams;

  const rows = await db
    .select({
      id:             tenants.id,
      slug:           tenants.slug,
      name:           tenants.name,
      isActive:       tenants.isActive,
      customDomain:   tenants.customDomain,
      subdomain:      tenants.subdomain,
      createdAt:      tenants.createdAt,
    })
    .from(tenants)
    .where(
      q
        ? or(
            like(tenants.name, `%${q}%`),
            like(tenants.slug, `%${q}%`),
          )
        : status === "active"
          ? eq(tenants.isActive, true)
          : status === "inactive"
            ? eq(tenants.isActive, false)
            : undefined,
    )
    .orderBy(desc(tenants.createdAt));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tenant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} tenant terdaftar</p>
        </div>
      </div>

      {/* Filter + Search */}
      <form className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nama atau slug..."
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-64"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Non-aktif</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Nama</th>
              <th className="text-left px-5 py-2.5 font-medium">Slug / Domain</th>
              <th className="text-left px-5 py-2.5 font-medium">Status</th>
              <th className="text-left px-5 py-2.5 font-medium">Dibuat</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  Tidak ada tenant ditemukan.
                </td>
              </tr>
            ) : rows.map((t) => (
              <tr key={t.id} className="hover:bg-muted/20">
                <td className="px-5 py-3">
                  <Link href={`/platform/tenants/${t.slug}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <p className="font-mono text-xs text-muted-foreground">{t.slug}</p>
                  {t.customDomain && (
                    <p className="text-xs text-muted-foreground">{t.customDomain}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {t.isActive ? "Aktif" : "Non-aktif"}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {t.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-5 py-3 text-right">
                  <PlatformTenantActions
                    tenantId={t.id}
                    tenantSlug={t.slug}
                    isActive={t.isActive}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
