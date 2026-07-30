"use server";

import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createTenantDb } from "@jalajogja/db";
import { getAkunIdentity } from "@/lib/akun-identity";
import { resolvePostHrefs } from "@/lib/post-permalink.server";

// Ambil list post terbaru (status published) untuk marquee ticker header.
// Dipanggil client-side via useEffect agar layout tetap ISR-safe.
export async function getTickerPostsAction(slug: string): Promise<Array<{ title: string; href: string }>> {
  try {
    const tenantClient = createTenantDb(slug);
    const { db: tenantDb, schema } = tenantClient;
    const posts = await tenantDb
      .select({
        title:        schema.posts.title,
        slug:         schema.posts.slug,
        publishedAt:  schema.posts.publishedAt,
        categorySlug: schema.postCategories.slug,
      })
      .from(schema.posts)
      .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
      .where(eq(schema.posts.status, "published"))
      .orderBy(desc(schema.posts.publishedAt))
      .limit(8);

    const postsWithHref = await resolvePostHrefs(tenantClient, posts);
    return postsWithHref.map((p) => ({
      title: p.title,
      href: p.href,
    }));
  } catch {
    return [];
  }
}

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

// Pelanggan konfirmasi terima paket — transisi shipped → delivered.
// Hanya bisa dilakukan oleh pemilik invoice (verifikasi via session).
export async function confirmDeliveryAction(
  slug:            string,
  invoiceId:       string,
  shippingLineId:  string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return { success: false, error: "Login diperlukan." };

    const identity = await getAkunIdentity(session.user.id);
    if (!identity)          return { success: false, error: "Akun tidak ditemukan." };

    const { db: tenantDb, schema } = createTenantDb(slug);

    // Verifikasi invoice milik akun ini
    const whereInvoice =
      identity.type === "member" && identity.memberId
        ? eq(schema.invoices.memberId,   identity.memberId)
        : identity.profileId
          ? eq(schema.invoices.profileId, identity.profileId)
          : null;

    if (!whereInvoice) return { success: false, error: "Identitas tidak valid." };

    const [inv] = await tenantDb
      .select({ id: schema.invoices.id, status: schema.invoices.status })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.id, invoiceId), whereInvoice))
      .limit(1);

    if (!inv) return { success: false, error: "Invoice tidak ditemukan." };

    // Fetch shipping line — harus shipped
    const [sl] = await tenantDb
      .select({ id: schema.invoiceShippingLines.id, status: schema.invoiceShippingLines.status })
      .from(schema.invoiceShippingLines)
      .where(and(
        eq(schema.invoiceShippingLines.id,        shippingLineId),
        eq(schema.invoiceShippingLines.invoiceId, invoiceId),
        eq(schema.invoiceShippingLines.status,    "shipped"),
      ))
      .limit(1);

    if (!sl) return { success: false, error: "Pengiriman belum dikirim atau sudah dikonfirmasi." };

    await tenantDb
      .update(schema.invoiceShippingLines)
      .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.invoiceShippingLines.id, shippingLineId));

    revalidatePath(`/${slug}/akun/transaksi`);
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengkonfirmasi penerimaan." };
  }
}
