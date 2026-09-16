// Validasi bentuk UUID generik (v1-v5, apa pun yang genuinely bisa keluar dari randomUUID()/
// gen_random_uuid()) — dipakai SEBELUM query Postgres apa pun yang membandingkan ke kolom
// bertipe uuid. Tanpa ini, segmen URL [id] yang bukan UUID (bot/scanner probe path acak, mis.
// "mogus.id") membuat Postgres throw "invalid input syntax for type uuid" mentah — 500,
// bukan 404 yang bersih — lihat docs/lessons-learned.md [2026-09-18].
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
