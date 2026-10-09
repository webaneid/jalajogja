"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db, tenants, tenantMemberships, createTenantDb, getSetting } from "@jalajogja/db";
import { auth } from "@/lib/auth";
import { getAkunIdentity } from "@/lib/akun-identity";
import { checkMemberEligibility } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";
import { isValidWhatsappGroupUrl, WHATSAPP_GROUP_SETTING_KEY } from "@/lib/whatsapp-group";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Gerbang akses grup WhatsApp tenant: anggota login + keanggotaan AKTIF di tenant ini. "Aktif"
// = forum: forum_status='active'; cabang/marhalah: baris ada, status 'active' DAN data eligible
// (keputusan user 2026-10-10, sama dengan pemicu notifikasi aktif). Tautan WhatsApp asli HANYA
// pernah keluar dari server lewat aksi ini — tidak dikirim lewat props halaman, WA, maupun email.
// Lihat docs/arsitektur-gabung-forum.md § 9b.
async function resolveGroupAccess(slug: string): Promise<
  | { ok: true; memberId: string; tenantId: string; url: string }
  | { ok: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Anda harus login terlebih dahulu." };

  const identity = await getAkunIdentity(session.user.id);
  if (!identity || identity.type !== "member" || !identity.memberId) {
    return { ok: false, error: "Hanya anggota yang bisa bergabung ke grup." };
  }

  const [tenantRow] = await db
    .select({ id: tenants.id, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow) return { ok: false, error: "Organisasi tidak ditemukan." };

  const [membership] = await db
    .select({ status: tenantMemberships.status, forumStatus: tenantMemberships.forumStatus })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, identity.memberId),
    ))
    .limit(1);

  const tenantDb = createTenantDb(slug);
  let active = false;
  if (tenantRow.tenantType === "forum") {
    active = membership?.forumStatus === "active";
  } else if (membership?.status === "active") {
    const modules = await getEnabledEkosistemModules(tenantDb);
    const eligibility = await checkMemberEligibility(identity.memberId, enabledModuleList(modules));
    active = eligibility.eligible;
  }
  if (!active) return { ok: false, error: "Keanggotaan Anda belum aktif." };

  const url = await getSetting<string>(tenantDb, WHATSAPP_GROUP_SETTING_KEY, "general");
  if (!isValidWhatsappGroupUrl(url)) return { ok: false, error: "Grup WhatsApp belum diatur oleh pengurus." };

  return { ok: true, memberId: identity.memberId, tenantId: tenantRow.id, url: url.trim() };
}

// Catat pertama kali saja — klik/laporan berikutnya tidak menimpa waktu & jalur pertama.
async function recordGroupJoin(tenantId: string, memberId: string, via: "click" | "self") {
  await db
    .update(tenantMemberships)
    .set({
      waGroupJoinedAt:  sql`COALESCE(${tenantMemberships.waGroupJoinedAt}, now())`,
      waGroupJoinedVia: sql`COALESCE(${tenantMemberships.waGroupJoinedVia}, ${via})`,
    })
    .where(and(
      eq(tenantMemberships.tenantId, tenantId),
      eq(tenantMemberships.memberId, memberId),
    ));
}

/** Anggota menekan "Gabung Grup WhatsApp" — mengembalikan tautan asli + mencatat klik. */
export async function openWhatsappGroupAction(slug: string): Promise<ActionResult<{ url: string }>> {
  try {
    const access = await resolveGroupAccess(slug);
    if (!access.ok) return { success: false, error: access.error };
    await recordGroupJoin(access.tenantId, access.memberId, "click");
    revalidatePath(`/${slug}/akun`);
    return { success: true, data: { url: access.url } };
  } catch (err) {
    console.error("[openWhatsappGroupAction]", err);
    return { success: false, error: "Gagal membuka grup. Coba lagi." };
  }
}

/** Anggota yang SUDAH di grup (mis. anggota lama) melapor — menandai selesai tanpa membuka tautan. */
export async function markInWhatsappGroupAction(slug: string): Promise<ActionResult> {
  try {
    const access = await resolveGroupAccess(slug);
    if (!access.ok) return { success: false, error: access.error };
    await recordGroupJoin(access.tenantId, access.memberId, "self");
    revalidatePath(`/${slug}/akun`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[markInWhatsappGroupAction]", err);
    return { success: false, error: "Gagal menyimpan. Coba lagi." };
  }
}
