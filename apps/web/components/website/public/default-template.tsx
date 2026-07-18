import { renderBody } from "@/lib/letter-render";
import type { NavItem } from "@/lib/nav-menu";
import { SingleFeatureImage } from "@/components/website/public/single/single-feature-image";
import { SocialShareCard } from "@/components/website/public/single/social-share-card";

type Props = {
  title:     string;
  content:   string | null;
  coverUrl:  string | null;
  updatedAt: Date;
  // Shell mobile — HANYA diaktifkan kalau dipanggil dari [pageSlug]/page.tsx (halaman single
  // generik sungguhan). Sengaja opsional — dibiarkan kosong saat dipanggil dari homepage root
  // (app/(public)/[tenant]/page.tsx), karena header situs TIDAK disembunyikan di homepage
  // (HeaderVisibility hanya cocok untuk pola URL single-page, homepage selalu punya header
  // penuh) — kalau shell mobile tetap dipaksa aktif di sana, overlay back+menu akan tumpang
  // tindih dengan header asli yang tetap tampil. Lihat docs/arsitektur-frontend-publik.md.
  backHref?: string;
  navMenu?:  NavItem[];
  siteName?: string;
  pageUrl?:  string;
};

export function DefaultTemplate({ title, content, coverUrl, updatedAt, backHref, navMenu, siteName, pageUrl }: Props) {
  const html = renderBody(content);
  const showMobileShell = navMenu !== undefined;

  const updatedText = `Diperbarui ${new Intl.DateTimeFormat("id-ID", {
    year: "numeric", month: "long", day: "numeric",
  }).format(updatedAt)}`;

  const contentBlock = (
    <div
      className="prose prose-sm max-w-none
        [&_p]:my-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3
        [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
        [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
        [&_li]:my-1 [&_a]:text-primary [&_a]:underline
        [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4
        [&_blockquote]:italic [&_blockquote]:text-muted-foreground
        [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-4 [&_pre]:overflow-x-auto
        [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  const desktopArticle = (
    <article className={`${showMobileShell ? "hidden md:block " : ""}max-w-7xl mx-auto px-4 py-10`}>
      <div className="max-w-3xl mx-auto">
        {coverUrl && (
          <div className="mb-8 rounded-xl overflow-hidden aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1>

        <p className="text-xs text-muted-foreground mb-8">{updatedText}</p>

        {contentBlock}
      </div>
    </article>
  );

  if (!showMobileShell) return desktopArticle;

  return (
    <>
      {/* ── Mobile shell — gambar full-bleed + overlay back/menu, urutan beda dari desktop ── */}
      <div className="md:hidden">
        <SingleFeatureImage
          src={coverUrl}
          alt={title}
          backHref={backHref ?? "/"}
          navMenu={navMenu ?? []}
          siteName={siteName ?? ""}
        />
        <div className="px-4 pt-4 space-y-3">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          <p className="text-xs text-muted-foreground">{updatedText}</p>
          <SocialShareCard url={pageUrl ?? ""} title={title} />
        </div>
        <div className="px-4 pt-6">{contentBlock}</div>
      </div>

      {/* ── Desktop/tablet — TIDAK DIUBAH ── */}
      {desktopArticle}
    </>
  );
}
