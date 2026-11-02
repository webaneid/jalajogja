// Halaman pengajuan menjadi Produsen (sisi anggota) — docs/arsitektur-pengajuan-produsen.md § 15.
// Server component: semua keputusan tampil (tutup / sudah produsen / form / menunggu) dihitung di server dari DB;
// klien hanya menerima data siap-tampil (tanpa path berkas).
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { Factory } from "lucide-react";
import { auth } from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { resolveApplicant, loadPageData } from "@/lib/producer-application.server";
import { getProducerAccessUngated } from "@/lib/producer-access.server";
import { ProducerApplicationClient } from "./producer-application-client";

type Params = Promise<{ tenant: string }>;

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function AkunProdusenPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/produsen`);

  const r = await resolveApplicant(slug);
  if (!r.ok && r.status === 404) notFound();

  const header = (
    <div className="flex items-center gap-3">
      <Factory className="h-6 w-6 text-primary" />
      <h1 className="text-xl font-semibold">Jadi Produsen</h1>
    </div>
  );

  if (!r.ok) {
    return <div className="space-y-6">{header}<Notice title="Pengajuan tidak tersedia">{r.error}</Notice></div>;
  }
  const a = r.a;

  // Sudah produsen: produsen aktif yang lolos akses → ke portal; selain itu (nonaktif / belum diberi akses) hubungi pengurus
  if (a.hasProducer) {
    if (await getProducerAccessUngated(slug)) redirect(`/app/${slug}/portal-produsen`);
    return <div className="space-y-6">{header}<Notice title="Anda sudah terdaftar sebagai produsen">Akses portal Anda belum aktif. Hubungi pengurus tenant ini.</Notice></div>;
  }

  const data = await loadPageData(a);
  return (
    <div className="space-y-6">
      {header}
      <ProducerApplicationClient
        slug={slug}
        baseUrl={baseUrl}
        enabled={data.enabled}
        open={data.open}
        last={data.last}
        sources={data.sources}
        originRegencyName={data.originRegencyName}
      />
    </div>
  );
}
