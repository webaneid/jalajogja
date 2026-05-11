import { notFound }           from "next/navigation";
import { eq, desc, and }      from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { publicUrl }          from "@/lib/minio";
import { renderBody }         from "@/lib/letter-render";
import type { Metadata }      from "next";
import { Heart, Target }      from "lucide-react";

export const revalidate = 60;

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return {};
  return { title: `Donasi — ${tenant.name}` };
}

export default async function DonasiArchivePage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(slug);

  const campaigns = await tenantDb
    .select({
      id:              schema.campaigns.id,
      slug:            schema.campaigns.slug,
      title:           schema.campaigns.title,
      campaignType:    schema.campaigns.campaignType,
      targetAmount:    schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount,
      coverId:         schema.campaigns.coverId,
      endsAt:          schema.campaigns.endsAt,
      categoryName:    schema.campaignCategories.name,
    })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, eq(schema.campaignCategories.id, schema.campaigns.categoryId))
    .where(eq(schema.campaigns.status, "active"))
    .orderBy(desc(schema.campaigns.createdAt));

  // Resolve cover URLs
  const coverIds = [...new Set(campaigns.map(c => c.coverId).filter(Boolean))] as string[];
  const mediaMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const mediaRows = await tenantDb.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(coverIds.length === 1 ? eq(schema.media.id, coverIds[0]!) : eq(schema.media.id, coverIds[0]!));
    // fetch individually if needed — simplified below
    for (const cId of coverIds) {
      const [m] = await tenantDb.select({ path: schema.media.path }).from(schema.media).where(eq(schema.media.id, cId)).limit(1);
      if (m) mediaMap.set(cId, publicUrl(slug, m.path));
    }
  }

  function progressPct(collected: string, target: string | null): number {
    if (!target || parseFloat(target) === 0) return 0;
    return Math.min(100, Math.round((parseFloat(collected) / parseFloat(target)) * 100));
  }

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Donasi & Qurban</h1>
          <p className="text-muted-foreground text-sm mt-1">{tenant.name}</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Heart className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada campaign aktif saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map(c => {
              const coverUrl = c.coverId ? mediaMap.get(c.coverId) : null;
              const pct = progressPct(c.collectedAmount, c.targetAmount);
              const isQurban = c.campaignType === "qurban";
              return (
                <a
                  key={c.id}
                  href={`/${slug}/donasi/${c.slug}`}
                  className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                >
                  {/* Cover */}
                  <div className="aspect-video bg-muted overflow-hidden">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Heart className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.categoryName && (
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c.categoryName}</span>
                      )}
                      {isQurban && (
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Qurban</span>
                      )}
                    </div>

                    <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{c.title}</h3>

                    {!isQurban && c.targetAmount && (
                      <div className="mt-auto space-y-1.5">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Terkumpul: <span className="font-medium text-foreground">Rp {parseFloat(c.collectedAmount).toLocaleString("id-ID")}</span></span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
