import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DokumenVersionHistory } from "@/components/dokumen/dokumen-version-history";
import { DokumenPdfViewer } from "@/components/dokumen/dokumen-pdf-viewer";
import {
  ChevronLeft, Pencil, FileText, Globe, Lock, FileDown, Tag, FolderOpen,
} from "lucide-react";

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function mimeLabel(mime: string | null) {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("openxmlformats")) return "DOCX";
  return mime.split("/")[1]?.toUpperCase() ?? "—";
}

export default async function DokumenDetail({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: docId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Fetch dokumen
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, docId))
    .limit(1);

  if (!doc) notFound();

  // Fetch kategori
  const [category] = doc.categoryId
    ? await db
        .select({ name: schema.documentCategories.name })
        .from(schema.documentCategories)
        .where(eq(schema.documentCategories.id, doc.categoryId))
        .limit(1)
    : [null];

  // Fetch semua versi (terbaru dulu)
  const allVersions = await db
    .select({
      id:            schema.documentVersions.id,
      versionNumber: schema.documentVersions.versionNumber,
      fileName:      schema.documentVersions.fileName,
      fileSize:      schema.documentVersions.fileSize,
      mimeType:      schema.documentVersions.mimeType,
      notes:         schema.documentVersions.notes,
      uploadedBy:    schema.documentVersions.uploadedBy,
      createdAt:     schema.documentVersions.createdAt,
    })
    .from(schema.documentVersions)
    .where(eq(schema.documentVersions.documentId, docId))
    .orderBy(desc(schema.documentVersions.versionNumber));

  // Cari versi aktif
  const currentVersion = allVersions.find((v) => v.id === doc.currentVersionId)
    ?? allVersions[0]
    ?? null;

  const isPdf = currentVersion?.mimeType?.includes("pdf") ?? false;

  const versionsForUI = allVersions.map((v) => ({
    ...v,
    uploaderName: null as string | null, // TODO: join ke public.user via betterAuthUserId
    isCurrent:    v.id === doc.currentVersionId,
  }));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Link
            href={`/${slug}/dokumen/semua`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Semua Dokumen
          </Link>
          <h1 className="text-xl font-semibold leading-tight">{doc.title}</h1>
          <div className="flex items-center gap-2">
            {doc.visibility === "public" ? (
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" /> Publik
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Internal
              </Badge>
            )}
            {currentVersion && (
              <span className="text-xs text-muted-foreground">v{currentVersion.versionNumber}</span>
            )}
          </div>
        </div>
        <Link href={`/${slug}/dokumen/${docId}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Info + Aksi file */}
      {currentVersion ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="h-10 w-10 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{currentVersion.fileName}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                <span>{mimeLabel(currentVersion.mimeType)}</span>
                <span>{formatBytes(currentVersion.fileSize)}</span>
                <span>Diperbarui {formatDate(doc.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isPdf && (
              <DokumenPdfViewer
                slug={slug}
                documentId={docId}
                fileName={currentVersion.fileName}
              />
            )}
            <a
              href={`/api/documents/${docId}/file?slug=${slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant={isPdf ? "ghost" : "outline"}>
                <FileDown className="h-4 w-4 mr-1.5" />
                Download
              </Button>
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada file yang diunggah.
        </div>
      )}

      {/* Deskripsi */}
      {doc.description && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deskripsi</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{doc.description}</p>
        </div>
      )}

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
      </div>

      {/* Riwayat Versi */}
      <DokumenVersionHistory
        slug={slug}
        documentId={docId}
        versions={versionsForUI}
      />
    </div>
  );
}
