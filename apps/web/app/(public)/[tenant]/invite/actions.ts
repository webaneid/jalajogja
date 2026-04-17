"use server";

import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, user as authUser } from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";

type AcceptResult =
  | { success: true; slug: string }
  | { success: false; error: string };

/**
 * Terima undangan — user sudah login saat action ini dipanggil.
 * Verifikasi token → buat row di tenant.users → tandai invite accepted.
 */
export async function acceptInviteAction(
  slug: string,
  token: string
): Promise<AcceptResult> {
  const session = await getCurrentSession();
  if (!session?.user) return { success: false, error: "Anda harus login terlebih dahulu." };

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) return { success: false, error: "Organisasi tidak ditemukan." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Cari invite
  const [invite] = await tenantDb
    .select()
    .from(schema.tenantInvites)
    .where(eq(schema.tenantInvites.token, token))
    .limit(1);

  if (!invite) return { success: false, error: "Link undangan tidak valid." };
  if (invite.acceptedAt) return { success: false, error: "Undangan ini sudah digunakan." };
  if (new Date(invite.expiresAt) < new Date()) {
    return { success: false, error: "Undangan sudah kadaluarsa. Minta link baru dari admin." };
  }

  // Cek user belum jadi anggota tenant ini
  const [existing] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.betterAuthUserId, session.user.id))
    .limit(1);

  if (existing) {
    return { success: false, error: "Anda sudah memiliki akses ke dashboard ini." };
  }

  // Buat user di tenant
  await tenantDb.insert(schema.users).values({
    betterAuthUserId: session.user.id,
    role:             invite.role,
    customRoleId:     invite.customRoleId ?? null,
    memberId:         invite.memberId ?? null,
  });

  // Tandai invite sudah diterima
  await tenantDb
    .update(schema.tenantInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.tenantInvites.id, invite.id));

  return { success: true, slug };
}

/**
 * Daftar akun baru lalu terima undangan.
 * Dipanggil jika user belum punya akun sama sekali.
 */
export async function registerAndAcceptAction(
  slug: string,
  token: string,
  name: string,
  email: string,
  password: string
): Promise<AcceptResult> {
  // Validasi token dulu sebelum buat akun
  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) return { success: false, error: "Organisasi tidak ditemukan." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [invite] = await tenantDb
    .select()
    .from(schema.tenantInvites)
    .where(eq(schema.tenantInvites.token, token))
    .limit(1);

  if (!invite) return { success: false, error: "Link undangan tidak valid." };
  if (invite.acceptedAt) return { success: false, error: "Undangan ini sudah digunakan." };
  if (new Date(invite.expiresAt) < new Date()) {
    return { success: false, error: "Undangan sudah kadaluarsa." };
  }

  // Cek email sudah terdaftar
  const [existingAuth] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email.toLowerCase().trim()))
    .limit(1);

  if (existingAuth) {
    return { success: false, error: "Email sudah terdaftar. Silakan login terlebih dahulu." };
  }

  // Buat akun via Better Auth API (hash password di server)
  // Panggil /api/auth/sign-up/email dari dalam server action
  const { auth } = await import("@/lib/auth");
  const signUpResult = await auth.api.signUpEmail({
    body: { name: name.trim(), email: email.toLowerCase().trim(), password },
  });

  if (!signUpResult || !signUpResult.user) {
    return { success: false, error: "Gagal membuat akun. Coba lagi." };
  }

  const userId = signUpResult.user.id;

  // Cek user belum jadi member tenant
  const [existingTenantUser] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.betterAuthUserId, userId))
    .limit(1);

  if (!existingTenantUser) {
    await tenantDb.insert(schema.users).values({
      betterAuthUserId: userId,
      role:             invite.role,
      customRoleId:     invite.customRoleId ?? null,
      memberId:         invite.memberId ?? null,
    });
  }

  await tenantDb
    .update(schema.tenantInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.tenantInvites.id, invite.id));

  return { success: true, slug };
}
