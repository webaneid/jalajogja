import { cn } from "@/lib/utils";
import { SectionSeeAllLink } from "@/components/website/public/sections/section-see-all-link";
import { SectionTitleBlock } from "@/components/website/public/sections/section-title-block";
import type { SectionTitleAlign } from "@/lib/section-title-align";

type Props = {
  title:        string;     // *italic* untuk bagian berwarna primary
  eyebrow?:     string;     // judul kecil, opsional
  description?: string;     // opsional
  href?:        string;     // opsional — jika tidak ada, link kanan tidak tampil
  linkLabel?:   string;
  align?:       SectionTitleAlign;  // default "left" — "center" pindahkan tombol ke baris bawah
  as?:          "h2" | "h3";
  className?:   string;
};

function renderTitle(text: string) {
  const parts = text.split(/\*([^*]+)\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <em key={i} style={{ fontStyle: "italic", color: "var(--primary)" }}>{part}</em>
      : <span key={i}>{part}</span>
  );
}

// Judul standar section berbasis Post/Produk/Campaign/Event (semua design, lewat sini) — trio
// eyebrow+judul+deskripsi via <SectionTitleBlock> (lib/section-title-align.ts, sama dengan
// Keunggulan/Tentang Kami/Galeri/Statistik). Tombol "Lihat Semua" SELALU di kanan (align="left",
// default) atau di baris terpisah di bawah, terpusat (align="center") — cuma 2 opsi, beda dari
// Keunggulan/CTA yang punya left/center/right.
export function PostsSectionTitle({
  title,
  eyebrow,
  description,
  href,
  linkLabel = "Lihat Semua",
  align = "left",
  as: Tag = "h2",
  className,
}: Props) {
  if (align === "center") {
    return (
      <div className={cn("mb-10", className)}>
        <div className="max-w-3xl mx-auto">
          <SectionTitleBlock
            eyebrow={eyebrow}
            title={renderTitle(title)}
            description={description}
            as={Tag}
            className="text-center"
          />
        </div>
        {href && (
          <div className="flex justify-center mt-6">
            <SectionSeeAllLink href={href} label={linkLabel} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-end justify-between gap-6 mb-10 flex-wrap", className)}>
      {/* [&>*:last-child]:!mb-0 — zerokan margin-bottom bawaan elemen TERAKHIR di dalam title
          block (judul kalau tanpa deskripsi, deskripsi kalau ada) supaya tombol "Lihat Semua"
          tetap align persis ke baseline via items-end, tidak bergeser oleh margin trailing. */}
      <SectionTitleBlock
        eyebrow={eyebrow}
        title={renderTitle(title)}
        description={description}
        as={Tag}
        className="[&>*:last-child]:!mb-0"
      />
      {href && <SectionSeeAllLink href={href} label={linkLabel} className="self-end" />}
    </div>
  );
}
