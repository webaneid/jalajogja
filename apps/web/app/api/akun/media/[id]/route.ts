export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and }                   from "drizzle-orm";
import { db, members, memberMedia }  from "@jalajogja/db";
import { auth }                      from "@/lib/auth";
import { deleteFile }                from "@/lib/minio";

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
    })
    .from(memberMedia)
    .where(and(eq(memberMedia.id, id), eq(memberMedia.memberId, member!.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const pathsToDelete = file.variants
    ? (Object.values(file.variants).filter(Boolean) as string[])
    : [file.path];

  await Promise.allSettled(pathsToDelete.map(p => deleteFile(file.sourceTenantSlug, p)));
  await db.delete(memberMedia).where(and(eq(memberMedia.id, id), eq(memberMedia.memberId, member!.id)));

  return NextResponse.json({ success: true });
}
