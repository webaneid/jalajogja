// Ambil kode error Postgres (SQLSTATE) dari error hasil query Drizzle/postgres.js.
// Drizzle ≥0.44 membungkus error driver dalam DrizzleQueryError (kode ada di `.cause`), driver mentah
// menaruhnya di `.code` — cek keduanya. Contoh: "23505" unique_violation, "23503" foreign_key_violation.
export function pgErrorCode(err: unknown): string | null {
  const read = (e: unknown): string | null =>
    typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string"
      ? (e as { code: string }).code
      : null;
  return read(err) ?? read((err as { cause?: unknown } | null)?.cause);
}
