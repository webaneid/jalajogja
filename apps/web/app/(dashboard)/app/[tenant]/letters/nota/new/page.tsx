import { createTenantDb, db, members, getSettings, refProvinces, refRegencies, refDistricts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LetterForm } from "@/components/letters/letter-form";
import type { AvailableOfficer } from "@/components/letters/signature-slot-manager";

export default async function NotaDinasNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const generalSettings = await getSettings(tenantClient, "general");
  const orgName = (generalSettings["site_name"] as string | undefined) ?? "";

  const [letterTypes, templates, rawOfficers, rawContacts] = await Promise.all([
    tenantDb.select({ id: schema.letterTypes.id, name: schema.letterTypes.name, code: schema.letterTypes.code, defaultCategory: schema.letterTypes.defaultCategory })
      .from(schema.letterTypes)
      .where(eq(schema.letterTypes.isActive, true))
      .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name),

    tenantDb.select({ id: schema.letterTemplates.id, name: schema.letterTemplates.name, type: schema.letterTemplates.type, subject: schema.letterTemplates.subject, body: schema.letterTemplates.body })
      .from(schema.letterTemplates)
      .where(eq(schema.letterTemplates.isActive, true))
      .orderBy(schema.letterTemplates.name),

    tenantDb.select({ id: schema.officers.id, memberId: schema.officers.memberId, position: schema.officers.position, divisionId: schema.officers.divisionId })
      .from(schema.officers)
      .where(eq(schema.officers.isActive, true))
      .orderBy(schema.officers.sortOrder, schema.officers.position),

    tenantDb.select({
      id: schema.letterContacts.id, name: schema.letterContacts.name, title: schema.letterContacts.title,
      organization: schema.letterContacts.organization, addressDetail: schema.letterContacts.addressDetail,
      provinceId: schema.letterContacts.provinceId, regencyId: schema.letterContacts.regencyId,
      districtId: schema.letterContacts.districtId, phone: schema.letterContacts.phone, email: schema.letterContacts.email,
    }).from(schema.letterContacts).orderBy(schema.letterContacts.name),
  ]);

  const memberIds = [...new Set(rawOfficers.map((o) => o.memberId))];
  const memberMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const rows = await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, memberIds));
    rows.forEach((m) => memberMap.set(m.id, m.name));
  }

  const divisionIds = rawOfficers.map((o) => o.divisionId).filter((x): x is string => !!x);
  const divisionMap = new Map<string, string>();
  const divisionNameMap = new Map<string, string>();
  if (divisionIds.length > 0) {
    const rows = await tenantDb.select({ id: schema.divisions.id, code: schema.divisions.code, name: schema.divisions.name }).from(schema.divisions).where(inArray(schema.divisions.id, divisionIds));
    rows.forEach((d) => { divisionMap.set(d.id, d.code ?? ""); divisionNameMap.set(d.id, d.name); });
  }

  const officerRoleMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const userRows = await tenantDb.select({ memberId: schema.users.memberId, role: schema.users.role }).from(schema.users).where(inArray(schema.users.memberId, memberIds));
    userRows.forEach((u) => { if (u.memberId) officerRoleMap.set(u.memberId, u.role); });
  }

  const officers = rawOfficers.map((o) => ({
    id: o.id, name: memberMap.get(o.memberId) ?? "—", position: o.position,
    divisionCode: o.divisionId ? (divisionMap.get(o.divisionId) ?? null) : null,
  }));

  const availableOfficers: AvailableOfficer[] = rawOfficers.map((o) => ({
    officerId:     o.id,
    name:          memberMap.get(o.memberId) ?? "—",
    position:      o.position,
    division:      o.divisionId ? (divisionNameMap.get(o.divisionId) ?? null) : null,
    userRole:      officerRoleMap.get(o.memberId) ?? null,
    canSign:       true,
    isCurrentUser: false,
  }));

  const cProvinceIds = [...new Set(rawContacts.map((c) => c.provinceId).filter((x): x is number => x != null))];
  const cRegencyIds  = [...new Set(rawContacts.map((c) => c.regencyId).filter((x): x is number => x != null))];
  const cDistrictIds = [...new Set(rawContacts.map((c) => c.districtId).filter((x): x is number => x != null))];

  const [cProvinceRows, cRegencyRows, cDistrictRows] = await Promise.all([
    cProvinceIds.length > 0 ? db.select({ id: refProvinces.id, name: refProvinces.name }).from(refProvinces).where(inArray(refProvinces.id, cProvinceIds)) : Promise.resolve([]),
    cRegencyIds.length  > 0 ? db.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies).where(inArray(refRegencies.id, cRegencyIds))   : Promise.resolve([]),
    cDistrictIds.length > 0 ? db.select({ id: refDistricts.id, name: refDistricts.name }).from(refDistricts).where(inArray(refDistricts.id, cDistrictIds)) : Promise.resolve([]),
  ]);

  const cProvinceMap = new Map(cProvinceRows.map((p) => [p.id, p.name]));
  const cRegencyMap  = new Map(cRegencyRows.map((r)  => [r.id, r.name]));
  const cDistrictMap = new Map(cDistrictRows.map((d) => [d.id, d.name]));

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center">
        <Link
          href={`/${slug}/letters/nota`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Nota Dinas
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Nota Dinas Baru</h1>
      </div>

      <LetterForm
        slug={slug}
        letterId={null}
        type="internal"
        orgName={orgName}
        letterTypes={letterTypes.map((t) => ({ ...t, code: t.code ?? null }))}
        templates={templates.map((t) => ({
          ...t, type: t.type ?? "internal", subject: t.subject ?? null, body: t.body ?? null,
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
            address:      parts.join(", ") || null,
            phone:        c.phone        ?? null,
            email:        c.email        ?? null,
          };
        })}
        defaultValues={{
          letterNumber:    "",
          typeId:          "",
          templateId:      "",
          issuerOfficerId: "",
          subject:         "",
          body:            "",
          sender:          "",
          recipient:       "",
          letterDate:      today,
          status:          "draft",
          paperSize:       "A4",
          mergeFields:     {},
          attachmentUrls:    [],
          attachmentLabel:   "",
          signatureLayout:   "double",
          signatureShowDate: true,
        }}
        availableOfficers={availableOfficers}
        initialSlots={[]}
      />
    </div>
  );
}
