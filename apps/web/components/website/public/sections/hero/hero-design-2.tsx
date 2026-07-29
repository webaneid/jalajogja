import { ChevronDown } from "lucide-react";
import type { HeroDesignProps, FunfactResult } from "@/lib/hero-section-designs";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { renderSafeHtml } from "@/lib/safe-html";

// Desain 2 — Full-Bleed Modern. Sumber ide: design-refs/jalakarta-v2/ (lihat design-refs/README.md).
// Struktur & bahasa diadaptasi, bukan disalin mentah — tidak ada field data baru selain
// funfactItems (pakai HeroSectionData yang sama dengan Desain 1), gradient/scrim disederhanakan
// dari sumber (tanpa tagline slider — data model kita cuma 1 subtitle, bukan array taglines).
//
// Beda dari Desain 1: showModuleStrip DI SINI berarti "tampilkan Funfact" (statistik live dari
// DB, dihitung di hero-section.tsx), BUKAN strip kartu modul — lihat lib/hero-section-designs.ts.

type Props = HeroDesignProps & { funfacts: FunfactResult[] };

export function HeroDesign2({ data: d, heroCard, funfacts }: Props) {
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
                {renderSafeHtml(d.eyebrow)}
              </span>
            )}
            {d.title && (
              <h1 className="text-white text-4xl sm:text-5xl xl:text-6xl font-bold leading-[0.98] tracking-tight">
                {renderSafeHtml(d.title)}
              </h1>
            )}
            {d.subtitle && (
              <p className="text-white/85 text-base sm:text-lg max-w-lg leading-relaxed">
                {renderSafeHtml(d.subtitle)}
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

      {/* Funfact — aktif via showModuleStrip, statistik live dari DB (bukan strip kartu modul
          seperti Desain 1). Gaya visual disamakan dengan StatsSection yang sudah ada di app.
          Dua posisi (funfactStyle): "inline" (default) mengalir normal, "floating" menggantung
          menimpa batas bawah gambar hero via negative margin — sumber ide design-refs/jalakarta-v2/
          (stat bar overlap), lihat design-refs/README.md. */}
      {d.showModuleStrip && funfacts.length > 0 && (
        d.funfactStyle === "floating" ? (
          <div className="relative z-10 -mt-14 md:-mt-20 mx-4 md:mx-auto md:max-w-5xl">
            <div className="bg-background rounded-3xl shadow-2xl px-6 py-6 md:px-10 md:py-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                {funfacts.map((f) => (
                  <div key={f.id}>
                    <div className="text-3xl font-bold text-primary">{f.number}</div>
                    <div className="text-sm text-muted-foreground mt-1">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 pt-10 pb-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {funfacts.map((f) => (
                <div key={f.id}>
                  <div className="text-3xl font-bold text-primary">{f.number}</div>
                  <div className="text-sm text-muted-foreground mt-1">{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </section>
  );
}
