// Samarkan nama untuk ditampilkan ke pengunjung yang belum terverifikasi.
// "Ahmad Fauzi Rahman" → "A*** F*** R***" (huruf pertama tiap kata + 3 bintang tetap,
// panjang asli nama tidak bocor). Dipakai /api/akun/lookup-member untuk stambuk & email.
export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${Array.from(w)[0]}***`)
    .join(" ");
}
