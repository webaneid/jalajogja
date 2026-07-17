import type { EventCardData } from "@/lib/event-card-templates";
import type { EventArchiveCardDesignId } from "@/lib/event-archive-card-designs";
import { EventArchiveCardsDesign1 } from "./event-archive-cards-design-1";

type Props = {
  design:     EventArchiveCardDesignId;
  events:     EventCardData[];
  tenantSlug: string;
};

// Dispatcher desain kartu arsip event — dipakai di /agenda (arsip).
// Nambah desain baru: tambah ID di lib/event-archive-card-designs.ts + case di sini +
// komponen event-archive-cards-design-N.tsx baru (ikuti pola Design1 — grid desktop/list mobile).
export function EventArchiveCards({ design, events, tenantSlug }: Props) {
  switch (design) {
    default: return <EventArchiveCardsDesign1 events={events} tenantSlug={tenantSlug} />;
  }
}
