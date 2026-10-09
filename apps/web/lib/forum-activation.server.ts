import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db as publicDb, tenants, tenantMemberships, getSetting, type createTenantDb } from "@jalajogja/db";
import { checkMemberEligibility } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";
import { generateForumMembershipNumber } from "@/lib/forum-membership-number.server";
import { isRequirementSatisfied } from "@/lib/membership-config";
import { notifyMembershipActivated } from "@/lib/membership-activated.server";
import type { MembershipConfigData } from "@/app/(dashboard)/app/[tenant]/settings/actions";

// SATU-SATUNYA implementasi aktivasi keanggotaan forum berbasis pembayaran syarat iuran.
// Dipakai: hook invoice-lunas (finance/billing/actions.ts), aksi klaim donasi lama, dan
// pemicu ulang setelah data anggota lengkap. JANGAN menulis ulang logika ini di tempat lain
// (pelajaran lessons-learned: tiga implementasi independen kode-unik/voucher berulang kali
// memicu bug). Lihat docs/arsitektur-gabung-forum.md § "RENCANA — Pendaftaran Forum Bertahap".
//
// Dua mode — beda HANYA di (a) syarat invoice pemicu, (b) status baris yang boleh ditimpa.
// Keduanya HANYA menghitung item berflag forGabungRegistration:
//   "invoice-paid" — dipanggil saat sebuah invoice lunas. Invoice itu WAJIB memuat item
//                    berflag yang cocok syarat (precondition lama, mencegah donasi organik
//                    mengaktifkan). Evaluasi dikumulatifkan ke SEMUA invoice lunas berflag milik
//                    member (donasi di invoice A + produk di invoice B). Perilaku lama
//                    dipertahankan: baris suspended/rejected boleh diaktifkan ulang.
//   "retrigger"    — dipicu setelah data member lengkap / setelah klaim. Hanya mengaktifkan bila
//                    belum ada baris atau masih "pending" (tidak melawan keputusan admin
//                    suspend/reject).
//
// KLAIM donasi/produk lama (aksi eksplisit member, gabung/actions.ts) TIDAK punya mode sendiri:
// ia menandai (flag) item lunas milik member itu sendiri yang cocok syarat — lihat
// claimablePaidItems() — lalu memanggil mode "retrigger". Jadi klaim parsial (donasi lama + beli
// produk yang kurang) tersimpan dan konsisten dengan seluruh jalur lain.

export type ForumActivationMode = "invoice-paid" | "retrigger";

export type ForumActivationOutcome =
  | "activated"
  | "already_active"
  | "not_applicable"        // bukan forum / tidak ada syarat iuran / invoice tidak relevan
  | "no_matching_payment"   // tidak ada pembayaran lunas berflag yang cocok syarat
  | "requirement_unmet"     // ada yang cocok tapi syarat wajib belum lengkap
  | "ineligible"            // data anggota belum lengkap
  | "blocked_status";       // ditangguhkan/ditolak admin — tidak ditimpa oleh retrigger

type TenantDbHandle = ReturnType<typeof createTenantDb>;

type PaidItemRow = {
  invoiceId: string;
  itemRowId: string;
  itemType:  string;
  itemId:    string | null;
  flagged:   boolean;
};

// Item donasi/produk pada invoice LUNAS milik `memberId` (dari caller tervalidasi: sesi/invoice,
// bukan input mentah) beserta predikat kecocokan terhadap syarat iuran forum.
async function gatherPaidItems(
  tenantDb: TenantDbHandle,
  memberId: string,
  config:   MembershipConfigData,
) {
  const { db, schema } = tenantDb;

  // Produk BERVARIASI: itemId di invoice_items adalah variation id, bukan products.id —
  // kumpulkan semua variationId milik requiredProductId (bug laten 2026-08-06).
  const productRelevantIds = new Set<string>();
  if (config.requiredProductId) {
    productRelevantIds.add(config.requiredProductId);
    const variationRows = await db
      .select({ id: schema.productVariations.id })
      .from(schema.productVariations)
      .where(eq(schema.productVariations.productId, config.requiredProductId));
    for (const v of variationRows) productRelevantIds.add(v.id);
  }

  const rows: PaidItemRow[] = await db
    .select({
      invoiceId: schema.invoiceItems.invoiceId,
      itemRowId: schema.invoiceItems.id,
      itemType:  schema.invoiceItems.itemType,
      itemId:    schema.invoiceItems.itemId,
      flagged:   schema.invoiceItems.forGabungRegistration,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(and(
      eq(schema.invoices.memberId, memberId),
      eq(schema.invoices.status, "paid"),
      inArray(schema.invoiceItems.itemType, ["product", "donation"]),
    ));

  const matchesProduct  = (r: PaidItemRow) =>
    r.itemType === "product" && !!r.itemId && productRelevantIds.has(r.itemId);
  const matchesCampaign = (r: PaidItemRow) =>
    r.itemType === "donation" && !!r.itemId && r.itemId === config.requiredCampaignId;

  return { rows, matchesProduct, matchesCampaign };
}

/**
 * Item lunas milik member yang COCOK syarat iuran tapi BELUM berflag (dibayar lewat jalur
 * biasa, bukan /gabung) — kandidat klaim. `satisfiedAfterClaim` = syarat wajib akan terpenuhi
 * kalau semua kandidat diklaim DITAMBAH item yang sudah berflag. Dipakai UI (tampilkan tombol
 * klaim) dan aksi klaim (item mana yang di-flag).
 */
export async function claimablePaidItems(opts: {
  tenantDb: TenantDbHandle;
  memberId: string;
}): Promise<{ itemRowIds: string[]; hasProduct: boolean; hasCampaign: boolean; satisfiedAfterClaim: boolean }> {
  const empty = { itemRowIds: [], hasProduct: false, hasCampaign: false, satisfiedAfterClaim: false };
  const config = await getSetting<MembershipConfigData>(opts.tenantDb, "membership_config", "forum");
  if (!config || (!config.requiredProductId && !config.requiredCampaignId)) return empty;

  const { rows, matchesProduct, matchesCampaign } = await gatherPaidItems(opts.tenantDb, opts.memberId, config);
  const unflagged = rows.filter((r) => !r.flagged && (matchesProduct(r) || matchesCampaign(r)));
  if (unflagged.length === 0) return empty;

  const hasProduct  = rows.some((r) => matchesProduct(r));
  const hasCampaign = rows.some((r) => matchesCampaign(r));
  return {
    itemRowIds: unflagged.map((r) => r.itemRowId),
    hasProduct,
    hasCampaign,
    satisfiedAfterClaim: isRequirementSatisfied(config, { product: hasProduct, campaign: hasCampaign }),
  };
}

export async function activateForumMembership(opts: {
  slug:       string;
  tenantDb:   TenantDbHandle;
  memberId:   string | null;
  mode:       ForumActivationMode;
  invoiceId?: string;   // wajib untuk mode "invoice-paid"
}): Promise<{ outcome: ForumActivationOutcome }> {
  const { slug, tenantDb, memberId, mode, invoiceId } = opts;
  if (!memberId) return { outcome: "not_applicable" };

  const [tenantRow] = await publicDb
    .select({ id: tenants.id, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow || tenantRow.tenantType !== "forum") return { outcome: "not_applicable" };

  const config = await getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum");
  if (!config || (!config.requiredProductId && !config.requiredCampaignId)) {
    return { outcome: "not_applicable" };
  }

  const { rows, matchesProduct, matchesCampaign } = await gatherPaidItems(tenantDb, memberId, config);
  const counted = rows.filter((r) => r.flagged);

  // Precondition WAJIB (mode invoice-paid): invoice yang baru lunas ini sendiri harus memuat
  // item berflag yang cocok — tanpa ini, pembelian biasa dari member yang ditangguhkan bisa
  // mengaktifkan ulang keanggotaannya. Juga mencegah donasi organik jadi vacuous-true.
  if (mode === "invoice-paid") {
    const own = counted.filter((r) => r.invoiceId === invoiceId);
    if (!own.some((r) => matchesProduct(r) || matchesCampaign(r))) return { outcome: "not_applicable" };
  }

  const hasProduct  = counted.some(matchesProduct);
  const hasCampaign = counted.some(matchesCampaign);
  if (!hasProduct && !hasCampaign) return { outcome: "no_matching_payment" };
  if (!isRequirementSatisfied(config, { product: hasProduct, campaign: hasCampaign })) {
    return { outcome: "requirement_unmet" };
  }

  const enabledModulesConfig = await getEnabledEkosistemModules(tenantDb);
  const eligibility = await checkMemberEligibility(memberId, enabledModuleList(enabledModulesConfig));
  if (!eligibility.eligible) return { outcome: "ineligible" };

  const [existing] = await publicDb
    .select({
      id:               tenantMemberships.id,
      forumStatus:      tenantMemberships.forumStatus,
      membershipNumber: tenantMemberships.membershipNumber,
    })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, memberId),
    ))
    .limit(1);
  if (existing?.forumStatus === "active") return { outcome: "already_active" };

  // retrigger tidak melawan keputusan admin (suspended/rejected).
  if (mode === "retrigger" && existing && existing.forumStatus !== "pending" && existing.forumStatus !== null) {
    return { outcome: "blocked_status" };
  }

  // Invoice yang dicatat sebagai dasar aktivasi: pilih yang memuat item cocok (prefer invoice
  // yang baru lunas).
  const basisRows = counted.filter((r) => matchesProduct(r) || matchesCampaign(r));
  const basisInvoiceId = basisRows.find((r) => r.invoiceId === invoiceId)?.invoiceId ?? basisRows[0].invoiceId;

  const now = new Date();

  // Nomor keanggotaan lokal forum — generate SEKALI, pertahankan yang lama.
  let membershipNumber = existing?.membershipNumber ?? null;
  if (!membershipNumber && config.membershipNumberFormat) {
    membershipNumber = await generateForumMembershipNumber({
      tenantId: tenantRow.id,
      memberId,
      format:   config.membershipNumberFormat,
      joinDate: now,
    });
  }

  if (existing) {
    await publicDb.update(tenantMemberships)
      .set({
        status: "active", membershipType: "forum", forumStatus: "active",
        approvedAt: now, forumInvoiceId: basisInvoiceId, membershipNumber, updatedAt: now,
      })
      .where(and(
        eq(tenantMemberships.id, existing.id),
        eq(tenantMemberships.tenantId, tenantRow.id),
      ));
  } else {
    // onConflictDoNothing: race dengan hook invoice-lunas / klaim bersamaan — yang kalah
    // tidak menimpa dan tidak error (unique tenantId+memberId).
    const inserted = await publicDb.insert(tenantMemberships).values({
      tenantId:       tenantRow.id,
      memberId,
      status:         "active",
      membershipType: "forum",
      forumStatus:    "active",
      joinedAt:       now.toISOString().split("T")[0],
      approvedAt:     now,
      forumInvoiceId: basisInvoiceId,
      registeredVia:  "self",
      membershipNumber,
    }).onConflictDoNothing().returning({ id: tenantMemberships.id });
    if (inserted.length === 0) return { outcome: "already_active" };
  }

  // Beri tahu anggota (idempoten lewat penanda; fire-and-forget, tidak menggagalkan aktivasi).
  void notifyMembershipActivated({ slug, memberId });
  return { outcome: "activated" };
}
