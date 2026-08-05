"use server";

import { auth }              from "@/lib/auth";
import { headers }           from "next/headers";
import { db, members, createTenantDb } from "@jalajogja/db";
import { eq, and }           from "drizzle-orm";
import { revalidatePath }    from "next/cache";

export type MitraShippingSettings = {
  codEnabled:         boolean;
  pickupEnabled:      boolean;
  pickupLocationName: string;
  pickupAddress:      string;
  pickupMapsUrl:      string;
};

// Auth pola sama updateShippingTrackingAction (akun/mitra/pesanan/actions.ts) — session →
// member → mitra aktif milik user. Mitra bukan tenant.users, TIDAK PERNAH lewat getTenantAccess.
export async function updateMitraShippingSettingsAction(
  slug:   string,
  values: MitraShippingSettings,
): Promise<{ success: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: "Login diperlukan" };

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM" };

  const { db: tdb, schema } = createTenantDb(slug);

  const [mitra] = await tdb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);
  if (!mitra) return { error: "Bukan mitra aktif" };

  if (values.pickupEnabled && !values.pickupLocationName.trim()) {
    return { error: "Nama Lokasi wajib diisi kalau Ambil Sendiri diaktifkan." };
  }
  if (values.pickupEnabled && !values.pickupAddress.trim()) {
    return { error: "Alamat Lengkap wajib diisi kalau Ambil Sendiri diaktifkan." };
  }

  await tdb
    .update(schema.mitras)
    .set({
      codEnabled:         values.codEnabled,
      pickupEnabled:      values.pickupEnabled,
      pickupLocationName: values.pickupLocationName || null,
      pickupAddress:      values.pickupAddress || null,
      pickupMapsUrl:      values.pickupMapsUrl || null,
      updatedAt:          new Date(),
    })
    .where(eq(schema.mitras.id, mitra.id));

  revalidatePath(`/${slug}/akun/mitra/pengaturan`);
  return { success: true };
}
