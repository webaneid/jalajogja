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
  akun:    ["original", "large", "square", "profile"],
};

export const DEFAULT_VARIANTS: VariantKey[] = [
  "original", "large", "medium", "thumbnail", "square",
];

export function getVariantsForModule(module: string): VariantKey[] {
  return MODULE_VARIANTS[module] ?? DEFAULT_VARIANTS;
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

// Generate semua variant — route memilih subset via getVariantsForModule()
export async function processImage(inputBuffer: Buffer): Promise<ProcessedVariants> {
  const pos = "attention"; // smart crop: face detection + saliency map (libvips, zero API)
  const q   = WEBP_QUALITY;

  const [original, large, medium, thumbnail, square, squareLarge, profile] =
    await Promise.all([
      sharp(inputBuffer).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(1200, 630,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(800,  420,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(400,  210,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(400,  400,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(800,  800,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
      sharp(inputBuffer).resize(300,  400,  { fit: "cover", position: pos }).webp({ quality: q }).toBuffer(),
    ]);

  return { original, large, medium, thumbnail, square, "square-large": squareLarge, profile };
}
