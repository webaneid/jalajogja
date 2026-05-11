import { notFound }           from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { publicUrl }          from "@/lib/minio";
import { CampaignCard }       from "@/components/website/public/campaign-cards/campaign-card";
import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/campaign-card-templates";
import type { Metadata }      from "next";
import { Heart }              from "lucide-react";

export const revalidate = 60;

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ type?: string; category?: string }>;

const VALID_TYPES = ["donasi", "zakat", "wakaf", "qurban"] as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return {};
  return { title: `Donasi & Infaq — ${tenant.name}` };
}

export default async function CampaignArchivePage({
  params, searchParams,
}: {
  params: Params; searchParams: SearchParams;
}) {
  const { tenant: slug }     = await params;
  const { type, category }   = await searchParams;

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Resolve filter
  const validType = VALID_TYPES.includes(type as typeof VALID_TYPES[number])
    ? (type as "donasi" | "zakat" | "wakaf" | "qurban") : null;

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (category) {
    const [cat] = await tenantDb.select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name })
      .from(schema.campaignCategories).where(eq(schema.campaignCategories.slug, category)).limit(1);
    if (cat) { categoryId = cat.id; categoryName = cat.name; }
  }

  const clauses = [
    eq(schema.campaigns.status, "active"),
    ...(validType   ? [eq(schema.campaigns.campaignType, validType)]  : []),
    ...(categoryId  ? [eq(schema.campaigns.categoryId,  categoryId)]  : []),
  ];

  const rows = await tenantDb
    .select({
      id:              schema.campaigns.id,
      title:           schema.campaigns.title,
      slug:            schema.campaigns.slug,
      description:     schema.campaigns.description,
      campaignType:    schema.campaigns.campaignType,
      coverId:         schema.campaigns.coverId,
      targetAmount:    schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount,
      endsAt:          schema.campaigns.endsAt,
      categoryName:    schema.campaignCategories.name,
    })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, eq(schema.campaignCategories.id, schema.campaigns.categoryId))
    .where(and(...clauses))
    .orderBy(desc(schema.campaigns.createdAt))
    .limit(50);

  // Resolve covers
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  const coverMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const media = await tenantDb.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media).where(inArray(schema.media.id, coverIds));
    media.forEach(m => coverMap.set(m.id, publicUrl(slug, m.path)));
  }

  const campaigns: CampaignCardData[] = rows.map(r => {
    const collected = parseFloat(r.collectedAmount ?? "0");
    const target    = r.targetAmount ? parseFloat(r.targetAmount) : null;
    return {
      id:              r.id,
      title:           r.title,
      slug:            r.slug,
      description:     r.description,
      campaignType:    (r.campaignType ?? "donasi") as CampaignCardData["campaignType"],
      coverUrl:        r.coverId ? (coverMap.get(r.coverId) ?? null) : null,
      categoryName:    r.categoryName ?? null,
      targetAmount:    r.targetAmount ?? null,
      collectedAmount: String(collected),
      progressPercent: target ? Math.min(100, Math.round((collected / target) * 100)) : null,
      endsAt:          r.endsAt ? r.endsAt.toISOString() : null,
      isRecurring:     false,
    };
  });

  // Semua kategori + tipe untuk filter chips
  const categories = await tenantDb.select({ id: schema.campaignCategories.id, name: schema.campaignCategories.name, slug: schema.campaignCategories.slug })
    .from(schema.campaignCategories).orderBy(schema.campaignCategories.name);

  const pageTitle = categoryName ?? (validType ? CAMPAIGN_TYPE_LABELS[validType] : "Donasi & Infaq");

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tenant.name}</p>
        </div>

        {/* Filter chips: tipe */}
        <div className="flex gap-2 flex-wrap mb-4">
          {([null, ...VALID_TYPES] as const).map(t => {
            const isActive = t === validType;
            const params = new URLSearchParams();
            if (t) params.set("type", t);
            if (category) params.set("category", category);
            return (
              <a key={t ?? "semua"}
                href={`/${slug}/campaign${params.toString() ? "?" + params.toString() : ""}`}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  isActive ? "bg-primary text-primary-foreground border-primary"
                           : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {t ? CAMPAIGN_TYPE_LABELS[t] : "Semua"}
              </a>
            );
          })}
        </div>

        {/* Filter chips: kategori */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {[null, ...categories].map(cat => {
              const isActive = (cat?.slug ?? null) === (category ?? null);
              const params = new URLSearchParams();
              if (validType) params.set("type", validType);
              if (cat) params.set("category", cat.slug);
              return (
                <a key={cat?.id ?? "semua"}
                  href={`/${slug}/campaign${params.toString() ? "?" + params.toString() : ""}`}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    isActive ? "bg-muted-foreground/20 border-muted-foreground/50 font-medium"
                             : "border-border/50 hover:border-border text-muted-foreground"
                  }`}
                >
                  {cat?.name ?? "Semua Kategori"}
                </a>
              );
            })}
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Heart className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada campaign aktif.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} variant="grid" tenantSlug={slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
