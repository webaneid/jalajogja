import type { CampaignCardInfoBlock as InfoBlockData } from "@/lib/campaign-card-templates";
import { formatRp } from "@/lib/campaign-card-templates";

const ANIMAL_LABELS: Record<string, string> = { domba: "🐑 Domba", kambing: "🐐 Kambing", sapi: "🐄 Sapi" };

type Props = {
  info:   InfoBlockData;
  layout: "grid" | "list" | "ringkas";
};

// Slot info polimorfik di dalam badan card — satu tempat, dipakai oleh CampaignCardGrid/List/Ringkas.
// Menambah kind baru (mis. qurban_patungan, qurban_tabungan) = tambah 1 case di sini,
// tidak perlu sentuh ketiga layout. Lihat docs/arsitektur-donasi.md § 14k.
export function CampaignCardInfoBlock({ info, layout }: Props) {
  if (info.kind === "qurban_tersedia") {
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">Mulai dari {formatRp(info.minPrice)}</p>
        {layout !== "list" && (
          <p className="text-xs text-muted-foreground">
            {info.availableTypes.map(t => ANIMAL_LABELS[t]).join(" · ")} · Sisa {info.remainingSlots} slot
          </p>
        )}
      </div>
    );
  }

  if (info.kind === "qurban_habis") {
    return <p className="text-xs text-muted-foreground italic">Hewan qurban sudah habis</p>;
  }

  // kind === "progress"
  if (info.percent === null) {
    return (
      <p className="text-xs text-muted-foreground">
        Terkumpul <span className="font-semibold text-foreground">{formatRp(info.collected)}</span>
      </p>
    );
  }

  if (layout === "list") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${info.percent}%` }} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{formatRp(info.collected)}</span>
      </div>
    );
  }

  if (layout === "ringkas") {
    return (
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${info.percent}%` }} />
      </div>
    );
  }

  // layout === "grid" — versi paling lengkap
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${info.percent}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatRp(info.collected)}</span>
        <span>{info.percent}%</span>
      </div>
    </div>
  );
}
