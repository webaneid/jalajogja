export const dynamic = "force-dynamic";
// GET /api/ref/customer-search?slug=&q=
// Cari pelanggan gabungan dari 2 sumber: public.members (anggota tenant ini, scoped via
// tenant_memberships persis pola /api/ref/tenant-members) + public.profiles (akun publik,
// TIDAK tenant-scoped — publik bisa transaksi lintas tenant, sama seperti member).
// Dipakai admin untuk autocomplete "Informasi Pelanggan" saat buat pesanan manual
// (/toko/pesanan/new) — search "seperti di invoice" tapi mencakup akun publik juga.

import { NextRequest, NextResponse } from "next/server";
import { db, members, tenantMemberships, contacts, profiles } from "@jalajogja/db";
import { eq, and, ilike, or, isNull } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";

export type CustomerSearchResult = {
  type:         "member" | "profile";
  id:           string;
  name:         string;
  phone:        string | null;
  email:        string | null;
  memberNumber: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const q    = (searchParams.get("q") ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [memberRows, profileRows] = await Promise.all([
    db
      .select({
        id:           members.id,
        name:         members.name,
        memberNumber: members.memberNumber,
        phone:        contacts.phone,
        email:        contacts.email,
      })
      .from(members)
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, access.tenant.id),
      ))
      .leftJoin(contacts, eq(contacts.id, members.contactId))
      .where(or(
        ilike(members.name, `%${q}%`),
        ilike(members.memberNumber, `%${q}%`),
      ))
      .limit(8),
    db
      .select({
        id:    profiles.id,
        name:  profiles.name,
        phone: profiles.phone,
        email: profiles.email,
      })
      .from(profiles)
      .where(and(
        isNull(profiles.deletedAt),
        or(
          ilike(profiles.name, `%${q}%`),
          ilike(profiles.phone, `%${q}%`),
          ilike(profiles.email, `%${q}%`),
        ),
      ))
      .limit(8),
  ]);

  const items: CustomerSearchResult[] = [
    ...memberRows.map((r) => ({
      type: "member" as const,
      id: r.id, name: r.name,
      phone: r.phone ?? null, email: r.email ?? null,
      memberNumber: r.memberNumber ?? null,
    })),
    ...profileRows.map((r) => ({
      type: "profile" as const,
      id: r.id, name: r.name,
      phone: r.phone ?? null, email: r.email ?? null,
      memberNumber: null,
    })),
  ];

  return NextResponse.json({ items });
}
