import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "positive" | "negative" | "warning";

const TONE_ICON_BG: Record<Tone, string> = {
  neutral:  "bg-primary/10 text-primary",
  positive: "bg-green-100 text-green-600",
  negative: "bg-red-100 text-red-600",
  warning:  "bg-amber-100 text-amber-600",
};

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  href,
  tone = "neutral",
}: {
  label:     string;
  value:     string;
  sublabel?: string;
  icon:      LucideIcon;
  href?:     string;
  tone?:     Tone;
}) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-5 h-full transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_BG[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
