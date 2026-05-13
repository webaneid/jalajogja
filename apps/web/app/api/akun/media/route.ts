import { NextRequest, NextResponse }    from "next/server";
import { eq, desc, and, isNotNull }    from "drizzle-orm";
import { db, members }                 from "@jalajogja/db";
import { createTenantDb }              from "@jalajogja/db";
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

// GET /api/akun/media?tenant={slug}&page={n}&search={q}
// Kembalikan daftar file milik member yang login — hanya milik sendiri
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error) return NextResponse.json({ error }, { status });

  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10));
  const PAGE_SIZE = 50;

  const { db: tenantDb, schema } = createTenantDb(slug);

  const rows = await tenantDb
    .select()
    .from(schema.media)
    .where(and(
      eq(schema.media.memberId, member!.id),
      isNotNull(schema.media.memberId),
    ))
    .orderBy(desc(schema.media.createdAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const result = rows.map((m) => ({
    ...m,
    url: publicUrl(slug, m.path),
    variants: m.variants
      ? Object.fromEntries(
          Object.entries(m.variants).map(([k, v]) => [k, publicUrl(slug, v as string)]),
        )
      : null,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({ data: result, page, pageSize: PAGE_SIZE });
}
