import { ArrowRight } from "lucide-react";
import { pickCover } from "@/lib/post-card-templates";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign6({ data, posts, baseUrl, sectionTitle, filterHref }: PostsSectionProps) {
  // Hanya ambil 2 post (atau sesuai count data)
  const displayPosts = posts.slice(0, data.count ?? 2);

  return (
    <section className="py-12 md:py-16 px-4 overflow-hidden">
      {/* Wrapper luar max-w-7xl — konsisten dengan SEMUA section publik lain (hero, design 1-5,
          about, features, cta) agar batas lebar section proporsional di satu halaman yang sama.
          Konten editorial 2-kolom sendiri tetap dibatasi lebih sempit (max-w-4xl) via wrapper
          dalam — pola sama yang dipakai landing-template.tsx untuk section About/CTA (outer
          max-w-7xl + inner max-w-3xl/4xl), bukan mengganti batas section itu sendiri. */}
      <div className="max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto">

          {/* Judul standar (trio eyebrow+judul+deskripsi) via komponen shared — konsisten dengan
              Design 2/3/5, dan membuat kontrol "Posisi Judul" + filter kategori/tag ("Lihat
              Semua") yang sudah ada di editor benar-benar berpengaruh (sebelumnya hand-rolled
              markup di sini mengabaikan keduanya). Default "center" (bukan "left" generik) —
              identitas visual desain ini memang "di tengah" (lihat POSTS_SECTION_DESIGNS["6"]) —
              admin tetap bebas pilih "left" dari editor jika mau. */}
          <PostsSectionTitle
            title={sectionTitle}
            eyebrow={data.eyebrow}
            description={data.headerDesc}
            align={data.titleAlign ?? "center"}
            href={filterHref}
          />

          {/* ── 2 Columns Cards Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12">
            {displayPosts.map((post) => {
              const coverUrl = pickCover(post, "profile") ?? pickCover(post, "original") ?? post.coverUrl;
              const fullHref = `${baseUrl}${post.href}`;
              const cornerClass = data.imageCorner === "square" ? "rounded-none" : "rounded-xl";

              return (
                <article key={post.id} className="group flex flex-col items-start">
                  <a href={fullHref} className={`w-full block overflow-hidden ${cornerClass} border border-border/40 shadow-sm transition-all duration-300 group-hover:shadow-md`}>
                    {coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={coverUrl}
                        alt={post.coverAlt || post.title}
                        className="w-full aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full aspect-[4/5] bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {post.title}
                      </div>
                    )}
                  </a>

                  {/* Aksen Diamond Warna Secondary */}
                  <div className="w-3 h-3 bg-secondary rotate-45 mt-4 mb-2.5 shrink-0" />

                  {/* Judul Post */}
                  <h3 className="font-bold text-lg md:text-xl text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    <a href={fullHref} className="no-underline text-inherit">
                      {post.title}
                    </a>
                  </h3>

                  {/* Deskripsi Ringkas / Subtitle / Author */}
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Link Baca Lebih Lanjut — Warna SECONDARY */}
                  <a
                    href={fullHref}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline mt-3 transition-colors"
                  >
                    <span>Baca Lebih Lanjut</span>
                    <ArrowRight className="w-3.5 h-3.5 text-secondary transition-transform group-hover:translate-x-1" />
                  </a>
                </article>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
