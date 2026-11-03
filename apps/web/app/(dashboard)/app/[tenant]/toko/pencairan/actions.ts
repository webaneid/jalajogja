"use server";
// Server Actions pencairan produsen — sisi ADMIN/BENDAHARA. docs/arsitektur-pencairan-produsen.md § 13.
// getTenantAccess + hasFullAccess(keuangan) di SETIAP aksi (Bendahara/Ketua/Owner); pengurus yang sekaligus produsen tak boleh memproses pencairannya
// sendiri (ditegakkan di layanan). Bukti transfer WAJIB: id media divalidasi ke tabel media tenant & URL dibangun SERVER dari baris itu.
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import {
  createTenantDb, approvePayout, rejectPayout, markPayoutPaid, recordProducerRefund, recordDebtRepayment, setShipmentHold, savePayoutSettings, getPayoutSettings,
  getPayoutWithLines, sanitizePayoutSettings, db as publicDb, members,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { publicUrl } from "@/lib/minio";
import { resolveProducers } from "@/lib/producer.server";
import { notifyPayoutDecision } from "@/lib/producer-payout-notify.server";

export type PencairanResult = { success: true; message?: string } | { success: false; error: string };

async function guard(slug: string) {
  const access = await getTenantAccess(slug);
  if (!access) return { access: null as null, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { access: null as null, error: "Hanya Bendahara/Ketua (akses penuh Keuangan) yang boleh memproses pencairan." };
  return { access, error: null };
}
const actorOf = (a: NonNullable<Awaited<ReturnType<typeof guard>>["access"]>) => ({ userId: a.tenantUser.id, memberId: a.tenantUser.memberId });
const refresh = (slug: string, id?: string) => { revalidatePath(`/app/${slug}/toko/pencairan`); if (id) revalidatePath(`/app/${slug}/toko/pencairan/${id}`); revalidatePath(`/app/${slug}/portal-produsen/pencairan`); };

async function producerName(slug: string, tc: ReturnType<typeof createTenantDb>, access: NonNullable<Awaited<ReturnType<typeof guard>>["access"]>, producerId: string) {
  try {
    const m = await resolveProducers(tc, { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, [producerId]);
    return m.get(producerId)?.name ?? "Produsen";
  } catch { return "Produsen"; }
}

/**
 * Pengurus yang SEKALIGUS produsen tidak boleh memproses uangnya sendiri. Dicek lewat DUA identitas (member DAN akun login Better Auth):
 * akses portal produsen terikat ke akun login, sedangkan `tenant.users.member_id` bisa kosong/berbeda — satu identitas saja bisa dilewati.
 * Mengembalikan pesan galat bila aktor adalah pemilik produsen itu.
 */
async function ownProducerError(slug: string, access: NonNullable<Awaited<ReturnType<typeof guard>>["access"]>, producerId: string | null): Promise<string | null> {
  if (!producerId) return null;
  const { db, schema } = createTenantDb(slug);
  const [p] = await db.select({ memberId: schema.producers.memberId }).from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
  if (!p?.memberId) return null;
  if (access.tenantUser.memberId && access.tenantUser.memberId === p.memberId) return "Anda tidak boleh memproses dana milik produsen Anda sendiri — minta bendahara/ketua lain.";
  const [m] = await publicDb.select({ auth: members.betterAuthUserId }).from(members).where(eq(members.id, p.memberId)).limit(1);
  if (m?.auth && m.auth === access.userId) return "Anda tidak boleh memproses dana milik produsen Anda sendiri — minta bendahara/ketua lain.";
  return null;
}

const PROOF_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Bukti: id media tenant → URL dari baris DB (bukan dari klien). Hanya jpeg/png/webp/PDF (tanpa SVG), TIDAK boleh dipakai ulang sebagai bukti
 * pencairan/pelunasan lain, dan (bila `notBefore` diberi) harus diunggah SESUDAH pengajuan dibuat — bukan gambar lama yang kebetulan ada.
 */
async function resolveProof(slug: string, mediaId: unknown, notBefore?: Date): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (typeof mediaId !== "string" || !isValidUuid(mediaId)) return { ok: false, error: "Bukti transfer wajib dilampirkan." };
  const { db, schema } = createTenantDb(slug);
  const [m] = await db.select({ id: schema.media.id, path: schema.media.path, mime: schema.media.mimeType, createdAt: schema.media.createdAt }).from(schema.media).where(eq(schema.media.id, mediaId)).limit(1);
  if (!m) return { ok: false, error: "Berkas bukti tidak ditemukan di Media Library." };
  if (!PROOF_MIMES.has(m.mime)) return { ok: false, error: "Bukti transfer harus berupa gambar (JPG/PNG/WebP) atau PDF." };
  const [used] = await db.select({ id: schema.producerPayouts.id }).from(schema.producerPayouts).where(eq(schema.producerPayouts.proofMediaId, mediaId)).limit(1);
  const [usedRepay] = await db.select({ id: schema.producerLedgerEntries.id }).from(schema.producerLedgerEntries).where(sql`${schema.producerLedgerEntries.meta}->>'proofMediaId' = ${mediaId}`).limit(1);
  if (used || usedRepay) return { ok: false, error: "Berkas ini sudah dipakai sebagai bukti transfer lain. Unggah bukti yang baru untuk transfer ini." };
  if (notBefore && m.createdAt < notBefore) return { ok: false, error: "Bukti harus diunggah setelah pengajuan ini dibuat (bukan berkas lama). Unggah bukti transfer yang baru." };
  return { ok: true, id: m.id, url: publicUrl(slug, m.path) };
}

async function load(slug: string, payoutId: string) {
  if (typeof payoutId !== "string" || !isValidUuid(payoutId)) return null;
  return getPayoutWithLines(createTenantDb(slug), payoutId);
}

type Access = NonNullable<Awaited<ReturnType<typeof guard>>["access"]>;

/** Notifikasi pasca-aksi: dijalankan terpisah & aman — kegagalannya TIDAK boleh membuat aksi uang yang sudah commit tampak gagal. */
function afterDecision(slug: string, access: Access, kind: "approved" | "rejected" | "paid", payoutId: string, extra: { net?: number; reason?: string } = {}) {
  void (async () => {
    try {
      const tc = createTenantDb(slug);
      const d = await load(slug, payoutId);
      if (!d) return;
      await notifyPayoutDecision(slug, tc, kind, {
        id: d.payout.id, number: d.payout.number, subtotal: Number(d.payout.subtotal), producerId: d.payout.producerId,
        producerName: await producerName(slug, tc, access, d.payout.producerId),
        slaDays: kind === "approved" ? (await getPayoutSettings(tc)).slaDays : undefined,
        reason: kind === "rejected" ? (d.payout.rejectedReason ?? extra.reason) : undefined,
        fee: Number(d.payout.transferFee), net: extra.net, bank: d.payout.bankName, last4: d.payout.accountLast4,
      });
    } catch (e) { console.error("[pencairan notif]", e instanceof Error ? e.message : "unknown"); }
  })();
}

export async function approvePayoutAction(slug: string, payoutId: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  try {
    const pre = await load(slug, payoutId);
    if (!pre) return { success: false, error: "Pengajuan tidak ditemukan." };
    const own = await ownProducerError(slug, g.access, pre.payout.producerId);
    if (own) return { success: false, error: own };
    const res = await approvePayout(createTenantDb(slug), payoutId, actorOf(g.access));
    if (!res.ok) return { success: false, error: res.error };
    afterDecision(slug, g.access, "approved", payoutId);
    refresh(slug, payoutId);
    return { success: true, message: "Pengajuan disetujui. Produsen diberi tahu." };
  } catch (e) { console.error("[approvePayoutAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal menyetujui pengajuan." }; }
}

export async function rejectPayoutAction(slug: string, payoutId: string, reason: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  try {
    const pre = await load(slug, payoutId);
    if (!pre) return { success: false, error: "Pengajuan tidak ditemukan." };
    const own = await ownProducerError(slug, g.access, pre.payout.producerId);
    if (own) return { success: false, error: own };
    const res = await rejectPayout(createTenantDb(slug), payoutId, actorOf(g.access), reason);
    if (!res.ok) return { success: false, error: res.error };
    afterDecision(slug, g.access, "rejected", payoutId, { reason });
    refresh(slug, payoutId);
    return { success: true, message: "Pengajuan ditolak. Saldo produsen kembali utuh dan alasan disampaikan." };
  } catch (e) { console.error("[rejectPayoutAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal menolak pengajuan." }; }
}

export async function markPayoutPaidAction(slug: string, payoutId: string, input: { transferFee: number; proofMediaId: string; sourceBankLabel?: string; note?: string }): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    const pre = await load(slug, payoutId);
    if (!pre) return { success: false, error: "Pengajuan tidak ditemukan." };
    const own = await ownProducerError(slug, g.access, pre.payout.producerId);
    if (own) return { success: false, error: own };
    const proof = await resolveProof(slug, i.proofMediaId, pre.payout.requestedAt);
    if (!proof.ok) return { success: false, error: proof.error };
    const res = await markPayoutPaid(createTenantDb(slug), payoutId, actorOf(g.access), { transferFee: i.transferFee, proofMediaId: proof.id, proofUrl: proof.url, sourceBankLabel: i.sourceBankLabel, note: i.note });
    if (!res.ok) return { success: false, error: res.error };
    afterDecision(slug, g.access, "paid", payoutId, { net: res.netAmount });
    refresh(slug, payoutId);
    return { success: true, message: "Transfer tercatat, jurnal dibuat, dan produsen diberi tahu beserta bukti." };
  } catch (e) { console.error("[markPayoutPaidAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mencatat transfer." }; }
}

async function producerOfShipment(slug: string, shippingLineId: string): Promise<string | null> {
  const { db, schema } = createTenantDb(slug);
  const [r] = await db.select({ p: schema.invoiceShippingLines.producerId }).from(schema.invoiceShippingLines).where(eq(schema.invoiceShippingLines.id, shippingLineId)).limit(1);
  return r?.p ?? null;
}

export async function recordRefundAction(slug: string, shippingLineId: string, amount: number, reason: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  if (typeof shippingLineId !== "string" || !isValidUuid(shippingLineId)) return { success: false, error: "Pengiriman tidak ditemukan." };
  try {
    const own = await ownProducerError(slug, g.access, await producerOfShipment(slug, shippingLineId));
    if (own) return { success: false, error: own };
    const res = await recordProducerRefund(createTenantDb(slug), { shippingLineId, amount, reason, actorUserId: g.access.tenantUser.id });
    if (!res.ok) return { success: false, error: res.error };
    refresh(slug);
    return { success: true, message: "Refund dibebankan ke produsen dan akan dipotong dari pencairan berikutnya." };
  } catch (e) { console.error("[recordRefundAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mencatat refund." }; }
}

export async function recordRepaymentAction(slug: string, producerId: string, amount: number, proofMediaId: string, note?: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  if (typeof producerId !== "string" || !isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  try {
    const own = await ownProducerError(slug, g.access, producerId);
    if (own) return { success: false, error: own };
    const proof = await resolveProof(slug, proofMediaId);
    if (!proof.ok) return { success: false, error: proof.error };
    const res = await recordDebtRepayment(createTenantDb(slug), { producerId, amount, proofMediaId: proof.id, proofUrl: proof.url, note, actorUserId: g.access.tenantUser.id });
    if (!res.ok) return { success: false, error: res.error };
    refresh(slug);
    return { success: true, message: "Pelunasan hutang tercatat." };
  } catch (e) { console.error("[recordRepaymentAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mencatat pelunasan." }; }
}

export async function setHoldAction(slug: string, shippingLineId: string, reason: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  if (typeof shippingLineId !== "string" || !isValidUuid(shippingLineId)) return { success: false, error: "Pengiriman tidak ditemukan." };
  try {
    // Melepas tahan atas pengiriman milik sendiri dilarang (menahan pun tak perlu: kepentingan berlawanan).
    const own = await ownProducerError(slug, g.access, await producerOfShipment(slug, shippingLineId));
    if (own) return { success: false, error: own };
    const res = await setShipmentHold(createTenantDb(slug), shippingLineId, g.access.tenantUser.id, reason);
    if (!res.ok) return { success: false, error: res.error };
    refresh(slug);
    return { success: true, message: reason?.trim() ? "Pencairan pengiriman ini ditahan." : "Tahan dilepas." };
  } catch (e) { console.error("[setHoldAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mengubah status tahan." }; }
}

export async function savePayoutSettingsAction(slug: string, input: unknown): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  try {
    await savePayoutSettings(createTenantDb(slug), sanitizePayoutSettings(input));
    refresh(slug);
    return { success: true, message: "Pengaturan pencairan tersimpan." };
  } catch (e) { console.error("[savePayoutSettingsAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal menyimpan pengaturan." }; }
}
