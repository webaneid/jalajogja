import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft, Pencil } from "lucide-react";
import { db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { DeleteMemberButton } from "./delete-button";

const STATUS_LABEL: Record<string, string> = { active: "Aktif", inactive: "Tidak Aktif", alumni: "Alumni" };
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-zinc-100 text-zinc-600",
  alumni: "bg-blue-100 text-blue-700",
};
const GENDER_LABEL: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3 border-b last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: memberId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Ambil member + data keanggotaan sekaligus
  const [row] = await db
    .select({
      id: members.id,
      memberNumber: members.memberNumber,
      stambukNumber: members.stambukNumber,
      nik: members.nik,
      name: members.name,
      gender: members.gender,
      birthPlace: members.birthPlace,
      birthDate: members.birthDate,
      phone: members.phone,
      email: members.email,
      address: members.address,
      status: tenantMemberships.status,
      joinedAt: tenantMemberships.joinedAt,
      registeredVia: tenantMemberships.registeredVia,
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

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <Link
        href={`/${slug}/members`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Daftar Anggota
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{row.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status ?? "active"]}`}>
              {STATUS_LABEL[row.status ?? "active"]}
            </span>
            {row.memberNumber && (
              <span className="font-mono text-xs text-muted-foreground">{row.memberNumber}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/${slug}/members/${memberId}/edit`}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm
                       font-medium hover:bg-accent transition-colors"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <DeleteMemberButton slug={slug} memberId={memberId} memberName={row.name} />
        </div>
      </div>

      {/* Data Identitas */}
      <section className="rounded-xl border bg-card p-5 mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identitas Pribadi
        </h2>
        <dl>
          <Row label="Nomor Stambuk" value={row.stambukNumber} />
          <Row label="NIK" value={row.nik} />
          <Row label="Jenis Kelamin" value={row.gender ? GENDER_LABEL[row.gender] : null} />
          <Row label="Tempat Lahir" value={row.birthPlace} />
          <Row label="Tanggal Lahir" value={row.birthDate} />
        </dl>
      </section>

      {/* Kontak */}
      <section className="rounded-xl border bg-card p-5 mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Kontak
        </h2>
        <dl>
          <Row label="Telepon" value={row.phone} />
          <Row label="Email" value={row.email} />
          <Row label="Alamat" value={row.address} />
        </dl>
      </section>

      {/* Keanggotaan */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Keanggotaan
        </h2>
        <dl>
          <Row label="Status" value={STATUS_LABEL[row.status ?? "active"]} />
          <Row label="Bergabung" value={row.joinedAt ?? undefined} />
          <Row label="Didaftarkan via" value={row.registeredVia ?? undefined} />
        </dl>
      </section>
    </div>
  );
}
