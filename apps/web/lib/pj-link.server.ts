import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, tenants, pjVerificationLinks, members, contacts, createTenantDb, type PjVerificationLink } from "@jalajogja/db";
import { hashPjToken } from "@/lib/pj-notification.server";

// Akses halaman verifikasi PJ via tautan: validasi token + sesi buka-kunci (cookie bertanda tangan).
// Lihat docs/arsitektur-notifikasi-pengurus.md § 8. Token: 192 bit, hanya hash yang disimpan.
// Kata sandi (4 digit terakhir HP penerima) diperiksa di unlockPjLink; setelah benar, cookie httpOnly
// berlaku singkat dan TERIKAT id tautan + tenant sehingga tidak bisa dipakai di tautan lain.

export const PJ_MAX_ATTEMPTS = 5;
const UNLOCK_TTL_SECONDS = 30 * 60;

export type PjLinkLoad =
  | { ok: true;  link: PjVerificationLink; tenant: { id: string; name: string; slug: string } }
  | { ok: false; reason: "notfound" | "expired" | "locked" };

export async function loadPjLink(slug: string, token: string): Promise<PjLinkLoad> {
  // Bentuk token dicek dulu (base64url ±32 char) — buang sampah sebelum menyentuh DB.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, reason: "notfound" };

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) return { ok: false, reason: "notfound" };

  const [link] = await db
    .select()
    .from(pjVerificationLinks)
    .where(and(eq(pjVerificationLinks.tokenHash, hashPjToken(token)), eq(pjVerificationLinks.tenantId, tenant.id)))
    .limit(1);
  if (!link) return { ok: false, reason: "notfound" };
  if (link.lockedAt) return { ok: false, reason: "locked" };
  if (link.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, link, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
}

function signSession(linkId: string, tenantId: string, exp: number): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET belum diset.");
  return createHmac("sha256", secret).update(`pjv|${linkId}|${tenantId}|${exp}`).digest("base64url");
}

function cookieName(linkId: string): string {
  return `pjv_${linkId.replace(/-/g, "")}`;
}

export async function setPjUnlockCookie(link: PjVerificationLink): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const value = `${exp}.${signSession(link.id, link.tenantId, exp)}`;
  (await cookies()).set(cookieName(link.id), value, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   UNLOCK_TTL_SECONDS,
  });
}

export async function hasPjUnlockCookie(link: PjVerificationLink): Promise<boolean> {
  const raw = (await cookies()).get(cookieName(link.id))?.value;
  if (!raw) return false;
  const [expStr, sig] = raw.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  const expected = signSession(link.id, link.tenantId, exp);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Tenant user yang dicatat sebagai pemegang jurnal untuk verifikasi via tautan: user dashboard milik
 * PJ (dicocokkan lewat nomor HP-nya di data anggota), kalau tidak ada → owner tenant.
 */
export async function resolvePjActorUserId(slug: string, recipientPhone: string): Promise<string | null> {
  const { db: tdb, schema } = createTenantDb(slug);

  const people = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(eq(contacts.whatsapp, recipientPhone))
    .limit(5);
  const byPhone = people.length > 0 ? people : await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(eq(contacts.phone, recipientPhone))
    .limit(5);

  for (const p of byPhone) {
    const [u] = await tdb.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.memberId, p.id)).limit(1);
    if (u) return u.id;
  }
  const [owner] = await tdb.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "owner")).limit(1);
  return owner?.id ?? null;
}
