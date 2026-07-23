// Standar nomor telepon & WhatsApp — lihat docs/arsitektur-kontak.md

// Normalisasi ke E.164 — wajib dipanggil di semua server insert/update
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s;           // sudah E.164
  if (s.startsWith("0"))  return "+62" + s.slice(1);  // lokal Indonesia: 08xxx
  if (s.startsWith("62")) return "+" + s;   // tanpa +: 628xxx
  return "+62" + s;                          // fallback Indonesia
}

// Display: +628xxx → 08xxx (lebih enak dibaca orang Indonesia)
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  if (e164.startsWith("+62")) return "0" + e164.slice(3);
  return e164; // nomor internasional tampil apa adanya
}

// Format digit-saja untuk wa.me/api.whatsapp.com link dan GOWA send API — WAJIB
// dipanggil dengan nilai E.164 ASLI dari DB, bukan hasil displayPhone() (yang sudah
// dilokalkan ke 08xxx dan akan kehilangan kode negara kalau di-strip lagi).
export function toWaDigits(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  if (!normalized) return "";
  return normalized.replace(/^\+/, "");
}
