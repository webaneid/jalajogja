import { createTenantDb, db, members, tenantMemberships, contacts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OfficerForm } from "@/components/pengurus/officer-form";

export default async function PengurusNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);
  const tenantId = access.tenant.id;

  // Fetch anggota aktif + email dari contacts
  const memberships = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, tenantId));

  const memberIds = memberships.map((m) => m.memberId);

  let allMembers: { id: string; name: string; memberNumber: string | null; email: string | null }[] = [];
  if (memberIds.length > 0) {
    allMembers = await db
      .select({
        id:           members.id,
        name:         members.name,
        memberNumber: members.memberNumber,
        email:        contacts.email,
      })
      .from(members)
      .leftJoin(contacts, eq(contacts.id, members.contactId))
      .where(inArray(members.id, memberIds))
      .orderBy(members.name);
  }

  // Fetch divisi aktif
  const divisions = await tenantDb
    .select({ id: schema.divisions.id, name: schema.divisions.name, code: schema.divisions.code })
    .from(schema.divisions)
    .where(eq(schema.divisions.isActive, true))
    .orderBy(schema.divisions.sortOrder, schema.divisions.name);

  // Fetch custom roles
  const customRoles = await tenantDb
    .select({ id: schema.customRoles.id, name: schema.customRoles.name })
    .from(schema.customRoles)
    .orderBy(schema.customRoles.name);

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
        <h1 className="text-xl font-semibold">Tambah Pengurus</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pilih anggota, isi jabatan, dan opsional aktifkan akses dashboard sekaligus.
        </p>
      </div>

      <OfficerForm
        slug={slug}
        members={allMembers}
        divisions={divisions.map((d) => ({ ...d, code: d.code ?? null }))}
        customRoles={customRoles}
      />
    </div>
  );
}
