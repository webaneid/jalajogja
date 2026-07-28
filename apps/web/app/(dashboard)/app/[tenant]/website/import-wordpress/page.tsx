import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { ImportWordPressClient } from "./import-wordpress-client";

export default async function ImportWordPressPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");
  if (!hasFullAccess(access.tenantUser, "website")) redirect(`/app/${slug}/dashboard`);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/app/${slug}/website/posts`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Posts
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Import dari WordPress</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload file export WXR atau tarik langsung dari situs WordPress lama — data akan
          diperiksa dulu sebelum benar-benar disimpan.
        </p>
      </div>

      <ImportWordPressClient slug={slug} />
    </div>
  );
}
