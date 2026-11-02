// Penyaji berkas Pengajuan Produsen (bucket PRIVAT) — docs/arsitektur-pengajuan-produsen.md § 13.
// Berkas dirujuk lewat (tenant, app, f) → `key` MinIO dicari dari JSON pengajuan itu sendiri (tidak ada path dari klien, tanpa path traversal).
// Boleh: (a) pemilik pengajuan (anggota yang login), atau (b) pengurus dengan akses baca modul `anggota` (Owner/Ketua/Sekretaris).
// Selain itu → 404 (tidak membedakan "tidak ada" dari "bukan hakmu").
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db as publicDb, createTenantDb, members } from "@jalajogja/db";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { hasReadAccess } from "@/lib/permissions";
import { isActiveTenant } from "@/lib/tenant-active";
import { isValidUuid } from "@/lib/is-uuid";
import { getPrivate } from "@/lib/minio";

const notFound = () => new NextResponse("Tidak ditemukan", { status: 404 });

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("tenant") ?? "";
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const fileId = req.nextUrl.searchParams.get("f") ?? "";
  if (!/^[a-z0-9-]{3,30}$/.test(slug) || !isValidUuid(appId) || !isValidUuid(fileId)) return notFound();
  if (!(await isActiveTenant(slug))) return notFound();

  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) return notFound();

  const { db, schema } = createTenantDb(slug);
  const [app] = await db.select().from(schema.producerApplications).where(eq(schema.producerApplications.id, appId)).limit(1);
  if (!app) return notFound();

  // Otorisasi: pemilik pengajuan ATAU pengurus berhak baca `anggota`
  let allowed = false;
  const [me] = await publicDb.select({ id: members.id }).from(members).where(eq(members.betterAuthUserId, userId)).limit(1);
  if (me && me.id === app.memberId) allowed = true;
  if (!allowed) {
    const admin = await getTenantAccess(slug);
    // Peninjau hanya untuk pengajuan yang SUDAH dikirim — draf adalah milik pemohon sampai ia mengirimnya
    if (admin && hasReadAccess(admin.tenantUser, "anggota") && app.status !== "draft") allowed = true;
  }
  if (!allowed) return notFound();

  const file =
    (app.sampleProducts ?? []).map((s) => s.file).find((f) => f?.id === fileId) ??
    (app.processMedia ?? []).find((f) => f.id === fileId) ??
    (app.documentMedia ?? []).map((d) => d.file).find((f) => f.id === fileId);
  if (!file) return notFound();

  let buf: Buffer;
  try { buf = await getPrivate(slug, file.key); } catch { return notFound(); }   // sudah dibersihkan cron / tidak ada

  const ext = file.mime === "application/pdf" ? "pdf" : "webp";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime,                       // dari catatan server, bukan dari klien
      "Content-Disposition": `inline; filename="berkas.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "private, no-store",          // dokumen legalitas: jangan ada salinan di cache peramban
      ...(file.mime === "image/webp" ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),   // PDF: lihat docs § 13 (sandbox memblokir penampil PDF)
      "Referrer-Policy": "no-referrer",
    },
  });
}
