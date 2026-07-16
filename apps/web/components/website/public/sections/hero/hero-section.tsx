import { desc, eq, gt, and } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import type { HeroSectionData, HeroSectionDesignId, HeroCardData } from "@/lib/hero-section-designs";
import { HeroDesign1 } from "./hero-design-1";
import { HeroDesign2 } from "./hero-design-2";

type Props = {
  data:         HeroSectionData;
  variant:      HeroSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
  baseUrl:      string;
};

export async function HeroSection({ data, variant, tenantClient, baseUrl }: Props) {
  const heroCard = data.imageUrl ? await fetchHeroCard(tenantClient, baseUrl) : null;
  const props = { data, baseUrl, heroCard };

  switch (variant) {
    case "2": return <HeroDesign2 {...props} />;
    default:  return <HeroDesign1 {...props} />;
  }
}

// Kartu mengambang — event mendatang, fallback ke berita terbaru. Dipakai kedua desain.
async function fetchHeroCard(tenantClient: TenantDb, baseUrl: string): Promise<HeroCardData | null> {
  const { db: tenantDb, schema } = tenantClient;
  const now = new Date();

  const [upcomingEvent] = await tenantDb
    .select({ title: schema.events.title, slug: schema.events.slug, startsAt: schema.events.startsAt })
    .from(schema.events)
    .where(and(eq(schema.events.status, "published"), gt(schema.events.startsAt, now)))
    .orderBy(schema.events.startsAt)
    .limit(1);

  if (upcomingEvent) {
    return {
      type:  "event",
      label: "Agenda Terbaru",
      title: upcomingEvent.title,
      href:  `${baseUrl}/agenda/${upcomingEvent.slug}`,
      date:  upcomingEvent.startsAt
        ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(upcomingEvent.startsAt)
        : null,
    };
  }

  const [latestPost] = await tenantDb
    .select({ title: schema.posts.title, slug: schema.posts.slug, publishedAt: schema.posts.publishedAt })
    .from(schema.posts)
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(1);

  if (latestPost) {
    return {
      type:  "post",
      label: "Berita Terbaru",
      title: latestPost.title,
      href:  `${baseUrl}/post/${latestPost.slug}`,
      date:  latestPost.publishedAt
        ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(latestPost.publishedAt)
        : null,
    };
  }

  return null;
}
