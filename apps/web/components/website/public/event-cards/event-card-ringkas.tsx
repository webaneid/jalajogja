import type { EventCardData } from "@/lib/event-card-templates";
import { formatEventDate, formatTicketPrice } from "@/lib/event-card-templates";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventCardRingkas({ event, tenantSlug, className, timezone }: { event: EventCardData; tenantSlug: string; className?: string; timezone: string }) {
  const date = formatEventDate(event.startsAt, timezone);

  return (
    <a
      href={`/${tenantSlug}/agenda/${event.slug}`}
      className={cn(
        "group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all",
        className,
      )}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <CalendarDays className="w-8 h-8" />
          </div>
        )}
        {event.startsAt && (
          <div className="absolute top-2 left-2 bg-white/90 rounded-lg px-2 py-1 text-center">
            <div className="text-[9px] font-semibold text-primary uppercase">{date.month}</div>
            <div className="text-base font-bold text-foreground leading-none">{date.day}</div>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        <p className={`text-xs font-medium ${event.lowestPrice && parseFloat(event.lowestPrice) > 0 ? "text-primary" : "text-green-600"}`}>
          {formatTicketPrice(event.lowestPrice)}
        </p>
      </div>
    </a>
  );
}
