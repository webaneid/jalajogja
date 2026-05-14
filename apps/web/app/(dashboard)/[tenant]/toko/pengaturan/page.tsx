import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { getTokoSettings } from "@/lib/toko-settings";
import { TokoSettingsForm } from "./toko-settings-form";

export default async function TokoSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const settings = await getTokoSettings(slug);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Toko</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi sistem mitra dan informasi toko.
        </p>
      </div>
      <TokoSettingsForm slug={slug} initialSettings={settings} />
    </div>
  );
}
