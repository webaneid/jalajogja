import type { EventCardData } from "@/lib/event-card-templates";
import { formatEventDate, formatTicketPrice, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/event-card-templates";
import { MapPin } from "lucide-react";

export function EventCardList({ event, tenantSlug, timezone }: { event: EventCardData; tenantSlug: string; timezone: string }) {
  const date      = formatEventDate(event.startsAt, timezone);
  const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? "bg-muted text-muted-foreground";

  return (
    <a
      href={`/${tenantSlug}/agenda/${event.slug}`}
      className="group flex items-start gap-4 py-4 border-t border-border first:border-0 hover:bg-muted/30 px-2 -mx-2 rounded-lg transition-colors"
    >
      {/* Tanggal — kolom kiri */}
      <div className="shrink-0 w-14 text-center bg-primary/10 rounded-xl p-2">
        <div className="text-[10px] font-semibold text-primary uppercase">{date.month}</div>
        <div className="text-2xl font-bold text-primary leading-none">{date.day}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeColor}`}>
            {EVENT_TYPE_LABELS[event.eventType]}
          </span>
          {event.categoryName && (
            <span className="text-[10px] text-muted-foreground">{event.categoryName}</span>
          )}
        </div>
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        {event.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </p>
        )}
      </div>

      {/* Harga */}
      <div className="shrink-0 text-right">
        <span className={`text-sm font-semibold ${event.lowestPrice && parseFloat(event.lowestPrice) > 0 ? "text-primary" : "text-green-600"}`}>
          {formatTicketPrice(event.lowestPrice)}
        </span>
      </div>
    </a>
  );
}
