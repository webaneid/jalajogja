import { renderBody } from "@/lib/letter-render";

type Props = {
  title:      string;
  content:    string | null;
  coverUrl:   string | null;
  updatedAt:  Date;
};

export function DefaultTemplate({ title, content, coverUrl, updatedAt }: Props) {
  const html = renderBody(content);

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      {coverUrl && (
        <div className="mb-8 rounded-xl overflow-hidden aspect-video bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1>

      <p className="text-xs text-muted-foreground mb-8">
        Diperbarui{" "}
        {new Intl.DateTimeFormat("id-ID", {
          year: "numeric", month: "long", day: "numeric",
        }).format(updatedAt)}
      </p>

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
    </article>
  );
}
