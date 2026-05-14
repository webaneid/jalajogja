import { PostsSectionTitle } from "../posts/posts-section-title";
import { EventCard } from "@/components/website/public/event-cards/event-card";
import type { EventsSectionProps } from "@/lib/events-section-designs";

export function EventsDesign1({ events, tenantSlug, sectionTitle, filterHref }: EventsSectionProps) {
  if (events.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* ── MOBILE: list style (agenda strip) ── */}
        <div className="sm:hidden divide-y divide-border">
          {events.map(e => (
            <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* ── DESKTOP: grid 2/3 kolom ── */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(e => (
            <EventCard key={e.id} event={e} variant="grid" tenantSlug={tenantSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
