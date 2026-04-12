import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { DisplaySettingsForm } from "@/components/settings/display-settings-form";

export default async function DisplaySettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "display");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tampilan</h2>
        <p className="text-sm text-muted-foreground">
          Warna, font, dan teks footer untuk tampilan publik organisasi.
        </p>
      </div>

      <DisplaySettingsForm
        slug={slug}
        defaultValues={{
          primaryColor: (settings.primary_color as string) ?? "#2563eb",
          font:         (settings.font         as string) ?? "Inter",
          footerText:   (settings.footer_text  as string) ?? "",
        }}
      />
    </div>
  );
}
