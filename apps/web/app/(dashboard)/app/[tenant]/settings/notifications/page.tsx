import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { NotificationsSettingsForm } from "@/components/settings/notifications-settings-form";
import { WhatsAppSetupClient } from "@/components/settings/whatsapp-setup-client";
import type { WaNotifConfig } from "@/lib/whatsapp";
import { PjSettingsForm } from "@/components/settings/pj-settings-form";
import { canManageUsers } from "@/lib/permissions";
import { PJ_CONFIG_KEY, type OfficerNotificationConfig } from "@/lib/pj-config";
import { db, members } from "@jalajogja/db";
import { eq, inArray } from "drizzle-orm";

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
  };

  const notif       = (settings.notifications as NotifConfig) ?? null;
  const waConfig    = (settings["whatsapp_config"] as WaNotifConfig | undefined) ?? null;
  const waTemplates = (settings["wa_message_templates"] as Record<string, string> | undefined) ?? {};

  // Penanggung Jawab (PJ) per modul — hanya yang boleh mengelola pengguna.
  const canEditPj = canManageUsers(access.tenantUser);
  let pjOfficers: { value: string; label: string }[] = [];
  let pjDivisions: { value: string; label: string }[] = [];
  if (canEditPj) {
    const { db: tdb, schema } = tenantDb;
    const [officerRows, divisionRows] = await Promise.all([
      tdb.select().from(schema.officers).where(eq(schema.officers.isActive, true)),
      tdb.select().from(schema.divisions).where(eq(schema.divisions.isActive, true)),
    ]);
    const memberRows = officerRows.length === 0 ? [] : await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(inArray(members.id, officerRows.map((o) => o.memberId)));
    const nameById = new Map(memberRows.map((m) => [m.id, m.name]));
    const divName  = new Map(divisionRows.map((d) => [d.id, d.name]));
    pjOfficers = officerRows.map((o) => ({
      value: o.id,
      label: `${nameById.get(o.memberId) ?? "—"} — ${o.position}${o.divisionId && divName.get(o.divisionId) ? ` (${divName.get(o.divisionId)})` : ""}`,
    }));
    pjDivisions = divisionRows.map((d) => ({ value: d.id, label: d.name }));
  }
  const pjConfig = (settings[PJ_CONFIG_KEY] as OfficerNotificationConfig | undefined) ?? {};

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
          }}
        />
      </section>

      {/* Penanggung Jawab */}
      {canEditPj && (
        <section className="space-y-3">
          <div className="border-b pb-1.5">
            <h3 className="text-sm font-semibold">Penanggung Jawab (PJ) Modul</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pengurus yang menerima ringkasan otomatis lewat WhatsApp (atau email bila WhatsApp tidak aktif).
              Bendahara juga mendapat tautan untuk memverifikasi pembayaran tanpa login.
            </p>
          </div>
          <PjSettingsForm slug={slug} officers={pjOfficers} divisions={pjDivisions} defaultConfig={pjConfig} />
        </section>
      )}

      {/* WhatsApp Gateway */}
      <section className="space-y-3">
        <div className="border-b pb-1.5">
          <h3 className="text-sm font-semibold">WhatsApp Gateway</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Satu-satunya sakelar untuk notifikasi WhatsApp — status di kartu di bawah ini
            (Belum Diaktifkan / Diaktifkan — Belum Tersambung / Terhubung) menentukan apakah
            pesan benar-benar terkirim. Toggle per-notifikasi di bawah hanya aktif setelah
            status &quot;Terhubung&quot;.
          </p>
        </div>
        <WhatsAppSetupClient slug={slug} config={waConfig} templates={waTemplates} />
      </section>
    </div>
  );
}
