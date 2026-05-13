import { cn } from "@/lib/utils";
import { PublicButton } from "@/components/website/public/ui/public-button";

type Props = {
  title:      string;
  href:       string;
  linkLabel?: string;
  as?:        "h2" | "h3";
  className?: string;
};

export function PostsSectionTitle({
  title,
  href,
  linkLabel = "Lihat Semua",
  as: Tag = "h2",
  className,
}: Props) {
  return (
    <div className={cn("flex items-center gap-3 mb-4", className)}>
      <Tag className="shrink-0 text-xl font-bold border-b-2 border-primary pb-1">
        {title}
      </Tag>
      <div className="flex-1 border-t border-dashed border-border self-end mb-1" />
      <PublicButton href={href} variant="ghost" size="sm" icon="chevron">
        {linkLabel}
      </PublicButton>
    </div>
  );
}
