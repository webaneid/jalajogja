export type EventCardData = {
  id:           string;
  title:        string;
  slug:         string;
  description:  string | null;
  eventType:    "offline" | "online" | "hybrid";
  coverUrl:     string | null;
  coverVariants?: Record<string, string> | null;
  categoryName: string | null;
  startsAt:     string | null;   // ISO string
  endsAt:       string | null;
  location:     string | null;
  lowestPrice:  string | null;   // null = gratis; MIN(price) dari tiket aktif
  status:       string;
};

export const EVENT_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type EventCardVariant = typeof EVENT_CARD_VARIANTS[number];

export const EVENT_CARD_VARIANT_LABELS: Record<EventCardVariant, string> = {
  grid:    "Grid",
  list:    "List / Agenda",
  ringkas: "Ringkas",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  offline: "Offline",
  online:  "Online",
  hybrid:  "Hybrid",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  offline: "bg-blue-100 text-blue-700",
  online:  "bg-green-100 text-green-700",
  hybrid:  "bg-purple-100 text-purple-700",
};

export function formatEventDate(iso: string | null): { day: string; month: string; full: string } {
  if (!iso) return { day: "?", month: "?", full: "TBA" };
  const d = new Date(iso);
  return {
    day:   d.getDate().toString(),
    month: d.toLocaleDateString("id-ID", { month: "short" }),
    full:  d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  };
}

export function formatTicketPrice(lowestPrice: string | null): string {
  if (!lowestPrice || parseFloat(lowestPrice) === 0) return "Gratis";
  return `Rp ${parseFloat(lowestPrice).toLocaleString("id-ID")}`;
}
