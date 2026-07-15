export const dynamic = "force-dynamic";
// GET /api/mitra/status?slug={tenant}
// Cek status mitra + eligibility untuk anggota IKPM yang sedang login

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db, members, memberBusinesses, tenantMemberships, tenants, createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTokoSettings } from "@/lib/toko-settings";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });

  // Cari member dari session
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true, name: true, memberNumber: true },
  });
  if (!member) return NextResponse.json({ error: "Bukan anggota IKPM" }, { status: 403 });

  // Mitra terikat cabang — wajib anggota terdaftar (active/alumni) di tenant ini
  const [tenantRow] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const isTenantMember = tenantRow
    ? !!(await db.query.tenantMemberships.findFirst({
        where: and(
          eq(tenantMemberships.tenantId, tenantRow.id),
          eq(tenantMemberships.memberId, member.id),
          sql`${tenantMemberships.status} IN ('active', 'alumni')`,
        ),
      }))
    : false;

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Ambil status mitra + application
  const [mitra, application, businesses, settings] = await Promise.all([
    tenantDb.select().from(schema.mitras).where(eq(schema.mitras.memberId, member.id)).limit(1).then(r => r[0] ?? null),
    tenantDb.select().from(schema.mitraApplications)
      .where(and(
        eq(schema.mitraApplications.memberId, member.id),
        eq(schema.mitraApplications.status, "pending"),
      ))
      .limit(1)
      .then(r => r[0] ?? null),
    db.select({ id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand })
      .from(memberBusinesses)
      .where(and(eq(memberBusinesses.memberId, member.id), eq(memberBusinesses.isActive, true))),
    getTokoSettings(slug),
  ]);

  // Hitung jumlah produk mitra (jika sudah mitra)
  let productCount = 0;
  if (mitra) {
    const countResult = await tenantDb
      .select({ count: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.mitraId, (mitra as { id: string }).id));
    productCount = countResult.length;
  }

  return NextResponse.json({
    member: { id: member.id, name: member.name, memberNumber: member.memberNumber },
    mitra:  mitra ? {
      id:               (mitra as { id: string; status: string; suspensionReason: string | null }).id,
      status:           (mitra as { status: string }).status,
      suspensionReason: (mitra as { suspensionReason: string | null }).suspensionReason,
      productCount,
    } : null,
    pendingApplication: application ? {
      id:        application.id,
      appliedAt: application.appliedAt.toISOString(),
    } : null,
    businesses:      businesses.map((b: { id: string; name: string; brand: string | null }) => ({ id: b.id, name: b.name, brand: b.brand })),
    hasBusinesses:   businesses.length > 0,
    settings: {
      mitraEnabled:     settings.mitraEnabled,
      mitraMaxProducts: settings.mitraMaxProducts,
      minKomisiMitra:   settings.minKomisiMitra,
    },
    // Eligibility checks
    eligibility: {
      isMitraEnabled:  settings.mitraEnabled,
      isTenantMember,
      hasBusinesses:   businesses.length > 0,
      alreadyMitra:    !!mitra,
      hasPending:      !!application,
    },
  });
}
