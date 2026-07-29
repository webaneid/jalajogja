import { ArrowRight } from "lucide-react";
import type { QuoteSectionData } from "@/lib/quote-section-designs";

type Props = {
  data:             QuoteSectionData;
  memberCount?:     number;
  orgName?:         string;
  lastUpdateText?:  string;
  defaultStatLabel?: string;
  defaultCtaLabel?:  string;
  defaultCtaUrl?:    string;
};

function initials(name: string): string {
  if (!name.trim()) return "Q";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function QuoteSection({
  data,
  memberCount = 0,
  orgName = "",
  lastUpdateText = "",
  defaultStatLabel = "",
  defaultCtaLabel = "",
  defaultCtaUrl = "#",
}: Props) {
  const quoteText = data.quoteText?.trim();
  const authorName = data.authorName?.trim();
  const authorTitle = data.authorTitle?.trim();
  const authorSub = data.authorSub?.trim();
  const authorAvatarUrl = data.authorAvatarUrl;

  const statLabel = data.statLabel?.trim() || defaultStatLabel;
  const ctaLabel = data.ctaLabel?.trim() || defaultCtaLabel;
  const ctaUrl = data.ctaUrl?.trim() || defaultCtaUrl;

  // Jika quoteText belum diisi sama sekali, tampilkan default quote inspiratif
  const displayQuote = quoteText || "Selayaknya seorang santri, takzim kami kepada Kiai-Kiai Gontor tak pernah padam. Semoga kontribusi sederhana ini memberikan manfaat bagi almamater dan masyarakat.";
  const displayAuthorName = authorName || (orgName ? `Anggota ${orgName}` : "Anggota Organisasi");

  return (
    <section className="py-12 md:py-16 px-4">
      <div className="max-w-7xl mx-auto border-t border-border/40 pt-10 md:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
          
          {/* ── Kolom Kiri: Quote & Sitasi Tokoh (~65% width) ── */}
          <div className="lg:col-span-8 flex flex-col justify-center">
            <blockquote className="text-xl sm:text-2xl md:text-[26px] font-bold text-foreground leading-snug tracking-tight">
              “{displayQuote}”
            </blockquote>

            <div className="flex items-center gap-4 mt-6 sm:mt-8">
              {/* Foto Avatar 1:1 Bulat */}
              {authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authorAvatarUrl}
                  alt={displayAuthorName}
                  className="w-14 h-14 rounded-full object-cover shrink-0 border border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0 border border-border">
                  {initials(displayAuthorName)}
                </div>
              )}

              {/* Teks Nama, Profesi, & Sub-label */}
              <div>
                <p className="text-xs sm:text-sm font-semibold text-secondary leading-snug">
                  {[displayAuthorName, authorTitle].filter(Boolean).join(", ")}
                </p>
                {authorSub && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {authorSub}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Kolom Kanan: Angka Stat & Last Update (~35% width) ── */}
          <div className="lg:col-span-4 flex flex-col items-start justify-center">
            {/* Counter Angka Terdaftar Real-Time dari DB */}
            <div className="text-6xl sm:text-7xl md:text-8xl font-extrabold text-secondary tracking-tight leading-none">
              {memberCount}
            </div>

            {/* Label Keterangan Stat (Warna Secondary) */}
            {statLabel && (
              <p className="text-xs sm:text-sm font-semibold text-secondary leading-snug max-w-xs mt-3">
                {statLabel}
              </p>
            )}

            {/* Link CTA (Warna Secondary) */}
            {ctaLabel && (
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-secondary hover:opacity-85 transition-opacity no-underline group mt-5"
              >
                <span>{ctaLabel}</span>
                <ArrowRight className="w-4 h-4 text-secondary transition-transform group-hover:translate-x-1" />
              </a>
            )}

            {/* Sub-text Last Update Real-Time */}
            {lastUpdateText && (
              <p className="text-xs text-muted-foreground mt-1">
                {lastUpdateText}
              </p>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
