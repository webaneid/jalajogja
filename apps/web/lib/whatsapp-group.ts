// Validasi tautan undangan grup WhatsApp — client-safe (nol import server). Dipakai di titik
// SIMPAN (admin) dan titik BUKA (aksi anggota), sesuai aturan "validasi skema URL di simpan +
// render" (lib/safe-url.ts). Hanya https://chat.whatsapp.com/<kode> yang diterima.

export const WHATSAPP_GROUP_SETTING_KEY = "whatsapp_group_url";

export function isValidWhatsappGroupUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:"
      && u.hostname === "chat.whatsapp.com"
      && /^\/[A-Za-z0-9]{10,}\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}
