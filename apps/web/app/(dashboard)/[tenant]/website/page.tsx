import { desc, count, eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, FileStack, Plus, ArrowRight } from "lucide-react";
import { CreateButton } from "@/components/website/post-list-client";

export default async function WebsiteDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  // Fetch stats dan data terbaru secara paralel
  const [
    [{ totalPosts }],
    [{ draftPosts }],
    [{ publishedPosts }],
    [{ totalPages }],
    recentPosts,
  ] = await Promise.all([
    db.select({ totalPosts: count() }).from(schema.posts),
    db.select({ draftPosts: count() }).from(schema.posts).where(eq(schema.posts.status, "draft")),
    db.select({ publishedPosts: count() }).from(schema.posts).where(eq(schema.posts.status, "published")),
    db.select({ totalPages: count() }).from(schema.pages),
    db
      .select({
        id:        schema.posts.id,
        title:     schema.posts.title,
        slug:      schema.posts.slug,
        status:    schema.posts.status,
        updatedAt: schema.posts.updatedAt,
      })
      .from(schema.posts)
      .orderBy(desc(schema.posts.updatedAt))
      .limit(5),
  ]);

  const STATUS_MAP = {
    published: { label: "Terbit",  variant: "default"   as const },
    draft:     { label: "Draft",   variant: "secondary" as const },
    archived:  { label: "Arsip",   variant: "outline"   as const },
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Website</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola konten website organisasi
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Posts"
          value={Number(totalPosts)}
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Terbit"
          value={Number(publishedPosts)}
          icon={<FileText className="h-5 w-5 text-primary" />}
          accent
        />
        <StatCard
          label="Draft"
          value={Number(draftPosts)}
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Halaman"
          value={Number(totalPages)}
          icon={<FileStack className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Shortcut buttons */}
      <div className="flex gap-3 flex-wrap">
        <CreateButton slug={slug} />
        <Button variant="outline" className="gap-2" disabled title="Segera hadir">
          <Plus className="h-4 w-4" />
          Halaman Baru
        </Button>
      </div>

      {/* Post terbaru */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Post Terbaru</h2>
          <Link
            href={`/${slug}/website/posts`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Lihat semua <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentPosts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            Belum ada post. Mulai dengan membuat post pertama.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {recentPosts.map((post, i) => {
              const { label, variant } = STATUS_MAP[post.status] ?? { label: post.status, variant: "outline" as const };
              return (
                <Link
                  key={post.id}
                  href={`/${slug}/website/posts/${post.id}/edit`}
                  className={[
                    "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
                    i < recentPosts.length - 1 ? "border-b border-border" : "",
                  ].join(" ")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      /{post.slug}
                    </p>
                  </div>
                  <Badge variant={variant} className="shrink-0">{label}</Badge>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {post.updatedAt.toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={[
      "rounded-lg border border-border p-4 space-y-2",
      accent ? "bg-primary/5" : "bg-background",
    ].join(" ")}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={["text-3xl font-bold tabular-nums", accent ? "text-primary" : ""].join(" ")}>
        {value}
      </p>
    </div>
  );
}
