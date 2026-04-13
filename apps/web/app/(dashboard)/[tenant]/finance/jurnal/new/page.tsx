import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { JournalForm } from "@/components/keuangan/journal-form";

export default async function JurnalNewPage({
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
    })
    .from(schema.accounts)
    .where(eq(schema.accounts.isActive, true))
    .orderBy(schema.accounts.code);

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          href={`/${slug}/finance/jurnal`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Jurnal
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Buat Jurnal Manual</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Jurnal harus balance (total debit = total kredit). Setelah disimpan tidak bisa diubah.
        </p>
      </div>

      <JournalForm slug={slug} accounts={accounts} />
    </div>
  );
}
