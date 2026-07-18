import type { EventCardData } from "@/lib/event-card-templates";
import { EventCard } from "./event-card";

// Desain 1 — Klasik. Grid di desktop, List di mobile (wajib untuk semua desain di registry
// ini — lihat lib/event-archive-card-designs.ts). Dual-render CSS breakpoint, SSR-safe,
// tidak perlu "use client" — pola sama campaign-archive-cards-design-1.tsx.
export function EventArchiveCardsDesign1({
  events,
  tenantSlug,
  timezone,
}: {
  events:     EventCardData[];
  tenantSlug: string;
  timezone:   string;
}) {
  return (
    <>
      {/* Desktop: Grid 3 kolom */}
      <div className="hidden md:grid grid-cols-3 gap-5">
        {events.map(e => (
          <EventCard key={e.id} event={e} variant="grid" tenantSlug={tenantSlug} timezone={timezone} />
        ))}
      </div>
      {/* Mobile: List */}
      <div className="md:hidden flex flex-col">
        {events.map(e => (
          <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} timezone={timezone} />
        ))}
      </div>
    </>
  );
}
