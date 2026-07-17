export type QurbanAnimalType = "domba" | "kambing" | "sapi";

// Info block polimorfik — slot kecil di tengah card yang berbeda isi per tipe campaign,
// TANPA mengganti badan card (cover/badge/judul/CTA tetap sama). Lihat docs/arsitektur-donasi.md
// § 14k. Sub-tipe qurban lain (patungan, tabungan) akan ditambah sebagai varian union baru nanti.
export type CampaignCardInfoBlock =
  | { kind: "progress"; collected: number; target: number | null; percent: number | null }
  | { kind: "qurban_tersedia"; minPrice: number; availableTypes: QurbanAnimalType[]; remainingSlots: number }
  | { kind: "qurban_habis" };

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
  progressPercent: number | null;    // pre-computed; null jika tanpa target — dipertahankan utk backward-compat (dipakai featured block campaigns-design-2.tsx)
  endsAt:          string | null;    // ISO string
  isRecurring:     boolean;
  infoBlock:       CampaignCardInfoBlock;   // dipakai CampaignCardGrid/List/Ringkas — lihat § 14k
};

// Bangun info block "progress" dari data yang sudah difetch — dipakai untuk semua campaign non-qurban
export function buildProgressInfoBlock(collected: number, target: number | null): CampaignCardInfoBlock {
  return {
    kind:    "progress",
    collected,
    target,
    percent: target ? Math.min(100, Math.round((collected / target) * 100)) : null,
  };
}

// Bangun info block qurban dari baris qurban_animals (is_active=true) milik satu campaign.
// Pure — tidak query DB, hanya transform data. Dipakai bareng lib/campaign-info-block.ts (resolver DB).
export function buildQurbanInfoBlock(
  animals: { animalType: QurbanAnimalType; price: number; stock: number; booked: number }[],
): CampaignCardInfoBlock {
  const available = animals.filter(a => a.stock > a.booked).sort((a, b) => a.price - b.price);
  if (available.length === 0) return { kind: "qurban_habis" };

  const order: QurbanAnimalType[] = ["domba", "kambing", "sapi"];
  const availableTypes = order.filter(t => available.some(a => a.animalType === t));
  const remainingSlots = available.reduce((sum, a) => sum + (a.stock - a.booked), 0);

  return { kind: "qurban_tersedia", minPrice: available[0]!.price, availableTypes, remainingSlots };
}

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
