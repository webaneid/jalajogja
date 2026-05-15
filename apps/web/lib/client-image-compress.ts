// Browser-only — TIDAK ada "use server"

export interface CompressOptions {
  maxDimension?: number; // default: 1600
  quality?: number;      // default: 0.82
  skipIfSmall?: number;  // skip jika size < nilai ini (bytes), default: 800 KB
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82, skipIfSmall = 800 * 1024 } = options;

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w <= maxDimension && h <= maxDimension && file.size < skipIfSmall) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Ganti extension ke .jpg — HEIC/PNG dikonversi Canvas jadi JPEG
          const newName = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], newName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };

    // Fallback: Canvas gagal decode (misal HEIC di browser non-iOS)
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
