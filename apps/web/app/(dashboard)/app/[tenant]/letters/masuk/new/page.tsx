import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { IncomingLetterForm } from "@/components/letters/incoming-letter-form";

export default async function SuratMasukNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Fetch jenis surat aktif
  const letterTypes = await tenantDb
    .select({ id: schema.letterTypes.id, name: schema.letterTypes.name, code: schema.letterTypes.code })
    .from(schema.letterTypes)
    .where(eq(schema.letterTypes.isActive, true))
    .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/letters/masuk`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Surat Masuk
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Catat Surat Masuk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Rekam surat yang diterima</p>
      </div>

      <IncomingLetterForm
        slug={slug}
        letterTypes={letterTypes.map((t) => ({ ...t, code: t.code ?? null }))}
      />
    </div>
  );
}
