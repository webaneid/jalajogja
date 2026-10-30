// Semua "pintu" yang bisa dimasuki akun yang sedang login: dashboard pengurus (tenant.users) dan Portal Produsen
// (status produsen, public.producer_logins). Dipakai /dashboard-redirect untuk TIDAK menebak satu tenant saja
// (sebelumnya: tenant pengurus pertama → produsen di tenant lain tak pernah terjangkau, dan pengurus di dua tenant
// dilempar ke tenant yang acak). Doc: docs/arsitektur-portal-produsen.md § 16.
import "server-only";
import { eq } from "drizzle-orm";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";
import { findProducerPortal } from "@/lib/producer-access.server";

export type UserContext = { kind: "pengurus" | "produsen"; slug: string; name: string; href: string };

export async function listUserContexts(): Promise<UserContext[]> {
  const session = await getCurrentSession();
  const userId  = session?.user?.id ?? null;
  if (!userId) return [];

  // Pengurus: sama dengan getFirstTenantForUser (dibatasi 100 tenant — utang teknis O(n) yang sudah tercatat) tetapi
  // mengumpulkan SEMUA yang cocok. Satu tenant bermasalah tidak boleh menggagalkan seluruh daftar.
  const activeTenants = await db
    .select({ slug: tenants.slug, name: tenants.name })
    .from(tenants).where(eq(tenants.isActive, true)).limit(100);

  const pengurus = (await Promise.all(activeTenants.map(async (t) => {
    try {
      const { db: tdb, schema } = createTenantDb(t.slug);
      const [found] = await tdb.select({ id: schema.users.id }).from(schema.users)
        .where(eq(schema.users.betterAuthUserId, userId)).limit(1);
      return found ? t : null;
    } catch {
      return null;
    }
  }))).filter((t): t is { slug: string; name: string } => !!t);

  const producer = await findProducerPortal();

  return [
    ...pengurus.map((t): UserContext => ({ kind: "pengurus", slug: t.slug, name: t.name, href: `/app/${t.slug}/dashboard` })),
    ...(producer ? [{ kind: "produsen", slug: producer.slug, name: producer.name, href: `/app/${producer.slug}/portal-produsen` } as UserContext] : []),
  ].sort((a, b) => a.name.localeCompare(b.name, "id") || a.kind.localeCompare(b.kind));
}
