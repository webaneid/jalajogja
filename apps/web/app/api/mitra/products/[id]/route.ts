// PATCH  /api/mitra/products/[id]?slug= — edit produk
// DELETE /api/mitra/products/[id]?slug= — hapus produk

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, members, createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTokoSettings } from "@/lib/toko-settings";
import type { ProductImage } from "@/app/(dashboard)/[tenant]/toko/actions";

async function getMitraProduct(req: NextRequest, slug: string, productId: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return null;

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [mitra] = await tenantDb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);
  if (!mitra) return null;

  const [product] = await tenantDb
    .select({ id: schema.products.id, mitraId: schema.products.mitraId })
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.mitraId, mitra.id)))
    .limit(1);
  if (!product) return null;

  return { mitra, product, tenantDb, schema };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params;
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const ctx = await getMitraProduct(req, slug, productId);
  if (!ctx) return NextResponse.json({ error: "Produk tidak ditemukan atau bukan milik Anda" }, { status: 403 });

  const settings = await getTokoSettings(slug);
  const body = await req.json() as {
    name?: string; price?: number; memberPrice?: number | null;
    stock?: number; weightGram?: number | null; description?: string; images?: ProductImage[];
    status?: "active" | "draft" | "archived";
  };

  // Validasi member_price
  if (body.memberPrice != null && body.price != null) {
    const maxMemberPrice = body.price * (1 - settings.minKomisiMitra / 100);
    if (body.memberPrice > maxMemberPrice) {
      return NextResponse.json(
        { error: `Harga IKPM maksimal Rp ${Math.floor(maxMemberPrice).toLocaleString("id-ID")}` },
        { status: 422 },
      );
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name        != null) updateData.name        = body.name;
  if (body.price       != null) updateData.price       = String(body.price);
  if (body.memberPrice != null) updateData.memberPrice = String(body.memberPrice);
  if (body.memberPrice === null) updateData.memberPrice = null;
  if (body.stock       != null) updateData.stock       = body.stock;
  if (body.weightGram  != null) updateData.weightGram  = body.weightGram;
  if (body.description != null) updateData.description = body.description;
  if (body.images      != null) updateData.images      = body.images;
  if (body.status      != null) updateData.status      = body.status;

  await ctx.tenantDb
    .update(ctx.schema.products)
    .set(updateData)
    .where(eq(ctx.schema.products.id, productId));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params;
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const ctx = await getMitraProduct(req, slug, productId);
  if (!ctx) return NextResponse.json({ error: "Produk tidak ditemukan atau bukan milik Anda" }, { status: 403 });

  await ctx.tenantDb
    .delete(ctx.schema.products)
    .where(eq(ctx.schema.products.id, productId));

  return NextResponse.json({ success: true });
}
