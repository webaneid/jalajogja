import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db, refVillages } from "@jalajogja/db";

export const revalidate = 86400; // 24 jam — data wilayah sangat jarang berubah

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get("district_id");

  if (!districtId) {
    return NextResponse.json({ error: "district_id diperlukan" }, { status: 400 });
  }
  const did = parseInt(districtId, 10);
  if (isNaN(did)) {
    return NextResponse.json({ error: "district_id harus berupa angka" }, { status: 400 });
  }

  const rows = await db
    .select({ id: refVillages.id, name: refVillages.name, type: refVillages.type })
    .from(refVillages)
    .where(and(eq(refVillages.districtId, did), eq(refVillages.isActive, true)))
    .orderBy(asc(refVillages.name));

  return NextResponse.json(rows);
}
