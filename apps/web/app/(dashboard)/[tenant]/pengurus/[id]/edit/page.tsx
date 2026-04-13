import { createTenantDb, db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OfficerForm } from "@/components/pengurus/officer-form";

export default async function PengurusEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: officerId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Fetch officer
  const [officer] = await tenantDb
    .select()
    .from(schema.officers)
    .where(eq(schema.officers.id, officerId))
    .limit(1);

  if (!officer) notFound();

  // Fetch member data untuk officer ini
  const [memberData] = await db
    .select({ id: members.id, name: members.name, memberNumber: members.memberNumber })
    .from(members)
    .where(eq(members.id, officer.memberId))
    .limit(1);

  // Fetch semua member tenant untuk combobox (tidak dipakai di edit, tapi dikirim untuk type consistency)
  const tenantId = access.tenant.id;
  const memberships = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, tenantId));

  const memberIds = memberships.map((m) => m.memberId);
  const allMembers = memberIds.length > 0
    ? await db
        .select({ id: members.id, name: members.name, memberNumber: members.memberNumber })
        .from(members)
        .where(inArray(members.id, memberIds))
        .orderBy(members.name)
    : [];

  // Fetch divisi aktif
  const divisions = await tenantDb
    .select({ id: schema.divisions.id, name: schema.divisions.name, code: schema.divisions.code })
    .from(schema.divisions)
    .where(eq(schema.divisions.isActive, true))
    .orderBy(schema.divisions.sortOrder, schema.divisions.name);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/pengurus`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Pengurus
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Edit Pengurus</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{memberData?.name ?? "—"}</p>
      </div>

      <OfficerForm
        slug={slug}
        officerId={officerId}
        members={allMembers}
        divisions={divisions.map((d) => ({ ...d, code: d.code ?? null }))}
        defaultValues={{
          memberId:    officer.memberId,
          memberName:  memberData?.name ?? "",
          divisionId:  officer.divisionId ?? "",
          position:    officer.position,
          periodStart: officer.periodStart,
          periodEnd:   officer.periodEnd ?? "",
          isActive:    officer.isActive,
          canSign:     officer.canSign,
          sortOrder:   officer.sortOrder,
          userId:      officer.userId ?? null,
        }}
      />
    </div>
  );
}
