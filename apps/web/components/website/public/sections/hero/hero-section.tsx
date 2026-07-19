import { desc, eq, and, gt, count, sql, inArray } from "drizzle-orm";
import {
  db, tenants, members, tenantMemberships,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
  type TenantDb,
} from "@jalajogja/db";
import type { HeroSectionData, HeroSectionDesignId, HeroCardData, FunfactId, FunfactResult } from "@/lib/hero-section-designs";
import { FUNFACT_CATALOG, FUNFACT_MAX } from "@/lib/hero-section-designs";
import { formatRp } from "@/lib/campaign-card-templates";
import { stripTenantPrefix } from "@/lib/strip-tenant-prefix";
import { HeroDesign1 } from "./hero-design-1";
import { HeroDesign2 } from "./hero-design-2";

type Props = {
  data:         HeroSectionData;
  variant:      HeroSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
  baseUrl:      string;
};

export async function HeroSection({ data, variant, tenantClient, tenantSlug, baseUrl }: Props) {
  const heroCard = data.imageUrl ? await fetchHeroCard(tenantClient, baseUrl) : null;

  // CTA URL (dari PublicLinkPicker) selalu berprefix "/{slug}/..." — strip di custom domain,
  // satu titik untuk kedua desain. Lihat docs/arsitektur-public-link-picker.md § 9.
  const isCustomDomain = baseUrl === "";
  const strippedData: HeroSectionData = isCustomDomain
    ? {
        ...data,
        ctaUrl:          data.ctaUrl          ? stripTenantPrefix(data.ctaUrl, tenantSlug)          : data.ctaUrl,
        ctaSecondaryUrl: data.ctaSecondaryUrl ? stripTenantPrefix(data.ctaSecondaryUrl, tenantSlug) : data.ctaSecondaryUrl,
      }
    : data;

  if (variant === "2") {
    const funfacts = data.showModuleStrip && data.funfactItems?.length
      ? await fetchFunfacts(tenantClient, tenantSlug, data.funfactItems)
      : [];
    return <HeroDesign2 data={strippedData} baseUrl={baseUrl} heroCard={heroCard} funfacts={funfacts} />;
  }

  return <HeroDesign1 data={strippedData} baseUrl={baseUrl} heroCard={heroCard} />;
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

// Funfact — HANYA Hero Desain 2. Statistik dihitung live, admin cuma pilih metrik mana yang
// ditampilkan (maks 4). Metrik anggota/usaha/pesantren/profesional butuh public.tenants.id
// (cross-schema join) — resolve sekali, lazy (hanya kalau ada metrik yang butuh).
async function fetchFunfacts(
  tenantClient: TenantDb,
  tenantSlug:   string,
  ids:          string[],
): Promise<FunfactResult[]> {
  const { db: tenantDb, schema } = tenantClient;
  const validIds = ids.filter((id): id is FunfactId => id in FUNFACT_CATALOG).slice(0, FUNFACT_MAX);
  if (validIds.length === 0) return [];

  const NEEDS_TENANT_ID: FunfactId[] = ["anggota", "usaha", "pesantren", "profesional"];
  const needsTenantId = validIds.some(id => NEEDS_TENANT_ID.includes(id));
  const tenantRow = needsTenantId
    ? (await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1))[0]
    : null;

  async function resolveOne(id: FunfactId): Promise<FunfactResult> {
    const label = FUNFACT_CATALOG[id].label;

    switch (id) {
      case "anggota": {
        if (!tenantRow) return { id, number: "0", label };
        const [row] = await db
          .select({ total: count() })
          .from(members)
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "usaha": {
        if (!tenantRow) return { id, number: "0", label };
        const [row] = await db
          .select({ total: count() })
          .from(memberBusinesses)
          .innerJoin(members, eq(members.id, memberBusinesses.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ))
          .where(eq(memberBusinesses.isActive, true));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "pesantren": {
        if (!tenantRow) return { id, number: "0", label };
        const [row] = await db
          .select({ total: count() })
          .from(memberOwnedPesantren)
          .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "profesional": {
        if (!tenantRow) return { id, number: "0", label };
        const [row] = await db
          .select({ total: count() })
          .from(memberProfessionals)
          .innerJoin(members, eq(members.id, memberProfessionals.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ))
          .where(eq(memberProfessionals.isActive, true));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "campaign": {
        const [row] = await tenantDb
          .select({ total: count() })
          .from(schema.campaigns)
          .where(eq(schema.campaigns.status, "active"));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "donasi_rp": {
        const [row] = await tenantDb
          .select({ total: sql<string>`coalesce(sum(${schema.campaigns.collectedAmount}),0)` })
          .from(schema.campaigns);
        return { id, number: formatRp(row?.total ?? "0"), label };
      }
      case "event": {
        const [row] = await tenantDb
          .select({ total: count() })
          .from(schema.events)
          .where(eq(schema.events.status, "published"));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "produk": {
        const [row] = await tenantDb
          .select({ total: count() })
          .from(schema.products)
          .where(eq(schema.products.status, "active"));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "dokumen": {
        const [row] = await tenantDb
          .select({ total: count() })
          .from(schema.documents)
          .where(eq(schema.documents.visibility, "public"));
        return { id, number: String(row?.total ?? 0), label };
      }
      case "post": {
        const [row] = await tenantDb
          .select({ total: count() })
          .from(schema.posts)
          .where(eq(schema.posts.status, "published"));
        return { id, number: String(row?.total ?? 0), label };
      }
    }
  }

  return Promise.all(validIds.map(resolveOne));
}
