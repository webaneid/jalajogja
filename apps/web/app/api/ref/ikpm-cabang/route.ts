export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db, refIkpmCabang } from "@jalajogja/db";
import { eq } from "drizzle-orm";

// GET /api/ref/ikpm-cabang — daftar semua PC IKPM aktif (untuk dropdown)
export async function GET() {
  const rows = await db
    .select({ id: refIkpmCabang.id, nama: refIkpmCabang.nama })
    .from(refIkpmCabang)
    .where(eq(refIkpmCabang.isActive, true))
    .orderBy(refIkpmCabang.nama);

  return NextResponse.json(rows);
}
