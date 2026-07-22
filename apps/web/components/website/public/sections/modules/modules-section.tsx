import { eq, and, desc, gt, inArray, isNotNull } from "drizzle-orm";
import {
  db, tenants, members, tenantMemberships,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
  type TenantDb,
} from "@jalajogja/db";
import { getImageUrl } from "@/lib/image-url";
import {
  MODULE_CATALOG, MODULES_NO_AUTO_PHOTO, normalizeModuleItems,
  type ModulesSectionData, type ModuleItemConfig, type ModuleId, type ModuleSectionDesignId,
} from "@/lib/module-strip-designs";
import { ModulesDesign1 } from "./modules-design-1";
import { ModulesDesign2, type ResolvedModuleItem } from "./modules-design-2";

// Section "Strip Modul" — dispatcher. Desain 1 (Ikon) tidak butuh data DB sama sekali (perilaku
// asli, tidak berubah). Desain 2 (Foto) butuh resolveModuleImages() — custom foto per item, atau
// fallback ke foto item terbaru modul itu (lihat MODULES_NO_AUTO_PHOTO untuk modul yang di-skip).

type Props = {
  data:         ModulesSectionData;
  variant:      ModuleSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
  baseUrl:      string;
};

export async function ModulesSection({ data, variant, tenantClient, tenantSlug, baseUrl }: Props) {
  const items = normalizeModuleItems(data.items)
    .filter((item): item is ModuleItemConfig & { id: ModuleId } => item.id in MODULE_CATALOG);
  if (items.length === 0) return null;

  if (variant === "2") {
    const resolved = await resolveModuleImages(items, tenantClient, tenantSlug);
    return (
      <ModulesDesign2
        title={data.title}
        eyebrow={data.eyebrow}
        description={data.headerDesc}
        align={data.titleAlign}
        items={resolved}
        baseUrl={baseUrl}
      />
    );
  }

  return (
    <ModulesDesign1
      title={data.title}
      eyebrow={data.eyebrow}
      description={data.headerDesc}
      align={data.titleAlign}
      items={items}
      baseUrl={baseUrl}
    />
  );
}

// Resolve foto cover dari media (campaigns/events pakai FK coverId, bukan URL langsung)
async function resolveCoverFromMediaId(
  tenantDb:   TenantDb["db"],
  schema:     TenantDb["schema"],
  tenantSlug: string,
  coverId:    string | null,
): Promise<string | null> {
  if (!coverId) return null;
  const [m] = await tenantDb
    .select({ path: schema.media.path, variants: schema.media.variants })
    .from(schema.media)
    .where(eq(schema.media.id, coverId))
    .limit(1);
  return m ? getImageUrl(m, tenantSlug, "large") : null;
}

async function resolveModuleImages(
  items:        (ModuleItemConfig & { id: ModuleId })[],
  tenantClient: TenantDb,
  tenantSlug:   string,
): Promise<ResolvedModuleItem[]> {
  const { db: tenantDb, schema } = tenantClient;

  const needsTenantId = items.some(item =>
    !item.imageUrl && !MODULES_NO_AUTO_PHOTO.includes(item.id) &&
    (["usaha", "pesantren", "profesional"] as ModuleId[]).includes(item.id),
  );
  const tenantRow = needsTenantId
    ? (await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1))[0]
    : null;

  async function resolveOne(item: ModuleItemConfig & { id: ModuleId }): Promise<ResolvedModuleItem> {
    if (item.imageUrl) return { id: item.id, imageUrl: item.imageUrl };
    if (MODULES_NO_AUTO_PHOTO.includes(item.id)) return { id: item.id, imageUrl: null };

    switch (item.id) {
      case "donasi": {
        const [row] = await tenantDb
          .select({ coverId: schema.campaigns.coverId })
          .from(schema.campaigns)
          .where(and(eq(schema.campaigns.status, "active"), isNotNull(schema.campaigns.coverId)))
          .orderBy(desc(schema.campaigns.createdAt))
          .limit(1);
        return { id: item.id, imageUrl: row ? await resolveCoverFromMediaId(tenantDb, schema, tenantSlug, row.coverId) : null };
      }
      case "toko": {
        const [row] = await tenantDb
          .select({ images: schema.products.images })
          .from(schema.products)
          .where(eq(schema.products.status, "active"))
          .orderBy(desc(schema.products.createdAt))
          .limit(1);
        const first = Array.isArray(row?.images)
          ? (row.images[0] as { url?: string; variants?: Record<string, string> } | undefined)
          : undefined;
        return { id: item.id, imageUrl: first?.variants?.large ?? first?.url ?? null };
      }
      case "event": {
        const now = new Date();
        const [row] = await tenantDb
          .select({ coverId: schema.events.coverId })
          .from(schema.events)
          .where(and(
            eq(schema.events.status, "published"),
            gt(schema.events.startsAt, now),
            isNotNull(schema.events.coverId),
          ))
          .orderBy(schema.events.startsAt)
          .limit(1);
        return { id: item.id, imageUrl: row ? await resolveCoverFromMediaId(tenantDb, schema, tenantSlug, row.coverId) : null };
      }
      case "usaha": {
        if (!tenantRow) return { id: item.id, imageUrl: null };
        const [row] = await db
          .select({ coverUrl: memberBusinesses.coverUrl })
          .from(memberBusinesses)
          .innerJoin(members, eq(members.id, memberBusinesses.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ))
          .where(and(eq(memberBusinesses.isActive, true), isNotNull(memberBusinesses.coverUrl)))
          .orderBy(desc(memberBusinesses.createdAt))
          .limit(1);
        return { id: item.id, imageUrl: row?.coverUrl ?? null };
      }
      case "profesional": {
        if (!tenantRow) return { id: item.id, imageUrl: null };
        const [row] = await db
          .select({ coverUrl: memberProfessionals.coverUrl })
          .from(memberProfessionals)
          .innerJoin(members, eq(members.id, memberProfessionals.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ))
          .where(and(eq(memberProfessionals.isActive, true), isNotNull(memberProfessionals.coverUrl)))
          .orderBy(desc(memberProfessionals.createdAt))
          .limit(1);
        return { id: item.id, imageUrl: row?.coverUrl ?? null };
      }
      case "pesantren": {
        if (!tenantRow) return { id: item.id, imageUrl: null };
        const [row] = await db
          .select({ coverUrl: memberOwnedPesantren.coverUrl })
          .from(memberOwnedPesantren)
          .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
          .innerJoin(tenantMemberships, and(
            eq(tenantMemberships.memberId, members.id),
            eq(tenantMemberships.tenantId, tenantRow.id),
            inArray(tenantMemberships.status, ["active", "alumni"]),
          ))
          .where(isNotNull(memberOwnedPesantren.coverUrl))
          .orderBy(desc(memberOwnedPesantren.createdAt))
          .limit(1);
        return { id: item.id, imageUrl: row?.coverUrl ?? null };
      }
      default:
        return { id: item.id, imageUrl: null };
    }
  }

  return Promise.all(items.map(resolveOne));
}
