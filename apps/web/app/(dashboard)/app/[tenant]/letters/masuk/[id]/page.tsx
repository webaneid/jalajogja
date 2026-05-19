import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { renderBody } from "@/lib/letter-render";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  sent:     "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Terkirim", received: "Diterima", archived: "Diarsipkan",
};

export default async function SuratMasukDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "incoming") notFound();

  const [letterType] = letter.typeId
    ? await tenantDb
        .select({ name: schema.letterTypes.name })
        .from(schema.letterTypes)
        .where(eq(schema.letterTypes.id, letter.typeId))
        .limit(1)
    : [null];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/${slug}/letters/masuk`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Surat Masuk
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <h1 className="text-xl font-semibold flex-1">{letter.subject || "Tanpa Perihal"}</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[letter.status] ?? "bg-muted text-muted-foreground"}`}>
            {STATUS_LABELS[letter.status] ?? letter.status}
          </span>
        </div>
        {letter.letterNumber && (
          <p className="text-sm font-mono text-muted-foreground">{letter.letterNumber}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-border divide-y divide-border text-sm">
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Tanggal</span>
          <span>{letter.letterDate}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Pengirim</span>
          <span>{letter.sender || "—"}</span>
        </div>
        {letter.recipient && (
          <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
            <span className="text-muted-foreground">Kepada</span>
            <span>{letter.recipient}</span>
          </div>
        )}
        {letterType && (
          <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
            <span className="text-muted-foreground">Jenis</span>
            <span>{letterType.name}</span>
          </div>
        )}
      </div>

      {/* Isi / Ringkasan */}
      {letter.body && (
        <div>
          <h2 className="text-sm font-medium mb-2">Isi / Ringkasan</h2>
          <div
            className="rounded-lg border border-border bg-muted/10 px-6 py-5 text-sm leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderBody(letter.body) }}
          />
        </div>
      )}
    </div>
  );
}
