import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LetterTemplateForm } from "@/components/letters/letter-template-form";

export default async function TemplateNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/letters/template`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Template
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Template Baru</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buat template konten surat (perihal + isi) untuk dipilih saat buat surat</p>
      </div>

      <LetterTemplateForm slug={slug} />
    </div>
  );
}
