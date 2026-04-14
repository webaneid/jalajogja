import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { LetterForm } from "@/components/letters/letter-form";

export default async function SuratKeluarEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "outgoing") notFound();

  const isAdmin = ["owner", "admin"].includes(access.tenantUser.role);

  // Fetch jenis surat aktif
  const letterTypes = await tenantDb
    .select({ id: schema.letterTypes.id, name: schema.letterTypes.name, code: schema.letterTypes.code, defaultCategory: schema.letterTypes.defaultCategory })
    .from(schema.letterTypes)
    .where(eq(schema.letterTypes.isActive, true))
    .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name);

  // Fetch template
  const templates = await tenantDb
    .select({ id: schema.letterTemplates.id, name: schema.letterTemplates.name, isDefault: schema.letterTemplates.isDefault })
    .from(schema.letterTemplates)
    .orderBy(schema.letterTemplates.name);

  // Fetch pengurus yang bisa tanda tangan
  const signers = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
    })
    .from(schema.officers)
    .where(eq(schema.officers.canSign, true));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/letters/keluar/${letterId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Detail Surat
        </Link>
        {isAdmin && !letter.isBulk && (
          <Link
            href={`/${slug}/letters/keluar/${letterId}/bulk`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <Users className="h-3.5 w-3.5" />
            Kirim Massal
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-xl font-semibold">
          {letter.subject?.trim() ? letter.subject : "Surat Baru"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {letter.letterNumber ?? "Nomor belum diisi"}
        </p>
      </div>

      <LetterForm
        slug={slug}
        letterId={letterId}
        type="outgoing"
        letterTypes={letterTypes.map((t) => ({ ...t, code: t.code ?? null }))}
        templates={templates}
        signers={signers}
        defaultValues={{
          letterNumber:   letter.letterNumber ?? "",
          typeId:         letter.typeId ?? "",
          templateId:     letter.templateId ?? "",
          subject:        letter.subject,
          body:           letter.body ?? "",
          sender:         letter.sender,
          recipient:      letter.recipient,
          letterDate:     letter.letterDate,
          status:         letter.status as "draft" | "sent" | "received" | "archived",
          paperSize:      (letter.paperSize as "A4" | "F4" | "Letter") ?? "A4",
          mergeFields:    (letter.mergeFields as Record<string, string>) ?? {},
          attachmentUrls: (letter.attachmentUrls as string[]) ?? [],
        }}
      />
    </div>
  );
}
