import { createTenantDb, db, members, getSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LetterForm } from "@/components/letters/letter-form";

export default async function NotaDinasEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "internal") notFound();

  // Ambil nama organisasi untuk field Pengirim (auto-set dari settings)
  const generalSettings = await getSettings(tenantClient, "general");
  const orgName = (generalSettings["site_name"] as string | undefined) ?? "";

  // Fetch jenis surat aktif
  const letterTypes = await tenantDb
    .select({ id: schema.letterTypes.id, name: schema.letterTypes.name, code: schema.letterTypes.code, defaultCategory: schema.letterTypes.defaultCategory })
    .from(schema.letterTypes)
    .where(eq(schema.letterTypes.isActive, true))
    .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name);

  // Fetch template konten aktif (internal + outgoing)
  const templates = await tenantDb
    .select({ id: schema.letterTemplates.id, name: schema.letterTemplates.name, type: schema.letterTemplates.type, subject: schema.letterTemplates.subject, body: schema.letterTemplates.body })
    .from(schema.letterTemplates)
    .where(eq(schema.letterTemplates.isActive, true))
    .orderBy(schema.letterTemplates.name);

  // Fetch semua officer aktif dengan kode divisi
  const rawOfficers = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
    })
    .from(schema.officers)
    .where(eq(schema.officers.isActive, true))
    .orderBy(schema.officers.sortOrder, schema.officers.position);

  // Fetch nama member dari public.members
  const memberIds = [...new Set(rawOfficers.map((o) => o.memberId))];
  const memberMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const memberRows = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(inArray(members.id, memberIds));
    memberRows.forEach((m) => memberMap.set(m.id, m.name));
  }

  // Fetch kode divisi
  const divisionIds = rawOfficers.map((o) => o.divisionId).filter((x): x is string => !!x);
  const divisionMap = new Map<string, string>();
  if (divisionIds.length > 0) {
    const divisionRows = await tenantDb
      .select({ id: schema.divisions.id, code: schema.divisions.code })
      .from(schema.divisions)
      .where(inArray(schema.divisions.id, divisionIds));
    divisionRows.forEach((d) => divisionMap.set(d.id, d.code ?? ""));
  }

  const officers = rawOfficers.map((o) => ({
    id:           o.id,
    name:         memberMap.get(o.memberId) ?? "—",
    position:     o.position,
    divisionCode: o.divisionId ? (divisionMap.get(o.divisionId) ?? null) : null,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/letters/nota`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Nota Dinas
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">
          {letter.subject?.trim() ? letter.subject : "Nota Dinas Baru"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {letter.letterNumber ?? "Nomor belum diisi"}
        </p>
      </div>

      <LetterForm
        slug={slug}
        letterId={letterId}
        type="internal"
        orgName={orgName}
        letterTypes={letterTypes.map((t) => ({ ...t, code: t.code ?? null }))}
        templates={templates.map((t) => ({
          ...t,
          type:    t.type ?? "internal",
          subject: t.subject ?? null,
          body:    t.body    ?? null,
        }))}
        officers={officers}
        defaultValues={{
          letterNumber:    letter.letterNumber ?? "",
          typeId:          letter.typeId       ?? "",
          templateId:      letter.templateId   ?? "",
          issuerOfficerId: (letter as { issuerOfficerId?: string | null }).issuerOfficerId ?? "",
          subject:         letter.subject,
          body:            letter.body ?? "",
          sender:          letter.sender,
          recipient:       letter.recipient,
          letterDate:      letter.letterDate,
          status:          letter.status as "draft" | "sent" | "received" | "archived",
          paperSize:       (letter.paperSize as "A4" | "F4" | "Letter") ?? "A4",
          mergeFields:     (letter.mergeFields as Record<string, string>) ?? {},
          attachmentUrls:  (letter.attachmentUrls as string[]) ?? [],
        }}
      />
    </div>
  );
}
