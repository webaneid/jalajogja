import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Enkripsi at-rest untuk kredensial yang disimpan di DB (saat ini: password SMTP tenant) —
// docs/arsitektur-notifikasi-email.md § 6. AES-256-GCM (terautentikasi: ciphertext yang diubah
// ditolak, bukan didekripsi jadi sampah). Kunci 32 byte dari env SMTP_ENCRYPTION_KEY
// (base64 atau 64 hex). Format tersimpan: "enc:v1:<iv>:<tag>:<ciphertext>" (semua base64).
// Nilai TANPA awalan "enc:v1:" dianggap plaintext lama dan dikembalikan apa adanya.

const PREFIX = "enc:v1:";

function loadKey(): Buffer | null {
  const raw = process.env.SMTP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function isSecretKeyConfigured(): boolean {
  return loadKey() !== null;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Enkripsi. Melempar bila kunci belum diset — JANGAN pernah menyimpan plaintext diam-diam. */
export function encryptSecret(plain: string): string {
  const key = loadKey();
  if (!key) throw new Error("SMTP_ENCRYPTION_KEY belum diset/tidak valid (harus 32 byte base64 atau 64 hex).");
  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct     = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Dekripsi. Plaintext lama (tanpa awalan) dikembalikan apa adanya. Mengembalikan null bila gagal. */
export function decryptSecret(stored: string): string | null {
  if (!isEncryptedSecret(stored)) return stored;
  const key = loadKey();
  if (!key) return null;
  try {
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
