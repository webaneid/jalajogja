import { NextRequest, NextResponse } from "next/server";
import { eq, and }                   from "drizzle-orm";
import { db, members }               from "@jalajogja/db";
import { createTenantDb }            from "@jalajogja/db";
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

// DELETE /api/akun/media/{id}?tenant={slug}
// Guard: pastikan media.member_id = member.id — tidak bisa hapus file orang lain
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, status, member } = await getSessionMember(req);
  if (error) return NextResponse.json({ error }, { status });

  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  const { id } = await params;
  const { db: tenantDb, schema } = createTenantDb(slug);

  const [file] = await tenantDb
    .select({ path: schema.media.path, variants: schema.media.variants })
    .from(schema.media)
    .where(and(eq(schema.media.id, id), eq(schema.media.memberId, member!.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const pathsToDelete = file.variants
    ? (Object.values(file.variants).filter(Boolean) as string[])
    : [file.path];

  await Promise.allSettled(pathsToDelete.map(p => deleteFile(slug, p)));
  await tenantDb.delete(schema.media).where(and(eq(schema.media.id, id), eq(schema.media.memberId, member!.id)));

  return NextResponse.json({ success: true });
}
