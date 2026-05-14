export const dynamic = "force-dynamic";
// POST /api/decode-qr
// Body: { imageUrl: string }
// Server-side decode: fetch image (no CORS) → Sharp preprocess → jsQR → EMV payload

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import jsQR from "jsqr";

export async function POST(req: NextRequest) {
  let imageUrl: string;
  try {
    ({ imageUrl } = await req.json() as { imageUrl: string });
    if (!imageUrl) throw new Error("missing");
  } catch {
    return NextResponse.json({ error: "imageUrl wajib diisi" }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`fetch ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize ke 1024×1024 lalu decode — Sharp resize membantu QR kecil/terdistorsi
    const { data, info } = await sharp(buffer)
      .resize(1024, 1024, {
        fit:        "contain",
        background: { r: 255, g: 255, b: 255 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(new Uint8ClampedArray(data.buffer), info.width, info.height);

    if (!code?.data) {
      // Coba lagi dengan ukuran lebih kecil (500px) — kadang lebih efektif
      const { data: d2, info: i2 } = await sharp(buffer)
        .resize(500, 500, {
          fit:        "contain",
          background: { r: 255, g: 255, b: 255 },
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const code2 = jsQR(new Uint8ClampedArray(d2.buffer), i2.width, i2.height);
      if (!code2?.data) {
        return NextResponse.json({ error: "not_found" });
      }
      return NextResponse.json({ payload: code2.data });
    }

    return NextResponse.json({ payload: code.data });
  } catch (err) {
    console.error("[/api/decode-qr]", err);
    return NextResponse.json({ error: "Gagal memproses gambar" }, { status: 500 });
  }
}
