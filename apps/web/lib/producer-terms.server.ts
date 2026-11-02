// Pembacaan data Syarat & Ketentuan Produsen (server) — docs/arsitektur-portal-produsen.md § 28.
import "server-only";
import { desc, eq } from "drizzle-orm";
import { db as publicDb, createTenantDb, producerLogins } from "@jalajogja/db";
import { listProducerOptions } from "@/lib/producer.server";

type TenantDb = ReturnType<typeof createTenantDb>;

export type ActiveTerm = { id: string; version: number; title: string; body: string; publishedAt: Date };

/** Versi aktif = terbit dengan nomor terbesar. null = belum ada syarat terbit (→ tidak ada penguncian). */
export async function getActiveProducerTerm(tenantClient: TenantDb): Promise<ActiveTerm | null> {
  const { db: tdb, schema } = tenantClient;
  const [row] = await tdb.select().from(schema.producerTerms)
    .where(eq(schema.producerTerms.status, "published"))
    .orderBy(desc(schema.producerTerms.version)).limit(1);
  if (!row || row.version == null || !row.publishedAt) return null;
  return { id: row.id, version: row.version, title: row.title, body: row.body, publishedAt: row.publishedAt };
}

export type TermSignerRow = { producerId: string; name: string; isActive: boolean; signedAt: Date | null };

/** Produsen yang punya login (yang bisa menandatangani) + status tanda tangan versi aktif. */
export async function listTermSigners(tenantId: string, tenantClient: TenantDb, activeTermId: string | null): Promise<TermSignerRow[]> {
  const logins = await publicDb.select({ producerId: producerLogins.producerId })
    .from(producerLogins).where(eq(producerLogins.tenantId, tenantId));
  if (logins.length === 0) return [];
  const ids = logins.map((l) => l.producerId);

  const { db: tdb, schema } = tenantClient;
  const [options, signed] = await Promise.all([
    listProducerOptions(tenantClient),
    activeTermId
      ? tdb.select({ producerId: schema.producerTermAcceptances.producerId, signedAt: schema.producerTermAcceptances.signedAt })
          .from(schema.producerTermAcceptances)
          .where(eq(schema.producerTermAcceptances.termId, activeTermId))
      : Promise.resolve([] as { producerId: string; signedAt: Date }[]),
  ]);
  const nameOf = new Map(options.map((o) => [o.id, o]));
  const signedMap = new Map(signed.map((s) => [s.producerId, s.signedAt]));

  return ids
    .filter((id) => nameOf.has(id))   // listProducerOptions hanya memuat produsen AKTIF
    .map((id) => ({ producerId: id, name: nameOf.get(id)!.name, isActive: true, signedAt: signedMap.get(id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}
