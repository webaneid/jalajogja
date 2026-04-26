import { NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { asc } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json([], { status: 400 });

  try {
    const { db, schema } = createTenantDb(slug);
    const rows = await db
      .select({ id: schema.postCategories.id, name: schema.postCategories.name })
      .from(schema.postCategories)
      .orderBy(asc(schema.postCategories.name));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
