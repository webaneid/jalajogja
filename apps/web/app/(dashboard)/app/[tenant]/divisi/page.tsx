import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { PengurusNav } from "@/components/pengurus/pengurus-nav";
import { DivisionManageClient } from "@/components/pengurus/division-manage-client";

export default async function DivisiPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const divisions = await tenantDb
    .select({
      id:           schema.divisions.id,
      name:         schema.divisions.name,
      code:         schema.divisions.code,
      description:  schema.divisions.description,
      parentId:     schema.divisions.parentId,
      sortOrder:    schema.divisions.sortOrder,
      isActive:     schema.divisions.isActive,
      officerCount: sql<number>`COUNT(${schema.officers.id})::int`,
    })
    .from(schema.divisions)
    .leftJoin(schema.officers, eq(schema.officers.divisionId, schema.divisions.id))
    .groupBy(
      schema.divisions.id,
      schema.divisions.name,
      schema.divisions.code,
      schema.divisions.description,
      schema.divisions.parentId,
      schema.divisions.sortOrder,
      schema.divisions.isActive,
    )
    .orderBy(schema.divisions.sortOrder, schema.divisions.name);

  return (
    <div className="flex min-h-screen">
      <PengurusNav slug={slug} />
      <main className="flex-1 min-w-0 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Divisi / Bidang</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {divisions.length} divisi
          </p>
        </div>

        <DivisionManageClient
          slug={slug}
          initialDivisions={divisions.map((d) => ({
            ...d,
            code:        d.code        ?? null,
            description: d.description ?? null,
            parentId:    d.parentId    ?? null,
          }))}
        />
      </main>
    </div>
  );
}
