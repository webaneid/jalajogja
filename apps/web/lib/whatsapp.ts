// lib/whatsapp.ts
// Entry point tunggal untuk semua pengiriman notifikasi WhatsApp.
// Semua modul WAJIB pakai fungsi ini — tidak boleh fetch langsung ke GOWA.

import { createTenantDb, getSettings } from "@jalajogja/db";

export type WaNotifKey =
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_rejected"
  | "invoice_created"
  | "invoice_reminder"
  | "order_processing"
  | "order_shipped"
  | "order_delivered"
  | "event_registered"
  | "event_reminder"
  | "event_certificate_ready"
  | "donation_received"
  | "member_welcome"
  | "profile_incomplete_reminder"
  | "officer_invite"
  | "letter_sign_request"
  | "otp_register"
  | "otp_reset_password"
  | "otp_login"
  | "installment_converted"
  | "installment_payment_submitted"
  | "installment_payment_confirmed"
  | "installment_reminder"
  | "installment_due_today";

export type WaNotifConfig = {
  device_id:    string;
  phone_number: string | null;
  verified:     boolean;
  notifications: Partial<Record<WaNotifKey, boolean>>;
};

export const WA_NOTIF_DEFAULTS: WaNotifConfig["notifications"] = {
  payment_submitted:       false,
  payment_confirmed:       false,
  payment_rejected:        false,
  invoice_created:         false,
  invoice_reminder:        false,
  order_processing:        false,
  order_shipped:           false,
  order_delivered:         false,
  event_registered:        false,
  event_reminder:          false,
  event_certificate_ready: false,
  donation_received:       false,
  member_welcome:          false,
  profile_incomplete_reminder: false,
  officer_invite:          false,
  letter_sign_request:     false,
  otp_register:            false,
  otp_reset_password:      false,
  otp_login:               false,
  installment_converted:          false,
  installment_payment_submitted:  false,
  installment_payment_confirmed:  false,
  installment_reminder:           false,
  installment_due_today:          false,
};

type SendOptions = {
  slug:    string;
  event:   WaNotifKey;
  to:      string;    // E.164 format: "+6281234567890"
  message: string;
};

export type WaSendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "not_verified" | "event_disabled" | "send_failed" };

// ── Helpers GOWA ──────────────────────────────────────────────────────────────

export function gowaBaseUrl(): string {
  return (process.env.WHATSAPP_SERVICE_URL ?? "").replace(/\/$/, "");
}

export function gowaBasicAuth(): string {
  const user = process.env.WHATSAPP_API_USER ?? "";
  const pass = process.env.WHATSAPP_API_PASS ?? "";
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

export function gowaHeaders(deviceId: string): Record<string, string> {
  return {
    Authorization: gowaBasicAuth(),
    "Content-Type": "application/json",
    "X-Device-Id":  deviceId,
  };
}

// ── Fungsi kirim notifikasi ───────────────────────────────────────────────────

/**
 * Kirim notifikasi WhatsApp ke satu penerima.
 * Selalu gunakan sebagai fire-and-forget: `void sendWaNotification(...)`.
 * Kegagalan WA TIDAK boleh menggagalkan action utama.
 */
export async function sendWaNotification(opts: SendOptions): Promise<WaSendResult> {
  const { slug, event, to, message } = opts;

  const baseUrl = gowaBaseUrl();
  if (!baseUrl) return { ok: false, reason: "not_configured" };

  // Baca config WA dari settings tenant
  const tenantClient = createTenantDb(slug);
  const settings     = await getSettings(tenantClient, "notif");
  const config       = settings["whatsapp_config"] as WaNotifConfig | undefined;

  if (!config?.device_id)   return { ok: false, reason: "not_configured" };
  if (!config.verified)     return { ok: false, reason: "not_verified" };
  if (!config.notifications?.[event]) return { ok: false, reason: "event_disabled" };

  // Normalisasi nomor → format GOWA (digits + @s.whatsapp.net)
  const digits = to.replace(/\D/g, "");
  const phone  = `${digits}@s.whatsapp.net`;

  try {
    const res = await fetch(`${baseUrl}/send/message`, {
      method:  "POST",
      headers: gowaHeaders(config.device_id),
      body:    JSON.stringify({ phone, message }),
    });

    if (!res.ok) return { ok: false, reason: "send_failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "send_failed" };
  }
}

// ── Konversi nomor ke E.164 ───────────────────────────────────────────────────

/**
 * Normalisasi nomor HP ke format E.164 (+62xxx).
 * Input: "08123456789" | "628123456789" | "+628123456789"
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62"))  return `+${digits}`;
  if (digits.startsWith("0"))   return `+62${digits.slice(1)}`;
  return `+${digits}`;
}
