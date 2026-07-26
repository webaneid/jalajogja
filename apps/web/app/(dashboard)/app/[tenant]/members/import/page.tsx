import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { ImportClient } from "./import-client";

export default async function MembersImportPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");
  if (!hasFullAccess(access.tenantUser, "anggota")) redirect(`/app/${slug}/dashboard`);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/app/${slug}/members`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Anggota
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Import Anggota</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload database Excel — data akan diperiksa dulu sebelum benar-benar disimpan.
        </p>
      </div>

      <ImportClient slug={slug} />
    </div>
  );
}
