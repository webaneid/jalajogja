"use server";

import { createTenantDb, db, members, memberBusinesses } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type ActionResult = { error?: string };

export async function approveMitraAction(
  slug: string,
  applicationId: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [application] = await tenantDb
    .select()
    .from(schema.mitraApplications)
    .where(eq(schema.mitraApplications.id, applicationId))
    .limit(1);

  if (!application) return { error: "Pengajuan tidak ditemukan." };
  if (application.status !== "pending") return { error: "Pengajuan sudah diproses." };

  // Cek apakah member sudah punya akun mitra di tenant ini
  const existing = await tenantDb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(eq(schema.mitras.memberId, application.memberId))
    .limit(1);
  if (existing.length > 0) return { error: "Member sudah memiliki akun mitra aktif." };

  const now = new Date();

  // Insert ke mitras (copy kota asal dari application)
  await tenantDb.insert(schema.mitras).values({
    memberId:            application.memberId,
    businessId:          application.businessId,
    applicationId:       applicationId,
    status:              "active",
    rajaongkirCityId:    application.rajaongkirCityId ?? null,
    rajaongkirCityName:  application.rajaongkirCityName ?? null,
    approvedAt:          now,
    approvedBy:          access.tenantUser.id,
  });

  // Update status application
  await tenantDb
    .update(schema.mitraApplications)
    .set({ status: "approved", reviewedAt: now, reviewedBy: access.tenantUser.id })
    .where(eq(schema.mitraApplications.id, applicationId));

  revalidatePath(`/${slug}/toko/mitra`);
  return {};
}

export async function rejectMitraAction(
  slug: string,
  applicationId: string,
  reason: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [application] = await tenantDb
    .select({ id: schema.mitraApplications.id, status: schema.mitraApplications.status })
    .from(schema.mitraApplications)
    .where(eq(schema.mitraApplications.id, applicationId))
    .limit(1);

  if (!application) return { error: "Pengajuan tidak ditemukan." };
  if (application.status !== "pending") return { error: "Pengajuan sudah diproses." };

  const now = new Date();
  await tenantDb
    .update(schema.mitraApplications)
    .set({
      status:          "rejected",
      rejectionReason: reason || null,
      reviewedAt:      now,
      reviewedBy:      access.tenantUser.id,
    })
    .where(eq(schema.mitraApplications.id, applicationId));

  revalidatePath(`/${slug}/toko/mitra`);
  return {};
}

export async function suspendMitraAction(
  slug: string,
  mitraId: string,
  reason: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  await tenantDb
    .update(schema.mitras)
    .set({ status: "suspended", suspensionReason: reason || null, updatedAt: new Date() })
    .where(eq(schema.mitras.id, mitraId));

  revalidatePath(`/${slug}/toko/mitra`);
  return {};
}

export async function reactivateMitraAction(
  slug: string,
  mitraId: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  await tenantDb
    .update(schema.mitras)
    .set({ status: "active", suspensionReason: null, updatedAt: new Date() })
    .where(eq(schema.mitras.id, mitraId));

  revalidatePath(`/${slug}/toko/mitra`);
  return {};
}

// Fetch helpers untuk halaman admin

export async function getMitraApplications(slug: string) {
  const { db: tenantDb, schema } = createTenantDb(slug);

  const rows = await tenantDb
    .select({
      id:          schema.mitraApplications.id,
      memberId:    schema.mitraApplications.memberId,
      businessId:  schema.mitraApplications.businessId,
      motivation:  schema.mitraApplications.motivation,
      status:      schema.mitraApplications.status,
      rejectionReason: schema.mitraApplications.rejectionReason,
      appliedAt:   schema.mitraApplications.appliedAt,
      reviewedAt:  schema.mitraApplications.reviewedAt,
    })
    .from(schema.mitraApplications)
    .orderBy(schema.mitraApplications.appliedAt);

  // Fetch member names + business names
  const memberIds   = [...new Set(rows.map(r => r.memberId))];
  const businessIds = [...new Set(rows.map(r => r.businessId))];

  const [memberRows, businessRows] = await Promise.all([
    memberIds.length > 0
      ? db.select({ id: members.id, name: members.name, memberNumber: members.memberNumber })
          .from(members)
      : Promise.resolve([]),
    businessIds.length > 0
      ? db.select({ id: memberBusinesses.id, name: memberBusinesses.name, sector: memberBusinesses.sector })
          .from(memberBusinesses)
      : Promise.resolve([]),
  ]);

  const memberMap   = new Map(memberRows.map(m => [m.id, m]));
  const businessMap = new Map(businessRows.map(b => [b.id, b]));

  return rows.map(r => ({
    ...r,
    appliedAt:    r.appliedAt.toISOString(),
    reviewedAt:   r.reviewedAt?.toISOString() ?? null,
    memberName:   memberMap.get(r.memberId)?.name ?? "—",
    memberNumber: memberMap.get(r.memberId)?.memberNumber ?? null,
    businessName: businessMap.get(r.businessId)?.name ?? "—",
    businessSector: businessMap.get(r.businessId)?.sector ?? "—",
  }));
}

export async function getActiveMitras(slug: string) {
  const { db: tenantDb, schema } = createTenantDb(slug);

  const rows = await tenantDb
    .select({
      id:               schema.mitras.id,
      memberId:         schema.mitras.memberId,
      businessId:       schema.mitras.businessId,
      status:           schema.mitras.status,
      suspensionReason: schema.mitras.suspensionReason,
      approvedAt:       schema.mitras.approvedAt,
    })
    .from(schema.mitras)
    .orderBy(schema.mitras.approvedAt);

  const memberIds   = [...new Set(rows.map(r => r.memberId))];
  const businessIds = [...new Set(rows.map(r => r.businessId))];

  const [memberRows, businessRows] = await Promise.all([
    memberIds.length > 0
      ? db.select({ id: members.id, name: members.name })
          .from(members)
      : Promise.resolve([]),
    businessIds.length > 0
      ? db.select({ id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand })
          .from(memberBusinesses)
      : Promise.resolve([]),
  ]);

  const memberMap   = new Map(memberRows.map(m => [m.id, m]));
  const businessMap = new Map(businessRows.map(b => [b.id, b]));

  return rows.map(r => ({
    ...r,
    approvedAt:    r.approvedAt.toISOString(),
    memberName:    memberMap.get(r.memberId)?.name ?? "—",
    businessName:  businessMap.get(r.businessId)?.name ?? "—",
    businessBrand: businessMap.get(r.businessId)?.brand ?? null,
  }));
}
