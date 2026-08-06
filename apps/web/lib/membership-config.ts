// Predikat murni untuk "syarat wajib bergabung forum" — dipakai 3 titik (halaman /gabung,
// joinForumAction, activateForumMembershipIfApplicable) supaya definisi "wajib"/"terpenuhi"
// tidak pernah drift antar titik. Lihat docs/arsitektur-gabung-forum.md § "Redesain /gabung".
//
// Client-safe murni (nol import @jalajogja/db) — aman diimpor Server Component, Client
// Component, maupun Server Action.

import type { MembershipConfigData } from "@/app/(dashboard)/app/[tenant]/settings/actions";

export type MembershipRequirementConfig = Pick<
  MembershipConfigData,
  "requiredProductId" | "productRequired" | "requiredCampaignId" | "campaignRequired"
>;

/** Ada syarat wajib apa pun untuk bergabung? */
export function hasPaymentRequirement(config: MembershipRequirementConfig | null): boolean {
  if (!config) return false;
  return (!!config.requiredProductId && config.productRequired)
      || (!!config.requiredCampaignId && config.campaignRequired);
}

/**
 * Semua syarat yang ditandai wajib sudah terpenuhi? AND murni per-item — admin menentukan mana
 * yang wajib, bukan pengguna memilih salah satu. Item yang tidak dikonfigurasi ATAU tidak
 * ditandai wajib dianggap otomatis terpenuhi (vacuously true).
 */
export function isRequirementSatisfied(
  config: MembershipRequirementConfig,
  has: { product: boolean; campaign: boolean },
): boolean {
  const productOk  = !config.requiredProductId  || !config.productRequired  || has.product;
  const campaignOk = !config.requiredCampaignId || !config.campaignRequired || has.campaign;
  return productOk && campaignOk;
}
