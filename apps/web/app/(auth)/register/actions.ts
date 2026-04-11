"use server";

import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {
  db,
  createTenantDb,
  createTenantSchemaInDb,
  tenants,
  tenantPlans,
  tenantSubscriptions,
} from "@jalajogja/db";

type RegisterActionInput = {
  orgName: string;
  slug: string;
};

type RegisterActionResult =
  | { success: true }
  | { success: false; error: string };

// Validasi slug server-side — tidak pernah trust client
function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 20) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  return true;
}

export async function registerAction(
  input: RegisterActionInput
): Promise<RegisterActionResult> {
  const { orgName, slug } = input;

  // 1. Ambil userId dari session server — jangan trust client
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Sesi tidak valid. Silakan daftar ulang." };
  }
  const userId = session.user.id;

  // 2. Validasi input
  if (!orgName || orgName.trim().length < 2) {
    return { success: false, error: "Nama organisasi terlalu pendek." };
  }
  if (!isValidSlug(slug)) {
    return { success: false, error: "Slug tidak valid." };
  }

  // 3. Cek slug unik — UNIQUE constraint di DB sebagai safeguard terakhir
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (existing) {
    return { success: false, error: "Slug sudah digunakan, coba yang lain." };
  }

  let tenantId: string | null = null;
  let schemaCreated = false;

  try {
    // 4. Buat tenant + subscription trial dalam satu transaksi public schema
    await db.transaction(async (tx) => {
      const [newTenant] = await tx
        .insert(tenants)
        .values({ slug, name: orgName.trim(), isActive: true })
        .returning({ id: tenants.id });

      tenantId = newTenant.id;

      // Cari plan yang ada — skip jika belum ada (TODO: seed default plans)
      const [plan] = await tx
        .select({ id: tenantPlans.id })
        .from(tenantPlans)
        .limit(1);

      if (plan) {
        await tx.insert(tenantSubscriptions).values({
          tenantId: newTenant.id,
          planId: plan.id,
          status: "trial",
        });
      }
    });

    // 5. Buat schema PostgreSQL + semua tabel + seed data default
    // Fungsi ini punya transaksi sendiri — tidak bisa di-nest di atas
    await createTenantSchemaInDb(db, slug);
    schemaCreated = true;

    // 6. Insert user sebagai owner di tenant schema yang baru dibuat
    const { db: tenantDb, schema } = createTenantDb(slug);
    await tenantDb.insert(schema.users).values({
      betterAuthUserId: userId,
      role: "owner",
    });

    return { success: true };

  } catch (err) {
    // Rollback manual — hapus tenant dari public (cascade ke subscriptions)
    // JANGAN hapus public.user — akun Better Auth tetap ada, user bisa coba lagi
    if (tenantId) {
      try {
        await db.delete(tenants).where(eq(tenants.id, tenantId));
      } catch {
        // Abaikan error saat rollback agar error asli tetap ter-return
      }
    }

    // Drop schema jika sempat terbuat sebelum gagal
    if (schemaCreated) {
      try {
        await db.execute(
          sql.raw(`DROP SCHEMA IF EXISTS "tenant_${slug}" CASCADE`)
        );
      } catch {
        // Abaikan error saat rollback
      }
    }

    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { success: false, error: `Gagal membuat organisasi: ${message}` };
  }
}
