"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, tenants, platformUsers } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getPlatformSession } from "@/lib/platform-auth";

async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");
  return session;
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
