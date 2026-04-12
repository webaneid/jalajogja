"use client";

import Image from "next/image";

interface SocialPreviewProps {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
  platform?: "facebook" | "twitter";
}

export function SocialPreview({
  title,
  description,
  imageUrl,
  domain,
  platform = "facebook",
}: SocialPreviewProps) {
  const t  = title.trim()       || "Judul Halaman";
  const d  = description.trim() || "Deskripsi halaman";
  const dm = domain             || "contoh.jalajogja.com";

  return platform === "twitter"
    ? <TwitterCard title={t} description={d} imageUrl={imageUrl} domain={dm} />
    : <FacebookCard title={t} description={d} imageUrl={imageUrl} domain={dm} />;
}

function OgImagePlaceholder() {
  return (
    <div className="w-full aspect-[1.91/1] bg-muted flex items-center justify-center">
      <span className="text-xs text-muted-foreground">Gambar OG · 1200 × 630</span>
    </div>
  );
}

function FacebookCard({
  title,
  description,
  imageUrl,
  domain,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
}) {
  return (
    <div className="border border-[#dddfe2] rounded overflow-hidden max-w-[500px] font-sans shadow-sm">
      {imageUrl ? (
        <div className="relative w-full aspect-[1.91/1]">
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="500px" />
        </div>
      ) : (
        <OgImagePlaceholder />
      )}
      <div className="bg-[#f2f3f5] px-3 py-2.5 border-t border-[#dddfe2]">
        <p className="text-[11px] uppercase text-[#606770] tracking-wide truncate">{domain}</p>
        <p className="font-semibold text-[#1d2129] text-sm leading-snug line-clamp-2 mt-0.5">
          {title}
        </p>
        <p className="text-[#606770] text-xs leading-snug line-clamp-2 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function TwitterCard({
  title,
  description,
  imageUrl,
  domain,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
}) {
  return (
    <div className="border border-[#cfd9de] rounded-2xl overflow-hidden max-w-[500px] font-sans">
      {imageUrl ? (
        <div className="relative w-full aspect-[1.91/1]">
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="500px" />
        </div>
      ) : (
        <OgImagePlaceholder />
      )}
      <div className="p-3 bg-white">
        <p className="text-sm font-bold text-[#0f1419] line-clamp-1">{title}</p>
        <p className="text-sm text-[#536471] line-clamp-2 mt-0.5">{description}</p>
        <p className="text-xs text-[#536471] mt-1.5 flex items-center gap-1">
          <span aria-hidden>🔗</span>
          {domain}
        </p>
      </div>
    </div>
  );
}
