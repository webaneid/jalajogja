import { createTenantDb, db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Plus, UserCheck, UserX, PenLine } from "lucide-react";

function formatDate(d: string | null | undefined) {
  if (!d) return "sekarang";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PengurusPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Fetch semua officer + division
  const officers = await tenantDb
    .select({
      id:          schema.officers.id,
      memberId:    schema.officers.memberId,
      divisionId:  schema.officers.divisionId,
      position:    schema.officers.position,
      periodStart: schema.officers.periodStart,
      periodEnd:   schema.officers.periodEnd,
      isActive:    schema.officers.isActive,
      canSign:     schema.officers.canSign,
      sortOrder:   schema.officers.sortOrder,
    })
    .from(schema.officers)
    .orderBy(schema.officers.sortOrder, schema.officers.position);

  // Fetch semua division
  const divisions = await tenantDb
    .select({
      id:   schema.divisions.id,
      name: schema.divisions.name,
      code: schema.divisions.code,
    })
    .from(schema.divisions)
    .where(eq(schema.divisions.isActive, true))
    .orderBy(schema.divisions.sortOrder, schema.divisions.name);

  // Fetch data member dari public.members
  const memberIds = [...new Set(officers.map((o) => o.memberId))];
  const memberMap = new Map<string, { name: string; photoUrl: string | null; memberNumber: string | null }>();

  if (memberIds.length > 0) {
    const memberRows = await db
      .select({
        id:           members.id,
        name:         members.name,
        photoUrl:     members.photoUrl,
        memberNumber: members.memberNumber,
      })
      .from(members)
      .where(inArray(members.id, memberIds));

    memberRows.forEach((m) => memberMap.set(m.id, m));
  }

  const divisionMap = new Map(divisions.map((d) => [d.id, d]));

  // Kelompokkan officer per divisi
  const grouped = new Map<string | null, typeof officers>();
  officers.forEach((o) => {
    const key = o.divisionId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(o);
  });

  const orderedGroups: Array<{ divisionId: string | null; divisionName: string; divisionCode: string | null; officers: typeof officers }> = [];

  // Divisi yang ada
  divisions.forEach((div) => {
    const list = grouped.get(div.id) ?? [];
    orderedGroups.push({ divisionId: div.id, divisionName: div.name, divisionCode: div.code, officers: list });
  });

  // Tanpa divisi
  const noDivision = grouped.get(null) ?? [];
  if (noDivision.length > 0) {
    orderedGroups.push({ divisionId: null, divisionName: "Tanpa Divisi", divisionCode: null, officers: noDivision });
  }

  const totalActive   = officers.filter((o) => o.isActive).length;
  const totalInactive = officers.length - totalActive;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Daftar Pengurus</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalActive} aktif · {totalInactive} non-aktif
          </p>
        </div>
        <Link
          href={`/${slug}/pengurus/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengurus
        </Link>
      </div>

      {/* List per divisi */}
      {officers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Belum ada pengurus.</p>
          <Link href={`/${slug}/pengurus/new`} className="mt-2 inline-block text-sm text-primary hover:underline">
            Tambah pengurus pertama
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedGroups.map((group) => (
            group.officers.length === 0 ? null : (
              <div key={group.divisionId ?? "none"}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold">{group.divisionName}</h2>
                  {group.divisionCode && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      {group.divisionCode}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {group.officers.map((officer) => {
                    const member = memberMap.get(officer.memberId);
                    return (
                      <div key={officer.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-muted shrink-0 overflow-hidden flex items-center justify-center text-sm font-medium text-muted-foreground">
                          {member?.photoUrl
                            ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                            : (member?.name?.[0] ?? "?")}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {officer.position}
                            {member?.memberNumber && (
                              <span className="ml-2 font-mono">#{member.memberNumber}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(officer.periodStart)} — {formatDate(officer.periodEnd)}
                          </p>
                        </div>

                        {/* Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {officer.canSign && (
                            <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                              Penandatangan
                            </span>
                          )}
                          {officer.isActive
                            ? <UserCheck className="h-4 w-4 text-green-600" />
                            : <UserX    className="h-4 w-4 text-zinc-400" />
                          }
                        </div>

                        {/* Edit */}
                        <Link
                          href={`/${slug}/pengurus/${officer.id}/edit`}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <PenLine className="h-4 w-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
