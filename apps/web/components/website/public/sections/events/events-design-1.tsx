import { PostsSectionTitle } from "../posts/posts-section-title";
import { EventCard } from "@/components/website/public/event-cards/event-card";
import type { EventCardData } from "@/lib/event-card-templates";
import type { EventsSectionProps } from "@/lib/events-section-designs";

// "Grid Event" — ikut setting "Desain Kartu Arsip" (docs/arsitektur-event.md), bukan pilihan
// kartu terpisah. Registry arsip Event baru 1 desain — dispatch di bawah selalu 1 cabang untuk
// sekarang, murni plumbing supaya desain baru nanti otomatis ikut tanpa ubah file ini lagi.
// Mobile TETAP list (bukan slider) — dikonfirmasi user, treatment ini sudah benar sejak awal.
function renderCard(e: EventCardData, tenantSlug: string, cardDesign: EventsSectionProps["cardDesign"], timezone: string) {
  switch (cardDesign) {
    default: return <EventCard event={e} variant="grid" tenantSlug={tenantSlug} timezone={timezone} />;
  }
}

export function EventsDesign1({ events, tenantSlug, sectionTitle, filterHref, cardDesign, timezone }: EventsSectionProps) {
  if (events.length === 0) return null;
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* ── MOBILE: list style (agenda strip) ── */}
        <div className="sm:hidden divide-y divide-border">
          {events.map(e => (
            <EventCard key={e.id} event={e} variant="list" tenantSlug={tenantSlug} timezone={timezone} />
          ))}
        </div>

        {/* ── DESKTOP: grid 2/3 kolom ── */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(e => (
            <div key={e.id}>{renderCard(e, tenantSlug, cardDesign, timezone)}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
