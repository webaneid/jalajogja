import sharp from "sharp";

export const IMAGE_VARIANTS = {
  large:          { width: 1200, height: 630  },  // 1.91:1 — featured, OG
  medium:         { width: 800,  height: 420  },  // 1.91:1 — card preview
  thumbnail:      { width: 400,  height: 210  },  // 1.91:1 — grid kecil
  square:         { width: 400,  height: 400  },  // 1:1 — produk kecil, avatar
  "square-large": { width: 800,  height: 800  },  // 1:1 — produk utama, galeri
  profile:        { width: 300,  height: 400  },  // 3:4 — foto profil anggota
} as const;

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

// Re-crop satu variant dengan koordinat manual (persen 0–100) atau attention fallback
// Dipanggil dari POST /api/media/[id]/recrop
export async function processVariant(
  inputBuffer: Buffer,
  width:  number,
  height: number,
  crop?: { x: number; y: number; width: number; height: number } | null,
): Promise<Buffer> {
  const q = WEBP_QUALITY;

  if (crop) {
    // Manual crop: extract area dulu, baru resize ke target
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
      .resize(width, height, { fit: "cover", position: "center" })
      .webp({ quality: q })
      .toBuffer();
  }

  // Tanpa crop manual → pakai attention (default)
  return sharp(inputBuffer)
    .resize(width, height, { fit: "cover", position: "attention" })
    .webp({ quality: q })
    .toBuffer();
}

const MAX_PIXELS = 40_000_000; // 40 MP — foto 12MP/24MP masih aman

// Variant di-generate HANYA kalau sumber cukup besar untuk di-crop tanpa upscale
// (lebar & tinggi sumber >= target). Kalau tidak cukup besar, variant itu SENGAJA
// dilewati (bukan error) — caller (upload route) fallback ke variant lain yang ada,
// pada akhirnya ke `original` (convert WebP saja, dimensi asli utuh, tanpa crop).
// Mencegah logo/favicon/gambar kecil dipaksa upscale+crop ke ukuran konten (large/
// square/dst) yang tidak relevan untuknya. TIDAK retroaktif — hanya berlaku upload baru.
function fitsWithoutUpscale(name: VariantKey, srcW: number, srcH: number): boolean {
  const target = IMAGE_VARIANTS[name as keyof typeof IMAGE_VARIANTS];
  if (!target) return true; // "original" tidak ada di IMAGE_VARIANTS — selalu valid
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
    large:          () => sharp(inputBuffer).resize(1200, 630,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    medium:         () => sharp(inputBuffer).resize(800,  420,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    thumbnail:      () => sharp(inputBuffer).resize(400,  210,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    square:         () => sharp(inputBuffer).resize(400,  400,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    "square-large": () => sharp(inputBuffer).resize(800,  800,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
    profile:        () => sharp(inputBuffer).resize(300,  400,  { fit: "cover", position: pos, withoutEnlargement: true }).webp({ quality: q }).toBuffer(),
  };

  const entries = await Promise.all(
    variantList
      .filter((name) => name === "original" || fitsWithoutUpscale(name, srcW, srcH))
      .map(async (name) => [name, await VARIANT_BUILDERS[name]()] as const),
  );

  return Object.fromEntries(entries) as Partial<ProcessedVariants>;
}
