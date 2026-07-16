import { ArrowRight } from "lucide-react";
import { HERO_MODULES, type HeroDesignProps } from "@/lib/hero-section-designs";
import { PublicButton } from "@/components/website/public/ui/public-button";

// Desain 1 — Klasik. Ekstraksi 1:1 dari implementasi lama (dulu inline di landing-template.tsx,
// satu-satunya desain hero sebelum sistem variant ditambahkan 2026-07-16).

export function HeroDesign1({ data: d, baseUrl, heroCard }: HeroDesignProps) {
  const hasImage = !!d.imageUrl;

  return (
    <section className="py-10 md:py-16 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Mobile dengan gambar: gambar di atas, teks di bawah */}
        <div className={`grid grid-cols-1 items-center gap-8 ${hasImage ? "lg:grid-cols-2 lg:gap-16" : ""}`}>

          {/* Gambar — ditampilkan PERTAMA di mobile jika ada */}
          {hasImage && (
            <div className="lg:hidden flex justify-center order-first">
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-3 rounded-3xl bg-primary/5 -z-10" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl!}
                  alt={d.title ?? ""}
                  className="w-full aspect-[4/3] object-cover rounded-2xl shadow-xl"
                />
                {heroCard && (
                  <a
                    href={heroCard.href}
                    className="absolute bottom-3 left-3 right-3 bg-primary text-primary-foreground rounded-xl px-3 py-2 no-underline hover:opacity-90 transition-opacity"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-75 mb-0.5">
                      {heroCard.label}
                    </p>
                    <p className="text-xs font-semibold leading-snug line-clamp-1">
                      {heroCard.title}
                    </p>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Teks */}
          <div className={`space-y-5 ${!hasImage ? "max-w-2xl mx-auto text-center" : ""}`}>
            {d.eyebrow && (
              <div className={`flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground ${!hasImage ? "justify-center" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                {d.eyebrow}
              </div>
            )}
            {d.title && (
              <h1 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
                {d.title}
              </h1>
            )}
            {d.subtitle && (
              <p className={`text-base sm:text-lg text-muted-foreground leading-relaxed ${!hasImage ? "mx-auto" : ""} max-w-lg`}>
                {d.subtitle}
              </p>
            )}
            {(d.ctaLabel || d.ctaSecondaryLabel) && (
              <div className={`flex gap-3 flex-wrap pt-1 ${!hasImage ? "justify-center" : ""}`}>
                {d.ctaLabel && d.ctaUrl && (
                  <PublicButton href={d.ctaUrl as string} variant="primary" size="lg">
                    {d.ctaLabel as string}
                  </PublicButton>
                )}
                {d.ctaSecondaryLabel && d.ctaSecondaryUrl && (
                  <PublicButton href={d.ctaSecondaryUrl as string} variant="ghost" size="lg" icon="none">
                    {d.ctaSecondaryLabel as string}
                  </PublicButton>
                )}
              </div>
            )}
          </div>

          {/* Gambar — desktop only (kanan) */}
          {hasImage && (
            <div className="hidden lg:flex justify-end">
              <div className="relative w-full max-w-xs sm:max-w-sm">
                <div className="absolute -inset-4 rounded-3xl bg-primary/5 -z-10" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl!}
                  alt={d.title ?? ""}
                  className="w-full aspect-[3/4] object-cover rounded-2xl shadow-xl"
                />

                {/* Floating card — event mendatang atau berita terbaru */}
                {heroCard && (
                  <a
                    href={heroCard.href}
                    className="absolute bottom-4 left-4 right-4 bg-primary text-primary-foreground rounded-2xl px-4 py-3 no-underline hover:opacity-90 transition-opacity"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-75 mb-1">
                      {heroCard.label}
                    </p>
                    <p className="text-sm font-semibold leading-snug line-clamp-2">
                      {heroCard.title}
                    </p>
                    {heroCard.date && (
                      <p className="text-[11px] opacity-70 mt-1.5">{heroCard.date}</p>
                    )}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Module strip — aktif via showModuleStrip */}
        {d.showModuleStrip && (
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {HERO_MODULES.map(({ id, path, label, desc, Icon }) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
