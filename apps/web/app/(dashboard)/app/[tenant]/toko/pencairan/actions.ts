"use server";
// Server Actions pencairan produsen — sisi ADMIN/BENDAHARA. docs/arsitektur-pencairan-produsen.md § 13.
// getTenantAccess + hasFullAccess(keuangan) di SETIAP aksi (Bendahara/Ketua/Owner); pengurus yang sekaligus produsen tak boleh memproses pencairannya
// sendiri (ditegakkan di layanan). Bukti transfer WAJIB: id media divalidasi ke tabel media tenant & URL dibangun SERVER dari baris itu.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import {
  createTenantDb, approvePayout, rejectPayout, markPayoutPaid, recordProducerRefund, recordDebtRepayment, setShipmentHold, savePayoutSettings, getPayoutSettings,
  getPayoutWithLines, sanitizePayoutSettings,
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

/** Bukti: id media tenant → URL dari baris DB (bukan dari klien); hanya gambar/PDF. */
async function resolveProof(slug: string, mediaId: unknown): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (typeof mediaId !== "string" || !isValidUuid(mediaId)) return { ok: false, error: "Bukti transfer wajib dilampirkan." };
  const { db, schema } = createTenantDb(slug);
  const [m] = await db.select({ id: schema.media.id, path: schema.media.path, mime: schema.media.mimeType }).from(schema.media).where(eq(schema.media.id, mediaId)).limit(1);
  if (!m) return { ok: false, error: "Berkas bukti tidak ditemukan di Media Library." };
  if (!(m.mime.startsWith("image/") || m.mime === "application/pdf")) return { ok: false, error: "Bukti transfer harus berupa gambar atau PDF." };
  return { ok: true, id: m.id, url: publicUrl(slug, m.path) };
}

async function load(slug: string, payoutId: string) {
  if (typeof payoutId !== "string" || !isValidUuid(payoutId)) return null;
  return getPayoutWithLines(createTenantDb(slug), payoutId);
}

export async function approvePayoutAction(slug: string, payoutId: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  try {
    const tc = createTenantDb(slug);
    const res = await approvePayout(tc, payoutId, actorOf(g.access));
    if (!res.ok) return { success: false, error: res.error };
    const d = await load(slug, payoutId);
    if (d) void notifyPayoutDecision(slug, tc, "approved", { id: d.payout.id, number: d.payout.number, subtotal: Number(d.payout.subtotal), producerId: d.payout.producerId, producerName: await producerName(slug, tc, g.access, d.payout.producerId), slaDays: (await getPayoutSettings(tc)).slaDays });
    refresh(slug, payoutId);
    return { success: true, message: "Pengajuan disetujui. Produsen diberi tahu." };
  } catch (e) { console.error("[approvePayoutAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal menyetujui pengajuan." }; }
}

export async function rejectPayoutAction(slug: string, payoutId: string, reason: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  try {
    const tc = createTenantDb(slug);
    const res = await rejectPayout(tc, payoutId, actorOf(g.access), reason);
    if (!res.ok) return { success: false, error: res.error };
    const d = await load(slug, payoutId);
    if (d) void notifyPayoutDecision(slug, tc, "rejected", { id: d.payout.id, number: d.payout.number, subtotal: Number(d.payout.subtotal), producerId: d.payout.producerId, producerName: await producerName(slug, tc, g.access, d.payout.producerId), reason: d.payout.rejectedReason ?? reason });
    refresh(slug, payoutId);
    return { success: true, message: "Pengajuan ditolak. Saldo produsen kembali utuh dan alasan disampaikan." };
  } catch (e) { console.error("[rejectPayoutAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal menolak pengajuan." }; }
}

export async function markPayoutPaidAction(slug: string, payoutId: string, input: { transferFee: number; proofMediaId: string; sourceBankLabel?: string; note?: string }): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const proof = await resolveProof(slug, i.proofMediaId);
  if (!proof.ok) return { success: false, error: proof.error };
  try {
    const tc = createTenantDb(slug);
    const res = await markPayoutPaid(tc, payoutId, actorOf(g.access), { transferFee: i.transferFee, proofMediaId: proof.id, proofUrl: proof.url, sourceBankLabel: i.sourceBankLabel, note: i.note });
    if (!res.ok) return { success: false, error: res.error };
    const d = await load(slug, payoutId);
    if (d) void notifyPayoutDecision(slug, tc, "paid", { id: d.payout.id, number: d.payout.number, subtotal: Number(d.payout.subtotal), producerId: d.payout.producerId, producerName: await producerName(slug, tc, g.access, d.payout.producerId), fee: Number(d.payout.transferFee), net: res.netAmount, bank: d.payout.bankName, last4: d.payout.accountLast4 });
    refresh(slug, payoutId);
    return { success: true, message: "Transfer tercatat, jurnal dibuat, dan produsen diberi tahu beserta bukti." };
  } catch (e) { console.error("[markPayoutPaidAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mencatat transfer." }; }
}

export async function recordRefundAction(slug: string, shippingLineId: string, amount: number, reason: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  if (typeof shippingLineId !== "string" || !isValidUuid(shippingLineId)) return { success: false, error: "Pengiriman tidak ditemukan." };
  try {
    const res = await recordProducerRefund(createTenantDb(slug), { shippingLineId, amount, reason, actorUserId: g.access.tenantUser.id });
    if (!res.ok) return { success: false, error: res.error };
    refresh(slug);
    return { success: true, message: "Refund dibebankan ke produsen dan akan dipotong dari pencairan berikutnya." };
  } catch (e) { console.error("[recordRefundAction]", e instanceof Error ? e.message : "unknown"); return { success: false, error: "Gagal mencatat refund." }; }
}

export async function recordRepaymentAction(slug: string, producerId: string, amount: number, proofMediaId: string, note?: string): Promise<PencairanResult> {
  const g = await guard(slug); if (!g.access) return { success: false, error: g.error! };
  if (typeof producerId !== "string" || !isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  const proof = await resolveProof(slug, proofMediaId);
  if (!proof.ok) return { success: false, error: proof.error };
  try {
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
