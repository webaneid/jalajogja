import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, tenants, createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { getEnabledEkosistemModules, getEkosistemModuleLabels } from "@/lib/ekosistem-modules.server";
import { computeMemberStatistics } from "@/lib/member-statistics.server";
import { StatistikSections } from "@/components/statistik/statistik-sections";
import { ArrowLeft } from "lucide-react";

// Drill-down statistik SATU tenant (cabang/marhalah/forum apa pun) — dipanggil LAZY, hanya
// saat admin Pusat benar-benar klik masuk (bukan dihitung untuk semua tenant di page overview,
// tidak scalable). Lihat docs/arsitektur-backbone-ikpm.md § "E. Statistik detail — REUSE
// penuh dari /{slug}/statistik".

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  cabang:   { label: "Cabang",     cls: "bg-blue-100 text-blue-700" },
  marhalah: { label: "Marhalah",   cls: "bg-purple-100 text-purple-700" },
  forum:    { label: "Forum",      cls: "bg-orange-100 text-orange-700" },
  pusat:    { label: "IKPM Pusat", cls: "bg-emerald-100 text-emerald-700" },
};

export default async function RingkasanTenantDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; targetSlug: string }>;
}) {
  const { tenant: slug, targetSlug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  // Guard KEDUA — dicek terhadap tenant DI URL /app/{slug}/... (konteks dashboard yang sedang
  // dibuka), BUKAN tipe targetSlug (yang bisa cabang/marhalah/forum apa saja). Kalau guard ini
  // gagal, redirect SEBELUM targetSlug bahkan di-resolve — jangan bocorkan apa pun.
  if (access.tenant.tenantType !== "pusat") redirect(`/app/${slug}/dashboard`);

  const [target] = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, tenantType: tenants.tenantType, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, targetSlug))
    .limit(1);
  if (!target) notFound();

  const badge = TYPE_LABEL[target.tenantType] ?? TYPE_LABEL.cabang;

  // Satu-satunya pengecualian sempit terhadap "hanya 3 tabel backbone" — dijelaskan di dokumen
  // arsitektur: murni toggle UI boolean (bukan data finansial/PII), dibaca dari schema tenant
  // TARGET supaya breakdown Pesantren/Usaha/Profesional menghormati toggle admin tenant itu.
  const targetTenantClient = createTenantDb(targetSlug);
  const [enabledModules, moduleLabels] = await Promise.all([
    getEnabledEkosistemModules(targetTenantClient),
    getEkosistemModuleLabels(targetTenantClient),
  ]);
  const statsData       = await computeMemberStatistics(target.id);

  return (
    <div className="p-6 space-y-6">
      <Link
        href={`/app/${slug}/ringkasan-tenant`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit"
      >
        <ArrowLeft size={14} /> Ringkasan Tenant
      </Link>

      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{target.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
            {!target.isActive && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Non-aktif</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-mono">{target.slug}</p>
        </div>
      </div>

      <div className="space-y-12">
        <StatistikSections data={statsData} enabledModules={enabledModules} moduleLabels={moduleLabels} />
      </div>
    </div>
  );
}
