import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { EmailSettingsForm } from "@/components/settings/email-settings-form";

export default async function EmailSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "mail");

  type SmtpConfig = {
    host: string; port: number; user: string; password: string;
    fromName: string; fromEmail: string;
  };

  const smtp = (settings.smtp_config as SmtpConfig) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email / SMTP</h2>
        <p className="text-sm text-muted-foreground">
          Konfigurasi server email untuk notifikasi dan komunikasi ke anggota.
        </p>
      </div>

      <EmailSettingsForm
        slug={slug}
        defaultValues={{
          host:      smtp?.host      ?? "",
          port:      smtp?.port      ?? 587,
          user:      smtp?.user      ?? "",
          password:  smtp?.password  ?? "",
          fromName:  smtp?.fromName  ?? "",
          fromEmail: smtp?.fromEmail ?? "",
        }}
      />
    </div>
  );
}
