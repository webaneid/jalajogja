import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTenantAccess } from "@/lib/tenant";
import { AkunFormClient } from "./akun-form-client";

export default async function AkunNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  return (
    <div className="p-6 max-w-lg space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${slug}/akun`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Akun Publik
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Tambah Akun Publik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daftarkan pengguna baru secara manual. Email dan nomor HP harus unik.
        </p>
      </div>

      <AkunFormClient slug={slug} />
    </div>
  );
}
