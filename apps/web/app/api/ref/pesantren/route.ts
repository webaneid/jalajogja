// GET /api/ref/pesantren?search=&limit=20
// Cari pesantren aktif dari direktori public — untuk combobox di wizard anggota
// Tidak perlu filter tenant — pesantren adalah data publik ekosistem

import { NextRequest, NextResponse } from "next/server";
import { db, pesantren } from "@jalajogja/db";
import { ilike, eq, and, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const limit  = Math.min(30, parseInt(searchParams.get("limit") ?? "20", 10));

  const whereClause = search.length >= 2
    ? and(
        eq(pesantren.status, "aktif"),
        or(
          ilike(pesantren.name, `%${search}%`),
          ilike(pesantren.popularName, `%${search}%`)
        )
      )
    : eq(pesantren.status, "aktif");

  const rows = await db
    .select({
      id:          pesantren.id,
      name:        pesantren.name,
      popularName: pesantren.popularName,
      sistem:      pesantren.sistem,
    })
    .from(pesantren)
    .where(whereClause)
    .orderBy(pesantren.name)
    .limit(limit);

  return NextResponse.json({ data: rows });
}
