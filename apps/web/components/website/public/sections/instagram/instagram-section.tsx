import { ArrowRight } from "lucide-react";
import {
  getInstagramShortcode,
  type InstagramSectionData,
  type InstagramItem,
} from "@/lib/instagram-section-designs";

function InstagramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type Props = {
  data:                 InstagramSectionData;
  connected:            boolean;
  resolvedItems:        InstagramItem[];
  resolvedAccountName:  string;
  resolvedAccountUrl:   string;
};

export function InstagramSection({ data, connected, resolvedItems, resolvedAccountName, resolvedAccountUrl }: Props) {
  const mode = data.mode ?? "repost";
  const accountName = resolvedAccountName || data.accountName || "";
  const accountUrl = resolvedAccountUrl || data.accountUrl || "";
  const count = data.count ?? 8;
  const showBorderTop = data.showBorderTop ?? false;
  const postUrls = data.postUrls ?? [];

  // Jika ada postUrls resmi dari Instagram, utamakan membuat embed resmi Instagram — opsi ini
  // TIDAK bergantung pada koneksi OAuth, jadi tetap bisa dipakai meski belum connect.
  const embedShortcodes = postUrls.map(url => ({ url, shortcode: getInstagramShortcode(url) })).filter(x => x.shortcode);

  const displayItems = resolvedItems.slice(0, count);
  const headingText = mode === "repost" ? "Reposted dari" : "Post dari";

  // Belum terhubung ke Instagram DAN tidak ada embed manual — jangan tampilkan section kosong/
  // rusak ke pengunjung publik. Status "belum terhubung" ditampilkan di admin editor
  // (InstagramEditor, section-editors.tsx), bukan di halaman publik ini.
  if (embedShortcodes.length === 0 && displayItems.length === 0) return null;

  return (
    <section className={`py-10 md:py-14 px-4 ${showBorderTop ? "border-t border-border pt-10 md:pt-14" : ""}`}>
      <div className="max-w-7xl mx-auto">
        
        {/* ── Header Section ── */}
        <div className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-4">
          
          {/* Kiri: Judul Simpel + Icon Instagram */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{headingText}</span>
            <InstagramIcon className="w-5 h-5 text-foreground shrink-0" />
          </h2>

          {/* Kanan: Link Linimasa Account — Warna SECONDARY */}
          {accountName && (
            <a
              href={accountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-secondary hover:opacity-85 transition-opacity no-underline group"
            >
              <span>Linimasa {accountName}</span>
              <ArrowRight className="w-4 h-4 text-secondary transition-transform group-hover:translate-x-1" />
            </a>
          )}
        </div>

        {/* ── Photos Grid (4 Kolom Square 1:1) ── */}
        {embedShortcodes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {embedShortcodes.slice(0, count).map((item, i) => (
              <div key={i} className="w-full aspect-square overflow-hidden rounded-xl border border-border/40 shadow-sm bg-white relative">
                <iframe
                  src={`https://www.instagram.com/p/${item.shortcode}/embed`}
                  title={`Instagram post ${i + 1}`}
                  className="w-full h-full border-0 rounded-xl"
                  scrolling="no"
                  allowTransparency
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {displayItems.map((item, i) => {
              const linkHref = item.postUrl || accountUrl;

              return (
                <a
                  key={item.id || i}
                  href={linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block overflow-hidden rounded-xl bg-muted border border-border/40 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.015]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.caption || `Instagram photo ${i + 1}`}
                    className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Hover overlay dengan Instagram icon */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <InstagramIcon className="w-7 h-7 text-white drop-shadow-md" />
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
