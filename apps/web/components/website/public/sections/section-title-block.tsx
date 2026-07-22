import type { ReactNode } from "react";
import type { SectionBackground } from "@/lib/section-background";
import { resolveAccentTextClass } from "@/lib/section-background";

type Props = {
  eyebrow?:     string;
  title?:       ReactNode;   // biasanya string, tapi PostsSectionTitle mengirim markup *italic* terparsing
  description?: string;
  background?:  SectionBackground;   // untuk warna eyebrow — default "none"
  as?:          "h2" | "h3";          // default "h2" — h3 untuk sub-header (mis. kolom Trio Column Post)
  className?:   string;
};

// Blok judul standar (judul kecil/eyebrow + judul besar + deskripsi) — satu sumber dipakai
// bersama oleh section Keunggulan/Layanan, Tentang Kami, dan Galeri Foto. Ukuran+bobot judul
// via `.section-title` (globals.css) — bukan Tailwind size utilities yang sebelumnya diulang
// identik persis di tiga tempat. Warna eyebrow otomatis kontras terhadap `background` section
// (lihat lib/section-background.ts § resolveAccentTextClass).
//
// HANYA merender trio konten — align/max-width/mode "beside"/dsb tetap tanggung jawab caller
// (layout section berbeda-beda secara legit, tidak dipaksa seragam). CTA sengaja TIDAK memakai
// komponen ini — CTA punya judul besar tersendiri yang menyamai ukuran Hero, lihat
// docs/arsitektur-cta-section.md.
export function SectionTitleBlock({ eyebrow, title, description, background = "none", as: Tag = "h2", className }: Props) {
  if (!eyebrow && !title && !description) return null;

  const accentCls = resolveAccentTextClass(background);

  return (
    <div className={className}>
      {eyebrow && <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${accentCls}`}>{eyebrow}</p>}
      {title && <Tag className="section-title">{title}</Tag>}
      {description && <p className="text-base opacity-80 leading-relaxed mt-3">{description}</p>}
    </div>
  );
}
