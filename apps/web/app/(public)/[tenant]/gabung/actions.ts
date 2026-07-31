"use server";

import { eq, and }        from "drizzle-orm";
import { revalidatePath }  from "next/cache";
import { headers }         from "next/headers";
import { db, tenants, tenantMemberships, createTenantDb, getSetting } from "@jalajogja/db";
import { auth }               from "@/lib/auth";
import { getAkunIdentity }    from "@/lib/akun-identity";
import { checkMemberEligibility, MEMBER_ELIGIBILITY_LABELS } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";
import { generateForumMembershipNumber } from "@/lib/forum-membership-number.server";
import type { MembershipConfigData } from "../../../(dashboard)/app/[tenant]/settings/actions";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Bergabung ke tenant forum — alur "gratis" (belum ada syarat pembayaran, lihat
 * docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2", Fase D akan menambah
 * cabang pembayaran wajib di sini kalau admin mengonfigurasinya).
 */
export async function joinForumAction(slug: string): Promise<ActionResult<{ tenantName: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Anda harus login terlebih dahulu." };

  const identity = await getAkunIdentity(session.user.id);
  if (!identity || identity.type !== "member" || !identity.memberId) {
    return { success: false, error: "Hanya anggota IKPM yang bisa bergabung ke forum." };
  }

  const [tenantRow] = await db
    .select({ id: tenants.id, name: tenants.name, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow || tenantRow.tenantType !== "forum") {
    return { success: false, error: "Tenant ini bukan forum — tidak ada alur pendaftaran di sini." };
  }

  const tenantDb = createTenantDb(slug);

  // Cek ulang di server — jangan percaya state client, meski halaman /gabung sudah
  // menyaring ini sebelum tombol muncul. Eligibility dipersempit ke modul ekosistem
  // yang aktif untuk tenant forum ini (lib/ekosistem-modules.ts).
  const enabledModulesConfig = await getEnabledEkosistemModules(tenantDb);
  const eligibility = await checkMemberEligibility(identity.memberId, enabledModuleList(enabledModulesConfig));
  if (!eligibility.eligible) {
    const missingLabels = eligibility.missing.map((f) => MEMBER_ELIGIBILITY_LABELS[f]).join(", ");
    return { success: false, error: `Data Anda belum lengkap: ${missingLabels}.` };
  }

  // Kalau admin mewajibkan pembayaran, jalur ini (join langsung/gratis) tidak boleh
  // dipakai — aktivasi untuk forum berbayar HANYA lewat
  // activateForumMembershipIfApplicable() (finance/billing/actions.ts) setelah invoice
  // lunas. Guard ini pertahanan server-side — UI /gabung sudah tidak menampilkan tombol
  // ini kalau paymentRequired=true, tapi jangan percaya itu saja.
  const config = await getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum");
  if (config?.paymentRequired) {
    return {
      success: false,
      error: "Forum ini mewajibkan pembayaran — selesaikan pembayaran terlebih dahulu, keanggotaan akan aktif otomatis setelah invoice lunas.",
    };
  }

  const [existing] = await db
    .select({
      id:               tenantMemberships.id,
      forumStatus:      tenantMemberships.forumStatus,
      membershipNumber: tenantMemberships.membershipNumber,
    })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, identity.memberId),
    ))
    .limit(1);

  if (existing?.forumStatus === "active") {
    return { success: true, data: { tenantName: tenantRow.name } }; // sudah anggota — no-op
  }

  const now       = new Date();
  const todayDate = now.toISOString().split("T")[0];

  // Nomor keanggotaan lokal forum (opsional) — generate SEKALI saja. Kalau baris lama sudah
  // punya nomor (mis. sempat "suspended" lalu rejoin), pertahankan nomor lama, jangan
  // generate ulang. Lihat lib/forum-membership-number.ts.
  let membershipNumber = existing?.membershipNumber ?? null;
  if (!membershipNumber && config?.membershipNumberFormat) {
    membershipNumber = await generateForumMembershipNumber({
      tenantId: tenantRow.id,
      memberId: identity.memberId,
      format:   config.membershipNumberFormat,
      joinDate: now,
    });
  }

  if (existing) {
    // Baris lama (mis. sempat "rejected"/"suspended") — aktifkan ulang, jangan INSERT
    // baru (constraint unique tenantId+memberId akan menolak duplikat).
    await db.update(tenantMemberships)
      .set({
        status:           "active",
        membershipType:   "forum",
        forumStatus:      "active",
        approvedAt:       now,
        registeredVia:    "self",
        membershipNumber,
        updatedAt:        now,
      })
      .where(eq(tenantMemberships.id, existing.id));
  } else {
    await db.insert(tenantMemberships).values({
      tenantId:       tenantRow.id,
      memberId:       identity.memberId,
      status:         "active",
      membershipType: "forum",
      forumStatus:    "active",
      joinedAt:       todayDate,
      approvedAt:     now,
      registeredVia:  "self",
      membershipNumber,
    });
  }

  revalidatePath(`/${slug}/akun`);
  revalidatePath(`/${slug}/gabung`);

  return { success: true, data: { tenantName: tenantRow.name } };
}
