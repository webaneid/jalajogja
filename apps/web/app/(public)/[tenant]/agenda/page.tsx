import { notFound }           from "next/navigation";
import { eq, gte, and, inArray, desc } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings } from "@jalajogja/db";
import { publicUrl }          from "@/lib/minio";
import { EventArchiveCards }  from "@/components/website/public/event-cards/event-archive-cards";
import type { EventCardData } from "@/lib/event-card-templates";
import { EVENT_ARCHIVE_CARD_DESIGN_IDS, type EventArchiveCardDesignId } from "@/lib/event-archive-card-designs";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import type { Metadata }      from "next";
import { CalendarDays }       from "lucide-react";
import { getTenantTimezone }  from "@/lib/tenant-timezone.server";

export const revalidate = 60;

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ category?: string; all?: string }>;

// SEO ringan per kategori (Fase 2, docs/arsitektur-seo.md § 3.2) — kalau ?category= aktif dan
// kategori itu punya metaTitle/metaDesc, timpa default. Selain itu jatuh ke override page-wide
// (Fase 3, § 3.3), lalu fallback hardcode "Agenda & Event". ogTitle/ogDescription/ogImageUrl/
// robots SELALU dari override page-wide — kategori (Fase 2) tidak punya field itu sendiri.
export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const { category }     = await searchParams;
  const base = await getTenantSeoBase(slug);
  const tenantClient = createTenantDb(slug);

  const override = await getPageSeoOverride(tenantClient, slug, "agenda-archive");
  let title       = override?.metaTitle || "Agenda & Event";
  let description = override?.metaDesc || undefined;
  let canonicalUrl = `${base.baseUrl}/agenda`;

  if (category) {
    const { db: tenantDb, schema } = tenantClient;
    const [cat] = await tenantDb
      .select({ name: schema.eventCategories.name, metaTitle: schema.eventCategories.metaTitle, metaDesc: schema.eventCategories.metaDesc })
      .from(schema.eventCategories).where(eq(schema.eventCategories.slug, category)).limit(1);
    if (cat) {
      title        = cat.metaTitle || `Agenda ${cat.name}`;
      description  = cat.metaDesc || undefined;
      canonicalUrl = `${base.baseUrl}/agenda?category=${category}`;
    }
  }

  return buildMetadata({
    title, description,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl,
    robots:        override?.robots || undefined,
  });
}

export default async function AgendaArchivePage({
  params, searchParams,
}: {
  params: Params; searchParams: SearchParams;
}) {
  const { tenant: slug }    = await params;
  const { category, all }   = await searchParams;
  const showAll             = all === "1";

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const tenantTimezone           = await getTenantTimezone(tenantClient);

  // Resolve filter kategori
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (category) {
    const [cat] = await tenantDb.select({ id: schema.eventCategories.id, name: schema.eventCategories.name })
      .from(schema.eventCategories).where(eq(schema.eventCategories.slug, category)).limit(1);
    if (cat) { categoryId = cat.id; categoryName = cat.name; }
  }

  const now = new Date();
  const clauses = [
    eq(schema.events.status, "published"),
    ...(categoryId ? [eq(schema.events.categoryId, categoryId)] : []),
    ...(!showAll  ? [gte(schema.events.startsAt, now)]          : []),
  ];

  const rows = await tenantDb
    .select({
      id:           schema.events.id,
      title:        schema.events.title,
      slug:         schema.events.slug,
      description:  schema.events.description,
      eventType:    schema.events.eventType,
      coverId:      schema.events.coverId,
      startsAt:     schema.events.startsAt,
      endsAt:       schema.events.endsAt,
      location:     schema.events.location,
      status:       schema.events.status,
      categoryName: schema.eventCategories.name,
    })
    .from(schema.events)
    .leftJoin(schema.eventCategories, eq(schema.eventCategories.id, schema.events.categoryId))
    .where(and(...clauses))
    .orderBy(schema.events.startsAt)
    .limit(50);

  // Resolve covers
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  const coverMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const media = await tenantDb.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media).where(inArray(schema.media.id, coverIds));
    media.forEach(m => coverMap.set(m.id, publicUrl(slug, m.path)));
  }

  // lowestPrice per event
  const priceMap = new Map<string, string>();
  for (const row of rows) {
    const tickets = await tenantDb
      .select({ price: schema.eventTickets.price })
      .from(schema.eventTickets)
      .where(and(eq(schema.eventTickets.eventId, row.id), eq(schema.eventTickets.isActive, true)));
    if (tickets.length > 0) {
      const min = Math.min(...tickets.map(t => parseFloat(String(t.price))));
      priceMap.set(row.id, String(min));
    }
  }

  const events: EventCardData[] = rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    description:  r.description,
    eventType:    (r.eventType ?? "offline") as EventCardData["eventType"],
    coverUrl:     r.coverId ? (coverMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    startsAt:     r.startsAt ? r.startsAt.toISOString() : null,
    endsAt:       r.endsAt   ? r.endsAt.toISOString()   : null,
    location:     r.location ?? null,
    lowestPrice:  priceMap.get(r.id) ?? null,
    status:       r.status,
  }));

  const categories = await tenantDb
    .select({ id: schema.eventCategories.id, name: schema.eventCategories.name, slug: schema.eventCategories.slug })
    .from(schema.eventCategories).orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name);

  // Desain kartu arsip — lihat docs/arsitektur-event.md
  const eventSettings    = await getSettings(tenantClient, "event");
  const archiveDesignRaw = eventSettings.event_archive_design as { design?: string } | undefined;
  const archiveDesign: EventArchiveCardDesignId = EVENT_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as EventArchiveCardDesignId)
    ? (archiveDesignRaw!.design as EventArchiveCardDesignId)
    : "1";

  const pageTitle = categoryName ?? "Agenda";

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tenant.name}</p>
        </div>

        {/* Filter kategori */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {[null, ...categories].map(cat => {
              const isActive = (cat?.slug ?? null) === (category ?? null);
              const params = new URLSearchParams();
              if (cat) params.set("category", cat.slug);
              if (showAll) params.set("all", "1");
              return (
                <a key={cat?.id ?? "semua"}
                  href={`/${slug}/agenda${params.toString() ? "?" + params.toString() : ""}`}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    isActive ? "bg-primary text-primary-foreground border-primary"
                             : "border-border hover:border-primary/50 hover:bg-muted"
                  }`}
                >
                  {cat?.name ?? "Semua"}
                </a>
              );
            })}
          </div>
        )}

        {/* Toggle mendatang / semua */}
        <div className="flex gap-2 mb-6">
          {[
            { label: "Mendatang", value: "" },
            { label: "Semua Event", value: "1" },
          ].map(opt => {
            const isActive = (opt.value === "1") === showAll;
            const params = new URLSearchParams();
            if (opt.value) params.set("all", opt.value);
            if (category) params.set("category", category);
            return (
              <a key={opt.value}
                href={`/${slug}/agenda${params.toString() ? "?" + params.toString() : ""}`}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  isActive ? "bg-muted-foreground/20 border-muted-foreground/50 font-medium"
                           : "border-border/50 text-muted-foreground hover:border-border"
                }`}
              >
                {opt.label}
              </a>
            );
          })}
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada event{!showAll ? " mendatang" : ""}.</p>
          </div>
        ) : (
          <EventArchiveCards design={archiveDesign} events={events} tenantSlug={slug} timezone={tenantTimezone} />
        )}
      </div>
    </div>
  );
}
