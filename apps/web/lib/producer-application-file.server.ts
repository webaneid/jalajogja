// Validasi + pemrosesan berkas Pengajuan Produsen dari ISI file (bukan file.type klien) — docs/arsitektur-pengajuan-produsen.md § 13.
//  - Gambar (JPG/PNG/WebP/HEIC): diproses ulang Sharp → WebP, EXIF dibuang, maks 1600 px. File asli tidak pernah disimpan.
//  - PDF: hanya slot "document"; header %PDF- + penutup %%EOF, maks 5 MB; disimpan apa adanya (disajikan route berotorisasi).
//  - SVG/HTML/EXE/dll: ditolak (bukan format gambar yang didukung dan bukan PDF).
import "server-only";
import sharp from "sharp";
import { APP_IMAGE_MAX_BYTES, APP_PDF_MAX_BYTES } from "@/lib/producer-application";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const MAX_PIXELS = 16_000_000;   // PNG 16 MP didekode penuh ≈ 64 MB; foto HP 12 MP tetap lolos
// Batas konkurensi pemrosesan GLOBAL (dekode gambar memakan memori; rate limit hanya per anggota)
const MAX_CONCURRENT = 2;
let active = 0;

export type ProcessedFile =
  | { ok: true; body: Buffer; mime: "image/webp" | "application/pdf"; ext: "webp" | "pdf" }
  | { ok: false; error: string; busy?: boolean };

export async function processApplicationFile(input: Buffer, slot: "sample" | "process" | "document"): Promise<ProcessedFile> {
  const isPdf = input.subarray(0, 5).toString("latin1") === "%PDF-";
  if (isPdf) {
    if (slot !== "document") return { ok: false, error: "PDF hanya untuk dokumen legalitas. Unggah foto untuk contoh produk/proses produksi." };
    if (input.length > APP_PDF_MAX_BYTES) return { ok: false, error: "Ukuran PDF maksimal 5 MB." };
    if (!input.subarray(Math.max(0, input.length - 1024)).toString("latin1").includes("%%EOF")) return { ok: false, error: "Berkas PDF tidak lengkap atau rusak." };
    return { ok: true, body: input, mime: "application/pdf", ext: "pdf" };
  }
  if (input.length > APP_IMAGE_MAX_BYTES) return { ok: false, error: "Ukuran foto maksimal 8 MB." };
  if (active >= MAX_CONCURRENT) return { ok: false, error: "Server sedang sibuk memproses berkas. Coba lagi sebentar.", busy: true };
  active++;
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return { ok: false, error: "Format tidak didukung. Gunakan JPG, PNG, WebP, HEIC, atau PDF (khusus dokumen)." };
    const body = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { ok: true, body, mime: "image/webp", ext: "webp" };
  } catch {
    return { ok: false, error: "Berkas tidak bisa diproses. Coba berkas lain." };
  } finally {
    active--;
  }
}
