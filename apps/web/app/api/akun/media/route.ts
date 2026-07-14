export const dynamic = "force-dynamic";
import { NextRequest, NextResponse }    from "next/server";
import { eq, desc }                    from "drizzle-orm";
import { db, members, memberMedia }    from "@jalajogja/db";
import { auth }                        from "@/lib/auth";
import { publicUrl }                   from "@/lib/minio";

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

// GET /api/akun/media?page={n}
// Kembalikan SEMUA foto milik member yang login — lintas semua tenant (media library global).
// `tenant` query param tidak lagi dipakai untuk filter (dipertahankan optional untuk backward
// compat caller lama) — file fisik bisa berasal dari bucket tenant manapun, di-resolve per row
// via `sourceTenantSlug`. Lihat docs/arsitektur-medialibrary.md § 3.
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error) return NextResponse.json({ error }, { status });

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10));
  const PAGE_SIZE = 50;

  const rows = await db
    .select()
    .from(memberMedia)
    .where(eq(memberMedia.memberId, member!.id))
    .orderBy(desc(memberMedia.createdAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const result = rows.map((m) => ({
    ...m,
    url: publicUrl(m.sourceTenantSlug, m.path),
    variants: m.variants
      ? Object.fromEntries(
          Object.entries(m.variants).map(([k, v]) => [k, publicUrl(m.sourceTenantSlug, v as string)]),
        )
      : null,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({ data: result, page, pageSize: PAGE_SIZE });
}
