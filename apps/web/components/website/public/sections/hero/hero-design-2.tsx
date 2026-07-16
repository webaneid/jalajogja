import { ArrowRight, ChevronDown } from "lucide-react";
import { HERO_MODULES, type HeroDesignProps } from "@/lib/hero-section-designs";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { renderAccentTitle } from "@/lib/render-accent-title";

// Desain 2 — Full-Bleed Modern. Sumber ide: design-refs/jalakarta-v2/ (lihat design-refs/README.md).
// Struktur & bahasa diadaptasi, bukan disalin mentah — tidak ada field data baru (pakai
// HeroSectionData yang sama persis dengan Desain 1), gradient/scrim disederhanakan dari sumber
// (tanpa tagline slider — data model kita cuma 1 subtitle, bukan array taglines).

export function HeroDesign2({ data: d, baseUrl, heroCard }: HeroDesignProps) {
  const hasImage = !!d.imageUrl;

  return (
    <section className="overflow-hidden">
      <div className="relative min-h-[560px] sm:min-h-[680px] lg:min-h-[800px] flex items-center">
        {/* Background — gambar full-bleed atau fallback gradasi warna tenant */}
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl!}
            alt={d.title ?? ""}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-primary/40" />
        )}
        {/* Scrim gelap — memastikan teks putih tetap terbaca di atas foto apapun */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />

        <div className="relative w-full max-w-7xl mx-auto px-4 py-16">
          <div className="max-w-2xl space-y-5">
            {d.eyebrow && (
              <span className="inline-flex items-center gap-2 bg-white/15 text-white px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {d.eyebrow}
              </span>
            )}
            {d.title && (
              <h1 className="text-white text-4xl sm:text-5xl xl:text-6xl font-bold leading-[0.98] tracking-tight">
                {renderAccentTitle(d.title)}
              </h1>
            )}
            {d.subtitle && (
              <p className="text-white/85 text-base sm:text-lg max-w-lg leading-relaxed">
                {d.subtitle}
              </p>
            )}
            {(d.ctaLabel || d.ctaSecondaryLabel) && (
              <div className="flex gap-3 flex-wrap pt-2">
                {d.ctaLabel && d.ctaUrl && (
                  <PublicButton href={d.ctaUrl as string} variant="primary" size="lg">
                    {d.ctaLabel as string}
                  </PublicButton>
                )}
                {d.ctaSecondaryLabel && d.ctaSecondaryUrl && (
                  <PublicButton href={d.ctaSecondaryUrl as string} variant="light" size="lg" icon="none">
                    {d.ctaSecondaryLabel as string}
                  </PublicButton>
                )}
              </div>
            )}
          </div>

          {/* Kartu mengambang — event mendatang atau berita terbaru. Sengaja diberi jarak dari
              sisi kanan/bawah hero (bukan bottom-0/right-0) supaya benar-benar terlihat
              "mengambang" di atas gambar, bukan menempel ke ujung frame. */}
          {heroCard && (
            <a
              href={heroCard.href}
              className="hidden md:block absolute right-10 lg:right-16 bottom-10 lg:bottom-14 bg-white text-foreground rounded-2xl shadow-xl px-4 py-3 max-w-xs no-underline hover:opacity-90 transition-opacity"
            >
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                {heroCard.label}
              </p>
              <p className="text-sm font-semibold leading-snug line-clamp-2">{heroCard.title}</p>
              {heroCard.date && <p className="text-[11px] text-muted-foreground mt-1.5">{heroCard.date}</p>}
            </a>
          )}
        </div>

        {/* Indikator scroll — dekoratif */}
        <div className="hidden sm:flex absolute left-1/2 bottom-6 -translate-x-1/2 text-white/70 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {/* Module strip — aktif via showModuleStrip, ditempatkan setelah blok gambar (bukan menimpanya) */}
      {d.showModuleStrip && (
        <div className="max-w-7xl mx-auto px-4 pt-10 pb-2">
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
    </section>
  );
}
