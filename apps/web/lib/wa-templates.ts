// lib/wa-templates.ts
// Template pesan WhatsApp per event. Di kode, bukan di DB.
// Update template = deploy baru — tidak ada injection risk.
// Gunakan renderWaTemplate(event, vars) untuk render teks siap kirim.

export type WaTemplateVars = Record<string, string>;

const templates: Record<string, (v: WaTemplateVars) => string> = {

  // ── Billing ──────────────────────────────────────────────────────────────────

  payment_submitted: (v) =>
    `✅ *Bukti Pembayaran Diterima*\n\nHalo ${v.name}, bukti pembayaran untuk invoice *${v.invoiceNumber}* sudah kami terima.\n\nTotal: *Rp ${v.amount}*\n\nAdmin sedang memverifikasi. Kami akan konfirmasi segera.\n\nTerima kasih! 🙏`,

  payment_confirmed: (v) =>
    `🎉 *Pembayaran Dikonfirmasi*\n\nHalo ${v.name}, pembayaran Anda untuk *${v.invoiceNumber}* sudah dikonfirmasi.\n\nTotal: *Rp ${v.amount}*\n\nTerima kasih atas kepercayaan Anda kepada *${v.orgName}*. 🙏`,

  payment_rejected: (v) =>
    `❌ *Bukti Pembayaran Ditolak*\n\nHalo ${v.name}, maaf bukti pembayaran untuk *${v.invoiceNumber}* tidak dapat diverifikasi.\n\nAlasan: ${v.reason}\n\nSilakan upload ulang bukti pembayaran atau hubungi admin kami.`,

  invoice_created: (v) =>
    `📄 *Invoice Baru*\n\nHalo ${v.name}, invoice *${v.invoiceNumber}* telah dibuat.\n\nTotal: *Rp ${v.amount}*\nJatuh Tempo: ${v.dueDate}\n\nLihat detail: ${v.invoiceUrl}`,

  invoice_reminder: (v) =>
    `⏰ *Pengingat Invoice*\n\nHalo ${v.name}, invoice *${v.invoiceNumber}* akan jatuh tempo besok (${v.dueDate}).\n\nTotal: *Rp ${v.amount}*\n\nSilakan segera melakukan pembayaran:\n${v.invoiceUrl}`,

  // ── Toko / Pengiriman ─────────────────────────────────────────────────────────

  order_processing: (v) =>
    `🏭 *Pesanan Diproses*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* sedang kami siapkan.\n\nTerima kasih sudah berbelanja di *${v.orgName}*!`,

  order_shipped: (v) =>
    `🚚 *Pesanan Dikirim*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* sudah dikirim!\n\nKurir: *${v.courier}*\nNomor Resi: *${v.trackingNumber}*${v.trackingUrl ? `\n\nPantau: ${v.trackingUrl}` : ""}`,

  order_delivered: (v) =>
    `✅ *Pesanan Selesai*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* telah tiba.\n\nTerima kasih sudah berbelanja di *${v.orgName}*! Semoga puas dengan produknya. 😊`,

  // ── Event ─────────────────────────────────────────────────────────────────────

  event_registered: (v) =>
    `🎫 *Pendaftaran Event Berhasil*\n\nHalo ${v.name}, pendaftaran Anda untuk *${v.eventName}* telah diterima.\n\nNomor Registrasi: *${v.regNumber}*\n🗓 ${v.eventDate}\n📍 ${v.location}\n\nDetail: ${v.eventUrl}`,

  event_reminder: (v) =>
    `📅 *Pengingat Event Besok*\n\nHalo ${v.name}, jangan lupa!\n\n*${v.eventName}*\n🗓 ${v.eventDate}\n📍 ${v.location}\n\nNomor Registrasi: *${v.regNumber}*`,

  event_certificate_ready: (v) =>
    `🏆 *Sertifikat Siap Diunduh*\n\nHalo ${v.name}, sertifikat kehadiran untuk *${v.eventName}* sudah tersedia.\n\nUnduh sertifikat Anda: ${v.certUrl}`,

  // ── Donasi ────────────────────────────────────────────────────────────────────

  donation_received: (v) =>
    `🤲 *Donasi Diterima*\n\nJazakumullahu khairan, ${v.name}!\n\nDonasi Anda untuk *${v.campaignName}* sebesar *Rp ${v.amount}* telah kami terima dan sedang diverifikasi.\n\nDoa kami menyertai kebaikan Anda. 🙏`,

  // ── Anggota & Pengurus ────────────────────────────────────────────────────────

  member_welcome: (v) =>
    `🌟 *Selamat Datang di ${v.orgName}!*\n\nHalo ${v.name}, selamat bergabung!\n\nNomor Anggota: *${v.memberNumber}*\n\nLengkapi profil Anda di:\n${v.profileUrl}\n\nWassalamu'alaikum wr. wb.`,

  officer_invite: (v) =>
    `📨 *Undangan Menjadi Pengurus*\n\nAssalamu'alaikum ${v.name},\n\nAnda diundang menjadi *${v.role}* di *${v.orgName}*.\n\nAktifkan akun Anda melalui tautan berikut:\n${v.inviteUrl}\n\nTautan berlaku ${v.expiry}.`,

  // ── Surat ─────────────────────────────────────────────────────────────────────

  letter_sign_request: (v) =>
    `✍️ *Permintaan Tanda Tangan*\n\nAssalamu'alaikum ${v.name},\n\nAnda diminta untuk menandatangani surat:\n*${v.letterSubject}*${v.letterNumber ? `\nNomor: ${v.letterNumber}` : ""}\n\nTanda tangan melalui tautan:\n${v.signUrl}\n\nTautan berlaku 30 hari.`,

  // ── OTP ───────────────────────────────────────────────────────────────────────

  otp_register: (v) =>
    `🔐 *Kode Verifikasi ${v.orgName}*\n\nKode OTP Anda: *${v.otp}*\n\nBerlaku ${v.expiry} menit. Jangan bagikan kode ini kepada siapapun.`,

  otp_reset_password: (v) =>
    `🔑 *Reset Password ${v.orgName}*\n\nKode OTP untuk reset password Anda: *${v.otp}*\n\nBerlaku ${v.expiry} menit. Jika bukan Anda yang meminta, abaikan pesan ini.`,
};

export function renderWaTemplate(event: string, vars: WaTemplateVars): string | null {
  const fn = templates[event];
  if (!fn) return null;
  return fn(vars);
}
