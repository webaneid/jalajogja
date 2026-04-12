"use client";

import { TITLE_MAX_LENGTH, DESC_MAX_LENGTH } from "@/lib/seo-defaults";

interface SnippetPreviewProps {
  title: string;
  description: string;
  url: string;
  mode?: "desktop" | "mobile";
}

export function SnippetPreview({
  title,
  description,
  url,
  mode = "desktop",
}: SnippetPreviewProps) {
  const displayTitle = title.trim() || "Judul Halaman";
  const displayDesc  = description.trim() || "Deskripsi halaman akan tampil di sini saat muncul di hasil pencarian Google.";
  const displayUrl   = url || "https://contoh.jalajogja.com/halaman";

  const shownTitle = displayTitle.length > TITLE_MAX_LENGTH
    ? displayTitle.slice(0, TITLE_MAX_LENGTH) + "..."
    : displayTitle;
  const shownDesc = displayDesc.length > DESC_MAX_LENGTH
    ? displayDesc.slice(0, DESC_MAX_LENGTH) + "..."
    : displayDesc;

  return (
    <div
      className={`bg-white rounded-lg border border-border p-4 font-sans
        ${mode === "desktop" ? "max-w-[600px]" : "max-w-[360px] mx-auto"}`}
    >
      {/* Favicon + URL */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-[9px] text-muted-foreground font-bold">G</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[#202124] leading-none truncate">Website Organisasi</p>
          <p className="text-xs text-[#4d5156] truncate">{displayUrl}</p>
        </div>
      </div>

      {/* Title */}
      <p className="text-[#1a0dab] text-xl leading-snug hover:underline cursor-pointer line-clamp-1 mt-1">
        {shownTitle}
      </p>

      {/* Description */}
      <p className="text-sm text-[#4d5156] mt-1 leading-snug line-clamp-2">
        {shownDesc}
      </p>
    </div>
  );
}
