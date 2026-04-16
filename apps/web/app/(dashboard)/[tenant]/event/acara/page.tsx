import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { CreateEventButton, EventTable } from "@/components/event/event-list-client";

export default async function AcaraListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const events = await db
    .select({
      id:          schema.events.id,
      slug:        schema.events.slug,
      title:       schema.events.title,
      eventType:   schema.events.eventType,
      status:      schema.events.status,
      startsAt:    schema.events.startsAt,
      endsAt:      schema.events.endsAt,
      location:    schema.events.location,
      createdAt:   schema.events.createdAt,
    })
    .from(schema.events)
    .orderBy(desc(schema.events.createdAt));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Acara & Event</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola kegiatan dan pendaftaran peserta
          </p>
        </div>
        <CreateEventButton slug={slug} />
      </div>

      <EventTable slug={slug} events={events} />
    </div>
  );
}
