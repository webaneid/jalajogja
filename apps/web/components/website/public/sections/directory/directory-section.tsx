import { ArrowRight, ImageIcon } from "lucide-react";
import type { DirectorySectionData, DirectoryItem } from "@/lib/directory-section-designs";
import { SectionTitleBlock } from "@/components/website/public/sections/section-title-block";

type Props = {
  data:             DirectorySectionData;
  resolvedItems?:   DirectoryItem[];
  resolvedTitle?:   string;
  archiveHref?:     string;
  typeLabel?:       string;
  orgName?:         string;
};

function ownerInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function DirectorySection({
  data,
  resolvedItems,
  resolvedTitle,
  archiveHref,
  typeLabel = "Direktori",
  orgName = "",
}: Props) {
  const titleStyle = data.titleStyle ?? "simple";
  const titleText = data.title || resolvedTitle || "Direktori Organisasi";
  const count = data.count ?? 4;
  const gridCols = data.gridCols ?? (data.cardDesign === "custom" ? 2 : 3);
  const items = (resolvedItems && resolvedItems.length > 0) ? resolvedItems.slice(0, count) : [];

  // Tidak ada data real sama sekali — jangan tampilkan section kosong/rusak ke publik.
  if (items.length === 0) return null;

  const targetArchiveHref = archiveHref || "#";

  // Class grid container
  const gridContainerClass =
    gridCols === 2
      ? "max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10"
      : gridCols === 4
      ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6"
      : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8";

  return (
    <section className="py-12 md:py-16 px-4">
      <div className="max-w-7xl mx-auto">

        {/* ── Header Section ── */}
        {titleStyle === "simple" ? (
          <div className="flex items-center justify-between mb-8 md:mb-10 flex-wrap gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {titleText}
            </h2>
            <a
              href={targetArchiveHref}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-secondary hover:opacity-85 transition-opacity no-underline group"
            >
              <span>Direktori {typeLabel}{orgName ? ` ${orgName}` : ""}</span>
              <ArrowRight className="w-4 h-4 text-secondary transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        ) : (
          <SectionTitleBlock
            eyebrow={data.eyebrow}
            title={titleText}
            description={data.headerDesc}
          />
        )}

        {/* ── Grid Items ── */}
        <div className={gridContainerClass}>
          {items.map((item) => (
            <div key={item.id} className="flex flex-col group">

              {/* Cover Image — Tanpa Border Radius */}
              <a href={item.href} className="block overflow-hidden bg-muted aspect-[16/9] w-full">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-none transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
              </a>

              {/* Aksen Diamond Melayang berwarna Secondary */}
              <div className="w-3.5 h-3.5 bg-secondary rotate-45 my-4 shrink-0" />

              {/* Title & Description */}
              <a href={item.href} className="no-underline group/title">
                <h3 className="text-xl font-bold text-foreground line-clamp-1 group-hover/title:text-primary transition-colors">
                  {item.title}
                </h3>
              </a>

              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mt-1.5">
                  {item.description}
                </p>
              )}

              {/* Alamat / Lokasi (Warna Secondary) */}
              {item.location && (
                <p className="text-xs font-semibold text-secondary mt-3">
                  {item.location}
                </p>
              )}

              {/* Kategori / Bidang Tag Chip */}
              {item.category && (
                <div className="mt-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground border border-border/80 rounded-md px-2.5 py-1 inline-block bg-background">
                    {item.category}
                  </span>
                </div>
              )}

              {/* Border Tipis Cantik */}
              <div className="border-b border-border/60 pb-4 mt-3" />

              {/* Foto Bulat & Nama Pemilik Usaha / Member */}
              {item.ownerName && (
                <div className="flex items-center gap-2.5 mt-3.5">
                  {item.ownerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.ownerAvatar}
                      alt={item.ownerName}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {ownerInitials(item.ownerName)}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-foreground">{item.ownerName}</span>
                </div>
              )}

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
