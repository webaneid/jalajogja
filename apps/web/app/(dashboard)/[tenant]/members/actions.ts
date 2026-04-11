"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  members,
  tenantMemberships,
  generateMemberNumber,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";

// ─── Types ─────────────────────────────────────────────────────────────────

export type MemberFormData = {
  name: string;
  stambukNumber?: string;
  nik?: string;
  gender?: "male" | "female";
  birthPlace?: string;
  birthDate?: string;       // YYYY-MM-DD
  phone?: string;
  email?: string;
  address?: string;
  // Data keanggotaan cabang
  status?: "active" | "inactive" | "alumni";
  joinedAt?: string;        // YYYY-MM-DD
};

type ActionResult =
  | { success: true; memberId: string }
  | { success: false; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitize(data: MemberFormData) {
  return {
    name: data.name.trim(),
    stambukNumber: data.stambukNumber?.trim() || null,
    nik: data.nik?.trim() || null,
    gender: data.gender || null,
    birthPlace: data.birthPlace?.trim() || null,
    birthDate: data.birthDate || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    address: data.address?.trim() || null,
  };
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

export async function createMemberAction(
  slug: string,
  data: MemberFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.name?.trim()) {
    return { success: false, error: "Nama anggota wajib diisi." };
  }

  try {
    // Generate nomor anggota global via PostgreSQL SEQUENCE
    const memberNumber = await generateMemberNumber(db, data.birthDate ?? null);

    const [newMember] = await db
      .insert(members)
      .values({
        ...sanitize(data),
        memberNumber,
      })
      .returning({ id: members.id });

    // Catat keanggotaan di cabang ini
    await db.insert(tenantMemberships).values({
      tenantId: access.tenant.id,
      memberId: newMember.id,
      status: data.status ?? "active",
      joinedAt: data.joinedAt ?? null,
      registeredVia: slug,
    });

    revalidatePath(`/${slug}/members`);
    return { success: true, memberId: newMember.id };

  } catch (err) {
    console.error("[createMemberAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    // Deteksi duplikat NIK
    if (msg.includes("members_nik_not_null_unique")) {
      return { success: false, error: "NIK sudah terdaftar di sistem." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────

export async function updateMemberAction(
  slug: string,
  memberId: string,
  data: MemberFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  // Pastikan anggota ini memang milik tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  if (!data.name?.trim()) {
    return { success: false, error: "Nama anggota wajib diisi." };
  }

  try {
    // Update data identitas global
    await db
      .update(members)
      .set({ ...sanitize(data), updatedAt: new Date() })
      .where(eq(members.id, memberId));

    // Update status keanggotaan di cabang ini
    await db
      .update(tenantMemberships)
      .set({
        status: data.status ?? "active",
        joinedAt: data.joinedAt ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantMemberships.tenantId, access.tenant.id),
          eq(tenantMemberships.memberId, memberId)
        )
      );

    revalidatePath(`/${slug}/members`);
    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true, memberId };

  } catch (err) {
    console.error("[updateMemberAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (msg.includes("members_nik_not_null_unique")) {
      return { success: false, error: "NIK sudah terdaftar di sistem." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── DELETE (hapus dari cabang, bukan dari global) ──────────────────────────

export async function removeMemberFromTenantAction(
  slug: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  try {
    await db
      .delete(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, access.tenant.id),
          eq(tenantMemberships.memberId, memberId)
        )
      );

    revalidatePath(`/${slug}/members`);
    return { success: true };

  } catch (err) {
    console.error("[removeMemberFromTenantAction]", err);
    return { success: false, error: "Gagal menghapus." };
  }
}
