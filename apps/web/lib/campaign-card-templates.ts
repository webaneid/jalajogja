export type CampaignCardData = {
  id:              string;
  title:           string;
  slug:            string;
  description:     string | null;
  campaignType:    "donasi" | "zakat" | "wakaf" | "qurban";
  coverUrl:        string | null;
  coverVariants?:  Record<string, string> | null;
  categoryName:    string | null;
  targetAmount:    string | null;    // null = tanpa target
  collectedAmount: string;
  progressPercent: number | null;    // pre-computed; null jika tanpa target
  endsAt:          string | null;    // ISO string
  isRecurring:     boolean;
};

export const CAMPAIGN_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type CampaignCardVariant = typeof CAMPAIGN_CARD_VARIANTS[number];

export const CAMPAIGN_CARD_VARIANT_LABELS: Record<CampaignCardVariant, string> = {
  grid:    "Grid",
  list:    "List",
  ringkas: "Ringkas",
};

export const CAMPAIGN_CARD_VARIANT_DESCRIPTIONS: Record<CampaignCardVariant, string> = {
  grid:    "Cover + judul + progress bar + badge tipe. Cocok untuk grid 3 kolom.",
  list:    "Horizontal: thumbnail + judul + progress mini. Cocok untuk list padat.",
  ringkas: "Cover + judul + progress bar tipis. Cocok untuk carousel.",
};

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  donasi: "Donasi",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};

export const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  donasi: "bg-primary/10 text-primary",
  zakat:  "bg-green-100 text-green-700",
  wakaf:  "bg-purple-100 text-purple-700",
  qurban: "bg-amber-100 text-amber-700",
};

// Format nominal Rupiah
export function formatRp(amount: string | number | null): string {
  if (!amount) return "Rp 0";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// Hitung sisa hari dari endsAt
export function daysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
