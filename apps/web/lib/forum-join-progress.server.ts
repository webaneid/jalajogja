import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, tenantMemberships, getSetting, type createTenantDb } from "@jalajogja/db";
import { checkMemberEligibility, type MemberEligibilityField } from "@/lib/member-eligibility";
import { enabledModuleList, type EkosistemModule, type EkosistemModulesConfig } from "@/lib/ekosistem-modules";
import { hasPaymentRequirement } from "@/lib/membership-config";
import { activateForumMembership, claimablePaidItems } from "@/lib/forum-activation.server";
import type { MembershipConfigData } from "@/app/(dashboard)/app/[tenant]/settings/actions";

// Satu sumber kebenaran "user sedang di langkah mana" untuk pendaftaran forum — dipakai overlay
// /akun DAN halaman /gabung supaya keduanya tidak pernah saling bertentangan. Status DITURUNKAN
// dari data yang sudah ada (tenant_memberships, invoices, eligibility), bukan kolom baru.
// Lihat docs/arsitektur-gabung-forum.md § "RENCANA — Pendaftaran Forum Bertahap & Dipandu".
//
// URUTAN prioritas (sama dengan perilaku overlay lama, ditambah status baru):
//   active → suspended/rejected → invoice komitmen (awaiting_confirmation | pay_invoice)
//   → complete_data → claimable → ready

export type ForumJoinStage =
  | "active"
  | "suspended"
  | "rejected"
  | "awaiting_confirmation"  // bukti bayar sudah dikirim, menunggu admin/bendahara
  | "pay_invoice"            // ada invoice komitmen /gabung yang belum dibayar
  | "complete_data"          // data anggota belum eligible
  | "claimable"              // ada pembayaran lunas lama yang bisa dipakai klaim
  | "ready";                 // eligible; lanjut ke /gabung (bayar syarat / gabung gratis)

export type ForumJoinProgress = {
  stage:                     ForumJoinStage;
  forumStatus:               string | null;
  missing:                   MemberEligibilityField[];
  directoryIncompleteModule: EkosistemModule | null;
  invoiceId:                 string | null;   // untuk awaiting_confirmation / pay_invoice
  claim:                     { hasProduct: boolean; hasCampaign: boolean; satisfiedAfterClaim: boolean } | null;
};

type TenantDbHandle = ReturnType<typeof createTenantDb>;

/**
 * PERHATIAN — punya efek samping terbatas: bila pembayaran berflag yang sudah lunas SUDAH
 * memenuhi syarat dan data anggota kini eligible (kasus "bayar dulu, lengkapi data belakangan"),
 * keanggotaan diaktifkan di sini (mode "retrigger", idempoten, tidak melawan suspend/reject)
 * sebelum stage dihitung. Dipanggil dari halaman /akun dan /gabung, yaitu tempat user kembali
 * setelah melengkapi data — menggantikan hook di setiap aksi simpan data.
 */
export async function resolveForumJoinProgress(opts: {
  slug:           string;
  tenantId:       string;
  tenantDb:       TenantDbHandle;
  memberId:       string;
  enabledModules: EkosistemModulesConfig;
}): Promise<ForumJoinProgress> {
  const { slug, tenantId, tenantDb, memberId, enabledModules } = opts;

  const readStatus = async () => {
    const [row] = await db
      .select({ forumStatus: tenantMemberships.forumStatus })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.memberId, memberId)))
      .limit(1);
    return row?.forumStatus ?? null;
  };

  let forumStatus = await readStatus();
  const base: ForumJoinProgress = {
    stage: "ready", forumStatus, missing: [], directoryIncompleteModule: null, invoiceId: null, claim: null,
  };

  if (forumStatus === "active") return { ...base, stage: "active" };

  // Pemicu ulang (aktivasi otomatis) sebelum menyimpulkan apa pun.
  if (forumStatus !== "suspended" && forumStatus !== "rejected") {
    const res = await activateForumMembership({ slug, tenantDb, memberId, mode: "retrigger" });
    if (res.outcome === "activated" || res.outcome === "already_active") {
      return { ...base, forumStatus: "active", stage: "active" };
    }
    forumStatus = await readStatus();
  }

  if (forumStatus === "suspended") return { ...base, forumStatus, stage: "suspended" };
  if (forumStatus === "rejected")  return { ...base, forumStatus, stage: "rejected" };

  // Invoice komitmen /gabung yang belum lunas — PRIORITAS di atas eligibility (user sudah
  // memilih membayar). Beda dari sebelumnya: bukti sudah dikirim (waiting_verification) ditandai
  // "menunggu konfirmasi", bukan "Lunasi Pembayaran".
  const { db: tdb, schema } = tenantDb;
  const pendingRows = await tdb
    .select({ id: schema.invoices.id, status: schema.invoices.status })
    .from(schema.invoices)
    .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
    .where(and(
      eq(schema.invoices.memberId, memberId),
      inArray(schema.invoices.status, ["pending", "waiting_verification", "partial", "overdue"]),
      eq(schema.invoiceItems.forGabungRegistration, true),
    ));
  if (pendingRows.length > 0) {
    // Ada yang masih perlu dibayar → pay_invoice (prioritas); kalau semua sudah dikirim buktinya
    // → awaiting_confirmation.
    const needsPay = pendingRows.find((r) => r.status !== "waiting_verification");
    if (needsPay) return { ...base, forumStatus, stage: "pay_invoice", invoiceId: needsPay.id };
    return { ...base, forumStatus, stage: "awaiting_confirmation", invoiceId: pendingRows[0].id };
  }

  const eligibility = await checkMemberEligibility(memberId, enabledModuleList(enabledModules));
  if (!eligibility.eligible) {
    return {
      ...base, forumStatus, stage: "complete_data",
      missing: eligibility.missing,
      directoryIncompleteModule: eligibility.directoryIncompleteModule,
    };
  }

  const config = await getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum");
  if (hasPaymentRequirement(config) || config?.requiredProductId || config?.requiredCampaignId) {
    const c = await claimablePaidItems({ tenantDb, memberId });
    if (c.itemRowIds.length > 0) {
      return {
        ...base, forumStatus, stage: "claimable",
        claim: { hasProduct: c.hasProduct, hasCampaign: c.hasCampaign, satisfiedAfterClaim: c.satisfiedAfterClaim },
      };
    }
  }

  return { ...base, forumStatus, stage: "ready" };
}
