export const dynamic = "force-dynamic";
// GET  /api/mitra/products?slug= — list produk milik mitra yang login
// POST /api/mitra/products       — buat produk baru

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db, members, createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTokoSettings } from "@/lib/toko-settings";
import type { ProductImage } from "@/app/(dashboard)/app/[tenant]/toko/actions";

async function getMitraFromSession(req: NextRequest, slug: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return null;

  const { db: tenantDb, schema } = createTenantDb(slug);
  const [mitra] = await tenantDb
    .select()
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);

  return mitra ? { mitra, tenantDb, schema } : null;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const ctx = await getMitraFromSession(req, slug);
  if (!ctx) return NextResponse.json({ error: "Mitra aktif tidak ditemukan" }, { status: 403 });

  const { mitra, tenantDb, schema } = ctx;

  const products = await tenantDb
    .select({
      id:          schema.products.id,
      name:        schema.products.name,
      slug:        schema.products.slug,
      price:       schema.products.price,
      memberPrice: schema.products.memberPrice,
      stock:       schema.products.stock,
      status:      schema.products.status,
      images:      schema.products.images,
      createdAt:   schema.products.createdAt,
    })
    .from(schema.products)
    .where(eq(schema.products.mitraId, mitra.id))
    .orderBy(desc(schema.products.createdAt));

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const ctx = await getMitraFromSession(req, slug);
  if (!ctx) return NextResponse.json({ error: "Mitra aktif tidak ditemukan" }, { status: 403 });

  const { mitra, tenantDb, schema } = ctx;
  const settings = await getTokoSettings(slug);

  // Cek batas produk
  if (settings.mitraMaxProducts > 0) {
    const countRows = await tenantDb
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.mitraId, mitra.id), eq(schema.products.status, "active")));
    if (countRows.length >= settings.mitraMaxProducts) {
      return NextResponse.json(
        { error: `Batas maksimal ${settings.mitraMaxProducts} produk aktif sudah tercapai.` },
        { status: 422 },
      );
    }
  }

  const body = await req.json() as {
    name: string; slug: string; price: number; memberPrice?: number | null;
    stock?: number; weightGram?: number | null; description?: string; images?: ProductImage[]; categoryId?: string | null;
  };
  if (!body.weightGram || body.weightGram <= 0) {
    return NextResponse.json({ error: "Berat produk wajib diisi" }, { status: 422 });
  }

  // Validasi member_price
  if (body.memberPrice != null) {
    const maxMemberPrice = body.price * (1 - settings.minKomisiMitra / 100);
    if (body.memberPrice > maxMemberPrice) {
      return NextResponse.json(
        { error: `Harga IKPM maksimal Rp ${Math.floor(maxMemberPrice).toLocaleString("id-ID")} (komisi ${settings.minKomisiMitra}%)` },
        { status: 422 },
      );
    }
  }

  const [product] = await tenantDb
    .insert(schema.products)
    .values({
      name:        body.name,
      slug:        body.slug,
      price:       String(body.price),
      memberPrice: body.memberPrice != null ? String(body.memberPrice) : null,
      stock:       body.stock ?? 0,
      weightGram:  body.weightGram ?? null,
      description: body.description ?? null,
      images:      body.images ?? [],
      categoryId:  body.categoryId ?? null,
      sellerType:  "mitra",
      mitraId:     mitra.id,
      status:      "active",  // produk mitra langsung aktif setelah dibuat
    })
    .returning({ id: schema.products.id });

  return NextResponse.json({ success: true, productId: product.id }, { status: 201 });
}
