import type { EventCardData } from "@/lib/event-card-templates";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatEventDate, formatTicketPrice } from "@/lib/event-card-templates";
import { CalendarDays, MapPin } from "lucide-react";

export function EventCardGrid({ event, tenantSlug, timezone }: { event: EventCardData; tenantSlug: string; timezone: string }) {
  const date      = formatEventDate(event.startsAt, timezone);
  const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? "bg-muted text-muted-foreground";

  return (
    <a
      href={`/${tenantSlug}/agenda/${event.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Cover dengan badge tanggal */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <CalendarDays className="w-10 h-10" />
          </div>
        )}
        {/* Badge tanggal */}
        {event.startsAt && (
          <div className="absolute top-3 left-3 bg-white rounded-lg shadow px-2.5 py-1.5 text-center min-w-[2.5rem]">
            <div className="text-[10px] font-semibold text-primary uppercase">{date.month}</div>
            <div className="text-lg font-bold text-foreground leading-none">{date.day}</div>
          </div>
        )}
        {/* Badge tipe */}
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
            {EVENT_TYPE_LABELS[event.eventType]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {event.categoryName && (
          <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full w-fit">
            {event.categoryName}
          </span>
        )}
        <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        {event.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </p>
        )}
        <p className={`text-sm font-semibold mt-auto ${event.lowestPrice && parseFloat(event.lowestPrice) > 0 ? "text-primary" : "text-green-600"}`}>
          {formatTicketPrice(event.lowestPrice)}
        </p>
      </div>
    </a>
  );
}
