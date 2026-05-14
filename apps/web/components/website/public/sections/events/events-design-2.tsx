import { PostsSectionTitle } from "../posts/posts-section-title";
import { EventCard } from "@/components/website/public/event-cards/event-card";
import { formatEventDate, formatTicketPrice, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/event-card-templates";
import type { EventsSectionProps } from "@/lib/events-section-designs";
import { CalendarDays, MapPin } from "lucide-react";

export function EventsDesign2({ events, tenantSlug, sectionTitle, filterHref }: EventsSectionProps) {
  if (events.length === 0) return null;

  const featured  = events[0]!;
  const rest      = events.slice(1, 4);
  const date      = formatEventDate(featured.startsAt);
  const typeColor = EVENT_TYPE_COLORS[featured.eventType] ?? "bg-muted text-muted-foreground";

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* ── MOBILE: full list ── */}
        <div className="sm:hidden divide-y divide-border">
          {events.map(e => (
            <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} />
          ))}
        </div>

        {/* ── DESKTOP: featured besar + list kanan ── */}
        <div className="hidden sm:grid grid-cols-2 gap-6">
          {/* Featured besar */}
          <a
            href={`/${tenantSlug}/agenda/${featured.slug}`}
            className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              {featured.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.coverUrl} alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <CalendarDays className="w-14 h-14" />
                </div>
              )}
              {featured.startsAt && (
                <div className="absolute top-3 left-3 bg-white rounded-lg shadow px-3 py-2 text-center">
                  <div className="text-xs font-semibold text-primary uppercase">{date.month}</div>
                  <div className="text-2xl font-bold text-foreground leading-none">{date.day}</div>
                </div>
              )}
            </div>
            <div className="p-5 space-y-2">
              <div className="flex gap-1.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                  {EVENT_TYPE_LABELS[featured.eventType]}
                </span>
                {featured.categoryName && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {featured.categoryName}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {featured.title}
              </h3>
              {featured.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {featured.location}
                </p>
              )}
              <p className={`font-semibold ${featured.lowestPrice && parseFloat(featured.lowestPrice) > 0 ? "text-primary" : "text-green-600"}`}>
                {formatTicketPrice(featured.lowestPrice)}
              </p>
            </div>
          </a>

          {/* List event lain */}
          {rest.length > 0 && (
            <div className="divide-y divide-border">
              {rest.map(e => (
                <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
