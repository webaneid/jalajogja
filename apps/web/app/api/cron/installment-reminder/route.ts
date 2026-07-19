export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq, and, or, inArray, ne } from "drizzle-orm";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";
import { getTenantTimezone, anchorTodayUtc } from "@/lib/tenant-timezone.server";

// Kirim pengingat WA H-1 + hari-H untuk termin cicilan yang jatuh tempo — dipicu crontab VPS
// harian. Terpisah dari invoice-reminder karena `invoices.dueDate` di-freeze ke tanggal termin
// PERTAMA saja saat konversi (tidak pernah diupdate lagi) — termin ke-2 dst hanya bisa dideteksi
// dari installment_schedules.due_date. Auth via x-cron-secret header, pola sama cron lain.
export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let notified = 0;

  for (const tenant of activeTenants) {
    const tenantDb = createTenantDb(tenant.slug);
    const { db: tdb, schema } = tenantDb;

    // "Hari ini" dan "besok" WAJIB dihitung per-tenant dari kalender timezone tenant tsb —
    // lihat penjelasan sama di event-reminder/route.ts dan invoice-reminder/route.ts.
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const today = anchorTodayUtc(tenantTimezone);
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = anchorTodayUtc(tenantTimezone);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const dueTerms = await tdb
      .select({
        termNumber:        schema.installmentSchedules.termNumber,
        dueDate:           schema.installmentSchedules.dueDate,
        amount:            schema.installmentSchedules.amount,
        uniqueCode:        schema.installmentSchedules.uniqueCode,
        invoiceId:         schema.installmentSchedules.invoiceId,
        invoiceNumber:     schema.invoices.invoiceNumber,
        customerName:      schema.invoices.customerName,
        customerPhone:     schema.invoices.customerPhone,
        total:             schema.invoices.total,
        paidAmount:        schema.invoices.paidAmount,
        installmentCount:  schema.installmentPlans.installmentCount,
      })
      .from(schema.installmentSchedules)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.installmentSchedules.invoiceId))
      .innerJoin(schema.installmentPlans, eq(schema.installmentPlans.id, schema.installmentSchedules.installmentPlanId))
      .where(and(
        ne(schema.installmentSchedules.status, "paid"),
        inArray(schema.invoices.status, ["pending", "partial", "waiting_verification"]),
        or(
          eq(schema.installmentSchedules.dueDate, todayStr),
          eq(schema.installmentSchedules.dueDate, tomorrowStr),
        ),
      ));

    for (const term of dueTerms) {
      if (!term.customerPhone) continue;

      const isToday   = term.dueDate === todayStr;
      const remaining = parseFloat(String(term.total)) - parseFloat(String(term.paidAmount));
      const amount    = parseFloat(String(term.amount)) + (term.uniqueCode ?? 0);
      const invoiceUrl = await waAppUrl(tenant.slug, `/invoice/${term.invoiceId}`);

      void notifyWa({
        slug: tenant.slug, tenantDb,
        event: isToday ? "installment_due_today" : "installment_reminder",
        phone: term.customerPhone,
        vars: {
          name:             term.customerName,
          invoiceNumber:    term.invoiceNumber,
          termNumber:       String(term.termNumber),
          installmentCount: String(term.installmentCount),
          amount:           waRupiah(amount),
          remaining:        waRupiah(remaining),
          dueDate:          term.dueDate,
          invoiceUrl,
        },
      });
      notified++;
    }
  }

  return NextResponse.json({ notified });
}
