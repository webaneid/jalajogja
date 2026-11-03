"use server";
// Server Actions pencairan PRODUSEN — docs/arsitektur-pencairan-produsen.md § 13. Penjaga getProducerAccess (fail-closed T&C);
// producerId SELALU dari sesi; nominal dihitung di layanan (packages/db/helpers/producer-payout) dari ledger — bukan dari input.
import { revalidatePath } from "next/cache";
import { createTenantDb, requestPayout, cancelPayoutByProducer, setProducerBankAccount, getBankAccounts, getPayoutWithLines } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/is-uuid";
import { notifyPayoutRequested, notifyBankChanged, notifyProducerBankChanged } from "@/lib/producer-payout-notify.server";

export type PayoutActionResult = { success: true; message?: string; id?: string } | { success: false; error: string };
const HOUR = 60 * 60_000;
const refresh = (slug: string) => { revalidatePath(`/app/${slug}/portal-produsen/pencairan`); revalidatePath(`/app/${slug}/portal-produsen/saldo`); };

export async function saveBankAccountAction(slug: string, input: unknown): Promise<PayoutActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!checkRateLimit(`prodbank:${access.producer.id}`, 10, HOUR).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    const tc = createTenantDb(access.tenant.slug);
    const res = await setProducerBankAccount(tc, access.producer.id, { bankCode: i.bankCode, accountNumber: i.accountNumber, holder: i.holder });
    if (!res.ok) return { success: false, error: res.error };
    // Pasca-commit: tidak boleh membuat penyimpanan yang sudah berhasil tampak gagal.
    void (async () => {
      try {
        const { pending, active } = await getBankAccounts(tc, access.producer.id);
        const shown = pending ?? active;
        if (!shown) return;
        await notifyBankChanged(access.tenant.slug, tc, { producerName: access.producer.displayName, bank: shown.bankName, last4: shown.accountLast4, effectiveAt: res.effectiveAt, immediate: res.immediate });
        // Pemilik rekening juga diberi tahu (bila sesinya dibajak, ia tahu) — email/WA ke kontak produsen sendiri.
        await notifyProducerBankChanged(access.tenant.slug, tc, access.producer.id, { bank: shown.bankName, last4: shown.accountLast4, effectiveAt: res.effectiveAt, immediate: res.immediate });
      } catch (e) { console.error("[saveBankAccountAction notif]", e instanceof Error ? e.message : "unknown"); }
    })();
    refresh(access.tenant.slug);
    return { success: true, message: res.immediate ? "Rekening tersimpan dan langsung berlaku." : "Rekening baru tersimpan. Demi keamanan, baru berlaku 24 jam lagi; sebelum itu pencairan memakai rekening lama." };
  } catch (e) {
    console.error("[saveBankAccountAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menyimpan rekening." };
  }
}

export async function requestPayoutAction(slug: string): Promise<PayoutActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!checkRateLimit(`prodpayout:${access.producer.id}`, 10, HOUR).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };
  try {
    const tc = createTenantDb(access.tenant.slug);
    const res = await requestPayout(tc, access.producer.id);
    if (!res.ok) return { success: false, error: res.error };
    void (async () => {
      try {
        const d = await getPayoutWithLines(tc, res.payoutId, access.producer.id);
        if (d) await notifyPayoutRequested(access.tenant.slug, tc, { id: d.payout.id, number: d.payout.number, subtotal: res.subtotal, producerName: access.producer.displayName, bank: d.payout.bankName, last4: d.payout.accountLast4, holder: d.payout.accountHolder });
      } catch (e) { console.error("[requestPayoutAction notif]", e instanceof Error ? e.message : "unknown"); }
    })();
    refresh(access.tenant.slug);
    return { success: true, id: res.payoutId, message: `Pengajuan ${res.number} terkirim ke bendahara.` };
  } catch (e) {
    console.error("[requestPayoutAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal mengajukan pencairan." };
  }
}

export async function cancelPayoutAction(slug: string, payoutId: string): Promise<PayoutActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof payoutId !== "string" || !isValidUuid(payoutId)) return { success: false, error: "Pengajuan tidak ditemukan." };
  try {
    const res = await cancelPayoutByProducer(createTenantDb(access.tenant.slug), access.producer.id, payoutId);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true, message: "Pengajuan dibatalkan. Saldo Anda kembali utuh." };
  } catch (e) {
    console.error("[cancelPayoutAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal membatalkan pengajuan." };
  }
}
