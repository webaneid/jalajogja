"use server";
// Server Actions Pengajuan Produsen (sisi PEMOHON) — docs/arsitektur-pengajuan-produsen.md § 5–6, § 14.
// Setiap aksi: resolveApplicant (sesi → anggota → keanggotaan tenant) + rate limit; isi draf diperiksa ulang di server.
// Unggah berkas ada di route handler terpisah (api/produsen/pengajuan/upload) karena batas body Server Action.
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  resolveApplicant, saveDraftFields, submitApplication, cancelPending, discardDraft, removeDraftItem,
} from "@/lib/producer-application.server";
import { parseDraftInput, type DraftInput, type DraftView } from "@/lib/producer-application";
import { notifyApproversNewApplication } from "@/lib/producer-application-notify.server";

type ViewResult  = { success: true; view: DraftView } | { success: false; error: string };
type PlainResult = { success: true } | { success: false; error: string };

const HOUR = 60 * 60_000, DAY = 24 * HOUR;
const refresh = (slug: string) => revalidatePath(`/${slug}/akun/produsen`);

export async function saveApplicationDraftAction(slug: string, input: DraftInput): Promise<ViewResult> {
  try {
    const r = await resolveApplicant(slug);
    if (!r.ok) return { success: false, error: r.error };
    if (!checkRateLimit(`prodapp-save:${r.a.member.id}`, 120, HOUR).allowed) return { success: false, error: "Terlalu banyak penyimpanan. Coba lagi nanti." };
    const parsed = parseDraftInput(input);                       // menerima `unknown`: Server Action bisa dipanggil dengan JSON bebas
    if (!parsed.ok) return { success: false, error: parsed.error };
    const res = await saveDraftFields(r.a, parsed.value);
    return res.ok ? { success: true, view: res.view } : { success: false, error: res.error };
  } catch (e) {
    console.error("[saveApplicationDraft]", e);
    return { success: false, error: "Gagal menyimpan draf." };
  }
}

export async function submitApplicationAction(slug: string): Promise<ViewResult> {
  const r = await resolveApplicant(slug);
  if (!r.ok) return { success: false, error: r.error };
  if (!checkRateLimit(`prodapp-submit:${r.a.member.id}`, 5, DAY).allowed) return { success: false, error: "Batas pengiriman harian tercapai. Coba lagi besok." };
  try {
    const res = await submitApplication(r.a);
    if (res.ok) {
      refresh(slug);
      // Email ke penyetuju — fire-and-forget (compare-and-set pengiriman menjamin satu email per pengiriman sungguhan)
      void notifyApproversNewApplication({
        slug: r.a.tenant.slug, tenantClient: r.a.tenantClient, applicantMemberId: r.a.member.id,
        applicantName: r.a.member.name, brand: res.view.brandName,
      });
    }
    return res.ok ? { success: true, view: res.view } : { success: false, error: res.error };
  } catch (e) {
    console.error("[submitApplication]", e);
    return { success: false, error: "Gagal mengirim pengajuan." };
  }
}

export async function cancelApplicationAction(slug: string): Promise<PlainResult> {
  const r = await resolveApplicant(slug);
  if (!r.ok) return { success: false, error: r.error };
  if (!checkRateLimit(`prodapp-cancel:${r.a.member.id}`, 10, DAY).allowed) return { success: false, error: "Terlalu banyak percobaan." };
  try {
    const res = await cancelPending(r.a);
    if (res.ok) refresh(slug);
    return res.ok ? { success: true } : { success: false, error: res.error };
  } catch (e) {
    console.error("[cancelApplication]", e);
    return { success: false, error: "Gagal membatalkan pengajuan." };
  }
}

export async function discardApplicationDraftAction(slug: string): Promise<PlainResult> {
  const r = await resolveApplicant(slug);
  if (!r.ok) return { success: false, error: r.error };
  if (!checkRateLimit(`prodapp-discard:${r.a.member.id}`, 20, DAY).allowed) return { success: false, error: "Terlalu banyak percobaan." };
  try {
    const res = await discardDraft(r.a);
    if (res.ok) refresh(slug);
    return res.ok ? { success: true } : { success: false, error: res.error };
  } catch (e) {
    console.error("[discardApplicationDraft]", e);
    return { success: false, error: "Gagal membuang draf." };
  }
}

export async function removeApplicationItemAction(
  slug: string, item: { type: "sample" | "process" | "document"; id: string },
): Promise<ViewResult> {
  const r = await resolveApplicant(slug);
  if (!r.ok) return { success: false, error: r.error };
  if (!checkRateLimit(`prodapp-remove:${r.a.member.id}`, 60, HOUR).allowed) return { success: false, error: "Terlalu banyak percobaan." };
  if (!item || !["sample", "process", "document"].includes(item.type) || typeof item.id !== "string") return { success: false, error: "Data tidak valid." };
  try {
    const res = await removeDraftItem(r.a, item);
    return res.ok ? { success: true, view: res.view } : { success: false, error: res.error };
  } catch (e) {
    console.error("[removeApplicationItem]", e);
    return { success: false, error: "Gagal menghapus." };
  }
}
