import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq, asc } from "drizzle-orm";
import { db, refProfessions, tenants } from "@jalajogja/db";
import { MemberWizardShell } from "@/components/members/wizard/member-wizard-shell";

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // Fetch tenant + professions secara paralel — keduanya statis/jarang berubah
  const [tenantRow, professions] = await Promise.all([
    db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(refProfessions)
      .orderBy(asc(refProfessions.order), asc(refProfessions.name)),
  ]);

  // Seharusnya tidak terjadi — layout sudah verifikasi tenant valid
  if (!tenantRow) return null;

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Link
        href={`/${slug}/members`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke Daftar Anggota
      </Link>

      <h1 className="mb-8 text-2xl font-bold">Tambah Anggota Baru</h1>

      <MemberWizardShell
        slug={slug}
        tenantId={tenantRow.id}
        tenantName={tenantRow.name}
        professions={professions}
      />
    </div>
  );
}
