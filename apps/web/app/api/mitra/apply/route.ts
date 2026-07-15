export const dynamic = "force-dynamic";
// POST /api/mitra/apply — daftar sebagai mitra
// DELETE /api/mitra/apply — batalkan pengajuan pending

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db, members, memberBusinesses, tenantMemberships, tenants, createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getTokoSettings } from "@/lib/toko-settings";

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
}

export async function POST(req: NextRequest) {
  const member = await getSessionMember(req);
  if (!member) return NextResponse.json({ error: "Login sebagai anggota IKPM diperlukan" }, { status: 401 });

  const body = await req.json() as {
    slug: string; businessId: string; motivation?: string;
    rajaongkirCityId?: number; rajaongkirCityName?: string;
  };
  const { slug, businessId, motivation, rajaongkirCityId, rajaongkirCityName } = body;
  if (!slug || !businessId) return NextResponse.json({ error: "slug dan businessId wajib diisi" }, { status: 400 });
  if (!rajaongkirCityId) return NextResponse.json({ error: "Kota asal pengiriman wajib dipilih" }, { status: 400 });

  const settings = await getTokoSettings(slug);
  if (!settings.mitraEnabled) return NextResponse.json({ error: "Sistem mitra belum diaktifkan di toko ini" }, { status: 403 });

  // Mitra terikat cabang — wajib anggota terdaftar (active/alumni) di tenant ini
  const [tenantRow] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow) return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, member.id),
      sql`${tenantMemberships.status} IN ('active', 'alumni')`,
    ),
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Anda hanya bisa mendaftar mitra di cabang tempat Anda terdaftar sebagai anggota." },
      { status: 403 },
    );
  }

  // Validasi business milik member dan aktif
  const [business] = await db
    .select({ id: memberBusinesses.id })
    .from(memberBusinesses)
    .where(and(
      eq(memberBusinesses.id, businessId),
      eq(memberBusinesses.memberId, member.id),
      eq(memberBusinesses.isActive, true),
    ))
    .limit(1);
  if (!business) return NextResponse.json({ error: "Data usaha tidak valid" }, { status: 400 });

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Cek sudah mitra
  const existingMitra = await tenantDb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(eq(schema.mitras.memberId, member.id))
    .limit(1);
  if (existingMitra.length > 0) return NextResponse.json({ error: "Anda sudah terdaftar sebagai mitra" }, { status: 409 });

  // Cek pending application
  const existingApp = await tenantDb
    .select({ id: schema.mitraApplications.id })
    .from(schema.mitraApplications)
    .where(and(
      eq(schema.mitraApplications.memberId, member.id),
      eq(schema.mitraApplications.status, "pending"),
    ))
    .limit(1);
  if (existingApp.length > 0) return NextResponse.json({ error: "Anda sudah memiliki pengajuan yang sedang diproses" }, { status: 409 });

  const [application] = await tenantDb
    .insert(schema.mitraApplications)
    .values({
      memberId:            member.id,
      businessId,
      motivation:          motivation?.trim() || null,
      rajaongkirCityId:    rajaongkirCityId ?? null,
      rajaongkirCityName:  rajaongkirCityName?.trim() || null,
      status:              "pending",
    })
    .returning({ id: schema.mitraApplications.id });

  return NextResponse.json({ success: true, applicationId: application.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const member = await getSessionMember(req);
  if (!member) return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [app] = await tenantDb
    .select({ id: schema.mitraApplications.id, status: schema.mitraApplications.status })
    .from(schema.mitraApplications)
    .where(and(
      eq(schema.mitraApplications.memberId, member.id),
      eq(schema.mitraApplications.status, "pending"),
    ))
    .limit(1);

  if (!app) return NextResponse.json({ error: "Tidak ada pengajuan yang bisa dibatalkan" }, { status: 404 });

  await tenantDb
    .update(schema.mitraApplications)
    .set({ status: "cancelled" })
    .where(eq(schema.mitraApplications.id, app.id));

  return NextResponse.json({ success: true });
}
