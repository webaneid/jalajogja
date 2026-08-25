// packages/db/scripts/encrypt-existing-nik.ts
//
// Migrasi data SATU KALI PAKAI untuk baris `public.members` lama yang `nik`-nya
// masih PLAINTEXT (ditulis sebelum enkripsi NIK ada). Baris BARU yang ditulis
// setelah kode aplikasi ter-deploy sudah otomatis tersimpan sebagai ciphertext —
// script ini HANYA untuk data historis.
//
// Wajib dijalankan SETELAH:
//   1. MEMBER_PII_ENCRYPTION_KEY sudah diset di environment (generate sekali per
//      environment — key lokal TIDAK BOLEH sama dengan key production).
//   2. Migration packages/db/migrations/0062_member_nik_encryption.sql sudah
//      dijalankan (kolom nik_hash + unique index baru sudah ada).
//
// Cara pakai:
//   DATABASE_URL=... MEMBER_PII_ENCRYPTION_KEY=... bun run packages/db/scripts/encrypt-existing-nik.ts
//     → DRY RUN (default) — cuma tampilkan berapa baris yang akan diubah, TIDAK menulis apa pun.
//   DATABASE_URL=... MEMBER_PII_ENCRYPTION_KEY=... bun run packages/db/scripts/encrypt-existing-nik.ts --commit
//     → benar-benar menulis perubahan ke DB.
//
// PENTING sebelum --commit ke production: BACKUP DATABASE DULU. Operasi ini
// menimpa kolom `nik` — kalau MEMBER_PII_ENCRYPTION_KEY yang dipakai salah/beda
// dari yang akan dipakai aplikasi selanjutnya, data NIK lama jadi tidak bisa
// didekripsi lagi (bukan hilang dari DB, tapi tidak bisa dibaca — sama buruknya
// untuk kebutuhan operasional).
//
// Script ini SENGAJA tidak pernah print nilai NIK asli ke stdout/log — hanya ID
// member dan jumlah baris, supaya output/log terminal tidak jadi kebocoran baru.

import { db, members, encryptPii, hashPiiForLookup } from "../src/index";
import { eq, isNotNull, sql } from "drizzle-orm";

const COMMIT = process.argv.includes("--commit");

async function main() {
  // Ambil SEMUA baris yang punya nik terisi. Kolom ini tidak besar (satu tenant
  // = ratusan anggota, bukan jutaan) — aman ditarik sekaligus ke memori, tidak
  // perlu batching.
  const rows = await db
    .select({ id: members.id, nik: members.nik, nikHash: members.nikHash })
    .from(members)
    .where(isNotNull(members.nik));

  // Heuristik "sudah ciphertext": format encryptPii() SELALU 3 segmen base64
  // dipisah titik ("iv.tag.data"). NIK asli (16 digit angka) tidak pernah
  // mengandung titik — jadi ini aman dipakai untuk skip baris yang kebetulan
  // sudah dienkripsi (mis. script ini pernah dijalankan sebagian lalu terhenti).
  const looksEncrypted = (v: string) => v.split(".").length === 3;

  const toMigrate = rows.filter((r) => r.nik && !looksEncrypted(r.nik));
  const alreadyDone = rows.length - toMigrate.length;

  console.log(`Total baris dengan NIK terisi: ${rows.length}`);
  console.log(`Sudah ciphertext (dilewati):    ${alreadyDone}`);
  console.log(`Perlu dienkripsi:                ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log("\nTidak ada yang perlu dikerjakan.");
    process.exit(0);
  }

  if (!COMMIT) {
    console.log(`\n[DRY RUN] Tidak ada perubahan ditulis. ID baris yang AKAN diubah:`);
    for (const r of toMigrate) console.log(`  - ${r.id}`);
    console.log(`\nJalankan ulang dengan --commit untuk benar-benar menulis perubahan.`);
    process.exit(0);
  }

  console.log(`\n[COMMIT] Menulis perubahan untuk ${toMigrate.length} baris...`);

  let ok = 0;
  let failed = 0;
  const failedIds: string[] = [];

  // Sequential (bukan Promise.all) — sengaja, supaya kalau ada gangguan di
  // tengah jalan, jelas baris mana saja yang sudah selesai vs belum, dan tidak
  // membanjiri koneksi DB dengan ratusan UPDATE sekaligus.
  for (const r of toMigrate) {
    try {
      const ciphertext = encryptPii(r.nik);
      const hash = hashPiiForLookup(r.nik);
      if (!ciphertext || !hash) {
        // r.nik lolos filter isNotNull tapi trim()-nya kosong (whitespace-only) —
        // edge case data kotor, bukan error kripto. Set ke null saja, bukan gagal.
        await db.update(members).set({ nik: null, nikHash: null }).where(eq(members.id, r.id));
        ok++;
        continue;
      }
      await db.update(members).set({ nik: ciphertext, nikHash: hash }).where(eq(members.id, r.id));
      ok++;
    } catch (err) {
      failed++;
      failedIds.push(r.id);
      console.error(`  GAGAL untuk member id=${r.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nSelesai: ${ok} baris berhasil, ${failed} baris gagal.`);
  if (failedIds.length > 0) {
    console.log(`ID yang gagal (butuh investigasi manual — kemungkinan besar dua baris punya NIK sama`);
    console.log(`persis dan menabrak unique index members_nik_hash_not_null_unique):`);
    for (const id of failedIds) console.log(`  - ${id}`);
  }

  // Verifikasi ringan pasca-commit: hitung ulang berapa baris yang MASIH belum
  // ciphertext (harus 0 kalau semua sukses).
  const [{ remaining }] = await db.execute<{ remaining: string }>(
    sql`SELECT count(*)::text AS remaining FROM public.members WHERE nik IS NOT NULL AND nik !~ '^[A-Za-z0-9+/=]+\\.[A-Za-z0-9+/=]+\\.[A-Za-z0-9+/=]+$'`,
  );
  console.log(`\nVerifikasi: ${remaining} baris MASIH belum ciphertext setelah proses ini (idealnya 0).`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Script gagal total:", err instanceof Error ? err.message : err);
  process.exit(1);
});
