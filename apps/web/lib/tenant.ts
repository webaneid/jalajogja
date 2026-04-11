import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db, createTenantDb, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";

// Cache per-request — panggil berkali-kali dalam satu request = satu query saja
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type TenantAccessResult = {
  tenant: typeof tenants.$inferSelect;
  tenantUser: { id: string; role: string; memberId: string | null };
  userId: string;
};

// Ambil data tenant + role user dalam satu tenant — untuk dipakai di layout
// Return null jika: tidak login, tenant tidak ada, atau user tidak punya akses
export async function getTenantAccess(
  slug: string
): Promise<TenantAccessResult | null> {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  // Cek tenant ada dan aktif
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) return null;

  // Cek user punya akses ke tenant ini
  const { db: tenantDb, schema } = createTenantDb(slug);
  const [tenantUser] = await tenantDb
    .select({
      id: schema.users.id,
      role: schema.users.role,
      memberId: schema.users.memberId,
    })
    .from(schema.users)
    .where(eq(schema.users.betterAuthUserId, session.user.id))
    .limit(1);

  if (!tenantUser) return null;

  return {
    tenant,
    tenantUser,
    userId: session.user.id,
  };
}

// Cari tenant pertama yang dimiliki user — untuk dashboard-redirect
// PERINGATAN: query ini O(n) terhadap jumlah tenant — lihat Technical Debt di CLAUDE.md
// Dibatasi 100 tenant untuk menghindari query tak terbatas di fase pertama
export async function getFirstTenantForUser(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  // TODO: ganti dengan index table saat tenant > 100
  // Lihat CLAUDE.md > Technical Debt > getFirstTenantForUser
  const allTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(100);

  for (const { slug } of allTenants) {
    const { db: tenantDb, schema } = createTenantDb(slug);
    const [found] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, session.user.id))
      .limit(1);

    if (found) return slug;
  }

  return null;
}
