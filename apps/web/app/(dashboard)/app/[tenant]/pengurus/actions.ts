"use server";

import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, db, members, tenantMemberships, contacts, user as authUserTable } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { auth } from "@/lib/auth";

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
  revalidatePath(`/app/${slug}/pengurus`);
  revalidatePath(`/app/${slug}/divisi`);
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

// ─── Buat Pengurus + Aktifkan Akun Sekaligus ─────────────────────────────────

export type OfficerWithAccountData = OfficerData & {
  // Jika activate = true, isi field di bawah
  activate:              boolean;
  activationEmail?:      string;
  activationPassword?:   string;
  activationRole?:       "ketua" | "sekretaris" | "bendahara" | "custom";
  activationCustomRoleId?: string;
  activationName?:       string;
};

export async function createOfficerWithAccountAction(
  slug: string,
  data: OfficerWithAccountData
): Promise<ActionResult<{ officerId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "pengurus")) return { success: false, error: "Akses ditolak." };

  if (!data.memberId?.trim()) return { success: false, error: "Anggota wajib dipilih." };
  if (!data.position?.trim()) return { success: false, error: "Jabatan wajib diisi." };
  if (!data.periodStart)      return { success: false, error: "Tanggal mulai wajib diisi." };

  if (data.activate) {
    // Role selalu wajib, terlepas dari apakah member sudah punya akun atau belum
    if (!data.activationRole) return { success: false, error: "Role wajib dipilih." };
    if (data.activationRole === "custom" && !data.activationCustomRoleId)
      return { success: false, error: "Role kustom wajib dipilih." };
    // Email + password divalidasi nanti di dalam cabang "belum punya akun front-end"
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi member ada di tenant
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, access.tenant.id), eq(tenantMemberships.memberId, data.memberId)))
    .limit(1);
  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // authUserId = Better Auth user ID (nanoid) — untuk insert tenant.users
  // tenantUserId = tenant.users.id (UUID) — untuk insert officers.user_id
  let authUserId:   string | null = null;
  let tenantUserId: string | null = null;

  // ── Aktivasi akun dashboard ───────────────────────────────────────────────
  if (data.activate) {
    // Cek member belum jadi user di tenant ini
    const [existingByMember] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.memberId, data.memberId))
      .limit(1);
    if (existingByMember) return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };

    // Ambil better_auth_user_id dari public.members (jika sudah punya akun front-end)
    const [memberRow] = await db
      .select({ betterAuthUserId: members.betterAuthUserId })
      .from(members)
      .where(eq(members.id, data.memberId))
      .limit(1);

    if (memberRow?.betterAuthUserId) {
      // Anggota sudah punya akun front-end → pakai langsung, tidak perlu email/password
      authUserId = memberRow.betterAuthUserId;

      const [existingByAuth] = await tenantDb
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.betterAuthUserId, authUserId))
        .limit(1);
      if (existingByAuth) return { success: false, error: "Akun ini sudah terdaftar sebagai pengguna dashboard ini." };
    } else {
      // Belum punya akun → validasi email + password dulu
      if (!data.activationEmail?.trim())
        return { success: false, error: "Email wajib diisi untuk aktivasi akun." };
      if (!data.activationPassword || data.activationPassword.length < 8)
        return { success: false, error: "Password minimal 8 karakter." };

      const email = data.activationEmail.toLowerCase().trim();

      // Cek email di Better Auth
      const [existingAuth] = await db
        .select({ id: authUserTable.id })
        .from(authUserTable)
        .where(eq(authUserTable.email, email))
        .limit(1);

      if (existingAuth) {
        const [existingByAuth] = await tenantDb
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.betterAuthUserId, existingAuth.id))
          .limit(1);
        if (existingByAuth) return { success: false, error: "Email ini sudah terdaftar sebagai pengguna dashboard ini." };
        authUserId = existingAuth.id;
      } else {
        const result = await auth.api.signUpEmail({
          body: {
            name:     (data.activationName ?? data.memberId).trim(),
            email,
            password: data.activationPassword!,
          },
        });
        if (!result?.user?.id) return { success: false, error: "Gagal membuat akun login." };
        authUserId = result.user.id;
      }

      // Set better_auth_user_id di public.members agar pengurus bisa login front-end
      await db
        .update(members)
        .set({ betterAuthUserId: authUserId! })
        .where(and(eq(members.id, data.memberId), isNull(members.betterAuthUserId)));
    }

    // Insert ke tenant.users — ambil UUID yang di-generate untuk officers.user_id
    const [insertedUser] = await tenantDb.insert(schema.users).values({
      betterAuthUserId: authUserId!,
      memberId:         data.memberId,
      role:             data.activationRole!,
      customRoleId:     data.activationRole === "custom" ? (data.activationCustomRoleId ?? null) : null,
    }).returning({ id: schema.users.id });

    // tenantUserId (UUID) — ini yang valid untuk FK officers.user_id
    tenantUserId = insertedUser.id;
  }

  // ── Buat officer record ───────────────────────────────────────────────────
  try {
    const [officer] = await tenantDb
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
        userId:      tenantUserId,  // UUID dari tenant.users.id, bukan betterAuthUserId (nanoid)
      })
      .returning({ id: schema.officers.id });

    revalidatePengurus(slug);
    return { success: true, data: { officerId: officer.id } };
  } catch (e) {
    console.error("createOfficerWithAccountAction:", e);
    return { success: false, error: "Gagal menyimpan pengurus." };
  }
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
