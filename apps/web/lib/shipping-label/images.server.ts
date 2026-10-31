// Unduh gambar logo → data URI (disematkan ke PDF label agar tidak bergantung jaringan saat Chromium mencetak).
// SSRF: URL berasal dari pengaturan tenant (diisi admin) → HANYA diizinkan yang diawali URL publik MinIO kita sendiri
// (MINIO_PUBLIC_URL); selain itu diabaikan (label tampil tanpa logo). Batas 1,5 MB, timeout 5 dtk, harus image/*.
import "server-only";

const MAX_BYTES = 1_500_000;

export async function imageToDataUri(url: string | null | undefined): Promise<string | null> {
  const base = process.env.MINIO_PUBLIC_URL;
  if (!url || !base || !url.startsWith(`${base.replace(/\/$/, "")}/`)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(type)) return null;
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) return null; // jangan membaca body besar sama sekali
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
