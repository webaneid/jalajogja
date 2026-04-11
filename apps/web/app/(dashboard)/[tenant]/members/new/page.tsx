import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MemberForm } from "@/components/members/member-form";
import { createMemberAction } from "../actions";

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <Link
        href={`/${slug}/members`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke Daftar Anggota
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Tambah Anggota Baru</h1>

      <MemberForm slug={slug} onSubmit={createMemberAction} />
    </div>
  );
}
