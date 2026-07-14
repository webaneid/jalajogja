export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq, and, sql } from "drizzle-orm";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";

// Kirim pengingat WA H-1 sebelum event berlangsung — dipicu crontab VPS harian.
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

    const tomorrowEvents = await tdb
      .select({
        id:       schema.events.id,
        slug:     schema.events.slug,
        title:    schema.events.title,
        startsAt: schema.events.startsAt,
        location: schema.events.location,
      })
      .from(schema.events)
      .where(and(
        eq(schema.events.status, "published"),
        sql`${schema.events.startsAt}::date = ${tomorrowStr}`,
      ));

    for (const event of tomorrowEvents) {
      if (!event.startsAt) continue;

      const registrations = await tdb
        .select({
          attendeeName:       schema.eventRegistrations.attendeeName,
          attendeePhone:      schema.eventRegistrations.attendeePhone,
          registrationNumber: schema.eventRegistrations.registrationNumber,
        })
        .from(schema.eventRegistrations)
        .where(and(
          eq(schema.eventRegistrations.eventId, event.id),
          eq(schema.eventRegistrations.status, "confirmed"),
        ));

      const eventDate = event.startsAt.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      for (const reg of registrations) {
        if (!reg.attendeePhone) continue;

        void notifyWa({
          slug: tenant.slug, tenantDb, event: "event_reminder",
          phone: reg.attendeePhone,
          vars: {
            name:      reg.attendeeName,
            eventName: event.title,
            eventDate: `${eventDate} WIB`,
            location:  event.location ?? "-",
            regNumber: reg.registrationNumber,
            eventUrl:  waAppUrl(tenant.slug, `/agenda/${event.slug}`),
          },
        });
        notified++;
      }
    }
  }

  return NextResponse.json({ notified });
}
