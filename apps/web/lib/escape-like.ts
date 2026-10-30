// Escape karakter spesial pola LIKE/ILIKE (`\`, `%`, `_`) pada teks pencarian dari pengguna, supaya
// "50%" atau "a_b" dicari apa adanya, bukan sebagai wildcard. Postgres memakai backslash sebagai
// karakter escape bawaan LIKE/ILIKE, jadi cukup dipakai di `ilike(kolom, `%${escapeLike(q)}%`)`.
// Ini BUKAN perlindungan injeksi (nilai sudah berparameter) — hanya ketepatan hasil pencarian.
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
