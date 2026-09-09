export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq, and, inArray, lte, isNull, sql } from "drizzle-orm";
import { getAvailableStock } from "@jalajogja/db";
import { getTokoSettings } from "@/lib/toko-settings";
import { getTenantTimezone, anchorTodayUtc } from "@/lib/tenant-timezone.server";
import { notifyStockOut, notifyOrderAutoCancelled } from "@/lib/notify-customer";
import { waAppUrl } from "@/lib/wa-notify";

// Dua pekerjaan terpisah, satu cron (jalan harian, sama seperti invoice-reminder). Lihat
// docs/arsitektur-stok.md untuk desain lengkap keputusan bisnisnya.
//
// 1. "Stok habis" — invoice pending (status pending/waiting_verification/partial) dengan item
//    produk yang stok tersedianya (di luar reservasi invoice ini sendiri) sudah tidak cukup
//    lagi. Notifikasi SEKALI per invoice (guard stockAlertSentAt), TIDAK mengubah status invoice
//    apa pun — murni informasi. Berlaku terlepas toggle auto-cancel.
//
// 2. Auto-cancel — HANYA kalau toko.auto_cancel_enabled = true. Invoice (dengan item produk)
//    yang dueDate-nya sudah lewat >= auto_cancel_days_after_due hari TANPA pembayaran →
//    dibatalkan otomatis + notifikasi ke pemesan.
//
// Auth via x-cron-secret header, pola sama dengan cron lain (invoice-reminder dkk).
const PENDING_STATUSES = ["pending", "waiting_verification", "partial"] as const;

export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let stockOutNotified = 0;
  let autoCancelled    = 0;

  for (const tenant of activeTenants) {
    const tenantDb = createTenantDb(tenant.slug);
    const { db: tdb, schema } = tenantDb;
    const tenantTimezone = await getTenantTimezone(tenantDb);

    // ── 1. Stok habis ────────────────────────────────────────────────────────
    const pendingWithProducts = await tdb
      .selectDistinct({
        id:             schema.invoices.id,
        invoiceNumber:  schema.invoices.invoiceNumber,
        customerName:   schema.invoices.customerName,
        customerPhone:  schema.invoices.customerPhone,
        customerEmail:  schema.invoices.customerEmail,
      })
      .from(schema.invoices)
      .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
      .where(and(
        inArray(schema.invoices.status, PENDING_STATUSES),
        eq(schema.invoiceItems.itemType, "product"),
        isNull(schema.invoices.stockAlertSentAt),
      ));

    for (const inv of pendingWithProducts) {
      const items = await tdb
        .select({ itemId: schema.invoiceItems.itemId, quantity: schema.invoiceItems.quantity, name: schema.invoiceItems.name })
        .from(schema.invoiceItems)
        .where(and(
          eq(schema.invoiceItems.invoiceId, inv.id),
          eq(schema.invoiceItems.itemType, "product"),
        ));

      let shortItemName: string | null = null;
      for (const item of items) {
        if (!item.itemId) continue;
        const available = await getAvailableStock(tdb, schema, item.itemId, { excludeInvoiceId: inv.id });
        if (available !== null && item.quantity > available) {
          shortItemName = item.name;
          break;
        }
      }

      if (shortItemName) {
        const invoiceUrl = await waAppUrl(tenant.slug, `/invoice/${inv.id}`);
        await notifyStockOut({
          slug: tenant.slug, tenantDb,
          phone: inv.customerPhone, email: inv.customerEmail, name: inv.customerName,
          invoiceNumber: inv.invoiceNumber, productName: shortItemName, invoiceUrl,
        });
        await tdb.update(schema.invoices).set({ stockAlertSentAt: new Date() }).where(eq(schema.invoices.id, inv.id));
        stockOutNotified++;
      }
    }

    // ── 2. Auto-cancel ───────────────────────────────────────────────────────
    const tokoSettings = await getTokoSettings(tenant.slug);
    if (!tokoSettings.autoCancelEnabled) continue;

    const cancelThreshold = (() => {
      const d = anchorTodayUtc(tenantTimezone);
      d.setUTCDate(d.getUTCDate() - tokoSettings.autoCancelDaysAfterDue);
      return d.toISOString().slice(0, 10);
    })();

    const overdueWithProducts = await tdb
      .selectDistinct({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        customerName:  schema.invoices.customerName,
        customerPhone: schema.invoices.customerPhone,
        customerEmail: schema.invoices.customerEmail,
      })
      .from(schema.invoices)
      .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
      .where(and(
        inArray(schema.invoices.status, PENDING_STATUSES),
        eq(schema.invoiceItems.itemType, "product"),
        lte(schema.invoices.dueDate, cancelThreshold),
      ));

    for (const inv of overdueWithProducts) {
      // Lock + re-cek status di dalam transaction — mencegah race dengan pembayaran yang
      // sedang diproses admin/customer di antara SELECT di atas dan UPDATE di sini (pola sama
      // dengan cancelInvoiceAction/reactivateInvoiceAction).
      const wasCancelled = await tdb.transaction(async (tx) => {
        const [locked] = await tx
          .select({ status: schema.invoices.status })
          .from(schema.invoices)
          .where(sql`${schema.invoices.id} = ${inv.id} FOR UPDATE`);
        if (!locked || !PENDING_STATUSES.includes(locked.status as (typeof PENDING_STATUSES)[number])) {
          return false;
        }
        await tx.update(schema.invoices).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
        return true;
      });

      if (!wasCancelled) continue;

      const invoiceUrl = await waAppUrl(tenant.slug, `/invoice/${inv.id}`);
      await notifyOrderAutoCancelled({
        slug: tenant.slug, tenantDb,
        phone: inv.customerPhone, email: inv.customerEmail, name: inv.customerName,
        invoiceNumber: inv.invoiceNumber, invoiceUrl,
      });
      autoCancelled++;
    }
  }

  return NextResponse.json({ stockOutNotified, autoCancelled });
}
