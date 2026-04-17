"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type OfficerData = {
  memberId:    string;
  divisionId:  string | null;
  position:    string;
  periodStart: string;        // YYYY-MM-DD
  periodEnd:   string | null; // YYYY-MM-DD | null = masih aktif
  isActive:    boolean;
  canSign:     boolean;
  sortOrder:   number;
  userId:      string | null;
};

export type DivisionData = {
  name:        string;
  code:        string | null;
  description: string | null;
  parentId:    string | null;
  sortOrder:   number;
  isActive:    boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidatePengurus(slug: string) {
  revalidatePath(`/${slug}/pengurus`);
  revalidatePath(`/${slug}/divisi`);
}

// ─── Officer Actions ──────────────────────────────────────────────────────────

export async function createOfficerAction(
  slug: string,
  data: OfficerData
): Promise<ActionResult<{ officerId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  if (!data.memberId?.trim()) return { success: false, error: "Anggota wajib dipilih." };
  if (!data.position?.trim()) return { success: false, error: "Jabatan wajib diisi." };
  if (!data.periodStart)      return { success: false, error: "Tanggal mulai wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [officer] = await db
      .insert(schema.officers)
      .values({
        memberId:    data.memberId,
        divisionId:  data.divisionId  || null,
        position:    data.position.trim(),
        periodStart: data.periodStart,
        periodEnd:   data.periodEnd   || null,
        isActive:    data.isActive,
        canSign:     data.canSign,
        sortOrder:   data.sortOrder,
        userId:      data.userId      || null,
      })
      .returning({ id: schema.officers.id });

    revalidatePengurus(slug);
    return { success: true, data: { officerId: officer.id } };
  } catch (e) {
    console.error("createOfficerAction:", e);
    return { success: false, error: "Gagal menyimpan pengurus." };
  }
}

export async function updateOfficerAction(
  slug: string,
  officerId: string,
  data: OfficerData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  if (!data.position?.trim()) return { success: false, error: "Jabatan wajib diisi." };
  if (!data.periodStart)      return { success: false, error: "Tanggal mulai wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.officers)
      .set({
        divisionId:  data.divisionId  || null,
        position:    data.position.trim(),
        periodStart: data.periodStart,
        periodEnd:   data.periodEnd   || null,
        isActive:    data.isActive,
        canSign:     data.canSign,
        sortOrder:   data.sortOrder,
        userId:      data.userId      || null,
        updatedAt:   new Date(),
      })
      .where(eq(schema.officers.id, officerId));

    revalidatePengurus(slug);
    return { success: true, data: undefined };
  } catch (e) {
    console.error("updateOfficerAction:", e);
    return { success: false, error: "Gagal memperbarui pengurus." };
  }
}

export async function toggleOfficerActiveAction(
  slug: string,
  officerId: string
): Promise<ActionResult<{ isActive: boolean }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [current] = await db
    .select({ isActive: schema.officers.isActive })
    .from(schema.officers)
    .where(eq(schema.officers.id, officerId))
    .limit(1);

  if (!current) return { success: false, error: "Pengurus tidak ditemukan." };

  const newActive = !current.isActive;

  await db
    .update(schema.officers)
    .set({ isActive: newActive, updatedAt: new Date() })
    .where(eq(schema.officers.id, officerId));

  revalidatePengurus(slug);
  return { success: true, data: { isActive: newActive } };
}

export async function deleteOfficerAction(
  slug: string,
  officerId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Cek apakah officer ini punya letter_signatures
  const [sig] = await db
    .select({ id: schema.letterSignatures.id })
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.officerId, officerId))
    .limit(1);

  if (sig) {
    return { success: false, error: "Pengurus ini sudah menandatangani surat — tidak bisa dihapus. Nonaktifkan saja." };
  }

  await db.delete(schema.officers).where(eq(schema.officers.id, officerId));

  revalidatePengurus(slug);
  return { success: true, data: undefined };
}

// ─── Division Actions ─────────────────────────────────────────────────────────

export async function createDivisionAction(
  slug: string,
  data: DivisionData
): Promise<ActionResult<{ divisionId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama divisi wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [div] = await db
      .insert(schema.divisions)
      .values({
        name:        data.name.trim(),
        code:        data.code?.trim()        || null,
        description: data.description?.trim() || null,
        parentId:    data.parentId            || null,
        sortOrder:   data.sortOrder,
        isActive:    data.isActive,
      })
      .returning({ id: schema.divisions.id });

    revalidatePengurus(slug);
    return { success: true, data: { divisionId: div.id } };
  } catch (e) {
    console.error("createDivisionAction:", e);
    return { success: false, error: "Gagal menyimpan divisi." };
  }
}

export async function updateDivisionAction(
  slug: string,
  divisionId: string,
  data: DivisionData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama divisi wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  await db
    .update(schema.divisions)
    .set({
      name:        data.name.trim(),
      code:        data.code?.trim()        || null,
      description: data.description?.trim() || null,
      parentId:    data.parentId            || null,
      sortOrder:   data.sortOrder,
      isActive:    data.isActive,
      updatedAt:   new Date(),
    })
    .where(eq(schema.divisions.id, divisionId));

  revalidatePengurus(slug);
  return { success: true, data: undefined };
}

export async function deleteDivisionAction(
  slug: string,
  divisionId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Cek apakah masih ada officer di divisi ini
  const [officer] = await db
    .select({ id: schema.officers.id })
    .from(schema.officers)
    .where(eq(schema.officers.divisionId, divisionId))
    .limit(1);

  if (officer) {
    return { success: false, error: "Divisi masih memiliki pengurus — pindahkan atau hapus pengurus dulu." };
  }

  await db.delete(schema.divisions).where(eq(schema.divisions.id, divisionId));

  revalidatePengurus(slug);
  return { success: true, data: undefined };
}
