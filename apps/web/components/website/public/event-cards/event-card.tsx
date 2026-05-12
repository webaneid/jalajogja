import type { EventCardData, EventCardVariant } from "@/lib/event-card-templates";
import { EventCardGrid }    from "./event-card-grid";
import { EventCardList }    from "./event-card-list";
import { EventCardRingkas } from "./event-card-ringkas";

type Props = {
  event:      EventCardData;
  variant:    EventCardVariant;
  tenantSlug: string;
  className?: string;
};

export function EventCard({ event, variant, tenantSlug, className }: Props) {
  switch (variant) {
    case "list":    return <EventCardList    event={event} tenantSlug={tenantSlug} />;
    case "ringkas": return <EventCardRingkas event={event} tenantSlug={tenantSlug} className={className} />;
    default:        return <EventCardGrid    event={event} tenantSlug={tenantSlug} />;
  }
}
