// QR Code generator — dipakai di server component (Node.js runtime)
// Return: data URL "data:image/png;base64,..." siap dipakai di <img src={...} />
import QRCode from "qrcode";

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark:  "#000000",
      light: "#ffffff",
    },
  });
}

// Helper: bentuk URL verifikasi lengkap dari hash
export function buildVerifyUrl(slug: string, verificationHash: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:6202";
  return `${base}/${slug}/verify/${verificationHash}`;
}
