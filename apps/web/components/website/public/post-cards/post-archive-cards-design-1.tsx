import type { PostCardData } from "@/lib/post-card-templates";
import { PostCard } from "./post-card";

// Rasio overlay hero disamakan dengan variant large/medium/thumbnail (1200×630, dst — semua
// share rasio yang sama), BUKAN default aspect-[4/3] milik PostCardOverlay — supaya gambar yang
// sudah di-crop pipeline upload tidak di-crop ULANG dengan rasio berbeda oleh object-cover.
const HERO_ASPECT = "aspect-[1200/630]";

// Desain 1 — Editorial Mix. Post pertama = overlay (hero), 4 post berikutnya = klasik (grid 2
// kolom), sisanya = list. Resep SAMA di setiap halaman pagination (bukan cuma page pertama).
//
// Mobile: seluruh posisi klasik/list melebur jadi list dalam satu stack vertikal — KECUALI tiap
// kelipatan 6 (index % 6 === 0, 0-indexed) tetap/jadi overlay lagi untuk variasi visual. Formula
// ini otomatis mencakup post pertama (index 0 adalah kelipatan 6) tanpa perlu kasus khusus.
//
// Dual-render breakpoint (bukan JS runtime check) — pola sama ProductArchiveCardsDesign1:
// SSR-safe, `hidden md:block` untuk desktop, `md:hidden` untuk mobile.
export function PostArchiveCardsDesign1({
  posts,
  baseUrl,
}: {
  posts:   PostCardData[];
  baseUrl: string;
}) {
  const hero   = posts.slice(0, 1);
  const klasik = posts.slice(1, 5);
  const rest   = posts.slice(5);

  return (
    <>
      {/* Desktop: 3 zona — overlay hero → grid klasik 2 kolom → list */}
      <div className="hidden md:block">
        {hero.map((p) => (
          <div key={p.id} className="mb-6">
            <PostCard post={p} variant="overlay" baseUrl={baseUrl} className={HERO_ASPECT} />
          </div>
        ))}
        {klasik.length > 0 && (
          <div className="grid grid-cols-2 gap-6 mb-6">
            {klasik.map((p) => (
              <PostCard key={p.id} post={p} variant="klasik" baseUrl={baseUrl} />
            ))}
          </div>
        )}
        {rest.length > 0 && (
          <div className="flex flex-col">
            {rest.map((p) => (
              <PostCard key={p.id} post={p} variant="list" baseUrl={baseUrl} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile: stack list datar, tiap kelipatan 6 jadi overlay */}
      <div className="md:hidden flex flex-col">
        {posts.map((p, i) =>
          i % 6 === 0 ? (
            <div key={p.id} className="my-4 first:mt-0">
              <PostCard post={p} variant="overlay" baseUrl={baseUrl} className={HERO_ASPECT} />
            </div>
          ) : (
            <PostCard key={p.id} post={p} variant="list" baseUrl={baseUrl} />
          ),
        )}
      </div>
    </>
  );
}
