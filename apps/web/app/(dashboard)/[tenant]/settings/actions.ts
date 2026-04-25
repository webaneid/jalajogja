"use server";

import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { createTenantDb, db, tenants, members, tenantMemberships, contacts, refProvinces, refRegencies, refDistricts, refVillages } from "@jalajogja/db";
import { upsertSettings } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Level, Module } from "@/lib/permissions";

type ActionResult = { error?: string };
type StrictActionResult = { success: true } | { success: false; error: string };
type InviteResult = { success: true; inviteId: string; token: string } | { success: false; error: string };

export type InviteFormData = {
  memberId:       string;
  role:           "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?:  string;
  deliveryMethod: "manual" | "email";
};

export type CustomRoleFormData = {
  name:         string;
  description?: string;
  permissions:  Record<Module, Level>;
};

// ── Umum ──────────────────────────────────────────────────────────────────────
export async function saveGeneralSettingsAction(
  slug: string,
  values: {
    siteName:        string;
    tagline:         string;
    siteDescription: string;
    logoUrl:         string;
    faviconUrl:      string;
    timezone:        string;
    language:        string;
    currency:        string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "general", {
    site_name:        values.siteName,
    tagline:          values.tagline,
    site_description: values.siteDescription,
    logo_url:         values.logoUrl,
    favicon_url:      values.faviconUrl,
    timezone:         values.timezone,
    language:         values.language,
    currency:         values.currency,
  });

  return {};
}

// ── Domain ────────────────────────────────────────────────────────────────────
// Data domain disimpan ke public.tenants (bukan settings table)
export async function saveDomainSettingsAction(
  slug: string,
  values: {
    subdomain: string;
    customDomain: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  // Validasi format custom domain jika diisi
  if (values.customDomain) {
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(values.customDomain)) {
      return { error: "Format domain tidak valid. Contoh: ikpm.or.id" };
    }
  }

  await db
    .update(tenants)
    .set({
      subdomain:          values.subdomain    || null,
      customDomain:       values.customDomain || null,
      // Reset ke pending jika custom domain berubah, none jika dikosongkan
      customDomainStatus: values.customDomain ? "pending" : "none",
      customDomainVerifiedAt: values.customDomain ? undefined : null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, access.tenant.id));

  return {};
}

// ── Kontak & Sosial Media ─────────────────────────────────────────────────────
export async function saveContactSettingsAction(
  slug: string,
  values: {
    contactEmail:    string;
    contactPhone:    string;
    contactWhatsapp: string;
    contactAddress: {
      provinceId?: number;
      regencyId?:  number;
      districtId?: number;
      villageId?:  number;
      detail:      string;
      postalCode:  string;
    };
    socials: Record<string, string>;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  // Resolve nama wilayah dari IDs untuk display di footer
  const { provinceId, regencyId, districtId, villageId } = values.contactAddress;
  const [province, regency, district, village] = await Promise.all([
    provinceId ? db.select({ name: refProvinces.name }).from(refProvinces).where(eq(refProvinces.id, provinceId)).limit(1).then(r => r[0]?.name ?? null) : null,
    regencyId  ? db.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, regencyId)).limit(1).then(r => r[0]?.name ?? null) : null,
    districtId ? db.select({ name: refDistricts.name }).from(refDistricts).where(eq(refDistricts.id, districtId)).limit(1).then(r => r[0]?.name ?? null) : null,
    villageId  ? db.select({ name: refVillages.name }).from(refVillages).where(eq(refVillages.id, villageId)).limit(1).then(r => r[0]?.name ?? null) : null,
  ]);

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "contact", {
    contact_email:    values.contactEmail,
    contact_phone:    values.contactPhone,
    contact_whatsapp: values.contactWhatsapp,
    contact_address: {
      ...values.contactAddress,
      provinceName: province,
      regencyName:  regency,
      districtName: district,
      villageName:  village,
    },
    socials: values.socials,
  });

  return {};
}

// ── Pembayaran: Rekening Bank ─────────────────────────────────────────────────
export async function savePaymentAccountsAction(
  slug: string,
  bankAccounts: Array<{
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    categories: string[];
  }>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "payment", { bank_accounts: bankAccounts });
  return {};
}

// ── Pembayaran: QRIS ──────────────────────────────────────────────────────────
export async function saveQrisAccountsAction(
  slug: string,
  qrisAccounts: Array<{
    id: string;
    name: string;
    imageUrl: string;
    categories: string[];
    isDynamic: boolean;
    emvPayload?: string;
    merchantName?: string;
    merchantCity?: string;
  }>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "payment", { qris_accounts: qrisAccounts });
  return {};
}

// ── Pembayaran: Gateway Config ────────────────────────────────────────────────
export async function saveGatewayConfigAction(
  slug: string,
  values: {
    midtrans?: { serverKey: string; clientKey: string; isSandbox: boolean };
    xendit?:   { apiKey: string };
    ipaymu?:   { va: string; apiKey: string };
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const entries: Record<string, unknown> = {};
  if (values.midtrans !== undefined) entries.midtrans = values.midtrans;
  if (values.xendit   !== undefined) entries.xendit   = values.xendit;
  if (values.ipaymu   !== undefined) entries.ipaymu   = values.ipaymu;

  await upsertSettings(tenantDb, "payment", entries);
  return {};
}

// ── Tampilan ──────────────────────────────────────────────────────────────────
export async function saveDisplaySettingsAction(
  slug: string,
  values: {
    primaryColor: string;
    font: string;
    footerText: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "display", {
    primary_color: values.primaryColor,
    font:          values.font,
    footer_text:   values.footerText,
  });

  return {};
}

// ── Email / SMTP ──────────────────────────────────────────────────────────────
export async function saveSmtpConfigAction(
  slug: string,
  values: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "mail", { smtp_config: values });
  return {};
}

// ── Notifikasi ────────────────────────────────────────────────────────────────
export async function saveNotificationSettingsAction(
  slug: string,
  values: {
    emailNewMember: boolean;
    emailPaymentIn: boolean;
    emailPaymentConfirmed: boolean;
    whatsappEnabled: boolean;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "notif", { notifications: values });
  return {};
}

// ─── INVITE ACTIONS ──────────────────────────────────────────────────────────

export async function createInviteAction(
  slug: string,
  data: InviteFormData
): Promise<InviteResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Hanya owner/ketua yang bisa mengundang." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi memberId ada di tenant ini
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, data.memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // Cek member belum jadi user aktif di tenant ini
  const [existingUser] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.memberId, data.memberId))
    .limit(1);

  if (existingUser) {
    return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };
  }

  // Ambil email member dari contacts jika ada
  const [memberData] = await db
    .select({ contactId: members.contactId })
    .from(members)
    .where(eq(members.id, data.memberId))
    .limit(1);

  let email: string | null = null;
  if (memberData?.contactId) {
    const [contact] = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, memberData.contactId))
      .limit(1);
    email = contact?.email ?? null;
  }

  if (data.role === "custom" && !data.customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Upsert: update token jika sudah ada invite yang belum accepted
  const [existingInvite] = await tenantDb
    .select({ id: schema.tenantInvites.id })
    .from(schema.tenantInvites)
    .where(eq(schema.tenantInvites.memberId, data.memberId))
    .limit(1);

  let inviteId: string;

  if (existingInvite) {
    await tenantDb
      .update(schema.tenantInvites)
      .set({
        role:           data.role,
        customRoleId:   data.customRoleId ?? null,
        token,
        expiresAt,
        acceptedAt:     null,
        deliveryMethod: data.deliveryMethod,
        email,
        createdBy:      access.tenantUser.id,
      })
      .where(eq(schema.tenantInvites.id, existingInvite.id));
    inviteId = existingInvite.id;
  } else {
    const [invite] = await tenantDb
      .insert(schema.tenantInvites)
      .values({
        memberId:       data.memberId,
        email,
        role:           data.role,
        customRoleId:   data.customRoleId ?? null,
        token,
        expiresAt,
        deliveryMethod: data.deliveryMethod,
        createdBy:      access.tenantUser.id,
      })
      .returning({ id: schema.tenantInvites.id });
    inviteId = invite.id;
  }

  revalidatePath(`/${slug}/settings/users`);
  return { success: true, inviteId, token };
}

export async function revokeInviteAction(
  slug: string,
  inviteId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);
  await tenantDb
    .delete(schema.tenantInvites)
    .where(eq(schema.tenantInvites.id, inviteId));

  revalidatePath(`/${slug}/settings/users`);
  return { success: true };
}

export async function removeUserAction(
  slug: string,
  userId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  if (userId === access.tenantUser.id) {
    return { success: false, error: "Tidak bisa menghapus akses diri sendiri." };
  }

  const [targetUser] = await tenantDb
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!targetUser) return { success: false, error: "Pengguna tidak ditemukan." };
  if (targetUser.role === "owner") return { success: false, error: "Owner tidak bisa dihapus." };

  await tenantDb
    .delete(schema.users)
    .where(eq(schema.users.id, userId));

  revalidatePath(`/${slug}/settings/users`);
  return { success: true };
}

export async function updateUserRoleAction(
  slug: string,
  userId: string,
  role: "ketua" | "sekretaris" | "bendahara" | "custom",
  customRoleId?: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [target] = await tenantDb
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!target) return { success: false, error: "Pengguna tidak ditemukan." };
  if (target.role === "owner") return { success: false, error: "Role owner tidak bisa diubah." };

  if (role === "custom" && !customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  await tenantDb
    .update(schema.users)
    .set({
      role,
      customRoleId: role === "custom" ? (customRoleId ?? null) : null,
      updatedAt:    new Date(),
    })
    .where(eq(schema.users.id, userId));

  revalidatePath(`/${slug}/settings/users`);
  return { success: true };
}

// ─── CUSTOM ROLE ACTIONS ─────────────────────────────────────────────────────

export async function createCustomRoleAction(
  slug: string,
  data: CustomRoleFormData
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  if (!data.name.trim()) return { success: false, error: "Nama role wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);
  await tenantDb.insert(schema.customRoles).values({
    name:        data.name.trim(),
    description: data.description?.trim() || null,
    permissions: data.permissions,
  });

  revalidatePath(`/${slug}/settings/roles`);
  return { success: true };
}

export async function updateCustomRoleAction(
  slug: string,
  roleId: string,
  data: CustomRoleFormData
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  if (!data.name.trim()) return { success: false, error: "Nama role wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [existing] = await tenantDb
    .select({ isSystem: schema.customRoles.isSystem })
    .from(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId))
    .limit(1);

  if (!existing) return { success: false, error: "Role tidak ditemukan." };
  if (existing.isSystem) return { success: false, error: "System role tidak bisa diedit." };

  await tenantDb
    .update(schema.customRoles)
    .set({
      name:        data.name.trim(),
      description: data.description?.trim() || null,
      permissions: data.permissions,
    })
    .where(eq(schema.customRoles.id, roleId));

  revalidatePath(`/${slug}/settings/roles`);
  return { success: true };
}

export async function deleteCustomRoleAction(
  slug: string,
  roleId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [existing] = await tenantDb
    .select({ isSystem: schema.customRoles.isSystem })
    .from(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId))
    .limit(1);

  if (!existing) return { success: false, error: "Role tidak ditemukan." };
  if (existing.isSystem) return { success: false, error: "System role tidak bisa dihapus." };

  const [userWithRole] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.customRoleId, roleId))
    .limit(1);

  if (userWithRole) {
    return { success: false, error: "Role sedang digunakan — ubah role pengguna tersebut terlebih dahulu." };
  }

  await tenantDb
    .delete(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId));

  revalidatePath(`/${slug}/settings/roles`);
  return { success: true };
}

// ─── AKTIVASI LANGSUNG ────────────────────────────────────────────────────────

export type ActivateUserData = {
  memberId:      string;
  role:          "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
  email:         string;
  password:      string;
  name:          string;
};

export type ActivateResult =
  | { success: true; name: string }
  | { success: false; error: string };

/**
 * Owner/ketua langsung buat akun + aktifkan pengurus tanpa kirim link.
 * Admin yang tentukan email dan password — user bisa ubah password nanti.
 */
export async function activateUserDirectAction(
  slug: string,
  data: ActivateUserData
): Promise<ActivateResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Hanya owner/ketua yang bisa mengaktifkan pengguna." };

  if (!data.email.trim())       return { success: false, error: "Email wajib diisi." };
  if (data.password.length < 8) return { success: false, error: "Password minimal 8 karakter." };
  if (!data.name.trim())        return { success: false, error: "Nama wajib diisi." };
  if (data.role === "custom" && !data.customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi member ada di tenant ini
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, data.memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // Cek member belum jadi user tenant ini
  const [existingByMember] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.memberId, data.memberId))
    .limit(1);

  if (existingByMember) return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };

  // Cek email sudah terdaftar di Better Auth
  const { user: authUserTable } = await import("@jalajogja/db");
  const [existingAuth] = await db
    .select({ id: authUserTable.id })
    .from(authUserTable)
    .where(eq(authUserTable.email, data.email.toLowerCase().trim()))
    .limit(1);

  let userId: string;

  if (existingAuth) {
    // Email sudah ada — pakai akun yang ada (pengurus dari cabang lain dll)
    userId = existingAuth.id;

    // Pastikan akun ini belum jadi user di tenant ini
    const [existingByAuth] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, userId))
      .limit(1);

    if (existingByAuth) {
      return { success: false, error: "Email ini sudah terdaftar sebagai pengguna dashboard ini." };
    }
  } else {
    // Buat akun baru via Better Auth server API
    const { auth } = await import("@/lib/auth");
    const result = await auth.api.signUpEmail({
      body: {
        name:     data.name.trim(),
        email:    data.email.toLowerCase().trim(),
        password: data.password,
      },
    });

    if (!result?.user) return { success: false, error: "Gagal membuat akun. Coba lagi." };
    userId = result.user.id;
  }

  // Buat user di tenant
  await tenantDb.insert(schema.users).values({
    betterAuthUserId: userId,
    role:             data.role,
    customRoleId:     data.role === "custom" ? (data.customRoleId ?? null) : null,
    memberId:         data.memberId,
  });

  revalidatePath(`/${slug}/settings/users`);
  return { success: true, name: data.name.trim() };
}
