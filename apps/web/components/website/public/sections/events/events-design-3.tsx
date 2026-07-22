import { PostsSectionTitle } from "../posts/posts-section-title";
import { EventCard } from "@/components/website/public/event-cards/event-card";
import type { EventsSectionProps } from "@/lib/events-section-designs";

export function EventsDesign3({ data, events, tenantSlug, sectionTitle, filterHref, timezone }: EventsSectionProps) {
  if (events.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle
          title={sectionTitle}
          eyebrow={data.eyebrow}
          description={data.headerDesc}
          align={data.titleAlign}
          href={filterHref}
          linkLabel="Lihat Semua"
        />
        <div className="divide-y divide-border">
          {events.map(e => (
            <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} timezone={timezone} />
          ))}
        </div>
      </div>
    </section>
  );
}
