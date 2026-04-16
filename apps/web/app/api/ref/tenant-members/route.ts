// GET /api/ref/tenant-members?slug=&status=active|alumni|all&search=&page=1
// Daftar anggota suatu tenant — untuk picker penerima mail merge bulk + RecipientCombobox
// Butuh sesi valid (admin/owner)

import { NextRequest, NextResponse } from "next/server";
import { db, members, tenantMemberships, contacts, addresses, refRegencies } from "@jalajogja/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getTenantAccess } from "@/lib/tenant";

const PAGE_SIZE = 30;

// Alias untuk JOIN ganda (addresses + ref_regencies)
const homeAddress = alias(addresses, "home_address");
const homeRegency = alias(refRegencies, "home_regency");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug   = searchParams.get("slug")   ?? "";
  const status = searchParams.get("status") ?? "active"; // active | alumni | all
  const search = searchParams.get("search") ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  if (!slug) {
    return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = access.tenant.id;

  // Filter status keanggotaan
  const membershipCondition = status === "all"
    ? eq(tenantMemberships.tenantId, tenantId)
    : and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, status as "active" | "alumni" | "inactive")
      );

  // Filter search — nama, nomor anggota, NIK
  const searchCondition = search.trim()
    ? or(
        ilike(members.name,         `%${search.trim()}%`),
        ilike(members.memberNumber, `%${search.trim()}%`),
        ilike(members.nik,          `%${search.trim()}%`)
      )
    : undefined;

  const whereClause = searchCondition
    ? and(membershipCondition, searchCondition)
    : membershipCondition;

  // Hitung total untuk pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      membershipCondition as ReturnType<typeof and>
    ))
    .where(searchCondition);

  const total  = count ?? 0;
  const offset = (page - 1) * PAGE_SIZE;

  // Fetch halaman — LEFT JOIN ke contacts, addresses, refRegencies
  const rows = await db
    .select({
      id:           members.id,
      name:         members.name,
      memberNumber: members.memberNumber,
      nik:          members.nik,
      phone:        contacts.phone,
      email:        contacts.email,
      status:       tenantMemberships.status,
      // Alamat: detail jalan + nama kabupaten/kota sebagai ringkasan
      addressDetail: homeAddress.detail,
      addressRegency: homeRegency.name,
    })
    .from(members)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      membershipCondition as ReturnType<typeof and>
    ))
    .leftJoin(contacts,     eq(contacts.id,     members.contactId))
    .leftJoin(homeAddress,  eq(homeAddress.id,  members.homeAddressId))
    .leftJoin(homeRegency,  eq(homeRegency.id,  homeAddress.regencyId))
    .where(searchCondition)
    .orderBy(members.name)
    .limit(PAGE_SIZE)
    .offset(offset);

  return NextResponse.json({
    items: rows.map((r) => {
      // Bangun string alamat ringkas: "Jl. XX No. 1, Kab. Sleman"
      const addrParts = [r.addressDetail, r.addressRegency].filter(Boolean);
      return {
        id:           r.id,
        name:         r.name,
        memberNumber: r.memberNumber ?? null,
        nik:          r.nik          ?? null,
        phone:        r.phone        ?? null,
        email:        r.email        ?? null,
        address:      addrParts.length > 0 ? addrParts.join(", ") : null,
        status:       r.status,
      };
    }),
    total,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
