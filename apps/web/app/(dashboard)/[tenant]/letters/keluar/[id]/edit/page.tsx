import { createTenantDb, db, members, getSettings, refProvinces, refRegencies, refDistricts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
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

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "outgoing") notFound();

  const isAdmin = ["owner", "admin"].includes(access.tenantUser.role);

  // Ambil nama organisasi untuk field Pengirim (auto-set dari settings)
  const generalSettings = await getSettings(tenantClient, "general");
  const orgName = (generalSettings["site_name"] as string | undefined) ?? "";

  // Fetch jenis surat aktif
  const letterTypes = await tenantDb
    .select({ id: schema.letterTypes.id, name: schema.letterTypes.name, code: schema.letterTypes.code, defaultCategory: schema.letterTypes.defaultCategory })
    .from(schema.letterTypes)
    .where(eq(schema.letterTypes.isActive, true))
    .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name);

  // Fetch template konten aktif (hanya outgoing)
  const templates = await tenantDb
    .select({ id: schema.letterTemplates.id, name: schema.letterTemplates.name, type: schema.letterTemplates.type, subject: schema.letterTemplates.subject, body: schema.letterTemplates.body })
    .from(schema.letterTemplates)
    .where(eq(schema.letterTemplates.isActive, true))
    .orderBy(schema.letterTemplates.name);

  // Fetch semua officer aktif dengan kode divisi (untuk "Yang Mengeluarkan")
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
    id:          o.id,
    name:        memberMap.get(o.memberId) ?? "—",
    position:    o.position,
    divisionCode: o.divisionId ? (divisionMap.get(o.divisionId) ?? null) : null,
  }));

  // Fetch kontak surat untuk autocomplete field Kepada
  const rawContacts = await tenantDb
    .select({
      id:           schema.letterContacts.id,
      name:         schema.letterContacts.name,
      title:        schema.letterContacts.title,
      organization: schema.letterContacts.organization,
      addressDetail: schema.letterContacts.addressDetail,
      provinceId:   schema.letterContacts.provinceId,
      regencyId:    schema.letterContacts.regencyId,
      districtId:   schema.letterContacts.districtId,
      phone:        schema.letterContacts.phone,
      email:        schema.letterContacts.email,
    })
    .from(schema.letterContacts)
    .orderBy(schema.letterContacts.name);

  // Resolve nama wilayah untuk address display di RecipientCombobox
  const cProvinceIds = [...new Set(rawContacts.map((c) => c.provinceId).filter((x): x is number => x != null))];
  const cRegencyIds  = [...new Set(rawContacts.map((c) => c.regencyId).filter((x): x is number => x != null))];
  const cDistrictIds = [...new Set(rawContacts.map((c) => c.districtId).filter((x): x is number => x != null))];

  const [cProvinceRows, cRegencyRows, cDistrictRows] = await Promise.all([
    cProvinceIds.length > 0 ? db.select({ id: refProvinces.id, name: refProvinces.name }).from(refProvinces).where(inArray(refProvinces.id, cProvinceIds)) : Promise.resolve([]),
    cRegencyIds.length  > 0 ? db.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies).where(inArray(refRegencies.id, cRegencyIds)) : Promise.resolve([]),
    cDistrictIds.length > 0 ? db.select({ id: refDistricts.id, name: refDistricts.name }).from(refDistricts).where(inArray(refDistricts.id, cDistrictIds)) : Promise.resolve([]),
  ]);

  const cProvinceMap = new Map(cProvinceRows.map((p) => [p.id, p.name]));
  const cRegencyMap  = new Map(cRegencyRows.map((r) => [r.id, r.name]));
  const cDistrictMap = new Map(cDistrictRows.map((d) => [d.id, d.name]));

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
        orgName={orgName}
        letterTypes={letterTypes.map((t) => ({ ...t, code: t.code ?? null }))}
        templates={templates.map((t) => ({
          ...t,
          type:    t.type ?? "outgoing",
          subject: t.subject ?? null,
          body:    t.body    ?? null,
        }))}
        officers={officers}
        contacts={rawContacts.map((c) => {
          const parts = [
            c.addressDetail,
            c.districtId ? cDistrictMap.get(c.districtId) : null,
            c.regencyId  ? cRegencyMap.get(c.regencyId)   : null,
            c.provinceId ? cProvinceMap.get(c.provinceId) : null,
          ].filter(Boolean);
          return {
            id:           c.id,
            name:         c.name,
            title:        c.title        ?? null,
            organization: c.organization ?? null,
            address:      parts.length > 0 ? parts.join(", ") : null,
            phone:        c.phone        ?? null,
            email:        c.email        ?? null,
          };
        })}
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
          attachmentLabel: (letter as { attachmentLabel?: string | null }).attachmentLabel ?? "",
        }}
      />
    </div>
  );
}
