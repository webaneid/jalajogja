"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  db, tenants, platformUsers, members, tenantMemberships,
  refIkpmCabang, createTenantSchemaInDb, createTenantDb,
  user as authUser, platformSettings,
} from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getPlatformSession } from "@/lib/platform-auth";
import { auth } from "@/lib/auth";
import type { TenantType, MarhalahPeriod } from "@jalajogja/db";

async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");
  return session;
}

export async function createTenantAction(formData: FormData): Promise<{ error: string } | { ok: true; slug: string }> {
  const session = await requirePlatformSession();
  if (session.role === "staff") return { error: "Tidak ada akses." };

  const name            = ((formData.get("name")             as string) ?? "").trim();
  const slug            = ((formData.get("slug")             as string) ?? "").trim().toLowerCase();
  const tenantType      = ((formData.get("tenant_type")      as string) ?? "cabang") as TenantType;
  const marhalahYearRaw = ((formData.get("marhalah_year")    as string) ?? "").trim();
  const marhalahPeriod  = ((formData.get("marhalah_period")  as string) ?? "") as MarhalahPeriod | "";
  const parentTenantId  = ((formData.get("parent_tenant_id") as string) ?? "").trim() || null;
  const refCabangId     = ((formData.get("ref_cabang_id")    as string) ?? "").trim() || null;

  if (!name || !slug) return { error: "Nama dan slug wajib diisi." };
  if (!/^[a-z][a-z0-9-]{2,}$/.test(slug)) return { error: "Slug hanya boleh huruf kecil, angka, dan dash (min. 3 karakter)." };

  const marhalahYear = marhalahYearRaw ? parseInt(marhalahYearRaw, 10) : null;
  if (tenantType === "marhalah" && !marhalahYear) return { error: "Angkatan (tahun) wajib diisi untuk tipe Marhalah." };

  try {
    const [inserted] = await db.insert(tenants).values({
      name,
      slug,
      tenantType,
      marhalahYear:   marhalahYear ?? undefined,
      marhalahPeriod: (marhalahPeriod || undefined) as MarhalahPeriod | undefined,
      parentTenantId: parentTenantId ?? undefined,
      refCabangId:    refCabangId ?? undefined,
      isActive:       true,
    }).returning({ id: tenants.id, slug: tenants.slug });

    // Provisioning schema database untuk tenant baru
    await createTenantSchemaInDb(db, slug);

    // ── Auto-populate: cabang → anggota yang sudah terdaftar di cabang ini ──
    if (tenantType === "cabang" && refCabangId) {
      const eligible = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.primaryCabangRefId, refCabangId));

      if (eligible.length > 0) {
        await db.insert(tenantMemberships).values(
          eligible.map(({ id }) => ({
            tenantId:       inserted.id,
            memberId:       id,
            status:         "active" as const,
            registeredVia:  "auto_cabang" as const,
            membershipType: "cabang" as const,
          }))
        ).onConflictDoNothing();
      }
    }

    // ── Auto-populate: marhalah → semua anggota dengan tahun lulus yang sama ──
    if (tenantType === "marhalah" && marhalahYear) {
      const eligible = await db
        .select({ id: members.id })
        .from(members)
        .where(
          marhalahPeriod
            ? and(
                eq(members.graduationYear, marhalahYear),
                eq(members.graduationPeriod, marhalahPeriod as MarhalahPeriod),
              )
            : eq(members.graduationYear, marhalahYear),
        );

      if (eligible.length > 0) {
        await db.insert(tenantMemberships).values(
          eligible.map(({ id }) => ({
            tenantId:       inserted.id,
            memberId:       id,
            status:         "active" as const,
            registeredVia:  "auto_marhalah" as const,
            membershipType: "marhalah" as const,
          }))
        ).onConflictDoNothing();
      }
    }

    revalidatePath("/platform/tenants");
    return { ok: true, slug: inserted.slug };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Slug sudah digunakan." };
    }
    return { error: "Gagal membuat tenant. " + msg };
  }
}

export async function toggleTenantActiveAction(tenantId: string, active: boolean) {
  await requirePlatformSession();
  await db.update(tenants)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  revalidatePath("/platform/tenants");
}

export async function createPlatformUserAction(
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const session = await requirePlatformSession();
  if (session.role === "staff") return { error: "Tidak ada akses." };

  const name     = ((formData.get("name")     as string) ?? "").trim();
  const email    = ((formData.get("email")    as string) ?? "").toLowerCase().trim();
  const password = ((formData.get("password") as string) ?? "");
  const role     = ((formData.get("role")     as string) ?? "staff");

  if (!name || !email || password.length < 8) {
    return { error: "Data tidak lengkap atau password minimal 8 karakter." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.insert(platformUsers).values({
      name,
      email,
      passwordHash,
      role: role as "owner" | "admin" | "staff",
      isActive: true,
    });
  } catch {
    return { error: "Email sudah digunakan." };
  }

  revalidatePath("/platform/users");
  return { ok: true };
}

export async function togglePlatformUserActiveAction(userId: string, active: boolean) {
  const session = await requirePlatformSession();
  if (session.role === "staff") return;
  await db.update(platformUsers)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(platformUsers.id, userId));
  revalidatePath("/platform/users");
}

export async function resetPlatformUserPasswordAction(userId: string, newPassword: string) {
  const session = await requirePlatformSession();
  if (session.role === "staff") return { error: "Tidak ada akses." };
  if (newPassword.length < 8) return { error: "Password minimal 8 karakter." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(platformUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(platformUsers.id, userId));

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// CABANG ACTIONS (ref_ikpm_cabang)
// ─────────────────────────────────────────────────────────────────────────────

export async function createCabangAction(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const session = await requirePlatformSession();
  if (session.role === "staff") return { error: "Tidak ada akses." };

  const nama       = ((formData.get("nama")       as string) ?? "").trim();
  const namaPendek = ((formData.get("nama_pendek") as string) ?? "").trim() || null;
  const kode       = ((formData.get("kode")        as string) ?? "").trim().toUpperCase() || null;
  const kota       = ((formData.get("kota")        as string) ?? "").trim() || null;
  const provinsi   = ((formData.get("provinsi")    as string) ?? "").trim() || null;

  if (!nama) return { error: "Nama cabang wajib diisi." };

  try {
    await db.insert(refIkpmCabang).values({ nama, namaPendek, kode, kota, provinsi });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Kode cabang sudah digunakan." };
    }
    return { error: "Gagal menyimpan: " + msg };
  }

  revalidatePath("/platform/cabang");
  return { ok: true };
}

export async function toggleCabangActiveAction(id: string, active: boolean) {
  await requirePlatformSession();
  await db.update(refIkpmCabang)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(refIkpmCabang.id, id));
  revalidatePath("/platform/cabang");
}

// ─────────────────────────────────────────────────────────────────────────────
// LINK TENANT ↔ REF CABANG
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BUAT OWNER PERTAMA TENANT (tanpa masuk ke dashboard tenant)
// ─────────────────────────────────────────────────────────────────────────────

export async function createFirstOwnerAction(
  tenantSlug:    string,
  ownerName:     string,
  ownerEmail:    string,
  ownerPassword: string,
): Promise<{ error: string } | { ok: true; email: string }> {
  await requirePlatformSession();

  if (!ownerName.trim() || !ownerEmail.trim() || ownerPassword.length < 8) {
    return { error: "Nama, email, dan password (min. 8 karakter) wajib diisi." };
  }

  const normalizedEmail = ownerEmail.toLowerCase().trim();

  // Pastikan tenant ada
  const [tenant] = await db.select({ id: tenants.id, slug: tenants.slug })
    .from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) return { error: "Tenant tidak ditemukan." };

  // Cek email belum dipakai di Better Auth
  const existingAuth = await db.query.user.findFirst({
    where: eq(authUser.email, normalizedEmail),
    columns: { id: true },
  });

  let betterAuthUserId: string;
  let memberId: string;

  if (existingAuth) {
    // Akun Better Auth sudah ada — cari member yang terhubung
    betterAuthUserId = existingAuth.id;
    const existingMember = await db.query.members.findFirst({
      where: eq(members.betterAuthUserId, betterAuthUserId),
      columns: { id: true },
    });
    if (!existingMember) {
      return { error: "Email sudah terdaftar di sistem tapi belum terhubung ke data anggota. Hubungkan manual dari halaman Akun." };
    }
    memberId = existingMember.id;
  } else {
    // Buat akun baru
    const signUpResult = await auth.api.signUpEmail({
      body: { name: ownerName.trim(), email: normalizedEmail, password: ownerPassword },
    });
    if (!signUpResult?.user?.id) {
      return { error: "Gagal membuat akun. Email mungkin sudah terdaftar." };
    }
    betterAuthUserId = signUpResult.user.id;

    // Buat member minimal — owner bisa lengkapi nanti via /akun/lengkapi
    try {
      const [newMember] = await db.insert(members).values({
        name: ownerName.trim(),
        betterAuthUserId,
      }).returning({ id: members.id });
      memberId = newMember.id;
    } catch (err) {
      // Rollback: hapus Better Auth account agar tidak jadi orphan
      await db.delete(authUser).where(eq(authUser.id, betterAuthUserId)).catch(() => {});
      return { error: "Gagal membuat data anggota: " + (err instanceof Error ? err.message : String(err)) };
    }
  }

  // Insert ke tenant.users sebagai owner
  const { db: tenantDb, schema } = createTenantDb(tenantSlug);
  try {
    await tenantDb.insert(schema.users).values({
      betterAuthUserId,
      memberId,
      role: "owner",
    }).onConflictDoNothing();
  } catch (err) {
    return { error: "Gagal menambahkan owner ke tenant: " + (err instanceof Error ? err.message : String(err)) };
  }

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  return { ok: true, email: normalizedEmail };
}

export async function linkTenantToCabangAction(
  tenantId: string,
  refCabangId: string | null,
): Promise<{ error: string } | { ok: true; populated: number }> {
  await requirePlatformSession();

  // Update FK di tenants
  const [updated] = await db.update(tenants)
    .set({ refCabangId: refCabangId ?? undefined, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ id: tenants.id, slug: tenants.slug });

  if (!updated) return { error: "Tenant tidak ditemukan." };

  // Auto-populate: masukkan semua anggota yg sudah di cabang ini ke tenant_memberships
  let populated = 0;
  if (refCabangId) {
    const eligible = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.primaryCabangRefId, refCabangId));

    if (eligible.length > 0) {
      await db.insert(tenantMemberships).values(
        eligible.map(({ id }) => ({
          tenantId:       tenantId,
          memberId:       id,
          status:         "active" as const,
          registeredVia:  "auto_cabang" as const,
          membershipType: "cabang" as const,
        }))
      ).onConflictDoNothing();
      populated = eligible.length;
    }
  }

  revalidatePath(`/platform/tenants/${updated.slug}`);
  return { ok: true, populated };
}

// ── Branding default IKPM (platform-wide, fallback untuk cabang belum onboard) ─

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function updatePlatformBrandingAction(
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  await requirePlatformSession();

  const defaultOrgName = ((formData.get("defaultOrgName") as string) ?? "").trim() || "IKPM Gontor";
  const defaultLogoUrlRaw = ((formData.get("defaultLogoUrl") as string) ?? "").trim();
  const defaultLogoUrl = defaultLogoUrlRaw || null;
  const defaultColorRaw = ((formData.get("defaultColor") as string) ?? "").trim();
  const defaultColor = HEX_COLOR_RE.test(defaultColorRaw) ? defaultColorRaw : "#2563eb";

  await db.insert(platformSettings)
    .values({ id: "default", defaultOrgName, defaultLogoUrl, defaultColor, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set:    { defaultOrgName, defaultLogoUrl, defaultColor, updatedAt: new Date() },
    });

  revalidatePath("/platform/settings");
  return { ok: true };
}
