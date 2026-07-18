export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq, and, sql } from "drizzle-orm";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";
import { getTenantTimezone, anchorTodayUtc, formatInTz, tzLabel } from "@/lib/tenant-timezone";

// Kirim pengingat WA H-1 sebelum event berlangsung — dipicu crontab VPS harian.
// Auth via x-cron-secret header, pola sama dengan cleanup-images/verify-domains.
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

    // "Besok" WAJIB dihitung per-tenant dari kalender timezone tenant tsb (bukan UTC global
    // sekali di luar loop) — tiap tenant bisa beda timezone, dan UTC mentah bisa geser
    // tanggal kalau cron dieksekusi jam 00:00-06:59 WIB. Lihat lib/tenant-timezone.ts.
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const tomorrow = anchorTodayUtc(tenantTimezone);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

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

      const eventDate = formatInTz(event.startsAt, tenantTimezone, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      for (const reg of registrations) {
        if (!reg.attendeePhone) continue;

        const eventUrl = await waAppUrl(tenant.slug, `/agenda/${event.slug}`);
        void notifyWa({
          slug: tenant.slug, tenantDb, event: "event_reminder",
          phone: reg.attendeePhone,
          vars: {
            name:      reg.attendeeName,
            eventName: event.title,
            eventDate: `${eventDate} ${tzLabel(tenantTimezone)}`,
            location:  event.location ?? "-",
            regNumber: reg.registrationNumber,
            eventUrl,
          },
        });
        notified++;
      }
    }
  }

  return NextResponse.json({ notified });
}
