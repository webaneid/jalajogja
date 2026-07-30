import sharp from "sharp";

// `height` untuk large/medium/thumbnail HANYA ilustrasi rasio 16:9 pada lebar penuh — BUKAN
// target resize yang ditegakkan. Ketiga variant ini "soft-scale" (fit:"inside", lihat
// SOFT_SCALE_VARIANTS di bawah): tinggi output SELALU otomatis mengikuti rasio gambar SUMBER,
// bukan angka di sini. square/square-large/profile TETAP hard-crop — height di situ BENAR-BENAR
// ditegakkan (fit:"cover").
export const IMAGE_VARIANTS = {
  large:          { width: 1200, height: 675  },  // ilustrasi 16:9 — lihat catatan di atas
  medium:         { width: 800,  height: 450  },  // ilustrasi 16:9 — lihat catatan di atas
  thumbnail:      { width: 400,  height: 225  },  // ilustrasi 16:9 — lihat catatan di atas
  square:         { width: 400,  height: 400  },  // 1:1 — produk kecil, avatar (hard crop)
  "square-large": { width: 800,  height: 800  },  // 1:1 — produk utama, galeri (hard crop)
  profile:        { width: 300,  height: 400  },  // 3:4 — foto profil anggota (hard crop)
} as const;

// Variant yang SELALU soft-scale proporsional (fit:"inside", zero crop) — dipakai di 3 tempat:
// gate upscale (fitsWithoutUpscale), pipeline otomatis (processImage/VARIANT_BUILDERS), dan
// crop manual (processVariant). Menjamin KONSISTENSI: untuk gambar yang sama, thumbnail (landing
// page) dan large (halaman single) SELALU menampilkan komposisi yang identik (yaitu: tidak ada
// crop sama sekali) — beda ukuran file, sama persis isi fotonya.
const SOFT_SCALE_VARIANTS: readonly VariantKey[] = ["large", "medium", "thumbnail"];

const WEBP_QUALITY = 85;

export type ProcessedVariants = {
  original:       Buffer;
  large:          Buffer;
  medium:         Buffer;
  thumbnail:      Buffer;
  square:         Buffer;
  "square-large": Buffer;
  profile:        Buffer;
};

export type VariantKey = keyof ProcessedVariants;

// Variant set per modul — hanya generate yang relevan
const MODULE_VARIANTS: Partial<Record<string, VariantKey[]>> = {
  shop:    ["original", "square", "square-large"],
  members: ["original", "profile"],
  akun:    ["original", "large", "medium", "thumbnail", "square", "profile"],
  // Kop surat (header/footer): convert ke WebP saja, ukuran asli dipertahankan
  letters: ["original"],
};

export const DEFAULT_VARIANTS: VariantKey[] = [
  "original", "large", "medium", "thumbnail", "square",
];

export function getVariantsForModule(module: string): VariantKey[] {
  return MODULE_VARIANTS[module] ?? DEFAULT_VARIANTS;
}

export function getVariantUrl(
  url: string | null | undefined,
  targetVariant: VariantKey,
): string {
  if (!url) return "";
  if (url.endsWith(".svg") || url.startsWith("data:")) return url;

  const suffixMap: Record<VariantKey, string> = {
    original:       "_ori",
    large:          "_lg",
    medium:         "_md",
    thumbnail:      "_th",
    square:         "_sq",
    "square-large": "_sql",
    profile:        "_pf",
  };

  const targetSuffix = suffixMap[targetVariant] ?? "_ori";
  return url.replace(/_(ori|lg|md|th|sq|sql|pf)\.webp$/, `${targetSuffix}.webp`);
}

// SVG tidak diproses — simpan as-is
export function shouldBypass(mime: string): boolean {
  return mime === "image/svg+xml";
}

// Re-crop satu variant. Dipanggil dari POST /api/media/[id]/recrop.
//
// Variant SOFT-SCALE (large/medium/thumbnail) SELALU diregenerasi proporsional dari `original`
// (fit:"inside", zero crop) — parameter `crop` DIABAIKAN TOTAL untuk ketiganya, apa pun isinya.
// Ini KEPUTUSAN DESAIN yang disengaja, bukan celah yang belum sempat ditangani: variant-variant
// ini adalah "versi hemat" dari foto asli (bukan crop artistik terpisah) — kalau salah satu boleh
// di-crop manual independen, thumbnail di landing page dan large di halaman single bisa
// menampilkan KOMPOSISI FOTO YANG BERBEDA untuk sumber yang sama, melanggar jaminan konsistensi
// yang sudah dikunci di komentar SOFT_SCALE_VARIANTS di atas. UI (MediaDetailPanel) tidak lagi
// menawarkan pilihan crop untuk ketiga variant ini — parameter `crop` tetap diterima di sini
// (bukan dihapus dari signature) semata untuk backward-compat pemanggil lama/pihak ketiga.
//
// Variant HARD-CROP (square/square-large/profile) tetap seperti semula: crop manual (extract +
// resize) kalau `crop` diisi, atau `position:"attention"` (auto-deteksi subjek) kalau tidak.
export async function processVariant(
  inputBuffer: Buffer,
  variantKey: VariantKey,
  crop?: { x: number; y: number; width: number; height: number } | null,
): Promise<Buffer> {
  const q = WEBP_QUALITY;
  const target = IMAGE_VARIANTS[variantKey as keyof typeof IMAGE_VARIANTS];

  // "original" (tidak ada di IMAGE_VARIANTS) → convert WebP saja, tanpa resize/crop apa pun.
  if (!target) {
    return sharp(inputBuffer).webp({ quality: q }).toBuffer();
  }

  if (SOFT_SCALE_VARIANTS.includes(variantKey)) {
    // Soft-scale: SELALU proporsional dari original, crop manual diabaikan (lihat komentar di atas).
    return sharp(inputBuffer)
      .resize(target.width, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
  }

  if (crop) {
    // Hard-crop dengan koordinat manual: extract area dulu, baru resize ke target
    const meta = await sharp(inputBuffer).metadata();
    const imgW = meta.width  ?? 1;
    const imgH = meta.height ?? 1;
    return sharp(inputBuffer)
      .extract({
        left:   Math.round(crop.x      / 100 * imgW),
        top:    Math.round(crop.y      / 100 * imgH),
        width:  Math.round(crop.width  / 100 * imgW),
        height: Math.round(crop.height / 100 * imgH),
      })
      .resize(target.width, target.height, { fit: "cover", position: "center" })
      .webp({ quality: q })
      .toBuffer();
  }

  // Hard-crop tanpa crop manual → pakai attention (auto-deteksi subjek)
  return sharp(inputBuffer)
    .resize(target.width, target.height, { fit: "cover", position: "attention" })
    .webp({ quality: q })
    .toBuffer();
}

const MAX_PIXELS = 40_000_000; // 40 MP — foto 12MP/24MP masih aman

// Variant di-generate HANYA kalau sumber cukup besar untuk variant itu tanpa upscale.
// Kalau tidak cukup besar, variant itu SENGAJA dilewati (bukan error) — caller (upload route)
// fallback ke variant lain yang ada, pada akhirnya ke `original` (convert WebP saja, dimensi
// asli utuh, tanpa crop). Mencegah logo/favicon/gambar kecil dipaksa upscale ke ukuran konten
// yang tidak relevan untuknya. TIDAK retroaktif — hanya berlaku upload baru.
//
// Soft-scale (large/medium/thumbnail): resize width-only (fit:"inside", lihat
// SOFT_SCALE_VARIANTS) — tinggi TIDAK pernah jadi target resize, jadi HANYA lebar sumber yang
// relevan sebagai syarat. Cek tinggi di sini dulu SALAH (bug ditemukan 2026-07): source lebar-
// tapi-pendek (mis. banner 1400×300) bisa gagal lolos gate large/medium padahal lebarnya cukup
// untuk scale proporsional — variant itu jadi tidak perlu-perlu amat dilewati.
//
// Hard-crop (square/square-large/profile): resize width+height (fit:"cover") — keduanya
// tetap relevan sebagai syarat cukup-besar (mencegah upscale di salah satu sisi).
function fitsWithoutUpscale(name: VariantKey, srcW: number, srcH: number): boolean {
  const target = IMAGE_VARIANTS[name as keyof typeof IMAGE_VARIANTS];
  if (!target) return true; // "original" tidak ada di IMAGE_VARIANTS — selalu valid
  if (SOFT_SCALE_VARIANTS.includes(name)) return srcW >= target.width;
  return srcW >= target.width && srcH >= target.height;
}

// Generate hanya variant yang diminta DAN yang sumbernya cukup besar untuk itu.
// originalMaxWidth: cap "normalized original" (akun module).
export async function processImage(
  inputBuffer: Buffer,
  variantList: VariantKey[],
  options?: { originalMaxWidth?: number },
): Promise<Partial<ProcessedVariants>> {
  const meta = await sharp(inputBuffer).metadata();
  const srcW = meta.width  ?? 0;
  const srcH = meta.height ?? 0;
  const totalPixels = srcW * srcH;
  if (totalPixels > MAX_PIXELS) {
    throw new Error("Gambar terlalu besar (maks 40 megapixel). Compress dulu sebelum upload.");
  }

  const pos = "attention";
  const q   = WEBP_QUALITY;

  const VARIANT_BUILDERS: Record<VariantKey, () => Promise<Buffer>> = {
    original:       () => options?.originalMaxWidth
      ? sharp(inputBuffer).resize(options.originalMaxWidth, undefined, { fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer()
      : sharp(inputBuffer).webp({ quality: q }).toBuffer(),
    large:          () => sharp(inputBuffer).resize(1200, undefined, { fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    medium:         () => sharp(inputBuffer).resize(800,  undefined, { fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    thumbnail:      () => sharp(inputBuffer).resize(400,  undefined, { fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    square:         () => sharp(inputBuffer).resize(400,  400,       { fit: "cover",  position: "center", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    "square-large": () => sharp(inputBuffer).resize(800,  800,       { fit: "cover",  position: "center", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    profile:        () => sharp(inputBuffer).resize(300,  400,       { fit: "cover",  position: "center", withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
  };

  const entries = await Promise.all(
    variantList
      .filter((name) => name === "original" || fitsWithoutUpscale(name, srcW, srcH))
      .map(async (name) => [name, await VARIANT_BUILDERS[name]()] as const),
  );

  return Object.fromEntries(entries) as Partial<ProcessedVariants>;
}
