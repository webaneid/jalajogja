import sharp from "sharp";

export const IMAGE_VARIANTS = {
  large:     { width: 1200, height: 630  },
  medium:    { width: 800,  height: 420  },
  thumbnail: { width: 400,  height: 210  },
  square:    { width: 400,  height: 400  },
  profile:   { width: 300,  height: 400  },
} as const;

const WEBP_QUALITY = 85;

export type ProcessedVariants = {
  original:  Buffer;
  large:     Buffer;
  medium:    Buffer;
  thumbnail: Buffer;
  square:    Buffer;
  profile:   Buffer;
};

// SVG tidak diproses — simpan as-is
export function shouldBypass(mime: string): boolean {
  return mime === "image/svg+xml";
}

export async function processImage(inputBuffer: Buffer): Promise<ProcessedVariants> {
  const [original, large, medium, thumbnail, square, profile] = await Promise.all([
    sharp(inputBuffer).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(1200, 630, { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(800,  420, { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  210, { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(400,  400, { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(inputBuffer).resize(300,  400, { fit: "cover", position: "center" }).webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);
  return { original, large, medium, thumbnail, square, profile };
}
