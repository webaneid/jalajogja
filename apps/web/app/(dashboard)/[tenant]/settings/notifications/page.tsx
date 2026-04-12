import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { NotificationsSettingsForm } from "@/components/settings/notifications-settings-form";

export default async function NotificationsSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "notif");

  type NotifConfig = {
    emailNewMember: boolean;
    emailPaymentIn: boolean;
    emailPaymentConfirmed: boolean;
    whatsappEnabled: boolean;
  };

  const notif = (settings.notifications as NotifConfig) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifikasi</h2>
        <p className="text-sm text-muted-foreground">
          Atur kapan sistem mengirim notifikasi ke admin atau anggota.
        </p>
      </div>

      <NotificationsSettingsForm
        slug={slug}
        defaultValues={{
          emailNewMember:        notif?.emailNewMember        ?? true,
          emailPaymentIn:        notif?.emailPaymentIn        ?? true,
          emailPaymentConfirmed: notif?.emailPaymentConfirmed ?? true,
          whatsappEnabled:       notif?.whatsappEnabled       ?? false,
        }}
      />
    </div>
  );
}
