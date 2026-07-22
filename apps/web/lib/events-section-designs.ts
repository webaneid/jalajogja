import type { EventCardData } from "./event-card-templates";
import type { EventArchiveCardDesignId } from "./event-archive-card-designs";
import type { SectionTitleAlign } from "./section-title-align";

export type EventsSectionData = {
  title:        string;
  eyebrow?:     string;             // judul kecil di atas title, opsional
  headerDesc?:  string;             // deskripsi di bawah title, opsional
  titleAlign?:  SectionTitleAlign;  // default "left" — lihat lib/section-title-align.ts
  count:        number;          // default 6
  categoryId:   string | null;
  upcomingOnly: boolean;         // default true — filter startsAt > NOW()
};

export const EVENTS_SECTION_DESIGN_IDS = ["1", "2", "3"] as const;
export type EventsSectionDesignId = typeof EVENTS_SECTION_DESIGN_IDS[number];

export type EventsSectionDesignMeta = {
  label:       string;
  description: string;
  minCount:    number;
};

export const EVENTS_SECTION_DESIGNS: Record<EventsSectionDesignId, EventsSectionDesignMeta> = {
  "1": { label: "Grid Event",     description: "3 kolom card dengan badge tanggal menonjol.",                minCount: 3 },
  "2": { label: "Event Utama",    description: "1 event featured besar + list 3 event lain di samping.",     minCount: 2 },
  "3": { label: "Agenda",         description: "List vertikal dengan tanggal di kolom kiri sebagai aksen.", minCount: 2 },
};

export type EventsSectionProps = {
  data:         EventsSectionData;
  events:       EventCardData[];
  tenantSlug:   string;
  sectionTitle: string;
  filterHref:   string;
  cardDesign:   EventArchiveCardDesignId;   // dipakai HANYA oleh EventsDesign1 — ikut Desain Kartu Arsip
  timezone:     string;                     // timezone tenant aktif, untuk formatEventDate/EventCard
};
