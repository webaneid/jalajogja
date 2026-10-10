import "server-only";
import { getSetting, getSettings, type createTenantDb } from "@jalajogja/db";
import type { WaNotifConfig } from "@/lib/whatsapp";
import { sendTenantMail, sendPlatformMail, isPlatformMailConfigured, type TenantSmtpConfig } from "@/lib/mail";

// Kanal OTP untuk gate checkout (type "checkout_verify"). Lihat docs/arsitektur-billing.md
// § "Gate OTP checkout — kanal email + jalur tamu bila tak ada kanal".
type TenantDbHandle = ReturnType<typeof createTenantDb>;

/** WA tenant siap mengirim OTP checkout? (sama dengan syarat di sendWaNotification). */
export async function isWaOtpAvailable(tenantDb: TenantDbHandle): Promise<boolean> {
  if (!(process.env.WHATSAPP_SERVICE_URL ?? "").trim()) return false;
  try {
    const notif = await getSettings(tenantDb, "notif");
    const cfg = notif["whatsapp_config"] as WaNotifConfig | undefined;
    return !!(cfg?.device_id && cfg.verified && cfg.notifications?.["otp_checkout_verify"]);
  } catch {
    return false;
  }
}

/** Ada jalur email yang bisa dipakai (SMTP tenant lengkap ATAU SMTP platform)? */
export async function isEmailOtpSendable(tenantDb: TenantDbHandle): Promise<boolean> {
  if (isPlatformMailConfigured()) return true;
  const smtp = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
  return !!(smtp?.host && smtp.user && smtp.password);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Kirim kode OTP lewat email (SMTP tenant dulu, lalu platform). Tidak melempar. */
export async function sendCheckoutOtpEmail(opts: {
  tenantDb: TenantDbHandle; to: string; code: string; orgName: string; expiryMinutes: number;
}): Promise<boolean> {
  const { tenantDb, to, code, orgName, expiryMinutes } = opts;
  const subject = `Kode verifikasi ${orgName}`;
  const html = `<p>Kode verifikasi checkout Anda di <strong>${escapeHtml(orgName)}</strong>:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${escapeHtml(code)}</p>
    <p>Berlaku ${expiryMinutes} menit. Jangan bagikan kode ini kepada siapa pun. Abaikan email ini bila Anda tidak sedang berbelanja.</p>`;

  try {
    const smtp = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
    if (smtp) {
      const sent = await sendTenantMail(smtp, { to, subject, html });
      if (sent.ok) return true;
    }
    if (isPlatformMailConfigured()) {
      const sent = await sendPlatformMail({ to, subject, html });
      return sent.ok;
    }
  } catch (err) {
    console.error("[sendCheckoutOtpEmail]", err);
  }
  return false;
}
