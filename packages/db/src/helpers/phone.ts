// Duplikasi minimal dari apps/web/lib/phone.ts:normalizePhone — HANYA untuk dipakai
// di dalam packages/db (createLinkedInvoice dll). TIDAK diimpor balik oleh apps/web/lib/phone.ts
// (yang harus tetap zero-dependency ke @jalajogja/db supaya aman dipakai client component —
// lihat lesson "tenant-timezone.ts" di CLAUDE.md soal Postgres client bocor ke client bundle).
// Kalau logic berubah, ubah kedua salinan sekaligus.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s;
  if (s.startsWith("0"))  return "+62" + s.slice(1);
  if (s.startsWith("62")) return "+" + s;
  return "+62" + s;
}
