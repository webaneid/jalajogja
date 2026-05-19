import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EventCheckinClient } from "@/components/event/event-checkin-client";

export default async function EventCheckinPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: eventId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [[event], tickets] = await Promise.all([
    db
      .select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt, status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1),
    db
      .select()
      .from(schema.eventTickets)
      .where(eq(schema.eventTickets.eventId, eventId))
      .orderBy(schema.eventTickets.sortOrder),
  ]);

  if (!event) notFound();

  const rawRegs = await db
    .select({
      id:                 schema.eventRegistrations.id,
      registrationNumber: schema.eventRegistrations.registrationNumber,
      attendeeName:       schema.eventRegistrations.attendeeName,
      attendeePhone:      schema.eventRegistrations.attendeePhone,
      status:             schema.eventRegistrations.status,
      ticketId:           schema.eventRegistrations.ticketId,
      checkedInAt:        schema.eventRegistrations.checkedInAt,
    })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId))
    .orderBy(schema.eventRegistrations.attendeeName);

  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  const registrations = rawRegs.map((r) => ({
    id:                 r.id,
    registrationNumber: r.registrationNumber,
    attendeeName:       r.attendeeName,
    attendeePhone:      r.attendeePhone ?? null,
    status:             r.status as "pending" | "confirmed" | "cancelled" | "attended",
    ticketName:         ticketMap.get(r.ticketId ?? "")?.name ?? "—",
    checkedInAt:        r.checkedInAt ?? null,
  }));

  const formatDate = (d: Date | null) => {
    if (!d) return "";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date(d));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/event/acara/${eventId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Pendaftaran
          </Link>
        </div>
        <div className="mt-2">
          <h1 className="font-bold text-lg">{event.title}</h1>
          {event.startsAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3" />
              {formatDate(event.startsAt)}
            </p>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        <EventCheckinClient slug={slug} registrations={registrations} />
      </main>
    </div>
  );
}
