import "server-only";
import { getSetting, getSettings, type TenantDb } from "@jalajogja/db";
import {
  sendTenantMail, sendPlatformMail, isPlatformMailConfigured,
  type SendMailResult, type TenantSmtpConfig,
} from "@/lib/mail";
import { decryptSecret } from "@/lib/secret-box.server";

// Satu-satunya pintu kirim email bermerek tenant — docs/arsitektur-notifikasi-email.md § 3.1.
// Urutan: SMTP milik tenant (jika lengkap & bisa didekripsi) → gagal/tidak ada → SMTP platform
// dengan nama pengirim = nama tenant dan Reply-To = email kontak tenant. Menggantikan 4 salinan
// logika yang sama di pj-notification / membership-activated / checkout-otp-channel / notify-customer.
// TIDAK melempar. `to` WAJIB dari data tercatat (invoice/member), bukan body request mentah.

export type MailVia = "tenant" | "platform";
export type DispatchResult = ({ ok: true; via: MailVia } | { ok: false; error: string });

/** SMTP tenant dengan password sudah didekripsi; null bila tidak ada / tidak lengkap / gagal dekripsi. */
export async function loadTenantSmtp(tenantDb: TenantDb): Promise<TenantSmtpConfig | null> {
  const stored = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
  if (!stored?.host || !stored.user || !stored.password) return null;
  const password = decryptSecret(stored.password);
  if (!password) {
    console.error("[mail-dispatch] password SMTP tenant tidak bisa didekripsi (kunci salah/belum diset?)");
    return null;
  }
  return { ...stored, password };
}

/** Ada jalur email yang bisa dipakai (SMTP tenant lengkap ATAU SMTP platform)? */
export async function isMailSendable(tenantDb: TenantDb): Promise<boolean> {
  if (isPlatformMailConfigured()) return true;
  return (await loadTenantSmtp(tenantDb)) !== null;
}

export const PLATFORM_SENDER_KEY = "platform_sender"; // settings group "mail"; ditulis HANYA oleh platform admin

async function tenantIdentity(tenantDb: TenantDb): Promise<{ name: string; replyTo: string | null; fromAddress: string | null }> {
  try {
    const [general, contact, mail] = await Promise.all([
      getSettings(tenantDb, "general"),
      getSettings(tenantDb, "contact"),
      getSettings(tenantDb, "mail"),
    ]);
    const sender = mail[PLATFORM_SENDER_KEY];
    return {
      fromAddress: typeof sender === "string" && sender ? sender : null,
      name:    (general.site_name as string | undefined)?.trim() || "Notifikasi",
      replyTo: (contact.contact_email as string | undefined)?.trim() || null,
    };
  } catch {
    return { name: "Notifikasi", replyTo: null, fromAddress: null };
  }
}

export async function sendMailForTenant(
  tenantDb: TenantDb,
  opts: { to: string; subject: string; html: string },
): Promise<DispatchResult> {
  try {
    const { name, replyTo, fromAddress } = await tenantIdentity(tenantDb);

    const smtp = await loadTenantSmtp(tenantDb);
    if (smtp) {
      const sent: SendMailResult = await sendTenantMail(smtp, { ...opts, replyTo });
      if (sent.ok) return { ok: true, via: "tenant" };
      console.warn("[mail-dispatch] SMTP tenant gagal, fallback ke platform:", sent.error);
    }

    if (isPlatformMailConfigured()) {
      const sent = await sendPlatformMail({ ...opts, fromName: name, fromAddress, replyTo });
      if (sent.ok) return { ok: true, via: "platform" };
      return { ok: false, error: sent.error };
    }
    return { ok: false, error: "Tidak ada jalur email yang dikonfigurasi." };
  } catch (err) {
    console.error("[mail-dispatch] sendMailForTenant:", err);
    return { ok: false, error: "Gagal mengirim email." };
  }
}
