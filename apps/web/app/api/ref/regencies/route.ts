import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db, refRegencies } from "@jalajogja/db";

export const revalidate = 86400; // 24 jam — data wilayah sangat jarang berubah

export async function GET(request: NextRequest) {
  const provinceId = request.nextUrl.searchParams.get("province_id");

  if (!provinceId) {
    return NextResponse.json({ error: "province_id diperlukan" }, { status: 400 });
  }
  const pid = parseInt(provinceId, 10);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "province_id harus berupa angka" }, { status: 400 });
  }

  const rows = await db
    .select({ id: refRegencies.id, name: refRegencies.name, type: refRegencies.type })
    .from(refRegencies)
    .where(and(eq(refRegencies.provinceId, pid), eq(refRegencies.isActive, true)))
    .orderBy(asc(refRegencies.name));

  return NextResponse.json(rows);
}
