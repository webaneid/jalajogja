import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { getTaxonomyOverrides } from "@/lib/taxonomy-overrides.server";
import { EkosistemTaksonomiForm } from "@/components/ekosistem/ekosistem-taksonomi-form";

export default async function EkosistemTaksonomiPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantClient      = createTenantDb(slug);
  const defaultOverrides  = await getTaxonomyOverrides(tenantClient);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Taksonomi Usaha</h2>
        <p className="text-sm text-muted-foreground">
          Ganti label Kategori/Sektor/Bidang Usaha sesuai istilah organisasi Anda, matikan
          sektor yang tidak relevan, dan tambah Bidang Usaha khusus tenant ini.
        </p>
      </div>

      <EkosistemTaksonomiForm slug={slug} defaultOverrides={defaultOverrides} />
    </div>
  );
}
