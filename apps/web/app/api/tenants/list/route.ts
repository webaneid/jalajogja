import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db, tenants } from "@jalajogja/db";

export async function GET() {
  const rows = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .orderBy(asc(tenants.name));

  return NextResponse.json(rows);
}
