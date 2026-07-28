export const dynamic = "force-dynamic";
// GET /api/ref/post-authors?slug=&q=
// Cari profil penulis TAMU (post_authors.member_id IS NULL) yang sudah pernah dibuat di tenant
// ini — "Penulis Tersimpan" untuk mekanisme recall di AuthorPicker. Butuh sesi valid tenant.

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { ilike, and, isNull } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const q    = (searchParams.get("q") ?? "").trim();

  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { db, schema } = createTenantDb(slug);

  const whereClause = q
    ? and(isNull(schema.postAuthors.memberId), ilike(schema.postAuthors.name, `%${q}%`))
    : isNull(schema.postAuthors.memberId);

  const rows = await db
    .select()
    .from(schema.postAuthors)
    .where(whereClause)
    .orderBy(schema.postAuthors.name)
    .limit(15);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id, memberId: r.memberId, name: r.name, bio: r.bio, avatarUrl: r.avatarUrl,
    })),
  });
}
