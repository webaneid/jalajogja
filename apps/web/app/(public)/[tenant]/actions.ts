"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createTenantDb } from "@jalajogja/db";
import { getAkunIdentity } from "@/lib/akun-identity";

// Cek apakah user yang sedang login punya akses dashboard tenant ini.
// Dipanggil client-side dari UserButton (useEffect) agar layout tetap ISR-safe.
export async function checkDashboardAccessAction(slug: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return false;

    const { db: tenantDb, schema } = createTenantDb(slug);
    const [row] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, session.user.id))
      .limit(1);

    return !!row;
  } catch {
    return false;
  }
}

// Ambil photoUrl dari identitas akun (member IKPM atau publik).
// Dipanggil client-side dari UserButton agar layout tetap ISR-safe.
export async function getAkunAvatarAction(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;
    const identity = await getAkunIdentity(session.user.id);
    return identity?.photoUrl ?? null;
  } catch {
    return null;
  }
}
