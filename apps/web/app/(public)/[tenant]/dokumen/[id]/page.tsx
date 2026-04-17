// Halaman publik dokumen — tanpa auth, hanya untuk visibility=public
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FileText, FolderOpen, Tag, Globe, FileDown } from "lucide-react";

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(d));
}

function mimeLabel(mime: string | null) {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("openxmlformats")) return "DOCX";
  return mime.split("/")[1]?.toUpperCase() ?? "—";
}

export default async function PublicDokumenPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: tenantSlug, id: docId } = await params;

  // Cek tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(tenantSlug);

  const [doc] = await tenantDb
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, docId))
    .limit(1);

  // Dokumen tidak ditemukan atau internal → tampilkan halaman "tidak tersedia"
  if (!doc) notFound();

  if (doc.visibility === "internal") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-3">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <h1 className="text-lg font-semibold">Dokumen Tidak Tersedia</h1>
          <p className="text-sm text-muted-foreground">
            Dokumen ini bersifat internal dan tidak dapat diakses oleh publik.
          </p>
        </div>
      </div>
    );
  }

  // Fetch versi aktif
  const [currentVersion] = doc.currentVersionId
    ? await tenantDb
        .select()
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.id, doc.currentVersionId))
        .limit(1)
    : [null];

  // Fetch kategori
  const [category] = doc.categoryId
    ? await tenantDb
        .select({ name: schema.documentCategories.name })
        .from(schema.documentCategories)
        .where(eq(schema.documentCategories.id, doc.categoryId))
        .limit(1)
    : [null];

  const isPdf = currentVersion?.mimeType?.includes("pdf") ?? false;
  const fileUrl = `/api/documents/${docId}/file?slug=${tenantSlug}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{tenant.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Judul + badge */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">
              <Globe className="h-3 w-3" /> Dokumen Publik
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{doc.title}</h1>
          {doc.description && (
            <p className="text-muted-foreground">{doc.description}</p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {category && (
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4" />
              {category.name}
            </span>
          )}
          {doc.tags.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              {doc.tags.join(", ")}
            </span>
          )}
          <span>Diperbarui {formatDate(doc.updatedAt)}</span>
        </div>

        {/* File card */}
        {currentVersion ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="h-10 w-10 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentVersion.fileName}</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{mimeLabel(currentVersion.mimeType)}</span>
                  <span>{formatBytes(currentVersion.fileSize)}</span>
                  <span>v{currentVersion.versionNumber}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isPdf && (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                    <FileText className="h-4 w-4" />
                    Buka PDF
                  </button>
                </a>
              )}
              <a href={fileUrl} download>
                <button className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                  <FileDown className="h-4 w-4" />
                  Download
                </button>
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            File belum tersedia.
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-12 px-6 py-4 text-center text-xs text-muted-foreground">
        {tenant.name} · Powered by jalajogja
      </footer>
    </div>
  );
}
