import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getPlatformSessionFromRequest } from "@/lib/platform-auth";
import { ensurePlatformBucket, uploadPlatformFile, platformPublicUrl } from "@/lib/minio";

export const dynamic = "force-dynamic";

// Upload logo default IKPM (branding platform-wide) — bukan bagian modul media
// tenant, tidak ada variant/versioning. Path fixed → selalu overwrite.
export async function POST(req: NextRequest) {
  const session = await getPlatformSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Tidak ada akses." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await sharp(buffer)
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "File bukan gambar yang valid." }, { status: 400 });
  }

  const path = "branding/logo.webp";
  await ensurePlatformBucket();
  await uploadPlatformFile(path, processed, "image/webp");

  return NextResponse.json({ url: `${platformPublicUrl(path)}?v=${Date.now()}` });
}
