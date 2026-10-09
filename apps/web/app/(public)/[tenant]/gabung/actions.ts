"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath }  from "next/cache";
import { headers }         from "next/headers";
import { db, tenants, tenantMemberships, createTenantDb, getSetting } from "@jalajogja/db";
import { auth }               from "@/lib/auth";
import { getAkunIdentity }    from "@/lib/akun-identity";
import { checkMemberEligibility, MEMBER_ELIGIBILITY_LABELS } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";
import { generateForumMembershipNumber } from "@/lib/forum-membership-number.server";
import { hasPaymentRequirement } from "@/lib/membership-config";
import { activateForumMembership, claimablePaidItems } from "@/lib/forum-activation.server";
import { notifyMembershipActivated } from "@/lib/membership-activated.server";
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
  // ini kalau hasPaymentRequirement(config)=true, tapi jangan percaya itu saja.
  const config = await getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum");
  if (hasPaymentRequirement(config)) {
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

  void notifyMembershipActivated({ slug, memberId: identity.memberId });

  revalidatePath(`/${slug}/akun`);
  revalidatePath(`/${slug}/gabung`);

  return { success: true, data: { tenantName: tenantRow.name } };
}

/**
 * Klaim pembayaran LUNAS yang sudah ada (donasi/produk yang dibayar lewat jalur biasa, bukan
 * /gabung) sebagai syarat iuran forum. Aksi eksplisit member — donasi organik tidak pernah
 * mengaktifkan keanggotaan sendiri (keputusan "Pemisahan Donasi vs Registrasi Forum" tetap
 * berlaku). Mekanisme: item lunas milik member ini yang cocok syarat di-flag
 * forGabungRegistration, lalu aktivasi dicek lewat helper bersama (mode "retrigger"). Klaim
 * parsial (mis. donasi lama diklaim, produk dibeli baru) tersimpan karena flag-nya permanen.
 *
 * Keamanan: memberId HANYA dari sesi; kandidat item diturunkan server-side dari invoice lunas
 * dengan invoices.member_id = memberId sesi — client tidak mengirim id invoice/item apa pun.
 * Lihat docs/arsitektur-gabung-forum.md § "RENCANA — Pendaftaran Forum Bertahap" § 4.
 */
export async function claimForumWithExistingPaymentAction(
  slug: string,
): Promise<ActionResult<{ activated: boolean; message: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Anda harus login terlebih dahulu." };

  const identity = await getAkunIdentity(session.user.id);
  if (!identity || identity.type !== "member" || !identity.memberId) {
    return { success: false, error: "Hanya anggota IKPM yang bisa bergabung ke forum." };
  }

  const [tenantRow] = await db
    .select({ id: tenants.id, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow || tenantRow.tenantType !== "forum") {
    return { success: false, error: "Tenant ini bukan forum." };
  }

  try {
    const tenantDb = createTenantDb(slug);
    const claim = await claimablePaidItems({ tenantDb, memberId: identity.memberId });
    if (claim.itemRowIds.length === 0) {
      return { success: false, error: "Tidak ada pembayaran lunas Anda yang bisa dipakai untuk syarat forum ini." };
    }

    const { db: tdb, schema } = tenantDb;
    await tdb
      .update(schema.invoiceItems)
      .set({ forGabungRegistration: true })
      .where(inArray(schema.invoiceItems.id, claim.itemRowIds));

    const res = await activateForumMembership({
      slug, tenantDb, memberId: identity.memberId, mode: "retrigger",
    });

    revalidatePath(`/${slug}/akun`);
    revalidatePath(`/${slug}/gabung`);

    switch (res.outcome) {
      case "activated":
      case "already_active":
        return { success: true, data: { activated: true, message: "Pembayaran Anda dihitung — keanggotaan aktif." } };
      case "ineligible":
        return { success: true, data: { activated: false, message: "Pembayaran Anda sudah dihitung. Lengkapi data Anda agar keanggotaan aktif." } };
      case "requirement_unmet":
        return { success: true, data: { activated: false, message: "Pembayaran Anda sudah dihitung, namun masih ada syarat lain yang perlu dipenuhi di halaman ini." } };
      case "blocked_status":
        return { success: false, error: "Keanggotaan Anda ditangguhkan atau ditolak admin — hubungi pengurus." };
      default:
        return { success: false, error: "Pembayaran tidak dapat dipakai untuk syarat forum ini." };
    }
  } catch (err) {
    console.error("[claimForumWithExistingPaymentAction]", err);
    return { success: false, error: "Gagal memproses klaim. Coba lagi." };
  }
}
