import { cn } from "@/lib/utils";

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
      <div className="flex-1 border-t border-dashed border-gray-300 self-end mb-1" />
      <a
        href={href}
        className="shrink-0 text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 whitespace-nowrap"
      >
        {linkLabel}
        <span aria-hidden className="ml-0.5">›</span>
      </a>
    </div>
  );
}
