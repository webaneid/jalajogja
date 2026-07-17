import { eq, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { buildQurbanInfoBlock, type CampaignCardInfoBlock, type QurbanAnimalType } from "./campaign-card-templates";

// Batch resolve info block qurban untuk banyak campaign sekaligus — satu query, bukan N+1.
// Dipakai di 3 titik fetch card: archive (/campaign), related campaigns (/campaign/[slug]),
// dan section builder landing page (CampaignsSection). Lihat docs/arsitektur-donasi.md § 14k.
export async function resolveQurbanInfoBlocks(
  tenantClient:      TenantDb,
  qurbanCampaignIds: string[],
): Promise<Map<string, CampaignCardInfoBlock>> {
  const map = new Map<string, CampaignCardInfoBlock>();
  if (qurbanCampaignIds.length === 0) return map;

  const { db, schema } = tenantClient;
  const rows = await db
    .select({
      campaignId: schema.qurbanAnimals.campaignId,
      animalType: schema.qurbanAnimals.animalType,
      price:      schema.qurbanAnimals.price,
      stock:      schema.qurbanAnimals.stock,
      booked:     schema.qurbanAnimals.booked,
    })
    .from(schema.qurbanAnimals)
    .where(and(
      inArray(schema.qurbanAnimals.campaignId, qurbanCampaignIds),
      eq(schema.qurbanAnimals.isActive, true),
    ));

  const grouped = new Map<string, { animalType: QurbanAnimalType; price: number; stock: number; booked: number }[]>();
  for (const r of rows) {
    const list = grouped.get(r.campaignId) ?? [];
    list.push({
      animalType: r.animalType as QurbanAnimalType,
      price:      parseFloat(r.price),
      stock:      r.stock,
      booked:     r.booked,
    });
    grouped.set(r.campaignId, list);
  }

  for (const id of qurbanCampaignIds) {
    map.set(id, buildQurbanInfoBlock(grouped.get(id) ?? []));
  }
  return map;
}
