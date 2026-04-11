import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db, refProvinces } from "@jalajogja/db";

export const revalidate = 86400; // 24 jam — data wilayah sangat jarang berubah

export async function GET() {
  const rows = await db
    .select({ id: refProvinces.id, name: refProvinces.name })
    .from(refProvinces)
    .where(eq(refProvinces.isActive, true))
    .orderBy(asc(refProvinces.name));

  return NextResponse.json(rows);
}
