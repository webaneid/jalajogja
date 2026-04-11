import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db, refProfessions } from "@jalajogja/db";

export const revalidate = 86400; // 24 jam — data profesi sangat jarang berubah

export async function GET() {
  const rows = await db
    .select()
    .from(refProfessions)
    .orderBy(asc(refProfessions.order), asc(refProfessions.name));

  return NextResponse.json(rows);
}
