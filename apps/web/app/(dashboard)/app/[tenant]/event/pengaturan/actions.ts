"use server";

import { revalidatePath } from "next/cache";
import { createTenantDb, upsertSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { EVENT_ARCHIVE_CARD_DESIGN_IDS, type EventArchiveCardDesignId } from "@/lib/event-archive-card-designs";

export async function saveEventArchiveDesignAction(
  slug:   string,
  design: EventArchiveCardDesignId,
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event")) return { success: false, error: "Akses ditolak." };

  if (!EVENT_ARCHIVE_CARD_DESIGN_IDS.includes(design))
    return { success: false, error: "Pilihan desain tidak valid." };

  const tenantClient = createTenantDb(slug);
  await upsertSetting(tenantClient, "event_archive_design", "event", { design });

  revalidatePath(`/${slug}/agenda`);
  revalidatePath(`/app/${slug}/event/pengaturan`);
  return { success: true };
}
