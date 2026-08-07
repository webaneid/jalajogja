import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { EkosistemPengaturanForm } from "@/components/ekosistem/ekosistem-pengaturan-form";
import { resolveEkosistemModuleLabels } from "@/lib/ekosistem-modules";

export default async function EkosistemPengaturanPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb  = createTenantDb(slug);
  const settings  = await getSettings(tenantDb, "ekosistem");

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan Ekosistem</h2>
        <p className="text-sm text-muted-foreground">
          Kelola modul direktori anggota (Usaha, Pesantren, Profesional) untuk tenant ini.
        </p>
      </div>

      <EkosistemPengaturanForm
        slug={slug}
        defaultValues={{
          usahaEnabled:       (settings.usaha_enabled       as boolean) ?? true,
          pesantrenEnabled:   (settings.pesantren_enabled   as boolean) ?? true,
          profesionalEnabled: (settings.profesional_enabled as boolean) ?? true,
        }}
        defaultLabels={resolveEkosistemModuleLabels(settings)}
      />
    </div>
  );
}
