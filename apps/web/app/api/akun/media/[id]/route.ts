export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and }                   from "drizzle-orm";
import { db, members, memberMedia }  from "@jalajogja/db";
import { auth }                      from "@/lib/auth";
import { deleteFile }                from "@/lib/minio";
import { createTenantDb }            from "@jalajogja/db";
import { findMediaInUse }            from "@/lib/producer-products.server";

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "Login diperlukan.", status: 401 as const, member: null };
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM.", status: 403 as const, member: null };
  return { error: null, status: 200 as const, member };
}

// DELETE /api/akun/media/{id}
// Guard: pastikan member_media.member_id = member.id — tidak bisa hapus file orang lain.
// File fisik dihapus dari bucket sourceTenantSlug (bukan dari query param — file bisa
// berasal dari tenant manapun, lihat docs/arsitektur-medialibrary.md § 3).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, status, member } = await getSessionMember(req);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;

  const [file] = await db
    .select({
      path:             memberMedia.path,
      variants:         memberMedia.variants,
      sourceTenantSlug: memberMedia.sourceTenantSlug,
      purpose:          memberMedia.purpose,
    })
    .from(memberMedia)
    .where(and(eq(memberMedia.id, id), eq(memberMedia.memberId, member!.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  // Foto yang sedang dipakai produk (di tenant mana pun anggota ini menjadi produsen) TIDAK boleh dihapus — foto produk akan rusak.
  // Gagal memeriksa = jangan hapus (fail-closed).
  try {
    const inUse = await findMediaInUse(member!.id, [id]);
    if (inUse.has(id)) {
      return NextResponse.json({ error: "Foto ini sedang dipakai oleh produk Anda. Ganti fotonya di produk (atau hapus produknya) terlebih dahulu." }, { status: 409 });
    }
  } catch (e) {
    console.error("[akun/media DELETE] cek pemakaian foto gagal:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Tidak dapat memeriksa pemakaian foto. Coba lagi nanti." }, { status: 503 });
  }

  const pathsToDelete = file.variants
    ? (Object.values(file.variants).filter(Boolean) as string[])
    : [file.path];

  await Promise.allSettled(pathsToDelete.map(p => deleteFile(file.sourceTenantSlug, p)));
  await db.delete(memberMedia).where(and(eq(memberMedia.id, id), eq(memberMedia.memberId, member!.id)));

  // Bukti pengiriman produsen: kosongkan rujukan di pengiriman supaya tidak ada tautan foto rusak (nomor resi tetap).
  if (file.purpose === "resi") {
    try {
      const { db: tdb, schema } = createTenantDb(file.sourceTenantSlug); // slug dari baris DB, bukan dari request
      await tdb.update(schema.invoiceShippingLines)
        .set({ trackingProofPath: null, trackingProofMediaId: null, updatedAt: new Date() })
        .where(eq(schema.invoiceShippingLines.trackingProofMediaId, id));
    } catch (e) { console.error("[akun-media] kosongkan rujukan resi gagal:", e); }
  }

  return NextResponse.json({ success: true });
}
