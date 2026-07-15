import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ModuleCard({
  title,
  icon: Icon,
  href,
  hrefLabel = "Lihat Semua",
  children,
}: {
  title:      string;
  icon:       LucideIcon;
  href:       string;
  hrefLabel?: string;
  children:   ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="flex-1 text-sm text-muted-foreground space-y-1.5">
        {children}
      </div>

      <Link
        href={href}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1"
      >
        {hrefLabel} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
