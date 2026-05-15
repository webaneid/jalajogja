import { createHash } from "crypto";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, getSetting, user as authUser, members } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { renderBody } from "@/lib/letter-render";
import { recordView, hashIp } from "@/lib/view-counter";
import { WidgetArea } from "@/components/website/public/widget-area";
import { PublicButton } from "@/components/website/public/ui/public-button";
import type { Metadata } from "next";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

// ── Date formatter ─────────────────────────────────────────────────────────────

function formatPostDate(date: Date, timezone: string): string {
  const tz = timezone || "Asia/Jakarta";

  // "Selasa, 20 April 2026"
  const datePart = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);

  // "00.00" (24 jam, titik sebagai pemisah)
  const timeParts = new Intl.DateTimeFormat("id-ID", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const hour   = timeParts.find(p => p.type === "hour")?.value   ?? "00";
  const minute = timeParts.find(p => p.type === "minute")?.value ?? "00";

  // Abbreviasi timezone: WIB / WITA / WIT / GMT+X
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, timeZoneName: "short",
  }).formatToParts(date);
  const tzAbbr = tzParts.find(p => p.type === "timeZoneName")?.value ?? "";

  return `${datePart} | ${hour}.${minute} ${tzAbbr}`;
}

// ── Data fetcher ───────────────────────────────────────────────────────────────

async function getPost(tenantSlug: string, postSlug: string) {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant?.isActive) return null;

  const tenantClient             = createTenantDb(tenantSlug);
  const { db: tenantDb, schema } = tenantClient;

  const [post] = await tenantDb
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      excerpt:      schema.posts.excerpt,
      content:      schema.posts.content,
      status:       schema.posts.status,
      coverId:      schema.posts.coverId,
      authorId:     schema.posts.authorId,
      publishedAt:  schema.posts.publishedAt,
      updatedAt:    schema.posts.updatedAt,
      metaTitle:    schema.posts.metaTitle,
      metaDesc:     schema.posts.metaDesc,
      ogTitle:      schema.posts.ogTitle,
      ogDesc:       schema.posts.ogDescription,
      categoryName: schema.postCategories.name,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(eq(schema.posts.slug, postSlug))
    .limit(1);

  if (!post || post.status !== "published") return null;

  // Resolve cover
  let coverUrl:     string | null = null;
  let coverAlt:     string | null = null;
  let coverTitle:   string | null = null;
  let coverCaption: string | null = null;
  if (post.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path, variants: schema.media.variants, altText: schema.media.altText, title: schema.media.title, caption: schema.media.caption })
      .from(schema.media)
      .where(eq(schema.media.id, post.coverId))
      .limit(1);
    if (media) {
      const vv = media.variants as Record<string, string> | null;
      coverUrl     = vv?.large ?? vv?.original ?? publicUrl(tenantSlug, media.path);
      coverAlt     = media.altText;
      coverTitle   = media.title;
      coverCaption = media.caption;
    }
  }

  // Timezone dari settings
  const timezone = (await getSetting<string>(tenantClient, "timezone", "general")) ?? "Asia/Jakarta";

  // Resolve author: posts.authorId → tenant.users → public.user + public.members (photoUrl)
  let authorName:   string | null = null;
  let authorAvatar: string | null = null;

  if (post.authorId) {
    const [tenantUser] = await tenantDb
      .select({ betterAuthUserId: schema.users.betterAuthUserId })
      .from(schema.users)
      .where(eq(schema.users.id, post.authorId))
      .limit(1);

    if (tenantUser) {
      const [au] = await db
        .select({ name: authUser.name, email: authUser.email })
        .from(authUser)
        .where(eq(authUser.id, tenantUser.betterAuthUserId))
        .limit(1);

      if (au) {
        authorName = au.name;

        // Cek photoUrl dari members (alumni IKPM yang juga pengurus)
        const [mem] = await db
          .select({ photoUrl: members.photoUrl })
          .from(members)
          .where(eq(members.betterAuthUserId, tenantUser.betterAuthUserId))
          .limit(1);

        if (mem?.photoUrl) {
          authorAvatar = mem.photoUrl;
        } else {
          const hashHex = createHash("md5").update(au.email.trim().toLowerCase()).digest("hex");
          authorAvatar  = `https://www.gravatar.com/avatar/${hashHex}?s=64&d=mp`;
        }
      }
    }
  }

  return {
    post, coverUrl, coverAlt, coverTitle, coverCaption,
    tenantName: tenant.name, timezone, authorName, authorAvatar,
  };
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  const [result, base] = await Promise.all([
    getPost(tenantSlug, postSlug),
    getTenantSeoBase(tenantSlug),
  ]);
  if (!result) return {};
  const { post, coverUrl } = result;
  return buildMetadata({
    title:          post.metaTitle || post.title,
    description:    post.metaDesc ?? post.excerpt,
    siteName:       base.siteName,
    canonicalUrl:   `${base.baseUrl}/post/${postSlug}`,
    ogImageUrl:     coverUrl ?? base.logoUrl,
    ogTitle:        post.ogTitle || undefined,
    ogDescription:  post.ogDesc  || undefined,
    ogType:         "article",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BlogDetailPage({ params }: { params: Params }) {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  const result = await getPost(tenantSlug, postSlug);
  if (!result) notFound();

  const tenantClient = createTenantDb(tenantSlug);

  const hdrs  = await headers();
  const ua    = hdrs.get("user-agent") ?? "";
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|googlebot|bingbot/i.test(ua);
  if (!isBot) {
    const rawIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
               ?? hdrs.get("x-real-ip")
               ?? "unknown";
    after(() => recordView(tenantClient, {
      slug:   tenantSlug,
      type:   "post",
      id:     result.post.id,
      ipHash: hashIp(rawIp),
    }));
  }

  const { post, coverUrl, coverAlt, coverTitle, coverCaption, tenantName, timezone, authorName, authorAvatar } = result;
  const html = renderBody(post.content);

  const fmtUpdated = (date: Date) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex gap-10">
        {/* Main article */}
        <article className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
            <a href={`/${tenantSlug}/post`} className="hover:text-foreground transition-colors">Postingan</a>
            <span>/</span>
            <span className="text-foreground truncate max-w-xs">{post.title}</span>
          </div>

          {/* ── Post Header ── */}
          <div className="mb-8 space-y-3">
            {/* 1. Kategori */}
            {post.categoryName && (
              <div>
                <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  {post.categoryName}
                </span>
              </div>
            )}

            {/* 2. Judul */}
            <h1 className="text-3xl font-bold tracking-tight leading-tight">{post.title}</h1>

            {/* 3. Meta date */}
            {post.publishedAt && (
              <p className="text-sm text-muted-foreground">
                {formatPostDate(post.publishedAt, timezone)}
              </p>
            )}

            {/* 4. Author */}
            {authorName && (
              <div className="flex items-center gap-3 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={authorAvatar ?? `https://www.gravatar.com/avatar/?d=mp&s=64`}
                  alt={authorName}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                />
                <div>
                  <p className="text-sm font-semibold leading-tight">{authorName}</p>
                  <p className="text-xs text-muted-foreground">Tim Redaksi</p>
                </div>
              </div>
            )}
          </div>

          {/* Cover */}
          {coverUrl && (
            <figure className="mb-8">
              <div className="rounded-xl overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={coverAlt ?? post.title}
                  title={coverTitle ?? undefined}
                  className="w-full aspect-video object-cover"
                />
              </div>
              {coverCaption && (
                <figcaption className="mt-2 text-center text-xs text-muted-foreground italic px-2">
                  {coverCaption}
                </figcaption>
              )}
            </figure>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-muted-foreground text-base leading-relaxed mb-6 font-medium">
              {post.excerpt}
            </p>
          )}

          {/* Content */}
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

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>Diterbitkan oleh {tenantName}</span>
            {post.updatedAt && post.updatedAt !== post.publishedAt && (
              <span>Diperbarui {fmtUpdated(post.updatedAt)}</span>
            )}
          </div>

          <PublicButton
            href={`/${tenantSlug}/post`}
            variant="ghost" size="sm" iconLeft="chevron" icon="none"
            className="mt-6"
          >
            Kembali ke Blog
          </PublicButton>
        </article>

        {/* Sidebar */}
        <div className="w-72 shrink-0 hidden lg:block">
          <WidgetArea id="default-sidebar" tenantClient={tenantClient} tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}
