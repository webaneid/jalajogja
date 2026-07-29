"use client";

import { useState } from "react";
import { ArrowRight, Play, X } from "lucide-react";
import { HERO_MODULES, type HeroDesignProps } from "@/lib/hero-section-designs";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { getYouTubeVideoId, isYouTubeShorts, buildYouTubeEmbedUrl } from "@/lib/youtube";

export function HeroDesign1({ data: d, baseUrl, heroCard }: HeroDesignProps) {
  const youtubeId = getYouTubeVideoId(d.youtubeUrl);
  const [isPlaying, setIsPlaying] = useState(!!(youtubeId && d.youtubeAutoplay));
  const [popupOpen, setPopupOpen] = useState(false);
  // Bedakan "mulai putar sendiri via config (tanpa klik)" dari "user klik tombol Putar Video" —
  // browser wajib mute autoplay yang tidak dipicu user gesture, tapi klik manual boleh bersuara.
  const [userInitiatedPlay, setUserInitiatedPlay] = useState(false);

  const hasMedia = !!(d.imageUrl || youtubeId);
  const shouldShowCard = d.showHeroCard !== false && !!heroCard;

  const titleColorClass =
    d.titleColor === "primary"
      ? "text-primary"
      : d.titleColor === "secondary"
      ? "text-secondary"
      : "text-foreground";

  const handlePlayClick = () => {
    setUserInitiatedPlay(true);
    if (d.youtubePlayMode === "popup") {
      setPopupOpen(true);
    } else {
      setIsPlaying(true);
    }
  };

  // Deteksi Rasio Asli Video YouTube (Shorts 9:16, Landscape 16:9, Square 1:1)
  const isShorts = isYouTubeShorts(d.youtubeUrl) || d.youtubeAspect === "9:16";
  const isSquare = d.youtubeAspect === "1:1";

  let aspectClass = "aspect-video"; // default 16:9
  const containerWidthClass = "w-full";

  if (isShorts) {
    aspectClass = "aspect-[9/16]";
  } else if (isSquare) {
    aspectClass = "aspect-square";
  }

  const renderMedia = () => {
    if (!hasMedia) return null;

    // Mode Video Sedang Diputar (Inline) — Murni Video Bersih Tanpa Overlay Apapun
    if (isPlaying && d.youtubePlayMode !== "popup" && youtubeId) {
      return (
        <div className={`relative ${containerWidthClass} ${aspectClass} rounded-2xl overflow-hidden shadow-2xl border border-border bg-black`}>
          <iframe
            src={buildYouTubeEmbedUrl(youtubeId, true, !userInitiatedPlay)}
            title={d.title || "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      );
    }

    const isCleanImage = d.imageBorder === "none";

    return (
      <div className={`relative ${containerWidthClass} group`}>
        {!isCleanImage && (
          <div className="absolute -inset-3 rounded-3xl bg-primary/5 -z-10" />
        )}

        {/* Gambar thumbnail original size (tanpa crop paksa, tanpa cap tinggi) */}
        {d.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={d.imageUrl}
            alt={d.title ?? ""}
            className={`w-full h-auto rounded-2xl ${
              isCleanImage ? "" : "shadow-xl border border-border/50"
            }`}
          />
        ) : (
          <div className={`w-full ${aspectClass} rounded-2xl bg-muted flex items-center justify-center border border-border`}>
            <Play className="w-12 h-12 text-muted-foreground opacity-50" />
          </div>
        )}

        {/* Tombol Play YouTube di kiri bawah (jika ada video) */}
        {youtubeId && !isPlaying && (
          <button
            onClick={handlePlayClick}
            className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-primary text-primary-foreground font-medium text-xs px-3.5 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all group/play"
          >
            <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 fill-current text-primary-foreground translate-x-0.5" />
            </div>
            <span>Putar Video</span>
          </button>
        )}

        {/* Floating card — event/donasi/berita terbaru */}
        {shouldShowCard && heroCard && (
          <a
            href={heroCard.href}
            className={`absolute ${
              youtubeId && !isPlaying ? "bottom-16" : "bottom-4"
            } left-3 right-3 lg:left-4 lg:right-4 bg-primary text-primary-foreground rounded-xl md:rounded-2xl px-3.5 py-2.5 md:px-4 md:py-3 no-underline hover:opacity-90 transition-opacity shadow-lg z-10`}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-75 mb-0.5">
              {heroCard.label}
            </p>
            <p className="text-xs md:text-sm font-semibold leading-snug line-clamp-1 md:line-clamp-2">
              {heroCard.title}
            </p>
            {heroCard.date && (
              <p className="text-[10px] md:text-[11px] opacity-70 mt-1">{heroCard.date}</p>
            )}
          </a>
        )}
      </div>
    );
  };

  return (
    <section className="py-10 md:py-16 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Layout Grid */}
        <div className={`grid grid-cols-1 items-center gap-8 ${hasMedia ? "lg:grid-cols-2 lg:gap-16" : ""}`}>
          
          {/* Media — satu instance saja (bukan duplikat mobile+desktop) — posisi diatur murni
              via CSS order, mencegah 2 iframe YouTube ter-mount bersamaan saat video diputar */}
          {hasMedia && (
            <div className="flex justify-center lg:justify-end order-first lg:order-2">
              {renderMedia()}
            </div>
          )}

          {/* Teks Content */}
          <div className={`space-y-5 lg:order-1 ${!hasMedia ? "max-w-2xl mx-auto text-center" : ""}`}>
            {d.eyebrow && (
              <div className={`flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground ${!hasMedia ? "justify-center" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                {d.eyebrow}
              </div>
            )}
            {d.title && (
              <h1 className={`text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight ${titleColorClass}`}>
                {d.title}
              </h1>
            )}
            {d.subtitle && (
              <p className={`text-base sm:text-lg text-muted-foreground leading-relaxed ${!hasMedia ? "mx-auto" : ""} max-w-lg`}>
                {d.subtitle}
              </p>
            )}
            {(d.ctaLabel || d.ctaSecondaryLabel) && (
              <div className={`flex gap-3 flex-wrap pt-1 ${!hasMedia ? "justify-center" : ""}`}>
                {d.ctaLabel && d.ctaUrl && (
                  <PublicButton
                    href={d.ctaUrl as string}
                    variant={d.ctaVariant ?? "primary"}
                    size="lg"
                  >
                    {d.ctaLabel as string}
                  </PublicButton>
                )}
                {d.ctaSecondaryLabel && d.ctaSecondaryUrl && (
                  <PublicButton
                    href={d.ctaSecondaryUrl as string}
                    variant={d.ctaSecondaryVariant ?? "ghost"}
                    size="lg"
                    icon="none"
                  >
                    {d.ctaSecondaryLabel as string}
                  </PublicButton>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Module strip */}
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

      {/* Pop-up Modal Lightbox Video YouTube */}
      {popupOpen && youtubeId && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPopupOpen(false)}
        >
          <div
            className={`relative w-full ${
              isShorts
                ? "max-w-[360px] aspect-[9/16]"
                : isSquare
                ? "max-w-[500px] aspect-square"
                : "max-w-4xl aspect-video"
            } bg-black rounded-2xl overflow-hidden shadow-2xl border border-border`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPopupOpen(false)}
              className="absolute top-3 right-3 z-10 bg-black/60 text-white rounded-full p-2 hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={buildYouTubeEmbedUrl(youtubeId, true)}
              title={d.title || "YouTube video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </section>
  );
}
