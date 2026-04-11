import { sql } from "drizzle-orm";
import type { PublicDb } from "../client";

// Generate nomor anggota global yang unik
// Format: {tahun_daftar}{DDMMYYYY}{00001}
// Contoh: lahir 26 Oktober 1981, daftar 2025, urutan ke-1 → 2025261019810000 1
//
// Sequence di-handle oleh PostgreSQL SEQUENCE `member_number_seq`
// agar atomic — tidak ada dua anggota mendapat nomor yang sama meskipun concurrent

export async function generateMemberNumber(
  db: PublicDb,
  birthDate: string | null, // format: YYYY-MM-DD dari kolom date
  registrationYear?: number
): Promise<string> {
  // Ambil nomor urut berikutnya dari sequence PostgreSQL — atomic
  const result = await db.execute(
    sql.raw(`SELECT nextval('member_number_seq') AS seq`)
  );
  const rows = result as unknown as Array<{ seq: string }>;
  const seq = Number(rows[0].seq);

  const year = registrationYear ?? new Date().getFullYear();

  // Format tanggal lahir: YYYY-MM-DD → DDMMYYYY
  let birthPart = "00000000";
  if (birthDate) {
    const [y, m, d] = birthDate.split("-");
    birthPart = `${d}${m}${y}`; // DDMMYYYY
  }

  // Nomor urut 5 digit: 00001–99999
  const seqPart = seq.toString().padStart(5, "0");

  return `${year}${birthPart}${seqPart}`;
}
