import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db, refDistricts } from "@jalajogja/db";

export const revalidate = 86400; // 24 jam — data wilayah sangat jarang berubah

export async function GET(request: NextRequest) {
  const regencyId = request.nextUrl.searchParams.get("regency_id");

  if (!regencyId) {
    return NextResponse.json({ error: "regency_id diperlukan" }, { status: 400 });
  }
  const rid = parseInt(regencyId, 10);
  if (isNaN(rid)) {
    return NextResponse.json({ error: "regency_id harus berupa angka" }, { status: 400 });
  }

  const rows = await db
    .select({ id: refDistricts.id, name: refDistricts.name })
    .from(refDistricts)
    .where(and(eq(refDistricts.regencyId, rid), eq(refDistricts.isActive, true)))
    .orderBy(asc(refDistricts.name));

  return NextResponse.json(rows);
}
