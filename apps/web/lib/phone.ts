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
