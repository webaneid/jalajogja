export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq, and, inArray } from "drizzle-orm";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";

// Kirim pengingat WA H-1 sebelum invoice jatuh tempo — dipicu crontab VPS harian.
// Auth via x-cron-secret header, pola sama dengan cleanup-images/verify-domains.
export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let notified = 0;

  for (const tenant of activeTenants) {
    const tenantDb = createTenantDb(tenant.slug);
    const { db: tdb, schema } = tenantDb;

    const dueInvoices = await tdb
      .select({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        customerName:  schema.invoices.customerName,
        customerPhone: schema.invoices.customerPhone,
        total:         schema.invoices.total,
        paidAmount:    schema.invoices.paidAmount,
        uniqueCode:    schema.invoices.uniqueCode,
        dueDate:       schema.invoices.dueDate,
      })
      .from(schema.invoices)
      .where(and(
        inArray(schema.invoices.status, ["pending", "partial"]),
        eq(schema.invoices.dueDate, tomorrowStr),
      ));

    for (const inv of dueInvoices) {
      if (!inv.customerPhone) continue;

      const total     = parseFloat(String(inv.total));
      const uniqueCode = inv.uniqueCode ?? 0;
      const remaining  = (total + uniqueCode) - parseFloat(String(inv.paidAmount));

      const invoiceUrl = await waAppUrl(tenant.slug, `/invoice/${inv.id}`);
      void notifyWa({
        slug: tenant.slug, tenantDb, event: "invoice_reminder",
        phone: inv.customerPhone,
        vars: {
          name:          inv.customerName,
          invoiceNumber: inv.invoiceNumber,
          amount:        waRupiah(remaining),
          dueDate:       inv.dueDate ?? tomorrowStr,
          invoiceUrl,
        },
      });
      notified++;
    }
  }

  return NextResponse.json({ notified });
}
