import { eq, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";

// Batch resolve jumlah transaksi donasi (paid) per campaign — dual-source, sama prinsip dengan
// resolveQurbanInfoBlocks di lib/campaign-info-block.ts. "donorCount" = jumlah transaksi, bukan
// strict distinct-by-identity — konsisten dengan donor list yang sudah ada di halaman detail
// campaign (juga tidak dedup by identity). Lihat docs/arsitektur-donasi.md § 14n.
export async function resolveDonorCounts(
  tenantClient: TenantDb,
  campaignIds:  string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (campaignIds.length === 0) return map;

  const { db, schema } = tenantClient;

  // Source 1 (legacy): donations JOIN payments WHERE source_type='donation' AND status='paid'
  const legacyRows = await db
    .select({ campaignId: schema.donations.campaignId })
    .from(schema.donations)
    .innerJoin(schema.payments, and(
      eq(schema.payments.sourceType, "donation"),
      eq(schema.payments.sourceId, schema.donations.id),
      eq(schema.payments.status, "paid"),
    ))
    .where(inArray(schema.donations.campaignId, campaignIds));

  for (const r of legacyRows) {
    if (!r.campaignId) continue;
    map.set(r.campaignId, (map.get(r.campaignId) ?? 0) + 1);
  }

  // Source 2 (cart, sumber utama): invoice_items JOIN invoices WHERE invoices.status='paid'
  const cartRows = await db
    .select({ campaignId: schema.invoiceItems.itemId })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(and(
      eq(schema.invoiceItems.itemType, "donation"),
      eq(schema.invoices.status, "paid"),
      inArray(schema.invoiceItems.itemId, campaignIds),
    ));

  for (const r of cartRows) {
    if (!r.campaignId) continue;
    map.set(r.campaignId, (map.get(r.campaignId) ?? 0) + 1);
  }

  return map;
}
