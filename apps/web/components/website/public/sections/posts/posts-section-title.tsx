import { cn } from "@/lib/utils";
import { SectionSeeAllLink } from "@/components/website/public/sections/section-see-all-link";

type Props = {
  title:      string;     // *italic* untuk bagian berwarna primary
  href?:      string;     // opsional — jika tidak ada, link kanan tidak tampil
  linkLabel?: string;
  label?:     string;     // teks mono kecil di atas heading (opsional)
  as?:        "h2" | "h3";
  className?: string;
};

function renderTitle(text: string) {
  const parts = text.split(/\*([^*]+)\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <em key={i} style={{ fontStyle: "italic", color: "var(--primary)" }}>{part}</em>
      : <span key={i}>{part}</span>
  );
}

export function PostsSectionTitle({
  title,
  href,
  linkLabel = "Lihat Semua",
  label,
  as: Tag = "h2",
  className,
}: Props) {
  return (
    <div className={cn("flex items-end justify-between gap-6 mb-10 flex-wrap", className)}>

      {/* Kiri: label mono + heading besar */}
      <div>
        {label && (
          <span className="block font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
            {label}
          </span>
        )}
        <Tag
          className="font-normal leading-none m-0 text-4xl lg:text-[48px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {renderTitle(title)}
        </Tag>
      </div>

      {/* Kanan: link lihat semua (opsional) */}
      {href && <SectionSeeAllLink href={href} label={linkLabel} className="self-end" />}

    </div>
  );
}
