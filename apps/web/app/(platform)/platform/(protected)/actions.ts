"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, tenants, platformUsers, createTenantSchemaInDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getPlatformSession } from "@/lib/platform-auth";
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
      isActive:       true,
    }).returning({ id: tenants.id, slug: tenants.slug });

    // Provisioning schema database untuk tenant baru
    await createTenantSchemaInDb(db, slug);

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
