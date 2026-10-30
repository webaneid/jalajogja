// Konstanta & aturan kanal notifikasi pelanggan (Email × WhatsApp) — client-safe (tanpa import server).
// docs/arsitektur-notifikasi-email.md § 3.2–3.4. Logika kirimnya ada di lib/wa-notify.ts (notifyWa).

import type { WaNotifKey } from "@/lib/whatsapp";

export const CHANNEL_MODE_KEY = "channel_mode";      // settings group "notif"
export const EMAIL_NOTIF_KEY  = "email_notifications"; // settings group "notif", Record<WaNotifKey, boolean>

/**
 * email_first (DEFAULT): kirim email bila ada alamat; WhatsApp HANYA bila email tak terkirim/tak ada alamat
 *   (dan WA tenant aktif + toggle event menyala) — menekan volume WA.
 * both: email DAN WhatsApp.  email_only: hanya email.  wa_only: perilaku lama (hanya WhatsApp).
 */
export const CHANNEL_MODES = ["email_first", "both", "email_only", "wa_only"] as const;
export type ChannelMode = typeof CHANNEL_MODES[number];
export const DEFAULT_CHANNEL_MODE: ChannelMode = "email_first";

export function parseChannelMode(v: unknown): ChannelMode {
  return (CHANNEL_MODES as readonly string[]).includes(v as string) ? (v as ChannelMode) : DEFAULT_CHANNEL_MODE;
}

export type EmailEventKey = Extract<WaNotifKey,
  | "invoice_created" | "payment_submitted" | "payment_confirmed" | "payment_rejected" | "invoice_reminder"
  | "order_processing" | "order_shipped" | "order_delivered"
  | "event_registered" | "event_reminder" | "event_certificate_ready"
  | "donation_received" | "member_welcome" | "profile_incomplete_reminder" | "letter_sign_request"
  | "installment_converted" | "installment_payment_submitted" | "installment_payment_confirmed"
  | "installment_reminder" | "installment_due_today">;

// Event yang punya jalur email via notifyWa(). OTP, digest PJ, dan stok habis/auto-batal TIDAK termasuk
// (punya jalur email sendiri). Default aktif = daftar event inti yang disetujui user (2026-10-30).
export const EMAIL_EVENT_GROUPS: Array<{
  label: string;
  items: Array<{ key: EmailEventKey; label: string; subject: string; defaultOn: boolean }>;
}> = [
  { label: "Pembayaran", items: [
    { key: "invoice_created",   label: "Invoice baru dibuat",     subject: "Tagihan baru — {{orgName}}",            defaultOn: true },
    { key: "payment_submitted", label: "Bukti bayar diterima",    subject: "Bukti pembayaran diterima — {{orgName}}", defaultOn: true },
    { key: "payment_confirmed", label: "Pembayaran dikonfirmasi", subject: "Pembayaran dikonfirmasi — {{orgName}}",  defaultOn: true },
    { key: "payment_rejected",  label: "Pembayaran ditolak",      subject: "Pembayaran ditolak — {{orgName}}",       defaultOn: true },
    { key: "invoice_reminder",  label: "Pengingat jatuh tempo",   subject: "Pengingat tagihan — {{orgName}}",        defaultOn: true },
  ]},
  { label: "Toko & Pengiriman", items: [
    { key: "order_processing", label: "Pesanan diproses", subject: "Pesanan Anda diproses — {{orgName}}", defaultOn: true },
    { key: "order_shipped",    label: "Pesanan dikirim",  subject: "Pesanan Anda dikirim — {{orgName}}",  defaultOn: true },
    { key: "order_delivered",  label: "Pesanan selesai",  subject: "Pesanan Anda selesai — {{orgName}}",  defaultOn: true },
  ]},
  { label: "Event", items: [
    { key: "event_registered",        label: "Pendaftaran event",   subject: "Pendaftaran event berhasil — {{orgName}}", defaultOn: true },
    { key: "event_reminder",          label: "Pengingat event H-1", subject: "Pengingat event — {{orgName}}",            defaultOn: true },
    { key: "event_certificate_ready", label: "Sertifikat siap",     subject: "Sertifikat Anda siap — {{orgName}}",       defaultOn: false },
  ]},
  { label: "Donasi", items: [
    { key: "donation_received", label: "Donasi diterima", subject: "Terima kasih atas donasi Anda — {{orgName}}", defaultOn: true },
  ]},
  { label: "Anggota", items: [
    { key: "member_welcome", label: "Sambutan anggota baru", subject: "Selamat datang — {{orgName}}", defaultOn: true },
    { key: "profile_incomplete_reminder", label: "Pengingat lengkapi profil", subject: "Lengkapi profil Anda — {{orgName}}", defaultOn: true },
  ]},
  { label: "Surat", items: [
    { key: "letter_sign_request", label: "Permintaan tanda tangan", subject: "Surat menunggu tanda tangan Anda — {{orgName}}", defaultOn: true },
  ]},
  { label: "Cicilan", items: [
    { key: "installment_converted",         label: "Invoice diubah jadi cicilan",    subject: "Rincian cicilan — {{orgName}}",           defaultOn: false },
    { key: "installment_payment_submitted", label: "Bukti bayar termin diterima",    subject: "Bukti bayar termin diterima — {{orgName}}", defaultOn: false },
    { key: "installment_payment_confirmed", label: "Pembayaran termin dikonfirmasi", subject: "Pembayaran termin dikonfirmasi — {{orgName}}", defaultOn: false },
    { key: "installment_reminder",          label: "Pengingat termin H-1",           subject: "Pengingat cicilan — {{orgName}}",          defaultOn: false },
    { key: "installment_due_today",         label: "Pengingat termin hari ini",      subject: "Cicilan jatuh tempo hari ini — {{orgName}}", defaultOn: false },
  ]},
];

const BY_KEY = new Map(EMAIL_EVENT_GROUPS.flatMap((g) => g.items).map((i) => [i.key as string, i]));

export function emailSubjectTemplate(event: string): string | null {
  return BY_KEY.get(event)?.subject ?? null;
}

/** Apakah event ini punya jalur email, dan aktif secara default? */
export function isEmailEventDefaultOn(event: string): boolean {
  return BY_KEY.get(event)?.defaultOn ?? false;
}

export function isEmailCapableEvent(event: string): boolean {
  return BY_KEY.has(event);
}
