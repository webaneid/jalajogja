import { drizzle } from "drizzle-orm/postgres-js";
import { postgresClient } from "./postgres-client";
import { getTenantSchema, type TenantSchema } from "./schema/tenant";

// Cache Drizzle instance per slug — hindari re-instantiate tiap request
const tenantDbCache = new Map<string, TenantDb>();

export type TenantDb = {
  db: ReturnType<typeof drizzle>;
  schema: TenantSchema;
};

export function createTenantDb(slug: string): TenantDb {
  if (tenantDbCache.has(slug)) {
    return tenantDbCache.get(slug)!;
  }

  const schema = getTenantSchema(slug);
  const db = drizzle(postgresClient, { schema });
  const tenantDb = { db, schema };

  tenantDbCache.set(slug, tenantDb);
  return tenantDb;
}

// Panggil saat tenant dihapus atau slug diubah
export function clearTenantCache(slug: string): void {
  tenantDbCache.delete(slug);
}

// Contoh penggunaan di app layer (Server Component / API route):
//
// import { createTenantDb } from "@jalajogja/db";
//
// const { db, schema } = createTenantDb("ikpm");
// const members = await db.select().from(schema.members);
// const activeMembers = await db
//   .select()
//   .from(schema.members)
//   .where(eq(schema.members.status, "active"));
