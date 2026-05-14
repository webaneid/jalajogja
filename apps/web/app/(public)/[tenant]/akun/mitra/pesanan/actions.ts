"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, members, createTenantDb } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateShippingTrackingAction(
  slug: string,
  shippingLineId: string,
  trackingNumber: string,
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

  // Pastikan shipping line milik mitra ini
  const [line] = await tdb
    .select({ id: schema.invoiceShippingLines.id, sellerId: schema.invoiceShippingLines.sellerId })
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line || line.sellerId !== mitra.id) return { error: "Data pengiriman tidak ditemukan" };

  const resi = trackingNumber.trim();

  await tdb
    .update(schema.invoiceShippingLines)
    .set({
      trackingNumber: resi || null,
      shippedAt:      resi ? new Date() : null,
      status:         resi ? "shipped" : "pending",
      updatedAt:      new Date(),
    })
    .where(eq(schema.invoiceShippingLines.id, shippingLineId));

  revalidatePath(`/${slug}/akun/mitra/pesanan`);
  return { success: true };
}
