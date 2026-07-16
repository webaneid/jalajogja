import { ArrowRight } from "lucide-react";
import { MODULE_CATALOG, type ModulesSectionData, type ModuleId } from "@/lib/module-strip-designs";
import { PostsSectionTitle } from "@/components/website/public/sections/posts/posts-section-title";

// Section "Strip Modul" — independen dari hero, admin pilih modul mana saja dari MODULE_CATALOG.
// Markup kartu identik dengan strip modul lama di hero-design-1.tsx/hero-design-2.tsx, disalin
// sebagai render independen (bukan di-share) supaya hero Desain 1 tidak punya dependency baru.

export function ModulesSection({ data, baseUrl }: { data: ModulesSectionData; baseUrl: string }) {
  const items = (data.items ?? []).filter((id): id is ModuleId => id in MODULE_CATALOG);
  if (items.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {data.title && <PostsSectionTitle title={data.title} />}
        <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {items.map((id) => {
            const { path, label, desc, Icon } = MODULE_CATALOG[id];
            return (
              <a
                key={id}
                href={`${baseUrl}/${path}`}
                className="group min-w-[160px] shrink-0 lg:min-w-0 flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all">
                  Lihat semua <ArrowRight className="w-3 h-3" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
