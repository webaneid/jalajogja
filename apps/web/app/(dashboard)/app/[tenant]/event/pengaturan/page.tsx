import { redirect }                   from "next/navigation";
import { getTenantAccess }             from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { EventArchiveDesignForm }      from "@/components/event/event-archive-design-form";
import { EVENT_ARCHIVE_CARD_DESIGN_IDS, type EventArchiveCardDesignId } from "@/lib/event-archive-card-designs";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const settings     = await getSettings(tenantClient, "event");

  const archiveDesignRaw = settings.event_archive_design as { design?: string } | undefined;
  const archiveDesign: EventArchiveCardDesignId = EVENT_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as EventArchiveCardDesignId)
    ? (archiveDesignRaw!.design as EventArchiveCardDesignId)
    : "1";

  return (
    <div className="p-6 space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurasi tampilan modul event.
        </p>
      </div>

      <section>
        <EventArchiveDesignForm slug={slug} initialDesign={archiveDesign} />
      </section>
    </div>
  );
}
