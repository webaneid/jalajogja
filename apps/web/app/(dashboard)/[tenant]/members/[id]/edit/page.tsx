import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { MemberForm } from "@/components/members/member-form";
import { updateMemberAction } from "../../actions";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: memberId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const [row] = await db
    .select({
      name: members.name,
      stambukNumber: members.stambukNumber,
      nik: members.nik,
      gender: members.gender,
      birthPlace: members.birthPlace,
      birthDate: members.birthDate,
      phone: members.phone,
      email: members.email,
      address: members.address,
      status: tenantMemberships.status,
      joinedAt: tenantMemberships.joinedAt,
    })
    .from(members)
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, access.tenant.id)
      )
    )
    .where(eq(members.id, memberId))
    .limit(1);

  if (!row) notFound();

  // Bind memberId ke updateMemberAction agar form tidak perlu tahu
  async function handleUpdate(slug: string, data: Parameters<typeof updateMemberAction>[2]) {
    "use server";
    return updateMemberAction(slug, memberId, data);
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href={`/${slug}/members/${memberId}`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke Detail
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Edit Anggota</h1>

      <MemberForm
        slug={slug}
        memberId={memberId}
        defaultValues={{
          name: row.name,
          stambukNumber: row.stambukNumber ?? undefined,
          nik: row.nik ?? undefined,
          gender: row.gender as "male" | "female" | undefined,
          birthPlace: row.birthPlace ?? undefined,
          birthDate: row.birthDate ?? undefined,
          phone: row.phone ?? undefined,
          email: row.email ?? undefined,
          address: row.address ?? undefined,
          status: row.status as "active" | "inactive" | "alumni" | undefined,
          joinedAt: row.joinedAt ?? undefined,
        }}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
