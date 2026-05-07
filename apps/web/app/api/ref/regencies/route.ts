import { NextRequest, NextResponse }    from "next/server";
import { eq, and, asc, ilike }          from "drizzle-orm";
import { db, refRegencies, refProvinces } from "@jalajogja/db";

export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provinceId = searchParams.get("province_id");
  const search     = searchParams.get("search")?.trim();

  // ── Mode search: cari kabupaten/kota by nama (tanpa province_id) ──────────
  if (search) {
    if (search.length < 2)
      return NextResponse.json([]);

    const rows = await db
      .select({
        id:           refRegencies.id,
        name:         refRegencies.name,
        type:         refRegencies.type,
        provinceName: refProvinces.name,
      })
      .from(refRegencies)
      .innerJoin(refProvinces, eq(refProvinces.id, refRegencies.provinceId))
      .where(and(
        eq(refRegencies.isActive, true),
        ilike(refRegencies.name, `%${search}%`),
      ))
      .orderBy(asc(refRegencies.name))
      .limit(15);

    return NextResponse.json(rows);
  }

  // ── Mode filter: ambil semua kabupaten di satu provinsi ───────────────────
  if (!provinceId)
    return NextResponse.json({ error: "province_id atau search diperlukan" }, { status: 400 });

  const pid = parseInt(provinceId, 10);
  if (isNaN(pid))
    return NextResponse.json({ error: "province_id harus berupa angka" }, { status: 400 });

  const rows = await db
    .select({ id: refRegencies.id, name: refRegencies.name, type: refRegencies.type })
    .from(refRegencies)
    .where(and(eq(refRegencies.provinceId, pid), eq(refRegencies.isActive, true)))
    .orderBy(asc(refRegencies.name));

  return NextResponse.json(rows);
}
