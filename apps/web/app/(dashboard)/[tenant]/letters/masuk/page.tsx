import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { LetterListClient } from "@/components/letters/letter-list-client";

export default async function SuratMasukPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const letters = await tenantDb
    .select({
      id:           schema.letters.id,
      letterNumber: schema.letters.letterNumber,
      subject:      schema.letters.subject,
      sender:       schema.letters.sender,
      recipient:    schema.letters.recipient,
      letterDate:   schema.letters.letterDate,
      status:       schema.letters.status,
      createdAt:    schema.letters.createdAt,
    })
    .from(schema.letters)
    .where(eq(schema.letters.type, "incoming"))
    .orderBy(desc(schema.letters.createdAt));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Surat Masuk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{letters.length} surat</p>
      </div>

      <LetterListClient
        slug={slug}
        type="incoming"
        initialLetters={letters.map((l) => ({
          ...l,
          letterNumber: l.letterNumber ?? null,
        }))}
      />
    </div>
  );
}
