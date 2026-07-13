// lib/wa-templates.ts
// Template default (seed) untuk semua notifikasi WA — dipakai sebagai fallback saat
// tenant belum kustomisasi teksnya sendiri, dan sebagai isi awal saat admin membuka
// editor teks di /settings/notifications.
//
// Sintaks placeholder: {{namaVariabel}} — string replace sederhana, BUKAN eval JS.
// WhatsApp mendukung format teks: bold *teks*, italic _teks_, monospace `teks`.
//
// Override per-tenant disimpan di tenant.settings (group="notif", key="wa_message_templates").
// Resolusi default vs custom ada di lib/wa-notify.ts (resolveWaTemplateText).

export type WaTemplateVars = Record<string, string>;

export const WA_TEMPLATE_DEFAULTS: Record<string, string> = {

  // ── Billing ──────────────────────────────────────────────────────────────────

  payment_submitted:
    "✅ *Bukti Pembayaran Diterima*\n\nHalo {{name}}, bukti pembayaran untuk invoice *{{invoiceNumber}}* sudah kami terima.\n\nTotal: *Rp {{amount}}*\n\nAdmin sedang memverifikasi. Kami akan konfirmasi segera.\n\nTerima kasih! 🙏",

  payment_confirmed:
    "🎉 *Pembayaran Dikonfirmasi*\n\nHalo {{name}}, pembayaran Anda untuk *{{invoiceNumber}}* sudah dikonfirmasi.\n\nTotal: *Rp {{amount}}*\n\nTerima kasih atas kepercayaan Anda kepada *{{orgName}}*. 🙏",

  payment_rejected:
    "❌ *Bukti Pembayaran Ditolak*\n\nHalo {{name}}, maaf bukti pembayaran untuk *{{invoiceNumber}}* tidak dapat diverifikasi.\n\nAlasan: {{reason}}\n\nSilakan upload ulang bukti pembayaran atau hubungi admin kami.",

  invoice_created:
    "📄 *Invoice Baru*\n\nHalo {{name}}, invoice *{{invoiceNumber}}* telah dibuat.\n\nTotal: *Rp {{amount}}*\nJatuh Tempo: {{dueDate}}\n\nLihat detail: {{invoiceUrl}}",

  invoice_reminder:
    "⏰ *Pengingat Invoice*\n\nHalo {{name}}, invoice *{{invoiceNumber}}* akan jatuh tempo besok ({{dueDate}}).\n\nTotal: *Rp {{amount}}*\n\nSilakan segera melakukan pembayaran:\n{{invoiceUrl}}",

  // ── Toko / Pengiriman ─────────────────────────────────────────────────────────

  order_processing:
    "🏭 *Pesanan Diproses*\n\nHalo {{name}}, pesanan *{{orderNumber}}* sedang kami siapkan.\n\nTerima kasih sudah berbelanja di *{{orgName}}*!",

  order_shipped:
    "🚚 *Pesanan Dikirim*\n\nHalo {{name}}, pesanan *{{orderNumber}}* sudah dikirim!\n\nKurir: *{{courier}}*\nNomor Resi: *{{trackingNumber}}*\n\nPantau: {{trackingUrl}}",

  order_delivered:
    "✅ *Pesanan Selesai*\n\nHalo {{name}}, pesanan *{{orderNumber}}* telah tiba.\n\nTerima kasih sudah berbelanja di *{{orgName}}*! Semoga puas dengan produknya. 😊",

  // ── Event ─────────────────────────────────────────────────────────────────────

  event_registered:
    "🎫 *Pendaftaran Event Berhasil*\n\nHalo {{name}}, pendaftaran Anda untuk *{{eventName}}* telah diterima.\n\nNomor Registrasi: *{{regNumber}}*\n🗓 {{eventDate}}\n📍 {{location}}\n\nDetail: {{eventUrl}}",

  event_reminder:
    "📅 *Pengingat Event Besok*\n\nHalo {{name}}, jangan lupa!\n\n*{{eventName}}*\n🗓 {{eventDate}}\n📍 {{location}}\n\nNomor Registrasi: *{{regNumber}}*",

  event_certificate_ready:
    "🏆 *Sertifikat Siap Diunduh*\n\nHalo {{name}}, sertifikat kehadiran untuk *{{eventName}}* sudah tersedia.\n\nUnduh sertifikat Anda: {{certUrl}}",

  // ── Donasi ────────────────────────────────────────────────────────────────────

  donation_received:
    "🤲 *Donasi Diterima*\n\nJazakumullahu khairan, {{name}}!\n\nDonasi Anda untuk *{{campaignName}}* sebesar *Rp {{amount}}* telah kami terima dan sedang diverifikasi.\n\nDoa kami menyertai kebaikan Anda. 🙏",

  // ── Anggota & Pengurus ────────────────────────────────────────────────────────

  member_welcome:
    "🌟 *Selamat Datang di {{orgName}}!*\n\nHalo {{name}}, selamat bergabung!\n\nNomor Anggota: *{{memberNumber}}*\n\nLengkapi profil Anda di:\n{{profileUrl}}\n\nWassalamu'alaikum wr. wb.",

  officer_invite:
    "📨 *Undangan Menjadi Pengurus*\n\nAssalamu'alaikum {{name}},\n\nAnda diundang menjadi *{{role}}* di *{{orgName}}*.\n\nAktifkan akun Anda melalui tautan berikut:\n{{inviteUrl}}\n\nTautan berlaku {{expiry}}.",

  // ── Surat ─────────────────────────────────────────────────────────────────────

  letter_sign_request:
    "✍️ *Permintaan Tanda Tangan*\n\nAssalamu'alaikum {{name}},\n\nAnda diminta untuk menandatangani surat:\n*{{letterSubject}}*\nNomor: {{letterNumber}}\n\nTanda tangan melalui tautan:\n{{signUrl}}\n\nTautan berlaku 30 hari.",

  // ── OTP ───────────────────────────────────────────────────────────────────────

  otp_register:
    "🔐 *Kode Verifikasi {{orgName}}*\n\nKode OTP Anda: *{{otp}}*\n\nBerlaku {{expiry}} menit. Jangan bagikan kode ini kepada siapapun.",

  otp_reset_password:
    "🔑 *Reset Password {{orgName}}*\n\nKode OTP untuk reset password Anda: *{{otp}}*\n\nBerlaku {{expiry}} menit. Jika bukan Anda yang meminta, abaikan pesan ini.",

  otp_login:
    "🔐 *Masuk ke {{orgName}}*\n\nKode OTP login Anda: *{{otp}}*\n\nBerlaku {{expiry}} menit. Jangan bagikan kode ini kepada siapapun.",
};

// Ganti semua {{key}} dengan vars[key] — string replace murni, tidak pernah eval JS.
// Placeholder yang tidak ada di vars diganti string kosong (bukan error).
export function renderTemplateString(tpl: string, vars: WaTemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

// Render pakai template default kode — tanpa cek override tenant.
// Dipertahankan untuk backward-compat caller yang tidak perlu resolusi per-tenant.
// Untuk notifikasi yang tenant-aware, gunakan resolveWaTemplateText() di lib/wa-notify.ts.
export function renderWaTemplate(event: string, vars: WaTemplateVars): string | null {
  const tpl = WA_TEMPLATE_DEFAULTS[event];
  if (!tpl) return null;
  return renderTemplateString(tpl, vars);
}
