import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { NotificationsSettingsForm } from "@/components/settings/notifications-settings-form";
import { WhatsAppSetupClient } from "@/components/settings/whatsapp-setup-client";
import type { WaNotifConfig } from "@/lib/whatsapp";

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

  const notif     = (settings.notifications as NotifConfig) ?? null;
  const waConfig  = (settings["whatsapp_config"] as WaNotifConfig | undefined) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Notifikasi</h2>
        <p className="text-sm text-muted-foreground">
          Atur kapan sistem mengirim notifikasi ke admin atau anggota.
        </p>
      </div>

      {/* Email */}
      <section className="space-y-3">
        <h3 className="border-b pb-1.5 text-sm font-semibold">Notifikasi Email</h3>
        <p className="text-xs text-muted-foreground">
          Email dikirim ke alamat admin yang dikonfigurasi di pengaturan SMTP.
        </p>
        <NotificationsSettingsForm
          slug={slug}
          defaultValues={{
            emailNewMember:        notif?.emailNewMember        ?? true,
            emailPaymentIn:        notif?.emailPaymentIn        ?? true,
            emailPaymentConfirmed: notif?.emailPaymentConfirmed ?? true,
            whatsappEnabled:       notif?.whatsappEnabled       ?? false,
          }}
        />
      </section>

      {/* WhatsApp Gateway */}
      <section className="space-y-3">
        <div className="border-b pb-1.5">
          <h3 className="text-sm font-semibold">WhatsApp Gateway</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Notifikasi otomatis via WhatsApp ke anggota, pelanggan, dan pengurus.
            Membutuhkan konfigurasi GOWA di server.
          </p>
        </div>
        <WhatsAppSetupClient slug={slug} config={waConfig} />
      </section>
    </div>
  );
}
