// packages/db/src/helpers/pii-crypto.ts
//
// Enkripsi at-rest untuk data pribadi paling sensitif (mulai dari NIK — nomor
// identitas nasional, diatur khusus di UU PDP). Kolom PERTAMA yang dienkripsi
// di seluruh sistem ini — sebelum ini nol enkripsi di codebase (password login
// ditangani Better Auth sendiri, bukan sesuatu yang dibangun di sini).
//
// Batasan matematis yang WAJIB dipahami sebelum menambah pemakaian baru:
// enkripsi asli (AES-GCM, non-deterministik) TIDAK PERNAH bisa mendukung
// pencarian SEBAGIAN teks (ILIKE/substring) di level database — ciphertext
// selalu berbeda tiap kali dienkripsi meski plaintext-nya sama. Kalau butuh
// exact-match lookup (uniqueness check, cari-persis), pakai `hashPiiForLookup()`
// sebagai kolom index terpisah — jangan pernah simpan hasil hash sebagai
// pengganti nilai asli (hash tidak reversible, dan HMAC-nya pakai sub-key
// yang berbeda dari enkripsi supaya dua tujuan itu tetap terpisah secara
// kriptografis meski berasal dari satu master key).

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const ALGO       = "aes-256-gcm";
const IV_BYTES    = 12; // standar GCM 96-bit IV
const KEY_BYTES   = 32; // AES-256

function getMasterKey(): Buffer {
  const raw = process.env.MEMBER_PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MEMBER_PII_ENCRYPTION_KEY tidak diset. Generate sekali via: " +
      "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" " +
      "lalu simpan ke .env.local — JANGAN pernah commit nilainya.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `MEMBER_PII_ENCRYPTION_KEY harus tepat ${KEY_BYTES} byte setelah di-decode base64 ` +
      `(sekarang ${key.length} byte). Generate ulang dengan perintah di komentar helper ini.`,
    );
  }
  return key;
}

// Derive 2 sub-key independen dari satu master key (key separation principle) —
// supaya kompromi salah satu tujuan (mis. index hash bocor lewat bug lain)
// TIDAK otomatis membuka kunci enkripsi nilai asli, dan sebaliknya.
function deriveKey(purpose: "encrypt" | "hmac"): Buffer {
  const master = getMasterKey();
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), Buffer.from(purpose), KEY_BYTES));
}

/**
 * Enkripsi nilai PII sebelum disimpan ke DB. `null`/kosong tetap `null` —
 * field ini boleh tidak diisi (tidak semua organisasi wajibkan NIK, dst).
 * Format hasil: "{iv}.{authTag}.{ciphertext}" semua base64 — bukan format
 * yang dimaksudkan dibaca manusia, murni internal.
 */
export function encryptPii(plain: string | null | undefined): string | null {
  const value = plain?.trim();
  if (!value) return null;

  const key    = deriveKey("encrypt");
  const iv     = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc    = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/**
 * Dekripsi nilai hasil `encryptPii()`. Return `null` untuk input kosong,
 * format tidak dikenal, atau gagal dekripsi (key salah/data korup) — SENGAJA
 * tidak throw, supaya satu baris rusak tidak menjatuhkan seluruh halaman yang
 * menampilkan banyak anggota sekaligus (mis. list/tabel).
 */
export function decryptPii(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  const parts = encoded.split(".");
  if (parts.length !== 3) return null;

  try {
    const [ivB64, tagB64, dataB64] = parts;
    const key = deriveKey("encrypt");
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Hash deterministik (HMAC-SHA256) untuk BLIND INDEX — satu-satunya cara sah
 * mencari/membandingkan nilai terenkripsi tanpa membuka nilai aslinya. Hasil
 * SELALU sama untuk plaintext yang sama (itu maksudnya — untuk mendukung
 * exact-match WHERE/UNIQUE), TIDAK PERNAH untuk menyimpan nilai yang bisa
 * dibalik ke plaintext. Normalisasi (trim + buang semua whitespace) dulu agar
 * "123 456" dan "123456" tetap menghasilkan hash yang sama.
 */
export function hashPiiForLookup(plain: string | null | undefined): string | null {
  const value = plain?.trim().replace(/\s+/g, "");
  if (!value) return null;
  const key = deriveKey("hmac");
  return createHmac("sha256", key).update(value).digest("hex");
}
