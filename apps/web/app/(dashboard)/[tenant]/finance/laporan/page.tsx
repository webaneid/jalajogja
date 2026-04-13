import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LaporanClient } from "@/components/keuangan/laporan-client";

export default async function LaporanPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const accounts = await db
    .select({
      id:   schema.accounts.id,
      code: schema.accounts.code,
      name: schema.accounts.name,
      type: schema.accounts.type,
    })
    .from(schema.accounts)
    .where(eq(schema.accounts.isActive, true))
    .orderBy(schema.accounts.code);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Laporan Keuangan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate laporan keuangan berdasarkan periode dan jenis laporan yang dipilih.
        </p>
      </div>

      <LaporanClient slug={slug} accounts={accounts} />
    </div>
  );
}
